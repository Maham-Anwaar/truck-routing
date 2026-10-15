# apps/web — frontend (React 19 + Vite + react-leaflet)

The UI. It **consumes the API for everything** (places, routes, weather, heatmap)
and only does visual derivation. **Hard rule: no synthetic/dummy data in the
frontend** — if the API is down, show an error state, never fake data. See
`docs/API.md` for the contract.

## Run / test — ALWAYS set the npm cache first

This environment can't write to `~/.npm`, so prefix npm with a local cache:

```bash
cd apps/web
export npm_config_cache="$PWD/.npm-cache"
npm run dev          # http://localhost:5173 (needs the backend running too)
npx vitest run       # tests
npm run build        # prod build
npm run lint         # oxlint
```

The backend base URL comes from `VITE_API_URL` (`.env`, gitignored;
`.env.example` is committed). Default: `http://localhost:8000/api`.

## Layout

```
src/
  domain/      pure logic (no React): geo (place store), format, validation,
               levels, constants, heat (heatmap render), adapt (DTO -> UI shape)
  services/    api.js — fetch client (fetchPlan, fetchWeatherField, fetchAllPlaces)
  state/       usePlanner (the plan pipeline), useLayout (responsive breakpoints)
  components/  map/ (MapView, CheckpointPopover), panel/ (form, cards, tables,
               legend, banners, why), forecast/ (ForecastSlider), layout/
  styles/      tokens.css (design tokens) + global.css
```

## How the plan flows (usePlanner)

Async: `runPlan(trip)` → `fetchPlan` (POST /routes/plan) → `adaptPlan(dto)` sets
`data` → `fetchWeatherField` → `buildHeatImage` attaches `data.heat`.
Phases: `empty | loading | noRoute | error | results`. **First load is empty** (no
auto-plan). `adapt.js` reconstructs the render shape from the DTO (coloured
segments by slicing the polyline, `at()` interpolation for the truck/badge, risk
bar from `riskBreakdownMi`).

## Conventions

- **CSS Modules + design tokens.** Colors/spacing/radii are `var(--color-…)` etc.
  defined in `styles/tokens.css` — reuse them, don't hardcode hex.
- **No hardcoded data.** Places load from `/api/places` into a cache
  (`geo.js` store); `findPlace`/`suggest` read that. There is no bundled list.
- **Times:** `NOW = Date.now()`; instants are UTC epoch ms; display converts to the
  viewer's timezone (`clock`, `TZ` in `format.js`). Departures sent as UTC ISO.
- **camelCase** comes straight from the API.

## Performance rules (don't regress the smooth play)

The forecast slider plays at 60fps. To keep it smooth:

- **`MapView` and `SidePanel` are `React.memo`** — their props are stable during
  play. Don't pass them new inline objects/callbacks each render (use stable
  refs / `useCallback`), or you'll break the memo.
- **App passes `Math.round(hour)` to `MapView`** (fractional hour only drives the
  lightweight slider). So the map re-renders ~2x/sec, not 60.
- **The truck CSS-glides** between integer steps (`.wr-truck-marker` in
  `global.css`) — don't make its position update at 60fps.
- **Leaflet markers need stable `key`s** (`key="truck"`, etc.) or react-leaflet
  tears them down/recreates them when siblings mount/unmount (the "truck blinks"
  bug).
- Heatmap frames are precomputed/cached (`buildHeatImage`); keep that warming.

## Gotchas

- Always `export npm_config_cache="$PWD/.npm-cache"` before npm (EACCES otherwise).
- Vite 8 uses Rolldown; its native binary + oxlint's are pinned in
  `optionalDependencies`. If a build/lint fails with "Cannot find module
  …binding…node", run `npm install` (with the cache env var).
- Vitest runs in Node (no DOM) — stub canvas (`heat.js`) in tests; seed the place
  store with `setPlaces(...)` at module load, not in `beforeAll` (describe bodies
  run at collection time).

## Commits

Conventional-commit style, small and testable. Keep `npx vitest run` +
`npm run build` + `npm run lint` green.
