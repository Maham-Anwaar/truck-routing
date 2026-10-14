"""Place lookup backed by the static data/places.json (no geocoding service)."""

import json
from functools import lru_cache
from pathlib import Path

# routing/services/places.py -> apps/api/data/places.json
_DATA = Path(__file__).resolve().parents[2] / "data" / "places.json"


@lru_cache(maxsize=1)
def _all():
    return json.loads(_DATA.read_text())["places"]


def all_places():
    """The full list — used by the frontend to bootstrap its place cache."""
    return _all()


def search(q, limit=8):
    """Autocomplete: case-insensitive label match; empty for queries under 3 chars."""
    q = (q or "").strip().lower()
    if len(q) < 3:
        return []
    return [p for p in _all() if q in p["label"].lower()][:limit]
