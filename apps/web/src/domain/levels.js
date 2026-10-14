// Risk levels — the semantic core of the app. Ported verbatim.
// n: name, c: color, fg: on-color text, g: glyph badge, rgb: for the heat raster.
export const LV = [
  { n: "Low", c: "#46b98a", fg: "#161826", g: "", rgb: [70, 185, 138] },
  { n: "Moderate", c: "#e6c84b", fg: "#161826", g: "|", rgb: [230, 200, 75] },
  { n: "High", c: "#ef8a3a", fg: "#161826", g: "!", rgb: [239, 138, 58] },
  { n: "Severe", c: "#e0464f", fg: "#f3f5fe", g: "!!", rgb: [224, 70, 79] },
  { n: "No Travel", c: "#b13ec2", fg: "#f3f5fe", g: "⊘", rgb: [177, 62, 194] },
];

export const GRAY = "#75798c";

// Per-level opacity used when compositing the heat raster.
export const ALPHA = [0.16, 0.42, 0.5, 0.56, 0.6];

export const HATCH_NT =
  "repeating-linear-gradient(135deg,#b13ec2 0 3px,#5a1f66 3px 6px)";
export const HATCH_GRAY =
  "repeating-linear-gradient(135deg,#595d6c 0 3px,#3f424d 3px 6px)";
