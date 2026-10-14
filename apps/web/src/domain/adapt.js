// Maps a POST /routes/plan response (docs/API.md) into the internal `data`
// shape the components render. The backend ships clean route/checkpoint data;
// the frontend derives render geometry (segments, interpolation, badge) from it.
//
// NOTE: the heatmap is still built client-side here (buildHeat) until
// POST /weather/field exists — that's the one remaining synthetic piece.
import { hav } from "./geo.js";
import { buildHeat } from "./heat.js";

const RISK_INDEX = { low: 0, moderate: 1, high: 2, severe: 3, no_travel: 4 };
const STATUS = { ok: "ok", no_data: "nodata", beyond_forecast: "beyond" };
const RULE_INDEX = {
  fewest_severe_miles: 0,
  fewest_high_miles: 1,
  lowest_average_risk: 2,
  shortest_time: 3,
};
const DEFAULT_MODE = { I: 1, spread: 1 };

// Cumulative great-circle distance along a [lat,lon][] polyline.
function cumulative(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + hav(points[i - 1], points[i]));
  return cum;
}

// Interpolate [lat,lon] at `mile` of `totalMi` (fraction-space, factor-agnostic).
function makeAt(points, cum, totalMi) {
  const totalRaw = cum[cum.length - 1] || 1;
  return (mile) => {
    const raw = (Math.max(0, Math.min(mile, totalMi)) / totalMi) * totalRaw;
    for (let i = 1; i < cum.length; i++) {
      if (raw <= cum[i]) {
        const f = (raw - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return [
          points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f,
          points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f,
        ];
      }
    }
    return points[points.length - 1];
  };
}

function sliceByMile(points, cum, totalMi, a, b, at) {
  const totalRaw = cum[cum.length - 1] || 1;
  const aRaw = (a / totalMi) * totalRaw,
    bRaw = (b / totalMi) * totalRaw;
  const out = [at(a)];
  for (let i = 0; i < cum.length; i++) if (cum[i] > aRaw && cum[i] < bRaw) out.push(points[i]);
  out.push(at(b));
  return out;
}

function adaptRoute(r, depMs) {
  const geometry = r.geometry;
  const total = r.distanceMi;
  const cum = cumulative(geometry);
  const at = makeAt(geometry, cum, total);

  const cps = r.checkpoints.map((c) => ({
    i: c.index,
    m: c.mileMarker,
    eta: (Date.parse(c.etaUtc) - depMs) / 3.6e6,
    ll: [c.coord.lat, c.coord.lon],
    st: STATUS[c.status] || "ok",
    w: c.weather ? { wind: c.weather.windGustMph, rain: c.weather.rainInHr, snow: c.weather.snowInHr } : null,
    lv: c.risk.levelIndex == null ? -1 : c.risk.levelIndex,
    driver: c.risk.driver,
    rule: c.risk.escalationRule,
  }));

  const segs = cps.slice(0, -1).map((c, i) => {
    const n = cps[i + 1];
    const v = [c.lv, n.lv].filter((x) => x >= 0);
    return { lv: v.length ? Math.max(...v) : -1, latlngs: sliceByMile(geometry, cum, total, c.m, n.m, at) };
  });

  const bd = r.summary.riskBreakdownMi;
  return {
    id: r.id,
    name: r.name,
    speed: r.avgSpeedMph,
    total,
    hours: r.durationHr,
    latlngs: geometry,
    at,
    cps,
    segs,
    levelMi: [bd.low, bd.moderate, bd.high, bd.severe, bd.noTravel],
    grayMi: bd.noData,
    sev: r.summary.severeMi,
    high: r.summary.highMi,
    avgR: r.summary.avgRisk,
    maxLv: r.summary.maxRiskLevel == null ? -1 : RISK_INDEX[r.summary.maxRiskLevel],
    ntCp: cps.find((c) => c.lv === 4),
    missing: cps.filter((c) => c.st === "nodata").length,
    beyond: cps.filter((c) => c.st === "beyond").length,
    badge: at(total * 0.42),
  };
}

export function adaptPlan(dto) {
  const depMs = Date.parse(dto.departureUtc);
  const horizon = (Date.parse(dto.forecastHorizonUtc) - depMs) / 3.6e6;
  const routes = dto.routes.map((r) => adaptRoute(r, depMs));
  const byId = Object.fromEntries(routes.map((r) => [r.id, r]));

  return {
    routes,
    heat: buildHeat(routes, DEFAULT_MODE, dto.loadLb, horizon),
    horizon,
    dep: depMs,
    ranked: dto.ranking.order.map((id) => byId[id]),
    recId: dto.recommendedRouteId,
    rule: dto.ranking.decidedBy == null ? null : RULE_INDEX[dto.ranking.decidedBy],
    reason: dto.ranking.explanation,
    sentence: dto.ranking.narrative,
    fastest: Math.min(...routes.map((r) => r.hours)),
    total: routes.reduce((a, r) => a + r.cps.length, 0),
  };
}
