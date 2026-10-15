# apps/api — backend (Django REST Framework)

Stateless JSON API that powers the frontend. **No models, no database, no auth** —
it calls providers, computes, and returns. See `docs/API.md` for the wire
contract and `docs/WALKTHROUGH.md` for the why.

## Run / test

Use the venv (Python 3.12) — do **not** use the system `python3`:

```bash
cd apps/api
./.venv/bin/python manage.py runserver 127.0.0.1:8008   # dev server
./.venv/bin/python manage.py test                       # tests (offline, deterministic)
```

If deps are missing: `./.venv/bin/pip install -r requirements.txt`.

## Layout

```
config/            Django project (settings, urls, wsgi) — stateless config
routing/
  views.py         APIViews (one per endpoint)
  urls.py          /api/... routes (NO trailing slashes)
  serializers.py   request validation (plain Serializer, not ModelSerializer)
  scoring.py       risk classification + thresholds (the risk/load rules)
  services/
    places.py      reads data/places.json
    geo.py         constants, haversine, now_utc(), iso_utc()
    weather.py     SyntheticWeatherProvider + OpenMeteoWeatherProvider
    route_source.py SyntheticRoutingProvider + OrsRoutingProvider
    planner.py     orchestration: sample routes → one weather call → rank
    field.py       heatmap risk grid (uses the weather provider; coarsened grid)
data/places.json   the place list served by /places
```

Endpoints: `GET /api/health`, `GET /api/places`, `GET /api/config/risk-levels`,
`POST /api/routes/plan` (core), `POST /api/weather/field` (heatmap grid).

## Provider pattern (important)

Routing and weather are swappable behind one interface each, chosen by settings:

- `WEATHER_PROVIDER` = `open_meteo` (default, real, keyless) | `synthetic`
- `ROUTING_PROVIDER` = `synthetic` (default) | `ors` (needs `ORS_API_KEY`)

`get_weather_provider()` / `get_routing_provider()` return the right one. Keep the
synthetic path working — tests and keyless dev rely on it.

## Conventions

- **Wire format is camelCase + UTC.** Write Python dicts in `snake_case`; the
  `djangorestframework-camel-case` renderer/parser converts at the edge. Times are
  UTC ISO with a `Z` (use `iso_utc`).
- **Everything is "now"-relative** via `now_utc()` — the forecast horizon and the
  valid-departure window. No pinned clock.
- **Risk + ranking rules are the spec** (`docs/API.md` §5/§6) and must stay in
  parity with the frontend's original logic. `scoring.classify` is the single
  source of truth (used by checkpoints *and* the grid).
- **Weather is batched:** `planner.plan` collects every checkpoint across all
  routes and makes **one** `forecast_many` call. Don't reintroduce per-checkpoint
  or per-route calls (that was 38s + rate limits).
- Tests use `APIRequestFactory` (not `APIClient` — it pulls in `contrib.auth`).
  Plan/field tests pin the synthetic provider and use **now-relative** departures
  (`_dep(hours)`). Real providers (ORS/Open-Meteo) are tested with **mocked** HTTP.

## Gotchas that will bite you

- **`REST_FRAMEWORK["UNAUTHENTICATED_USER"] = None`** must stay — without
  `contrib.auth` installed, DRF otherwise imports `AnonymousUser` → `contenttypes`
  → crash on every request.
- **`TIME_ZONE = "UTC"`** must stay — Django's default is `America/Chicago`, which
  silently shifts parsed ETAs by hours.
- **`runserver` does NOT reload `.env`** — restart the server after editing
  `apps/api/.env`.
- **ORS free tier** only returns alternative routes under ~100 km (error 2004);
  `OrsRoutingProvider` retries without alternatives → long trips get 1 route.
- **Weather outage is handled:** if `forecast_many` raises, the planner marks
  checkpoints `no_data` and still returns 200 (don't "fix" this into a 500).
- `DEBUG=1` enables CORS-allow-all; for prod set `CORS_ALLOWED_ORIGINS`.

## Commits

Conventional-commit style, small and testable (e.g. `feat(api): …`, `fix(api): …`).
Keep `./.venv/bin/python manage.py test` green.
