"""
Route planning orchestration — Python port of buildRoute() + rank() from
src/domain/routes.js. Pulls candidate geometry from the routing provider,
samples checkpoints, scores each against the weather provider at its ETA,
summarises and ranks, and shapes the /routes/plan response (docs/API.md).
"""

import math
from datetime import timedelta, timezone

from .. import scoring
from .geo import DEMO_NOW, haversine_mi, jround
from .route_source import get_routing_provider
from .weather import get_weather_provider

LEVEL_NAMES = scoring.LEVEL_NAMES
RULE_SLUGS = ["fewest_severe_miles", "fewest_high_miles", "lowest_average_risk", "shortest_time"]


def _iso(dt):
    # Always serialize in UTC, regardless of the datetime's own tzinfo.
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _dur(h):
    """Hours -> '3 h 45 min' (rounded to 5-min steps). Port of dur()."""
    H = math.floor(h)
    M = jround((h - H) * 60 / 5) * 5
    if M == 60:
        H, M = H + 1, 0
    if H:
        return f"{H} h" + (f" {M} min" if M else "")
    return f"{M} min"


def _sample_route(rd, spacing, horizon, departure):
    """Positions, ETAs, and status for each checkpoint — no weather yet."""
    pts = rd["geometry"]
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + haversine_mi(pts[i - 1], pts[i]) * 1.07)
    total = cum[-1]
    speed = rd["speed_mph"]

    def at(m):
        for i in range(1, len(cum)):
            if m <= cum[i]:
                f = (m - cum[i - 1]) / ((cum[i] - cum[i - 1]) or 1)
                return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
                        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]
        return pts[-1][:]

    ms, m = [], 0.0
    while m < total - spacing * 0.4:
        ms.append(m)
        m += spacing
    ms.append(total)

    raw = []
    for i, m in enumerate(ms):
        eta = m / speed
        raw.append({"i": i, "m": m, "ll": at(m), "eta": eta, "status": "ok" if eta <= horizon else "beyond_forecast"})
    return {"rd": rd, "pts": pts, "total": total, "speed": speed, "raw": raw, "departure": departure}


def _finalize_route(sk):
    """Build checkpoint records + summary once weather/risk are on the raw cps."""
    rd, pts, total, speed, raw, departure = (
        sk["rd"], sk["pts"], sk["total"], sk["speed"], sk["raw"], sk["departure"]
    )
    cps, internal = [], []
    for r in raw:
        if r["status"] == "ok":
            w = r["weather"]
            weather_out = {"wind_gust_mph": w["wind_gust_mph"], "rain_in_hr": w["rain_in_hr"], "snow_in_hr": w["snow_in_hr"]}
            risk = r["risk"]
        else:
            weather_out = None
            risk = {"level_index": -1, "level": None, "driver": None, "escalation_rule": None}
        cps.append({
            "index": r["i"],
            "mile_marker": jround(r["m"]),
            "coord": {"lat": round(r["ll"][0], 4), "lon": round(r["ll"][1], 4)},
            "eta_utc": _iso(departure + timedelta(hours=r["eta"])),
            "status": r["status"],
            "weather": weather_out,
            "risk": {
                "level": risk["level"],
                "level_index": risk["level_index"] if risk["level_index"] >= 0 else None,
                "driver": risk["driver"],
                "escalation_rule": risk["escalation_rule"],
            },
        })
        internal.append({"lv": risk["level_index"], "m": r["m"]})

    # Segment mileage by risk level (max of the two bounding checkpoints).
    level_mi, gray_mi = [0.0] * 5, 0.0
    for i in range(len(internal) - 1):
        c, nxt = internal[i], internal[i + 1]
        lvs = [x for x in (c["lv"], nxt["lv"]) if x >= 0]
        seg_lv = max(lvs) if lvs else -1
        seg_mi = nxt["m"] - c["m"]
        if seg_lv >= 0:
            level_mi[seg_lv] += seg_mi
        else:
            gray_mi += seg_mi

    valid = [x for x in internal if x["lv"] >= 0]
    avg = sum(x["lv"] + 1 for x in valid) / len(valid) if valid else 0
    sev = jround(level_mi[3] + level_mi[4])
    high = jround(level_mi[2])
    avg_r = round(avg, 1)
    max_lv = max((x["lv"] for x in valid), default=-1)
    hours = total / speed

    return {
        "id": rd["id"],
        "name": rd["name"],
        "distance_mi": jround(total),
        "duration_hr": round(hours, 2),
        "avg_speed_mph": speed,
        "geometry": [[round(p[0], 4), round(p[1], 4)] for p in pts],
        "summary": {
            "severe_mi": sev,
            "high_mi": high,
            "avg_risk": avg_r,
            "max_risk_level": LEVEL_NAMES[max_lv] if max_lv >= 0 else None,
            "risk_breakdown_mi": {
                "low": jround(level_mi[0]),
                "moderate": jround(level_mi[1]),
                "high": jround(level_mi[2]),
                "severe": jround(level_mi[3]),
                "no_travel": jround(level_mi[4]),
                "no_data": jround(gray_mi),
            },
        },
        "checkpoints": cps,
        # internal, stripped before serialising
        "_rank": {"sev": sev, "high": high, "avg": avg_r, "hours": hours, "max_lv": max_lv},
    }


def _rank(routes):
    ranked = sorted(routes, key=lambda r: (r["_rank"]["sev"], r["_rank"]["high"], r["_rank"]["avg"], r["_rank"]["hours"]))
    w = ranked[0]
    r = ranked[1] if len(ranked) > 1 else None
    wk = w["_rank"]
    rk = r["_rank"] if r else None
    fastest = min(x["_rank"]["hours"] for x in routes)
    all_low = all(x["_rank"]["max_lv"] <= 0 for x in routes)

    rule = None if not r else 0 if wk["sev"] != rk["sev"] else 1 if wk["high"] != rk["high"] else 2 if wk["avg"] != rk["avg"] else 3
    dt = wk["hours"] - fastest
    time_txt = ("Also the fastest." if len(ranked) > 1 else "") if dt < 1 / 60 else f"{_dur(dt)} longer than the fastest."

    if all_low:
        reason = "Low risk on all routes, fastest chosen."
        sentence = f"Every route stays Low the whole way, so rule 4 decides: {w['id']} is the fastest."
    elif not r:
        reason = f"{wk['sev']} severe miles. Only option found."
        sentence = f"{w['id']} is the only route returned for this trip."
    elif rule == 0:
        reason = f"{wk['sev']} severe miles, vs {rk['sev']} on {r['id']}. {time_txt}"
        sentence = f"{w['id']} has {rk['sev'] - wk['sev']} fewer Severe miles than {r['id']}, the next best."
    elif rule == 1:
        reason = f"{wk['sev']} severe miles, {wk['high']} high ({r['id']}: {rk['high']}). {time_txt}"
        sentence = f"{w['id']} and {r['id']} tied on Severe miles; {w['id']} has {rk['high'] - wk['high']} fewer High miles."
    elif rule == 2:
        reason = f"Lowest average risk ({wk['avg']:.1f} vs {rk['avg']:.1f}). {time_txt}"
        sentence = f"{w['id']} and {r['id']} tied on Severe and High miles; {w['id']} has the lower average risk."
    else:
        reason = f"Same risk as {r['id']}, and {_dur(rk['hours'] - wk['hours'])} faster."
        sentence = f"{w['id']} and {r['id']} tied on every risk rule; {w['id']} is faster."

    decided = RULE_SLUGS[3] if all_low else (RULE_SLUGS[rule] if rule is not None else None)
    return {
        "recommended_route_id": w["id"],
        "decided_by": decided,
        "order": [x["id"] for x in ranked],
        "explanation": reason.strip(),
        "narrative": sentence,
    }


def plan(origin, dest, departure_utc, load_lb, spacing_mi):
    """origin/dest = {lat, lon}; departure_utc = aware datetime. -> response dict."""
    weather = get_weather_provider()
    routing = get_routing_provider()
    horizon = 48 - (departure_utc - DEMO_NOW).total_seconds() / 3600

    # Sample every route, then fetch weather for ALL checkpoints in ONE call.
    sampled = [_sample_route(rd, spacing_mi, horizon, departure_utc) for rd in routing.routes(origin, dest)]
    scored = [r for sk in sampled for r in sk["raw"] if r["status"] == "ok"]
    points = [(r["ll"][0], r["ll"][1], r["eta"], departure_utc + timedelta(hours=r["eta"])) for r in scored]
    for r, w in zip(scored, weather.forecast_many(points)):
        r["weather"] = w
        r["risk"] = scoring.classify(w["wind_gust_mph"], w["rain_in_hr"], w["snow_in_hr"], load_lb)

    routes = [_finalize_route(sk) for sk in sampled]
    ranking = _rank(routes)
    for rt in routes:
        rt.pop("_rank", None)

    return {
        "departure_utc": _iso(departure_utc),
        "forecast_horizon_utc": _iso(departure_utc + timedelta(hours=horizon)),
        "checkpoint_spacing_mi": spacing_mi,
        "load_lb": load_lb,
        "recommended_route_id": ranking["recommended_route_id"],
        "ranking": {k: ranking[k] for k in ("decided_by", "order", "explanation", "narrative")},
        "routes": routes,
    }
