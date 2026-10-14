"""
Weather-risk grid for the heatmap (POST /weather/field, docs/API.md 3.4).

Returns a risk-level grid per forecast hour over a bbox. The backend does the
classification (Option A); the frontend masks it to the route corridor, colors,
and blurs. Uses the same weather provider + scoring as /routes/plan.
"""

import math
from datetime import timedelta

from .. import scoring
from .geo import DEMO_NOW, iso_utc
from .weather import get_weather_provider


def build_field(bbox, departure, from_hour, to_hour, resolution, load):
    weather = get_weather_provider()
    south, west = bbox["south"], bbox["west"]
    north, east = bbox["north"], bbox["east"]
    st = resolution
    cols = max(1, round((east - west) / st))
    rows = max(1, round((north - south) / st))

    # Only return frames within the 48 h forecast horizon.
    horizon = 48 - (departure - DEMO_NOW).total_seconds() / 3600
    last = min(to_hour, math.floor(horizon))

    frames = []
    for h in range(from_hour, last + 1):
        matrix = []
        for j in range(rows):
            la = north - (j + 0.5) * st
            row = []
            for i in range(cols):
                lo = west + (i + 0.5) * st
                w = weather.forecast(la, lo, h)
                row.append(scoring.classify(w["wind_gust_mph"], w["rain_in_hr"], w["snow_in_hr"], load)["level_index"])
            matrix.append(row)
        frames.append({"hour": h, "valid_utc": iso_utc(departure + timedelta(hours=h)), "risk": matrix})

    return {
        "bbox": bbox,
        "resolution_deg": st,
        "rows": rows,
        "cols": cols,
        "row_order": "north_to_south",
        "col_order": "west_to_east",
        "departure_utc": iso_utc(departure),
        "frames": frames,
    }
