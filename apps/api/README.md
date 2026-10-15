# api — DRF backend (planned)

The Django REST Framework backend that serves the frontend in `apps/web`.

Not implemented yet. The wire contract it must satisfy — endpoints, request/
response shapes, the risk-scoring and ranking rules, and the division of
responsibility — is specified in [`../../docs/API.md`](../../docs/API.md).

## Chosen stack

| Capability | Source | Key? |
| --- | --- | --- |
| Routing (`/routes/plan` geometry + A/B/C) | synthetic (default) or **OpenRouteService** (`driving-hgv`) | `ORS_API_KEY` for ors |
| Weather (`/routes/plan` checkpoints) | synthetic (default) or **Open-Meteo** (real, keyless) | none |
| Weather (`/weather/field` heatmap grid) | always **synthetic** (a per-cell real grid isn't feasible) | none |
| Places (`/places`) | **`data/places.json`** (50 state capitals + demo cities) | none |

Flip providers in `.env`: `ROUTING_PROVIDER=ors` (+ `ORS_API_KEY`) and/or
`WEATHER_PROVIDER=open_meteo`. Both default to keyless synthetic data.

Risk scoring + ranking are computed by the backend (port the reference logic
from `apps/web/src/domain/`: `weather.js`, `routes.js`). ORS only supplies the
road geometry/distance/duration; the backend samples checkpoints, scores
weather, and ranks.

Keys live **server-side only** (see `.env.example`), never in the frontend.

## Data

- `data/places.json` — static place list served by `/places`.
