// "Now" is pinned to a fixed instant so the demo forecast is deterministic.
export const NOW = Date.UTC(2026, 9, 14, 14, 47);

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Longitude-scaling factor at the map's reference latitude (~38.9°N).
// Used by the weather field and nearest-sample distance so that a degree of
// longitude is weighted like a degree of latitude. (The original also used
// K/LON0/LAT0 for a hand-rolled SVG projection — Leaflet replaces that.)
export const COS = Math.cos((38.9 * Math.PI) / 180);
