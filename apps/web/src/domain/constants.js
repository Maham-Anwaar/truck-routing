// Current instant (epoch ms) — the valid departure window and the timezone
// label are measured from this. Captured at app load.
export const NOW = Date.now();

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
