// The weather model and risk classification now live in the backend
// (apps/api). The frontend keeps only the threshold reference table for the
// info popover; colors/labels/glyphs stay in the frontend (see levels.js).
//
// Rows align with LV[0..4] (Low..Severe); No Travel is open-ended.
export const THRESHOLDS = [
  ["under 25 mph", "under 0.10 in/hr", "under 0.5 in/hr"],
  ["25 to 34 mph", "0.10 to 0.25 in/hr", "0.5 to 1.0 in/hr"],
  ["35 to 44 mph", "0.25 to 0.50 in/hr", "1.0 to 2.0 in/hr"],
  ["45 to 54 mph", "0.50 to 1.00 in/hr", "2.0 to 3.0 in/hr"],
  ["55 mph and over", "over 1.00 in/hr", "over 3.0 in/hr"],
];
