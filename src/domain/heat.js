import { COS } from "./constants.js";
import { wx, risk } from "./weather.js";
import { LV, ALPHA } from "./levels.js";

// Build the animated weather-risk heat field for a set of routes.
//
// This is NOT a point-density heatmap. It rasterises a lat/lon grid, masks it
// to the route corridor, and — for each forecast hour — colours every cell by
// the risk level of the weather there, then blurs/upscales to a smooth image.
// Returns one cached data-URL frame per hour plus lat/lon bounds so Leaflet's
// ImageOverlay can place it on a real basemap.
export function buildHeat(routes, mode, load, horizon) {
  // Dense samples along every route define the visible corridor.
  const samples = [];
  routes.forEach((r) => {
    for (let m = 0; m <= r.total; m += 15) samples.push(r.at(m));
  });
  const lats = samples.map((s) => s[0]),
    lons = samples.map((s) => s[1]);

  const st = 0.2; // grid step in degrees
  const latMax = Math.ceil(Math.max(...lats) + 2.4),
    latMin = Math.floor(Math.min(...lats) - 2.4),
    lonMin = Math.floor(Math.min(...lons) - 3),
    lonMax = Math.ceil(Math.max(...lons) + 3);
  const W = Math.round((lonMax - lonMin) / st),
    H = Math.round((latMax - latMin) / st);

  // Corridor mask: 1 near a route sample, fading to 0 away from it.
  const mask = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const la = latMax - (j + 0.5) * st,
        lo = lonMin + (i + 0.5) * st;
      let dm = 1e9;
      for (const s of samples) {
        const dd = (la - s[0]) ** 2 + ((lo - s[1]) * COS) ** 2;
        if (dd < dm) dm = dd;
      }
      const dd = Math.sqrt(dm);
      mask[j * W + i] = Math.max(0, Math.min(1, (2.1 - dd) / 0.7));
    }

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

  // Render (and cache) the heat image for forecast hour h.
  const frame = (h) => {
    if (h > horizon) return null;
    if (urls[h] !== undefined) return urls[h];
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i,
          mk = mask[k];
        if (mk <= 0) continue;
        const la = latMax - (j + 0.5) * st,
          lo = lonMin + (i + 0.5) * st;
        const lv = risk(wx(la, lo, h, mode), load).lv;
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
  frame(0);

  // Leaflet ImageOverlay bounds: [[south, west], [north, east]].
  // Image row 0 is at latMax (north), so the top-left maps to the NW corner.
  return { frame, urls, bounds: [[latMin, lonMin], [latMax, lonMax]] };
}
