"""
Weather providers. Each answers a batch of points:
forecast_many([(lat, lon, hours_from_departure, valid_time), ...])
  -> [{wind_gust_mph, rain_in_hr, snow_in_hr}, ...]

- SyntheticWeatherProvider: Python port of src/domain/weather.js `wx()` (keyless
  stand-in; also used for the heatmap grid).
- OpenMeteoWeatherProvider: real forecasts from Open-Meteo (keyless for
  non-commercial use), batched — one request covers many checkpoints.

Swap via settings.WEATHER_PROVIDER ("synthetic" | "open_meteo").
"""

import math
from datetime import timedelta, timezone

import requests
from django.conf import settings

from .geo import COS, jround


class SyntheticWeatherProvider:
    I = 1.0
    SPREAD = 1.0

    def forecast(self, lat, lon, t):
        I, spread = self.I, self.SPREAD
        c1 = (39.0 + 0.15 * t, -100.5 + 0.22 * t)
        s1 = 1.6 * spread
        g1 = math.exp(-((lat - c1[0]) ** 2 + ((lon - c1[1]) * COS) ** 2) / (2 * s1 * s1))
        c2 = (35.2 + 0.15 * t, -94.6 + 0.2 * t)
        s2 = 1.3 * spread
        g2 = math.exp(-((lat - c2[0]) ** 2 + ((lon - c2[1]) * COS) ** 2) / (2 * s2 * s2))
        n = math.sin(lat * 2.1 + lon * 1.7 + t * 0.3) * 0.5 + 0.5
        cold = lat > 40.2
        return {
            "wind_gust_mph": jround(8 + 4 * n + I * (50 * g1 + 20 * g2)),
            "rain_in_hr": jround(((0 if cold else I * 1.1 * g1) + I * 0.5 * g2) * 100) / 100,
            "snow_in_hr": jround((I * 3.3 * g1 if cold else 0) * 10) / 10,
        }

    def forecast_many(self, points):
        return [self.forecast(lat, lon, t) for (lat, lon, t, _valid) in points]

    def forecast_grid(self, cells, departure, hours):
        # cells = [(lat, lon), ...]; hours = [0, 1, ...] offsets from departure.
        return [[self.forecast(lat, lon, h) for h in hours] for (lat, lon) in cells]


def _hour_index(times, valid_time):
    """Index of the hour matching valid_time in Open-Meteo's `time` array.
    Times are ISO 'YYYY-MM-DDTHH:00' (UTC); lexicographic compare == chronological."""
    target = valid_time.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00")
    if target in times:
        return times.index(target)
    if not times or target < times[0]:
        return 0
    return len(times) - 1


class OpenMeteoWeatherProvider:
    URL = "https://api.open-meteo.com/v1/forecast"

    def _fetch(self, coords):
        """One batched request -> the `hourly` block for each (lat, lon)."""
        params = {
            "latitude": ",".join(f"{lat:.4f}" for lat, lon in coords),
            "longitude": ",".join(f"{lon:.4f}" for lat, lon in coords),
            "hourly": "wind_gusts_10m,rain,snowfall",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",  # rain -> in/hr; snowfall -> in/hr
            "timezone": "UTC",
            "forecast_days": 3,  # covers departure + 48 h horizon
        }
        resp = requests.get(self.URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # One location -> dict; several -> list (comma-separated coords).
        locs = data if isinstance(data, list) else [data]
        return [(locs[i] if i < len(locs) else locs[0])["hourly"] for i in range(len(coords))]

    @staticmethod
    def _at(hourly, idx):
        return {
            "wind_gust_mph": jround(hourly["wind_gusts_10m"][idx] or 0),
            "rain_in_hr": round((hourly["rain"][idx] or 0), 2),
            "snow_in_hr": round((hourly["snowfall"][idx] or 0), 1),
        }

    def forecast_many(self, points):
        # points = [(lat, lon, t_hours, valid_time), ...] — one hour per point.
        if not points:
            return []
        hourlies = self._fetch([(p[0], p[1]) for p in points])
        return [self._at(h, _hour_index(h["time"], p[3])) for h, p in zip(hourlies, points)]

    def forecast_grid(self, cells, departure, hours):
        # cells = [(lat, lon), ...]; hours = [0, 1, ...] offsets. One call, full series.
        if not cells:
            return []
        hourlies = self._fetch(cells)
        out = []
        for hourly in hourlies:
            times = hourly["time"]
            out.append([self._at(hourly, _hour_index(times, departure + timedelta(hours=h))) for h in hours])
        return out


def get_weather_provider():
    which = getattr(settings, "WEATHER_PROVIDER", "synthetic")
    if which == "synthetic":
        return SyntheticWeatherProvider()
    if which == "open_meteo":
        return OpenMeteoWeatherProvider()
    raise NotImplementedError(f"WEATHER_PROVIDER='{which}' not implemented yet")
