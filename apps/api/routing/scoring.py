"""
Risk scoring — Python port of apps/web/src/domain/weather.js `risk()`.

Classifies wind/rain/snow into a 0-4 risk level, applying the load-weight
escalation rules. This is the single source of truth the route checkpoints
and the heatmap grid both use (see docs/API.md sections 5 and 8.1).
"""

LEVEL_NAMES = ["low", "moderate", "high", "severe", "no_travel"]


def wind_level(mph):
    return 0 if mph < 25 else 1 if mph < 35 else 2 if mph < 45 else 3 if mph < 55 else 4


def rain_level(in_hr):
    return 0 if in_hr < 0.10 else 1 if in_hr < 0.25 else 2 if in_hr < 0.5 else 3 if in_hr <= 1 else 4


def snow_level(in_hr):
    return 0 if in_hr < 0.5 else 1 if in_hr < 1 else 2 if in_hr < 2 else 3 if in_hr <= 3 else 4


def classify(wind_mph, rain_in_hr, snow_in_hr, load_lb):
    """Return {level, level_index, driver, escalation_rule}."""
    wl = wind_level(wind_mph)
    rl = rain_level(rain_in_hr)
    sl = snow_level(snow_in_hr)

    w2, rule = wl, None
    if wl == 3 and load_lb > 30000:
        w2, rule = 4, "Raised to No Travel: 45 to 54 mph wind with over 30,000 lb."
    elif wl == 2 and load_lb > 40000:
        w2, rule = 3, "Raised to Severe: 35 to 44 mph wind with over 40,000 lb."

    lv = max(w2, rl, sl)
    driver = None if lv == 0 else ("wind" if w2 == lv else "rain" if rl == lv else "snow")
    return {
        "level_index": lv,
        "level": LEVEL_NAMES[lv],
        "driver": driver,
        # escalation_rule only surfaces when wind actually drove the level
        "escalation_rule": rule if driver == "wind" else None,
    }


# Threshold table for GET /api/config/risk-levels (upper bounds; None = open-ended).
LEVELS_CONFIG = [
    {"level": "low", "level_index": 0, "wind_mph_max": 25, "rain_in_hr_max": 0.10, "snow_in_hr_max": 0.5},
    {"level": "moderate", "level_index": 1, "wind_mph_max": 35, "rain_in_hr_max": 0.25, "snow_in_hr_max": 1.0},
    {"level": "high", "level_index": 2, "wind_mph_max": 45, "rain_in_hr_max": 0.50, "snow_in_hr_max": 2.0},
    {"level": "severe", "level_index": 3, "wind_mph_max": 55, "rain_in_hr_max": 1.00, "snow_in_hr_max": 3.0},
    {"level": "no_travel", "level_index": 4, "wind_mph_max": None, "rain_in_hr_max": None, "snow_in_hr_max": None},
]
