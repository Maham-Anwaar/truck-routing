"""Shared geo helpers — Python port of apps/web/src/domain (geo/constants)."""

import math
from datetime import datetime, timezone


def iso_utc(dt):
    """Format an instant as ISO-8601 UTC with a Z suffix."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

# Longitude scaling at the map's reference latitude (~38.9N): weights a degree
# of longitude like a degree of latitude in the synthetic field + distances.
COS = math.cos(math.radians(38.9))

# Synthetic reference "now" — matches the frontend demo so sample trips are
# deterministic and the default departure stays valid. Real weather later uses
# the actual current time instead.
DEMO_NOW = datetime(2026, 10, 14, 14, 47, tzinfo=timezone.utc)

# Known endpoints of the hand-authored demo corridor (coords, not labels).
DALLAS = (32.78, -96.80)
MINNEAPOLIS = (44.98, -93.27)


def jround(x):
    """Round half-up, matching JavaScript's Math.round (not banker's rounding)."""
    return math.floor(x + 0.5)


def haversine_mi(a, b):
    """Great-circle distance in miles between [lat, lon] points."""
    R = 3958.8
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def near(a, b, eps=0.05):
    return abs(a[0] - b[0]) < eps and abs(a[1] - b[1]) < eps
