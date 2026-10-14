import { NOW } from "./constants.js";
import { findPlace, suggest, parseDep, loadNum } from "./format.js";

// Allowed departure window: from ~now (15-min grace) to 48 h out.
export const DEP_MIN_MS = NOW - 15 * 6e4;
export const DEP_MAX_MS = NOW + 48 * 3.6e6;
export const LOAD_MAX = 80000;

// Whole-form validity — mirrors the original Component.valid().
export function isValidTrip(f) {
  const o = findPlace(f.origin),
    d = findPlace(f.dest),
    dep = parseDep(f.dep),
    load = loadNum(f.load);
  return !!(
    o &&
    d &&
    o !== d &&
    !isNaN(dep) &&
    dep >= DEP_MIN_MS &&
    dep <= DEP_MAX_MS &&
    !isNaN(load) &&
    load >= 0 &&
    load <= LOAD_MAX
  );
}

// Error for an origin/dest field (only once it's been touched).
// Returns { text, sug } or null.
export function fieldError(f, touched, k) {
  const v = f[k];
  if (!touched[k]) return null;
  if (!v) return { text: k === "origin" ? "Enter an origin." : "Enter a destination.", sug: [] };
  if (!findPlace(v)) return { text: `No place matches “${v}”.`, sug: suggest(v) };
  if (k === "dest" && findPlace(f.origin) && f.origin === v)
    return { text: "Destination must differ from origin.", sug: [] };
  return null;
}

// Load / departure range flags for inline helper messaging.
export function loadInvalid(f, touched) {
  if (!touched.load) return false;
  const load = loadNum(f.load);
  return isNaN(load) || load > LOAD_MAX;
}
export function depInvalid(f, touched) {
  if (!touched.dep) return false;
  const dep = parseDep(f.dep);
  return isNaN(dep) || dep < DEP_MIN_MS || dep > DEP_MAX_MS;
}
