"""
Weather providers. A provider answers: "what's the weather at (lat, lon),
`t` hours after departure?" -> {wind_gust_mph, rain_in_hr, snow_in_hr}.

SyntheticWeatherProvider is a Python port of src/domain/weather.js `wx()` — the
keyless stand-in. A real provider (NOAA/NWS) will implement the same `forecast`
method later; swap via settings.WEATHER_PROVIDER.
"""

import math

from django.conf import settings

from .geo import COS, jround


class SyntheticWeatherProvider:
    # Default intensity/spread (the frontend's "results" mode).
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


def get_weather_provider():
    which = getattr(settings, "WEATHER_PROVIDER", "synthetic")
    if which == "synthetic":
        return SyntheticWeatherProvider()
    # e.g. "noaa" -> NoaaWeatherProvider() (same .forecast interface)
    raise NotImplementedError(f"WEATHER_PROVIDER='{which}' not implemented yet")
