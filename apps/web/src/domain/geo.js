import { COS } from "./constants.js";

// Places come from the backend (GET /api/places) and are cached here at
// startup via setPlaces(). No hardcoded place data lives in the frontend.
let _places = [];

export function setPlaces(list) {
  _places = Array.isArray(list) ? list : [];
}
export function getPlaces() {
  return _places;
}

// Cities drawn on the map (exclude far-flung markers).
export function getMapCities() {
  return _places.filter((p) => !/FL|HI|Fort Worth/.test(p.label));
}

// Decorative road network (polylines of [lat, lon]).
export const ROADS = [
  [[39.74, -104.99], [38.84, -97.61], [39.05, -95.68], [39.1, -94.58], [38.95, -92.33], [38.63, -90.2]],
  [[41.14, -104.82], [40.92, -98.34], [40.81, -96.7], [41.26, -95.94], [41.59, -93.62], [41.66, -91.53], [41.52, -90.58], [41.88, -87.63]],
  [[35.22, -101.83], [35.47, -97.52], [35.39, -94.4], [34.75, -92.29], [35.15, -90.05]],
  [[32.45, -99.73], [32.75, -97.33], [32.78, -96.8], [32.35, -95.3], [32.52, -93.75]],
  [[43.55, -96.73], [43.65, -94.1], [43.8, -91.24], [43.07, -89.4]],
  [[35.47, -97.52], [36.15, -95.99], [37.08, -94.51], [37.21, -93.29], [38.63, -90.2]],
  [[39.1, -94.58], [41.26, -95.94], [42.5, -96.4], [43.55, -96.73], [46.88, -96.79]],
  [[46.88, -96.79], [44.98, -93.27], [43.04, -87.9]],
  [[29.42, -98.49], [30.27, -97.74], [32.78, -96.8], [35.47, -97.52], [37.69, -97.34], [39.1, -94.58], [41.59, -93.62], [44.98, -93.27]],
  [[29.76, -95.37], [32.78, -96.8]],
  [[35.15, -90.05], [38.63, -90.2], [41.88, -87.63]],
];

// Great-circle distance in miles between [lat, lon] points.
export function hav(a, b) {
  const R = 3958.8,
    t = Math.PI / 180;
  const dLat = (b[0] - a[0]) * t,
    dLon = (b[1] - a[1]) * t;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export { COS };
