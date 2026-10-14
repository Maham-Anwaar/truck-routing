import { describe, it, expect } from "vitest";
import { adaptPlan } from "./adapt.js";

const DTO = {
  departureUtc: "2026-10-15T06:00:00Z",
  forecastHorizonUtc: "2026-10-16T14:47:00Z",
  checkpointSpacingMi: 25,
  loadLb: 42000,
  recommendedRouteId: "A",
  ranking: { decidedBy: "fewest_high_miles", order: ["A", "B"], explanation: "x", narrative: "y" },
  routes: [
    {
      id: "A", name: "via I-35 N", distanceMi: 1005, durationHr: 16.47, avgSpeedMph: 61,
      geometry: [[32.78, -96.8], [39.1, -94.58], [44.98, -93.27]],
      summary: {
        severeMi: 0, highMi: 150, avgRisk: 1.5, maxRiskLevel: "moderate",
        riskBreakdownMi: { low: 855, moderate: 150, high: 0, severe: 0, noTravel: 0, noData: 0 },
      },
      checkpoints: [
        { index: 0, mileMarker: 0, coord: { lat: 32.78, lon: -96.8 }, etaUtc: "2026-10-15T06:00:00Z", status: "ok", weather: { windGustMph: 12, rainInHr: 0, snowInHr: 0 }, risk: { level: "low", levelIndex: 0, driver: null, escalationRule: null } },
        { index: 1, mileMarker: 500, coord: { lat: 39.1, lon: -94.58 }, etaUtc: "2026-10-15T14:12:00Z", status: "ok", weather: { windGustMph: 38, rainInHr: 0.18, snowInHr: 0 }, risk: { level: "high", levelIndex: 2, driver: "wind", escalationRule: null } },
        { index: 2, mileMarker: 1005, coord: { lat: 44.98, lon: -93.27 }, etaUtc: "2026-10-15T22:27:00Z", status: "ok", weather: { windGustMph: 10, rainInHr: 0, snowInHr: 0 }, risk: { level: "low", levelIndex: 0, driver: null, escalationRule: null } },
      ],
    },
    {
      id: "B", name: "alt", distanceMi: 1100, durationHr: 18.65, avgSpeedMph: 59,
      geometry: [[32.78, -96.8], [44.98, -93.27]],
      summary: {
        severeMi: 400, highMi: 150, avgRisk: 2.6, maxRiskLevel: "no_travel",
        riskBreakdownMi: { low: 300, moderate: 200, high: 200, severe: 200, noTravel: 200, noData: 0 },
      },
      checkpoints: [
        { index: 0, mileMarker: 0, coord: { lat: 32.78, lon: -96.8 }, etaUtc: "2026-10-15T06:00:00Z", status: "ok", weather: { windGustMph: 12, rainInHr: 0, snowInHr: 0 }, risk: { level: "low", levelIndex: 0, driver: null, escalationRule: null } },
        { index: 1, mileMarker: 1100, coord: { lat: 44.98, lon: -93.27 }, etaUtc: "2026-10-16T00:39:00Z", status: "beyond_forecast", weather: null, risk: { level: null, levelIndex: null, driver: null, escalationRule: null } },
      ],
    },
  ],
};

describe("adaptPlan", () => {
  const d = adaptPlan(DTO);

  it("carries ranking through", () => {
    expect(d.recId).toBe("A");
    expect(d.ranked.map((r) => r.id)).toEqual(["A", "B"]);
    expect(d.rule).toBe(1); // fewest_high_miles
    expect(d.sentence).toBe("y");
  });

  it("reconstructs route render data", () => {
    const a = d.routes[0];
    expect(a.total).toBe(1005);
    expect(a.hours).toBe(16.47);
    expect(a.speed).toBe(61);
    expect(a.cps).toHaveLength(3);
    expect(a.segs).toHaveLength(2);
    expect(a.levelMi).toEqual([855, 150, 0, 0, 0]);
    expect(a.grayMi).toBe(0);
    expect(a.sev).toBe(0);
    expect(a.high).toBe(150);
    expect(a.maxLv).toBe(1);
    expect(typeof a.at).toBe("function");
  });

  it("maps checkpoints and segment levels", () => {
    const a = d.routes[0];
    expect(a.cps[1].lv).toBe(2);
    expect(a.cps[1].driver).toBe("wind");
    expect(a.cps[1].eta).toBeCloseTo(8.2, 1); // 14:12 - 06:00
    expect(a.cps[1].w).toEqual({ wind: 38, rain: 0.18, snow: 0 });
    expect(a.segs[0].lv).toBe(2); // max(low, high)
  });

  it("handles beyond-forecast checkpoints", () => {
    const b = d.routes[1];
    expect(b.cps[1].st).toBe("beyond");
    expect(b.cps[1].lv).toBe(-1);
    expect(b.cps[1].w).toBeNull();
    expect(b.beyond).toBe(1);
    expect(b.maxLv).toBe(4); // from no_travel summary
  });
});
