import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from . import scoring, views
from .services.route_source import NoRouteError, OrsRoutingProvider

_factory = APIRequestFactory()


def _get(view, path, params=None):
    """Call a DRF view directly (no test client -> no contrib.auth dependency)."""
    response = view(_factory.get(path, params or {}))
    response.render()
    return response.status_code, json.loads(response.content)


class ScoringTests(SimpleTestCase):
    def test_worst_of_factors(self):
        self.assertEqual(scoring.classify(10, 0, 0, 0)["level"], "low")
        self.assertEqual(scoring.classify(60, 0, 0, 0)["level"], "no_travel")
        self.assertEqual(scoring.classify(0, 0.3, 0, 0)["driver"], "rain")

    def test_load_escalation(self):
        # 45-54 mph wind + >30,000 lb -> No Travel
        self.assertEqual(scoring.classify(48, 0, 0, 35000)["level"], "no_travel")
        # same wind, light load -> Severe
        self.assertEqual(scoring.classify(48, 0, 0, 1000)["level"], "severe")
        # 35-44 mph wind + >40,000 lb -> Severe, with a rule string
        r = scoring.classify(40, 0, 0, 45000)
        self.assertEqual(r["level"], "severe")
        self.assertIsNotNone(r["escalation_rule"])


class PlacesEndpointTests(SimpleTestCase):
    def test_search_matches_label(self):
        status, body = _get(views.PlacesView.as_view(), "/api/places", {"q": "denver"})
        self.assertEqual(status, 200)
        self.assertIn("Denver, CO", [p["label"] for p in body["places"]])

    def test_short_query_is_empty(self):
        _, body = _get(views.PlacesView.as_view(), "/api/places", {"q": "de"})
        self.assertEqual(body["places"], [])

    def test_no_query_returns_full_list(self):
        _, body = _get(views.PlacesView.as_view(), "/api/places")
        labels = [p["label"] for p in body["places"]]
        # superset: state capitals + the demo cities the web app needs
        self.assertGreaterEqual(len(labels), 60)
        for need in ("Dallas, TX", "Minneapolis, MN", "Saint Paul, MN"):
            self.assertIn(need, labels)


class ConfigEndpointTests(SimpleTestCase):
    def test_risk_levels(self):
        status, body = _get(views.RiskLevelsView.as_view(), "/api/config/risk-levels")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["levels"]), 5)
        # camelCase renderer should expose levelIndex
        self.assertEqual(body["levels"][0]["levelIndex"], 0)


class HealthEndpointTests(SimpleTestCase):
    def test_health(self):
        _, body = _get(views.HealthView.as_view(), "/api/health")
        self.assertEqual(body, {"status": "ok"})


DM_TRIP = {
    "origin": {"lat": 32.78, "lon": -96.80},
    "destination": {"lat": 44.98, "lon": -93.27},
    "departureUtc": "2026-10-15T06:00:00Z",
    "loadLb": 42000,
    "checkpointSpacingMi": 25,
}


def _post(view, path, body):
    response = view(_factory.post(path, body, format="json"))
    response.render()
    return response.status_code, json.loads(response.content)


class PlanEndpointTests(SimpleTestCase):
    def test_dallas_to_minneapolis_parity(self):
        status, body = _post(views.PlanView.as_view(), "/api/routes/plan", DM_TRIP)
        self.assertEqual(status, 200)
        # Matches the frontend: 3 routes, A recommended with 0 severe miles.
        self.assertEqual(len(body["routes"]), 3)
        self.assertEqual(body["recommendedRouteId"], "A")
        a = next(r for r in body["routes"] if r["id"] == "A")
        self.assertEqual(a["summary"]["severeMi"], 0)
        self.assertEqual(a["summary"]["highMi"], 150)
        self.assertGreater(len(a["checkpoints"]), 10)
        # camelCase + UTC checks
        self.assertTrue(body["departureUtc"].endswith("Z"))
        self.assertIn("windGustMph", a["checkpoints"][0]["weather"])

    def test_rejects_out_of_range_departure(self):
        bad = {**DM_TRIP, "departureUtc": "2026-10-20T06:00:00Z"}
        status, _ = _post(views.PlanView.as_view(), "/api/routes/plan", bad)
        self.assertEqual(status, 400)

    def test_rejects_same_origin_destination(self):
        bad = {**DM_TRIP, "destination": DM_TRIP["origin"]}
        status, _ = _post(views.PlanView.as_view(), "/api/routes/plan", bad)
        self.assertEqual(status, 400)


class WeatherFieldTests(SimpleTestCase):
    FIELD_REQ = {
        "bbox": {"south": 38.0, "west": -98.0, "north": 42.0, "east": -94.0},
        "departureUtc": "2026-10-15T06:00:00Z",
        "fromHour": 0,
        "toHour": 3,
        "resolutionDeg": 0.5,
        "loadLb": 42000,
    }

    def test_grid_shape_and_values(self):
        status, body = _post(views.WeatherFieldView.as_view(), "/api/weather/field", self.FIELD_REQ)
        self.assertEqual(status, 200)
        self.assertEqual(body["rows"], 8)  # (42-38)/0.5
        self.assertEqual(body["cols"], 8)  # (-94 - -98)/0.5
        self.assertEqual(len(body["frames"]), 4)  # hours 0..3
        frame = body["frames"][0]
        self.assertEqual(len(frame["risk"]), 8)
        self.assertEqual(len(frame["risk"][0]), 8)
        self.assertTrue(all(0 <= v <= 4 for row in frame["risk"] for v in row))
        self.assertTrue(frame["validUtc"].endswith("Z"))

    def test_trims_frames_beyond_horizon(self):
        # Departure late enough that only a few hours fit in the 48 h window.
        req = {**self.FIELD_REQ, "departureUtc": "2026-10-16T10:00:00Z", "toHour": 48}
        _, body = _post(views.WeatherFieldView.as_view(), "/api/weather/field", req)
        self.assertLess(len(body["frames"]), 10)


class OrsProviderTests(SimpleTestCase):
    @patch("routing.services.route_source.requests.post")
    def test_maps_ors_response(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "features": [
                    {
                        "geometry": {"coordinates": [[-96.80, 32.78], [-95.0, 39.0], [-93.27, 44.98]]},
                        "properties": {"summary": {"distance": 1_617_000, "duration": 59_000}},
                    }
                ]
            },
        )
        routes = OrsRoutingProvider("fake-key").routes({"lat": 32.78, "lon": -96.80}, {"lat": 44.98, "lon": -93.27})
        self.assertEqual(len(routes), 1)
        r = routes[0]
        self.assertEqual(r["id"], "A")
        self.assertEqual(r["geometry"][0], [32.78, -96.80])  # [lon,lat] -> [lat,lon]
        self.assertGreater(r["speed_mph"], 50)  # ~1004 mi / 16.4 h

    @patch("routing.services.route_source.requests.post")
    def test_no_features_raises_no_route(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"features": []})
        with self.assertRaises(NoRouteError):
            OrsRoutingProvider("fake-key").routes({"lat": 1, "lon": 1}, {"lat": 2, "lon": 2})


class OpenMeteoProviderTests(SimpleTestCase):
    @patch("routing.services.weather.requests.get")
    def test_batches_and_maps(self, mock_get):
        from datetime import datetime, timezone

        from .services.weather import OpenMeteoWeatherProvider

        # Two locations -> Open-Meteo returns a list, each with its own hourly series.
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: [
                {"hourly": {"time": ["2026-10-15T06:00", "2026-10-15T07:00"], "wind_gusts_10m": [40, 10], "rain": [0.2, 0.0], "snowfall": [0.0, 0.0]}},
                {"hourly": {"time": ["2026-10-15T06:00", "2026-10-15T07:00"], "wind_gusts_10m": [12, 12], "rain": [0.0, 0.0], "snowfall": [0.3, 0.0]}},
            ],
        )
        vt = datetime(2026, 10, 15, 6, 0, tzinfo=timezone.utc)
        out = OpenMeteoWeatherProvider().forecast_many([(39.0, -94.0, 0.0, vt), (44.0, -93.0, 1.0, vt)])
        self.assertEqual(out[0], {"wind_gust_mph": 40, "rain_in_hr": 0.2, "snow_in_hr": 0.0})
        self.assertEqual(out[1], {"wind_gust_mph": 12, "rain_in_hr": 0.0, "snow_in_hr": 0.3})
        # one batched request, not one per point
        self.assertEqual(mock_get.call_count, 1)

    def test_empty_points(self):
        from .services.weather import OpenMeteoWeatherProvider

        self.assertEqual(OpenMeteoWeatherProvider().forecast_many([]), [])
