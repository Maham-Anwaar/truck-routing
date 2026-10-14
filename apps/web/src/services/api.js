// Thin client for the backend (apps/api). Base URL from VITE_API_URL.
// Everything the frontend needs comes from here — no bundled dummy data.
import { findPlace, parseDep, loadNum } from "../domain/format.js";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

// Plan routes for a trip form. Resolves origin/dest to coords from the place
// cache, sends UTC, and returns the raw /routes/plan DTO (adapt it for the UI).
export async function fetchPlan(form, spacingMi) {
  const o = findPlace(form.origin),
    d = findPlace(form.dest);
  if (!o || !d) throw new Error("Origin and destination must be known places");
  const body = {
    origin: { lat: o.lat, lon: o.lon },
    destination: { lat: d.lat, lon: d.lon },
    departureUtc: new Date(parseDep(form.dep)).toISOString(),
    loadLb: loadNum(form.load),
    checkpointSpacingMi: spacingMi,
  };
  const res = await fetch(`${BASE}/routes/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) {
    const e = new Error("No drivable route");
    e.noRoute = true;
    throw e;
  }
  if (!res.ok) throw new Error(`plan ${res.status}`);
  return res.json();
}

// Full place list — called once at startup to seed the place cache.
// The promise is memoised so a double-invoked effect (React StrictMode in dev)
// results in a single network request.
let _placesPromise = null;
export function fetchAllPlaces() {
  if (!_placesPromise) _placesPromise = get("/places").then((r) => r.places);
  return _placesPromise;
}

// Server-side autocomplete (available if we move off the cached list later).
export async function searchPlaces(q) {
  return (await get(`/places?q=${encodeURIComponent(q)}`)).places;
}

// Per-hour risk grid for the heatmap over a bbox.
export async function fetchWeatherField(bbox, departureUtc, loadLb, resolutionDeg) {
  const res = await fetch(`${BASE}/weather/field`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox, departureUtc, loadLb, resolutionDeg, fromHour: 0, toHour: 48 }),
  });
  if (!res.ok) throw new Error(`weather field ${res.status}`);
  return res.json();
}

export async function fetchRiskLevels() {
  return (await get("/config/risk-levels")).levels;
}

export async function fetchHealth() {
  return get("/health");
}
