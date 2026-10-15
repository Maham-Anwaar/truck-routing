"""
Weather-risk grid for the heatmap (POST /weather/field, docs/API.md 3.4).

Returns a risk-level grid per forecast hour over a bbox, using the same weather
provider + scoring as /routes/plan — so with WEATHER_PROVIDER=open_meteo the
heatmap is REAL. The grid is coarsened so the whole thing fits in one batched
provider call (Open-Meteo returns each cell's full hourly series in that call);
the frontend upscales + blurs it, so coarse-but-real looks smooth.

The backend classifies (Option A); the frontend masks to the corridor + colors.
"""

import math
from datetime import timedelta

from .. import scoring
from .geo import iso_utc, now_utc
from .weather import get_weather_provider

# Cap the grid so one batched weather request (and its URL) stays within limits.
MAX_CELLS = 240


def build_field(bbox, departure, from_hour, to_hour, resolution, load):
    weather = get_weather_provider()
    south, west = bbox["south"], bbox["west"]
    north, east = bbox["north"], bbox["east"]

    st = resolution
    cols = max(1, round((east - west) / st))
    rows = max(1, round((north - south) / st))
    # Coarsen (keep the aspect ratio) until the grid fits one batched call.
    if rows * cols > MAX_CELLS:
        st *= math.sqrt(rows * cols / MAX_CELLS)
        cols = max(1, round((east - west) / st))
        rows = max(1, round((north - south) / st))

    # Only return frames within the 48 h forecast horizon.
    horizon = 48 - (departure - now_utc()).total_seconds() / 3600
    hours = list(range(from_hour, min(to_hour, math.floor(horizon)) + 1))

    # Cell centers (row 0 = northmost, col 0 = westmost), one batched forecast.
    cells = [(north - (j + 0.5) * st, west + (i + 0.5) * st) for j in range(rows) for i in range(cols)]
    series = weather.forecast_grid(cells, departure, hours)  # [cell][hourIndex] -> weather

    frames = []
    for hi, h in enumerate(hours):
        matrix = []
        for j in range(rows):
            row = []
            for i in range(cols):
                w = series[j * cols + i][hi]
                row.append(scoring.classify(w["wind_gust_mph"], w["rain_in_hr"], w["snow_in_hr"], load)["level_index"])
            matrix.append(row)
        frames.append({"hour": h, "valid_utc": iso_utc(departure + timedelta(hours=h)), "risk": matrix})

    return {
        "bbox": bbox,
        "resolution_deg": round(st, 4),
        "rows": rows,
        "cols": cols,
        "row_order": "north_to_south",
        "col_order": "west_to_east",
        "departure_utc": iso_utc(departure),
        "frames": frames,
    }
