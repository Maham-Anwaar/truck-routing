import { describe, it, expect } from "vitest";
import { findPlace, suggest, dur, fmtLoad, loadNum } from "./format.js";
import { risk } from "./weather.js";
import { isValidTrip, fieldError } from "./validation.js";
import { setPlaces } from "./geo.js";

// Routing/ranking logic now lives in the backend (apps/api) and is tested there.
// Places normally come from the API at runtime; seed the cache for tests.
const TEST_PLACES = [
  ["Dallas, TX", 32.78, -96.8],
  ["Minneapolis, MN", 44.98, -93.27],
  ["Minneola, FL", 28.57, -81.75],
  ["Denver, CO", 39.74, -104.99],
  ["Oklahoma City, OK", 35.47, -97.52],
  ["Honolulu, HI", 21.31, -157.86],
].map(([label, lat, lon]) => ({ label, lat, lon }));
// Seed at module load (before describe bodies compute routes).
setPlaces(TEST_PLACES);

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
