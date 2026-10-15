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
from datetime import timezone

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

    def forecast_many(self, points):
        if not points:
            return []
        params = {
            "latitude": ",".join(f"{p[0]:.4f}" for p in points),
            "longitude": ",".join(f"{p[1]:.4f}" for p in points),
            "hourly": "wind_gusts_10m,rain,snowfall",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",  # rain -> in/hr; snowfall -> in/hr
            "timezone": "UTC",
            "forecast_days": 3,  # covers departure + 48 h horizon
        }
        resp = requests.get(self.URL, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        # One location -> dict; several -> list (comma-separated coords).
        locs = data if isinstance(data, list) else [data]

        out = []
        for i, p in enumerate(points):
            hourly = (locs[i] if i < len(locs) else locs[0])["hourly"]
            idx = _hour_index(hourly["time"], p[3])
            out.append(
                {
                    "wind_gust_mph": jround(hourly["wind_gusts_10m"][idx] or 0),
                    "rain_in_hr": round((hourly["rain"][idx] or 0), 2),
                    "snow_in_hr": round((hourly["snowfall"][idx] or 0), 1),
                }
            )
        return out


def get_weather_provider():
    which = getattr(settings, "WEATHER_PROVIDER", "synthetic")
    if which == "synthetic":
        return SyntheticWeatherProvider()
    if which == "open_meteo":
        return OpenMeteoWeatherProvider()
    raise NotImplementedError(f"WEATHER_PROVIDER='{which}' not implemented yet")
