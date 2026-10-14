import { describe, it, expect } from "vitest";
import { findPlace, suggest, dur, fmtLoad, loadNum } from "./format.js";
import { risk } from "./weather.js";
import { routeDefs, buildRoute, rank, MODES } from "./routes.js";
import { isValidTrip, fieldError } from "./validation.js";
import { NOW } from "./constants.js";

const HORIZON = (dep) => 48 - (dep - NOW) / 3.6e6;

describe("format helpers", () => {
  it("looks up and suggests places", () => {
    expect(findPlace("Dallas, TX")?.lat).toBeCloseTo(32.78);
    expect(findPlace("Nowhere")).toBeNull();
    expect(suggest("Mineapolis").map((p) => p.label)).toContain("Minneapolis, MN");
  });
  it("formats durations and loads", () => {
    expect(dur(16.47)).toBe("16 h 30 min");
    expect(fmtLoad("42000")).toBe("42,000");
    expect(loadNum("42,000")).toBe(42000);
  });
});

describe("risk classification", () => {
  it("takes the worst of wind/rain/snow", () => {
    expect(risk({ wind: 10, rain: 0, snow: 0 }, 0).lv).toBe(0);
    expect(risk({ wind: 60, rain: 0, snow: 0 }, 0).lv).toBe(4);
    expect(risk({ wind: 0, rain: 0.3, snow: 0 }, 0).driver).toBe("rain");
  });
  it("applies load-weight escalation", () => {
    // 45–54 mph wind with >30,000 lb -> No Travel
    expect(risk({ wind: 48, rain: 0, snow: 0 }, 35000).lv).toBe(4);
    // same wind, light load -> Severe only
    expect(risk({ wind: 48, rain: 0, snow: 0 }, 1000).lv).toBe(3);
  });
});

describe("routing + ranking (Dallas -> Minneapolis)", () => {
  const o = findPlace("Dallas, TX");
  const d = findPlace("Minneapolis, MN");
  const dep = Date.UTC(2026, 9, 15, 6, 0);
  const routes = routeDefs(o, d, MODES.results).map((def) =>
    buildRoute(def, 25, { load: 42000 }, MODES.results, HORIZON(dep)),
  );

  it("builds three routes with checkpoints", () => {
    expect(routes).toHaveLength(3);
    routes.forEach((r) => expect(r.cps.length).toBeGreaterThan(10));
  });
  it("recommends route A (fewest severe, fewest high, fastest)", () => {
    const rk = rank(routes);
    expect(rk.ranked[0].id).toBe("A");
    expect(rk.ranked[0].sev).toBe(0);
  });
});

describe("trip validation", () => {
  const T = { origin: "Dallas, TX", dest: "Minneapolis, MN", dep: "2026-10-15T06:00", load: "42,000" };
  it("accepts a valid trip", () => expect(isValidTrip(T)).toBe(true));
  it("rejects same origin/destination", () => expect(isValidTrip({ ...T, dest: "Dallas, TX" })).toBe(false));
  it("rejects out-of-range departure and load", () => {
    expect(isValidTrip({ ...T, dep: "2026-10-20T06:00" })).toBe(false);
    expect(isValidTrip({ ...T, load: "90,000" })).toBe(false);
  });
  it("surfaces suggestions for a typo", () => {
    const err = fieldError({ ...T, dest: "Mineapolis" }, { dest: true }, "dest");
    expect(err.sug.map((p) => p.label)).toContain("Minneapolis, MN");
  });
});
