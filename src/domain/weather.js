import { COS } from "./constants.js";

// Synthetic forecast field: two moving weather systems (gaussian blobs that
// drift east/north over forecast time t) plus a little spatial noise.
// S = { I: intensity, spread } from the scenario MODE.
export function wx(lat, lon, t, S) {
  const c1 = [39.0 + 0.15 * t, -100.5 + 0.22 * t],
    s1 = 1.6 * S.spread;
  const g1 = Math.exp(
    -((lat - c1[0]) ** 2 + ((lon - c1[1]) * COS) ** 2) / (2 * s1 * s1),
  );
  const c2 = [35.2 + 0.15 * t, -94.6 + 0.2 * t],
    s2 = 1.3 * S.spread;
  const g2 = Math.exp(
    -((lat - c2[0]) ** 2 + ((lon - c2[1]) * COS) ** 2) / (2 * s2 * s2),
  );
  const n = Math.sin(lat * 2.1 + lon * 1.7 + t * 0.3) * 0.5 + 0.5;
  const I = S.I,
    cold = lat > 40.2;
  return {
    wind: Math.round(8 + 4 * n + I * (50 * g1 + 20 * g2)),
    rain: Math.round(((cold ? 0 : I * 1.1 * g1) + I * 0.5 * g2) * 100) / 100,
    snow: Math.round((cold ? I * 3.3 * g1 : 0) * 10) / 10,
  };
}

// Classify weather into a risk level 0..4, applying the load-weight rules
// that can escalate wind risk for heavy trucks.
export function risk(w, load) {
  const wl = w.wind < 25 ? 0 : w.wind < 35 ? 1 : w.wind < 45 ? 2 : w.wind < 55 ? 3 : 4;
  const rl = w.rain < 0.1 ? 0 : w.rain < 0.25 ? 1 : w.rain < 0.5 ? 2 : w.rain <= 1 ? 3 : 4;
  const sl = w.snow < 0.5 ? 0 : w.snow < 1 ? 1 : w.snow < 2 ? 2 : w.snow <= 3 ? 3 : 4;
  let w2 = wl,
    rule = null;
  if (wl === 3 && load > 30000) {
    w2 = 4;
    rule = "Raised to No Travel: 45 to 54 mph wind with over 30,000 lb.";
  } else if (wl === 2 && load > 40000) {
    w2 = 3;
    rule = "Raised to Severe: 35 to 44 mph wind with over 40,000 lb.";
  }
  const lv = Math.max(w2, rl, sl);
  const driver = lv === 0 ? null : w2 === lv ? "wind" : rl === lv ? "rain" : "snow";
  return { lv, driver, rule: driver === "wind" ? rule : null };
}

// Risk thresholds, for the info popover. Rows align with LV[0..4].
export const THRESHOLDS = [
  ["under 25 mph", "under 0.10 in/hr", "under 0.5 in/hr"],
  ["25 to 34 mph", "0.10 to 0.25 in/hr", "0.5 to 1.0 in/hr"],
  ["35 to 44 mph", "0.25 to 0.50 in/hr", "1.0 to 2.0 in/hr"],
  ["45 to 54 mph", "0.50 to 1.00 in/hr", "2.0 to 3.0 in/hr"],
  ["55 mph and over", "over 1.00 in/hr", "over 3.0 in/hr"],
];
