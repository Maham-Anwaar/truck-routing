"""
Routing providers. A provider answers: "what candidate routes connect origin
and destination?" -> list of {id, name, speed_mph, geometry:[[lat,lon], ...]}.
It supplies geometry + speed only; the planner samples/scores/ranks.

SyntheticRoutingProvider is a Python port of src/domain/routes.js `routeDefs`.
A real provider (OpenRouteService) will implement the same `routes` method
later; swap via settings.ROUTING_PROVIDER.
"""

import math

import requests
from django.conf import settings

from .geo import DALLAS, MINNEAPOLIS, near


class NoRouteError(Exception):
    """No drivable route exists between the two points (-> HTTP 404)."""

# Hand-authored demo corridor Dallas <-> Minneapolis (ported from DM in routes.js).
_DM = {
    "A": {"name": "via I-35 N", "speed_mph": 61, "pts": [[32.78, -96.8], [33.66, -97.14], [35.47, -97.52], [36.7, -97.3], [37.69, -97.34], [38.4, -96.2], [39.1, -94.58], [40.3, -94.0], [41.59, -93.62], [43.2, -93.35], [44.98, -93.27]]},
    "B": {"name": "via US-81 & I-29", "speed_mph": 59, "pts": [[32.78, -96.8], [33.91, -98.49], [35.0, -97.95], [36.4, -97.88], [37.7, -97.75], [38.84, -97.61], [40.0, -97.1], [40.81, -96.7], [41.26, -95.94], [42.5, -96.4], [43.55, -96.73], [44.3, -95.2], [44.98, -93.27]]},
    "C": {"name": "via I-44 & US-63", "speed_mph": 56, "pts": [[32.78, -96.8], [34.4, -96.3], [36.15, -95.99], [37.08, -94.51], [37.8, -93.9], [38.7, -93.23], [40.19, -92.58], [41.02, -92.41], [42.49, -92.34], [44.02, -92.46], [44.98, -93.27]]},
}


class SyntheticRoutingProvider:
    def routes(self, origin, dest):
        o = (origin["lat"], origin["lon"])
        d = (dest["lat"], dest["lon"])

        # Use the hand-authored corridor for the Dallas <-> Minneapolis demo.
        if near(o, DALLAS) and near(d, MINNEAPOLIS):
            return [{"id": k, **{x: v[x] for x in ("name", "speed_mph")}, "geometry": [p[:] for p in v["pts"]]} for k, v in _DM.items()]
        if near(o, MINNEAPOLIS) and near(d, DALLAS):
            return [{"id": k, **{x: v[x] for x in ("name", "speed_mph")}, "geometry": list(reversed([p[:] for p in v["pts"]]))} for k, v in _DM.items()]

        # Otherwise synthesize a direct corridor + two offset alternates.
        dy, dx = d[0] - o[0], d[1] - o[1]
        ln = math.hypot(dx, dy) or 1e-9
        px, py = -dx / ln, dy / ln

        def mk(off, off2):
            return [
                [o[0], o[1]],
                [o[0] + dy * 0.33 + px * off * ln, o[1] + dx * 0.33 + py * off * ln],
                [o[0] + dy * 0.66 + px * off2 * ln, o[1] + dx * 0.66 + py * off2 * ln],
                [d[0], d[1]],
            ]

        return [
            {"id": "A", "name": "Direct corridor", "speed_mph": 61, "geometry": mk(0.03, -0.02)},
            {"id": "B", "name": "Western alternate", "speed_mph": 58, "geometry": mk(0.17, 0.12)},
            {"id": "C", "name": "Eastern alternate", "speed_mph": 56, "geometry": mk(-0.15, -0.12)},
        ]


class OrsRoutingProvider:
    """Real routing via OpenRouteService (truck/HGV profile), free tier."""

    URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"
    _IDS = "ABC"

    def __init__(self, api_key):
        self.key = api_key

    def routes(self, origin, dest):
        body = {
            # ORS uses [lon, lat] order.
            "coordinates": [[origin["lon"], origin["lat"]], [dest["lon"], dest["lat"]]],
            "alternative_routes": {"target_count": 3, "weight_factor": 1.6, "share_factor": 0.6},
            "instructions": False,
        }
        try:
            resp = requests.post(
                self.URL,
                json=body,
                headers={"Authorization": self.key, "Content-Type": "application/json"},
                timeout=20,
            )
        except requests.RequestException as e:  # network/timeout
            raise RuntimeError(f"ORS request failed: {e}")
        if resp.status_code == 404:
            raise NoRouteError()
        resp.raise_for_status()

        features = resp.json().get("features", [])
        if not features:
            raise NoRouteError()

        out = []
        for idx, f in enumerate(features[:3]):
            rid = self._IDS[idx]
            # ORS geometry is [lon, lat]; the app uses [lat, lon].
            geometry = [[c[1], c[0]] for c in f["geometry"]["coordinates"]]
            summary = f["properties"]["summary"]
            dist_mi = summary["distance"] / 1609.344
            dur_hr = summary["duration"] / 3600
            speed = round(dist_mi / dur_hr, 1) if dur_hr else 55
            out.append({"id": rid, "name": f"Route {rid}", "speed_mph": speed, "geometry": geometry})
        return out


def get_routing_provider():
    which = getattr(settings, "ROUTING_PROVIDER", "synthetic")
    if which == "synthetic":
        return SyntheticRoutingProvider()
    if which == "ors":
        key = getattr(settings, "ORS_API_KEY", "")
        if not key:
            raise RuntimeError("ROUTING_PROVIDER='ors' but ORS_API_KEY is not set")
        return OrsRoutingProvider(key)
    raise NotImplementedError(f"ROUTING_PROVIDER='{which}' not implemented yet")
