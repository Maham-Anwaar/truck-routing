# Truck Routing — Monorepo

A weather-aware truck route planner. This repo holds the frontend and (soon)
the backend that serves it.

## Layout

```
.
├── apps/
│   ├── web/     React + Vite frontend  (see apps/web/README.md)
│   └── api/     DRF backend            (planned — see docs/API.md for the contract)
└── docs/
    └── API.md   the wire contract between web and api
```

The **backend does the heavy lifting** (routing, weather, risk scoring,
ranking, the heatmap grid) and the **frontend is a thin presentation layer**.
`docs/API.md` is the single source of truth for the interface between them.

## Getting started

**Frontend**

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
npm test           # domain unit tests
npm run build
```

**Backend** — not built yet. It will live in `apps/api/` and implement the
endpoints in [`docs/API.md`](docs/API.md).

## Status

- `apps/web` — complete, runs on isolated synthetic data in `src/domain/`.
  Once `apps/api` is live, the frontend will use **only** real API data (no
  dummy fallback) and the synthetic generators get removed.
- `apps/api` — to do.
