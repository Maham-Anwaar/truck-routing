# Truck Routing

A weather-aware truck route planner. Enter an origin, destination, departure
time, and load weight; the app generates up to three route options across the
US Midwest, scores each checkpoint by wind / rain / snow into a risk level, and
recommends the safest route. A 48-hour forecast slider animates a weather
heatmap and moves the truck along the chosen route.

This is a React port of a single-file prototype. The weather, routing, and
geocoding are all **synthetic** — no API keys or network services are required
(the only external request is map tiles, which are token-free).

## Stack

- **React 19** + **Vite**
- **react-leaflet / Leaflet** with a token-free **CARTO dark** basemap
- **CSS Modules** + a shared design-token stylesheet (`src/styles/tokens.css`)
- **Phosphor** icons, **Inter** font
- **Vitest** for the domain logic

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the domain test suite (Vitest) |
| `npm run lint` | oxlint |

### Environment notes

- **Node** 20.19+ or 22.12+ recommended (Vite 8). Older 22.x prints a warning
  but works.
- **npm cache:** if `npm install` fails with an `EACCES` on `~/.npm`, point npm
  at a local cache: `npm_config_cache="$PWD/.npm-cache" npm install`.
- **Rolldown native binary:** Vite 8 uses Rolldown; its platform binary is
  pinned in `optionalDependencies`. If a build ever reports
  `Cannot find module rolldown-binding.*.node`, re-run `npm install`.

## Architecture

```
src/
  domain/      framework-free logic (pure, unit-tested)
               levels · constants · geo · weather · routes · heat ·
               format · validation
  state/       usePlanner (trip + compute pipeline + scenarios), useLayout
  components/
    map/       MapView, CheckpointPopover
    panel/     SidePanel, TripForm, TripSummary, RouteCard, WhyPanel,
               CheckpointTable, Banners, Legend, InfoPopover
    forecast/  ForecastSlider
    layout/    BottomSheet (phone), Rail (tablet)
  styles/      tokens.css, global.css
```

- **`domain/`** is pure and has no React imports, so the routing/ranking/risk
  math is testable in isolation (`npm test`).
- **`usePlanner`** separates the editable *draft* trip from the *committed*
  trip that drives compute, and models the staged submit → loading → results
  flow. It also exposes the 11 demo **scenarios**.
- The **heatmap** (`domain/heat.js`) rasterizes a lat/lon grid, masks it to the
  route corridor, colors each cell by risk per forecast hour, and places the
  cached image via a Leaflet `ImageOverlay`.
- The layout is responsive: desktop (side panel), tablet (collapsible rail),
  phone (draggable bottom sheet).

## Demo scenarios

The **Scenario** picker (top-left) switches between the 11 built-in states:
`results`, `empty`, `loading`, `popover`, `twoRoutes`, `weatherMissing`,
`beyondForecast`, `allNoTravel`, `allLow`, `notFound`, `noRoute`.
