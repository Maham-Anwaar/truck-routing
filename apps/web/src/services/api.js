// Thin client for the backend (apps/api). Base URL from VITE_API_URL.
// Everything the frontend needs comes from here — no bundled dummy data.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

// Full place list — called once at startup to seed the place cache.
export async function fetchAllPlaces() {
  return (await get("/places")).places;
}

// Server-side autocomplete (available if we move off the cached list later).
export async function searchPlaces(q) {
  return (await get(`/places?q=${encodeURIComponent(q)}`)).places;
}

export async function fetchRiskLevels() {
  return (await get("/config/risk-levels")).levels;
}

export async function fetchHealth() {
  return get("/health");
}
