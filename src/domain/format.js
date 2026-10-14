import { DAYS, NOW } from "./constants.js";
import { PLACES } from "./geo.js";

// Time model: instants are epoch ms (UTC-based) — this is the "backend" data.
// Inputs and labels are rendered in the VIEWER'S local timezone.

// The viewer's short timezone label (e.g. "CDT", "PST", "GMT+2"), resolved at
// the demo's reference instant so it reflects the right DST offset.
export const TZ = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(
      new Date(NOW),
    );
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
})();

// Parse a datetime-local "YYYY-MM-DDTHH:MM" string (the viewer's local
// wall-clock, from the <input>) to an epoch ms instant.
export function parseDep(s) {
  const m = /(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}

// Epoch ms -> datetime-local string in the viewer's timezone (for <input>s).
export function toLocalStr(ms) {
  const d = new Date(ms),
    p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

// "Tue 6:30 AM" style label, in the viewer's timezone.
export function clock(ms, mins = true) {
  const d = new Date(ms);
  const hr = d.getHours(),
    mi = d.getMinutes();
  const h12 = hr % 12 || 12,
    ap = hr >= 12 ? "PM" : "AM";
  return `${DAYS[d.getDay()]} ${h12}${mins || mi ? ":" + String(mi).padStart(2, "0") : ""} ${ap}`;
}

// Hours -> "3 h 45 min" (rounded to 5-min steps).
export function dur(h) {
  let H = Math.floor(h),
    M = Math.round(((h - H) * 60) / 5) * 5;
  if (M === 60) {
    H++;
    M = 0;
  }
  return H ? `${H} h${M ? ` ${M} min` : ""}` : `${M} min`;
}

export function findPlace(s) {
  if (!s) return null;
  const q = s.trim().toLowerCase();
  return PLACES.find((p) => p.label.toLowerCase() === q) || null;
}

// Autocomplete suggestions for a partial place query.
export function suggest(s) {
  const q = (s || "").trim().toLowerCase();
  if (q.length < 3) return [];
  const a = PLACES.filter((p) => p.label.toLowerCase().includes(q));
  if (a.length) return a.slice(0, 5);
  const k = q.slice(0, 3);
  return PLACES.filter((p) => p.label.toLowerCase().startsWith(k)).slice(0, 3);
}

// Load weight: format with thousands separators / parse to a number.
export const fmtLoad = (v) => {
  const n = String(v).replace(/[^\d]/g, "");
  return n ? Number(n).toLocaleString("en-US") : "";
};
export const loadNum = (v) => {
  const n = String(v || "").replace(/[^\d]/g, "");
  return n === "" ? NaN : Number(n);
};
