import { hav, DM } from "./geo.js";
import { wx, risk } from "./weather.js";
import { dur } from "./format.js";

// Scenario MODES tune the weather intensity/spread and inject special cases.
export const MODES = {
  results: { I: 1, spread: 1 },
  popover: { I: 1, spread: 1 },
  weatherMissing: { I: 1, spread: 1, missing: { A: [230, 330], B: [480, 560], C: [140, 230] } },
  beyondForecast: { I: 1, spread: 1 },
  allNoTravel: { I: 2.3, spread: 1.7 },
  allLow: { I: 0.06, spread: 1 },
  twoRoutes: { I: 1, spread: 1, routes: ["A", "B"] },
};
export const RESULT_SC = Object.keys(MODES);

// Build the candidate route definitions for an origin/destination pair.
export function routeDefs(o, d, mode) {
  let defs;
  const isDM = (a, b) => a.label === "Dallas, TX" && b.label === "Minneapolis, MN";
  if (isDM(o, d)) defs = Object.keys(DM).map((id) => ({ id, ...DM[id] }));
  else if (isDM(d, o))
    defs = Object.keys(DM).map((id) => ({ id, ...DM[id], pts: [...DM[id].pts].reverse() }));
  else {
    const dy = d.lat - o.lat,
      dx = d.lon - o.lon,
      Ln = Math.hypot(dx, dy);
    const px = -dx / Ln,
      py = dy / Ln;
    const mk = (off, off2) => [
      [o.lat, o.lon],
      [o.lat + dy * 0.33 + px * off * Ln, o.lon + dx * 0.33 + py * off * Ln],
      [o.lat + dy * 0.66 + px * off2 * Ln, o.lon + dx * 0.66 + py * off2 * Ln],
      [d.lat, d.lon],
    ];
    defs = [
      { id: "A", name: "Direct corridor", speed: 61, pts: mk(0.03, -0.02) },
      { id: "B", name: "Western alternate", speed: 58, pts: mk(0.17, 0.12) },
      { id: "C", name: "Eastern alternate", speed: 56, pts: mk(-0.15, -0.12) },
    ];
  }
  if (mode.routes) defs = defs.filter((x) => mode.routes.includes(x.id));
  return defs;
}

// Sample a route into checkpoints, classify each, and summarise.
// Emits `latlngs` arrays (not SVG paths) for Leaflet polylines.
export function buildRoute(def, spacing, trip, mode, horizon) {
  const pts = def.pts,
    cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]) * 1.07);
  const total = cum[cum.length - 1];

  // Position [lat, lon] at cumulative mile m along the polyline.
  const at = (m) => {
    for (let i = 1; i < cum.length; i++) {
      if (m <= cum[i]) {
        const f = (m - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        ];
      }
    }
    return pts[pts.length - 1];
  };
  // Polyline points between mile a and b, inclusive of interpolated ends.
  const slice = (a, b) => {
    const out = [at(a)];
    for (let i = 0; i < cum.length; i++) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
    out.push(at(b));
    return out;
  };

  const ms = [];
  for (let m = 0; m < total - spacing * 0.4; m += spacing) ms.push(m);
  ms.push(total);
  const miss = mode.missing && mode.missing[def.id];

  const cps = ms.map((m, i) => {
    const ll = at(m),
      eta = m / def.speed;
    let st = "ok";
    if (miss && m >= miss[0] && m <= miss[1]) st = "nodata";
    else if (eta > horizon) st = "beyond";
    let w = null,
      r = { lv: -1, driver: null, rule: null };
    if (st === "ok") {
      w = wx(ll[0], ll[1], eta, mode);
      r = risk(w, trip.load);
    }
    return { i, m, eta, ll, st, w, lv: r.lv, driver: r.driver, rule: r.rule };
  });

  const segs = cps.slice(0, -1).map((c, i) => {
    const n = cps[i + 1];
    const v = [c.lv, n.lv].filter((x) => x >= 0);
    return { lv: v.length ? Math.max(...v) : -1, mi: n.m - c.m, latlngs: slice(c.m, n.m) };
  });

  const levelMi = [0, 0, 0, 0, 0];
  let grayMi = 0;
  segs.forEach((s) => {
    if (s.lv >= 0) levelMi[s.lv] += s.mi;
    else grayMi += s.mi;
  });
  const valid = cps.filter((c) => c.lv >= 0);
  const avg = valid.length ? valid.reduce((a, c) => a + c.lv + 1, 0) / valid.length : 0;

  return {
    id: def.id, name: def.name, speed: def.speed, total, hours: total / def.speed,
    at, cps, segs, levelMi, grayMi,
    latlngs: pts,
    sev: Math.round(levelMi[3] + levelMi[4]),
    high: Math.round(levelMi[2]),
    avgR: Math.round(avg * 10) / 10,
    maxLv: valid.length ? Math.max(...valid.map((c) => c.lv)) : -1,
    ntCp: cps.find((c) => c.lv === 4),
    missing: cps.filter((c) => c.st === "nodata").length,
    beyond: cps.filter((c) => c.st === "beyond").length,
    badge: at(total * 0.42),
  };
}

// Rank routes: fewest severe miles -> fewest high miles -> lowest avg risk ->
// shortest time. Returns the chosen route plus a human explanation.
export function rank(routes) {
  const cmp = (a, b) => a.sev - b.sev || a.high - b.high || a.avgR - b.avgR || a.hours - b.hours;
  const ranked = [...routes].sort(cmp);
  const w = ranked[0],
    r = ranked[1];
  const fastest = Math.min(...routes.map((x) => x.hours));
  const allLow = routes.every((x) => x.maxLv <= 0);
  const rule = !r ? null : w.sev !== r.sev ? 0 : w.high !== r.high ? 1 : w.avgR !== r.avgR ? 2 : 3;
  const dt = w.hours - fastest;
  const timeTxt =
    dt < 1 / 60
      ? ranked.length > 1 ? "Also the fastest." : ""
      : `${dur(dt)} longer than the fastest.`;
  let reason, sentence;
  if (allLow) {
    reason = "Low risk on all routes, fastest chosen.";
    sentence = `Every route stays Low the whole way, so rule 4 decides: ${w.id} is the fastest.`;
  } else if (!r) {
    reason = `${w.sev} severe miles. Only option found.`;
    sentence = `${w.id} is the only route returned for this trip.`;
  } else if (rule === 0) {
    reason = `${w.sev} severe miles, vs ${r.sev} on ${r.id}. ${timeTxt}`;
    sentence = `${w.id} has ${r.sev - w.sev} fewer Severe miles than ${r.id}, the next best.`;
  } else if (rule === 1) {
    reason = `${w.sev} severe miles, ${w.high} high (${r.id}: ${r.high}). ${timeTxt}`;
    sentence = `${w.id} and ${r.id} tied on Severe miles; ${w.id} has ${r.high - w.high} fewer High miles.`;
  } else if (rule === 2) {
    reason = `Lowest average risk (${w.avgR.toFixed(1)} vs ${r.avgR.toFixed(1)}). ${timeTxt}`;
    sentence = `${w.id} and ${r.id} tied on Severe and High miles; ${w.id} has the lower average risk.`;
  } else {
    reason = `Same risk as ${r.id}, and ${dur(r.hours - w.hours)} faster.`;
    sentence = `${w.id} and ${r.id} tied on every risk rule; ${w.id} is faster.`;
  }
  return { ranked, rule: allLow ? 3 : rule, reason: reason.trim(), sentence, fastest };
}
