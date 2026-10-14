import { COS } from "./constants.js";
import { LV, ALPHA } from "./levels.js";

// Heatmap rendering. The RISK VALUES now come from the backend
// (POST /weather/field) — the frontend only computes the route-corridor mask,
// colours each cell by risk level, and blurs/upscales to a smooth image.

// The bbox + corridor samples to request a field for (and to mask it to).
// Mirrors the original grid padding so the field covers the route region.
export function heatRegion(routes) {
  const samples = [];
  routes.forEach((r) => {
    for (let m = 0; m <= r.total; m += 15) samples.push(r.at(m));
  });
  const lats = samples.map((s) => s[0]),
    lons = samples.map((s) => s[1]);
  return {
    samples,
    resolutionDeg: 0.2,
    bbox: {
      south: Math.floor(Math.min(...lats) - 2.4),
      north: Math.ceil(Math.max(...lats) + 2.4),
      west: Math.floor(Math.min(...lons) - 3),
      east: Math.ceil(Math.max(...lons) + 3),
    },
  };
}

// Build the per-hour frame factory from the API risk grid + corridor samples.
export function buildHeatImage(grid, samples) {
  const st = grid.resolutionDeg;
  const W = grid.cols,
    H = grid.rows;
  const { south, west, north, east } = grid.bbox;

  // Corridor mask: 1 near a route sample, fading to 0 away from it.
  const mask = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const la = north - (j + 0.5) * st,
        lo = west + (i + 0.5) * st;
      let dm = 1e9;
      for (const s of samples) {
        const dd = (la - s[0]) ** 2 + ((lo - s[1]) * COS) ** 2;
        if (dd < dm) dm = dd;
      }
      mask[j * W + i] = Math.max(0, Math.min(1, (2.1 - Math.sqrt(dm)) / 0.7));
    }

  const byHour = {};
  grid.frames.forEach((f) => (byHour[f.hour] = f.risk));

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  const UP = 3,
    big = document.createElement("canvas");
  big.width = W * UP;
  big.height = H * UP;
  const bx = big.getContext("2d");
  bx.imageSmoothingEnabled = true;
  bx.imageSmoothingQuality = "high";
  const urls = [];

  // Colour + blur the risk grid for forecast hour h (null if no frame).
  const frame = (h) => {
    const matrix = byHour[h];
    if (!matrix) return null;
    if (urls[h] !== undefined) return urls[h];
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i,
          mk = mask[k];
        if (mk <= 0) continue;
        const lv = matrix[j][i];
        if (lv < 0) continue;
        const c = LV[lv].rgb;
        img.data[k * 4] = c[0];
        img.data[k * 4 + 1] = c[1];
        img.data[k * 4 + 2] = c[2];
        img.data[k * 4 + 3] = Math.round(ALPHA[lv] * mk * 255);
      }
    ctx.putImageData(img, 0, 0);
    bx.clearRect(0, 0, big.width, big.height);
    bx.filter = "blur(2px)";
    bx.drawImage(cv, 0, 0, big.width, big.height);
    urls[h] = big.toDataURL();
    return urls[h];
  };
  if (grid.frames.length) frame(grid.frames[0].hour);

  // Leaflet ImageOverlay bounds: [[south, west], [north, east]].
  return { frame, bounds: [[south, west], [north, east]] };
}
