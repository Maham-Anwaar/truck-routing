# Truck Routing — Backend API Contract

The spec the frontend expects, for implementation in **Django REST Framework**.
It covers the request/response shapes, the exact **risk-scoring** and **ranking**
rules the backend must reproduce, and DRF notes.

> The current frontend generates all of this synthetically in `src/domain/`.
> That logic is the reference implementation — port it to the backend. Nothing
> in `src/domain/` needs to match this document's field *names*; this document
> defines the **wire format** the frontend will consume once the API exists.

**Division of responsibility — the backend does the heavy lifting.** It owns all
routing, weather lookups, risk scoring (§5), ranking (§6), and the heatmap risk
grid (§3.4), and returns data that's ready to display. The frontend is a thin
presentation layer: it draws what the API sends and only does light visual
derivation from it (segment colors, truck/badge placement, the risk bar, ETA
formatting, and the heatmap's fade+blur). It does **not** recompute risk or
ranking, and once the backend is live it uses **only** real API data — no
synthetic/dummy fallback.

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| **Base path** | `/api/` (suggested) |
| **Times** | Always **UTC**, ISO-8601 with `Z`, e.g. `"2026-10-15T06:00:00Z"`. The frontend converts to the viewer's timezone for display. Never send local times or offsets. |
| **Coordinates** | `{ "lat": <number>, "lon": <number> }` (decimal degrees, WGS84). |
| **Geometry** | Polylines are `[[lat, lon], …]` arrays — **not GeoJSON**. GeoJSON (`[lon, lat]` LineString) isn't needed; keep the simple `[lat, lon]` order the frontend uses. |
| **Units in names** | Fields carry units: `Mi` (miles), `Hr` (hours), `Mph`, `InHr` (inches/hour), `Lb` (pounds). |
| **Enums** | Lower-snake-case strings (see §2). Risk levels also carry a numeric `levelIndex` for ordering. |
| **Casing** | JSON keys are `camelCase`. In DRF set `NamespaceVersioning`/renderer or a camelCase renderer (e.g. `djangorestframework-camel-case`) so Python stays `snake_case`. |
| **Auth** | The frontend sends a bearer token if present: `Authorization: Bearer <token>`. Decide the scheme; the data below is not user-specific. |
| **Errors** | Standard DRF: `400` with `{ "field": ["message"] }` for validation, `404` for unknown places/no route. See §7. |

---

## 2. Enums

**Risk level** (`level` + `levelIndex`):

| index | slug | meaning |
| --- | --- | --- |
| 0 | `low` | Low |
| 1 | `moderate` | Moderate |
| 2 | `high` | High |
| 3 | `severe` | Severe |
| 4 | `no_travel` | No Travel |

Colors/glyphs for these are **frontend-only** — do not send them.

**Checkpoint status** (`status`):

| slug | meaning |
| --- | --- |
| `ok` | scored normally |
| `no_data` | weather service returned nothing here; excluded from ranking |
| `beyond_forecast` | ETA is past the 48 h forecast horizon; excluded from ranking |

**Ranking rule** (`decidedBy`): `fewest_severe_miles` · `fewest_high_miles` ·
`lowest_average_risk` · `shortest_time`.

**Weather driver** (`driver`): `wind` · `rain` · `snow` · `null`.

---

## 3. Endpoints

### 3.1 `GET /api/places?q=<query>`

Autocomplete / geocode for the origin & destination fields. Match on name.
Return at most ~8. `q` under 3 chars → empty list. **Omitting `q` entirely
returns the full list** — the frontend calls this once at startup to cache the
places (so it can resolve coordinates for a picked trip without a round-trip per
keystroke).

```json
{
  "places": [
    { "id": "dallas-tx", "name": "Dallas", "region": "TX", "label": "Dallas, TX", "lat": 32.78, "lon": -96.80 }
  ]
}
```

- `label` is what the UI shows and sends back (`"Dallas, TX"`).
- `id` is a stable slug the backend owns.

### 3.2 `POST /api/routes/plan`  ← the core endpoint

Plan routes, score every checkpoint against the forecast at its **ETA**, and
rank. This is where the weather + routing providers are called server-side.

**Request**

```json
{
  "origin":        { "lat": 32.78, "lon": -96.80 },
  "destination":   { "lat": 44.98, "lon": -93.27 },
  "departureUtc":  "2026-10-15T06:00:00Z",
  "loadLb":        42000,
  "checkpointSpacingMi": 25
}
```

| field | type | notes |
| --- | --- | --- |
| `origin`, `destination` | `{lat,lon}` | Resolve via `/places` first. Must differ. |
| `departureUtc` | ISO-UTC | Must be within `[now − 15 min, now + 48 h]`. |
| `loadLb` | int | `0 … 80000`. Affects risk escalation (§5). |
| `checkpointSpacingMi` | int | One of `10`, `25`, `50`. Weather is sampled every this many miles. |

**Response** — see §4 for a full example. Shape:

```jsonc
{
  "departureUtc": "2026-10-15T06:00:00Z",
  "forecastHorizonUtc": "2026-10-16T14:47:00Z",   // last ETA that can be scored
  "checkpointSpacingMi": 25,
  "loadLb": 42000,
  "recommendedRouteId": "A",
  "ranking": {
    "decidedBy": "fewest_high_miles",
    "order": ["A", "C", "B"],                      // best → worst
    "explanation": "0 severe miles, 150 high (C: 175). Also the fastest.",
    "narrative": "A and C tied on Severe miles; A has 25 fewer High miles."
  },
  "routes": [ /* Route objects, see §4 */ ]
}
```

**Route object**

```jsonc
{
  "id": "A",
  "name": "via I-35 N",
  "distanceMi": 1005,
  "durationHr": 16.47,
  "avgSpeedMph": 61,
  "geometry": [[32.78,-96.80],[35.47,-97.52], /* … */ [44.98,-93.27]],  // [lat,lon] polyline (not GeoJSON)
  "summary": {
    "severeMi": 0,            // Severe + No-Travel miles, rounded
    "highMi": 150,
    "avgRisk": 1.5,           // mean of (levelIndex + 1) over scored checkpoints
    "maxRiskLevel": "moderate",
    "riskBreakdownMi": {      // miles at each level; sums ≈ distanceMi
      "low": 855, "moderate": 150, "high": 0, "severe": 0, "no_travel": 0, "no_data": 0
    }
  },
  "checkpoints": [ /* Checkpoint objects */ ]
}
```

**Checkpoint object**

```jsonc
{
  "index": 0,
  "mileMarker": 0,
  "coord": { "lat": 32.78, "lon": -96.80 },
  "etaUtc": "2026-10-15T06:00:00Z",       // departureUtc + (mileMarker / avgSpeedMph) hours
  "status": "ok",
  "weather": { "windGustMph": 12, "rainInHr": 0.00, "snowInHr": 0.0 },   // null when status != ok
  "risk": {
    "level": "low",
    "levelIndex": 0,
    "driver": null,                        // which factor set the level; null at low
    "escalationRule": null                 // human string when a load rule raised the level (§5)
  }
}
```

- `geometry` is the drawable polyline. Checkpoints are the **sampled** points
  (one every `checkpointSpacingMi`, plus the destination); they are a subset of
  interest, not the whole polyline.
- `etaUtc` **must** be absolute UTC. The frontend derives "+16 h 30 min" from it.

### 3.3 `GET /api/config/risk-levels`  (optional)

Lets the backend own the numeric thresholds (§5) without a frontend release.
Return numbers only — the frontend keeps the colors/labels.

```json
{
  "levels": [
    { "level": "low",       "levelIndex": 0, "windMphMax": 25, "rainInHrMax": 0.10, "snowInHrMax": 0.5 },
    { "level": "moderate",  "levelIndex": 1, "windMphMax": 35, "rainInHrMax": 0.25, "snowInHrMax": 1.0 },
    { "level": "high",      "levelIndex": 2, "windMphMax": 45, "rainInHrMax": 0.50, "snowInHrMax": 2.0 },
    { "level": "severe",    "levelIndex": 3, "windMphMax": 55, "rainInHrMax": 1.00, "snowInHrMax": 3.0 },
    { "level": "no_travel", "levelIndex": 4, "windMphMax": null, "rainInHrMax": null, "snowInHrMax": null }
  ]
}
```

### 3.4 `POST /api/weather/field`  ← the real heatmap

The animated heatmap samples the weather across a whole lat/lon **grid** (not
just the route), per forecast hour. This endpoint returns that field; the
frontend colors it, fades it to the route corridor, and blurs it.

**Request**

```json
{
  "bbox":          { "south": 30.8, "west": -107.5, "north": 49.4, "east": -84.3 },
  "departureUtc":  "2026-10-15T06:00:00Z",
  "fromHour":      0,
  "toHour":        48,
  "resolutionDeg": 0.2,
  "loadLb":        42000
}
```

| field | notes |
| --- | --- |
| `bbox` | Area to cover. The frontend sends the route-corridor bounds plus padding. |
| `fromHour`,`toHour` | Forecast hours **relative to `departureUtc`** (0 = departure). Return frames only up to the forecast horizon; trim the rest. |
| `resolutionDeg` | Grid step in degrees (default `0.2`). |
| `loadLb` | So the grid applies the same load escalation (§5) as the route checkpoints. |

**Response** — a stack of per-hour risk grids.

```jsonc
{
  "bbox": { "south": 30.8, "west": -107.5, "north": 49.4, "east": -84.3 },
  "resolutionDeg": 0.2,
  "rows": 93,                         // = round((north - south) / resolutionDeg)
  "cols": 116,                        // = round((east - west) / resolutionDeg)
  "rowOrder": "north_to_south",       // row 0 is the northmost
  "colOrder": "west_to_east",         // col 0 is the westmost
  "departureUtc": "2026-10-15T06:00:00Z",
  "frames": [
    {
      "hour": 0,
      "validUtc": "2026-10-15T06:00:00Z",
      "risk": [ [0,0,1,2,-1, /* …cols */ ], /* …rows */ ]   // levelIndex 0..4, or -1 = no data
    }
    // … one frame per hour in [fromHour, min(toHour, horizon)]
  ]
}
```

- Each `frame.risk` is a **rows × cols** matrix of risk `levelIndex` (0–4), with
  `-1` for cells with no data. Cell center = `(north − (row+0.5)·res, west + (col+0.5)·res)`.
- The frontend owns the **corridor mask**, **per-level opacity**, and **blur** —
  send only the raw risk field.
- **Payload:** prefer fetching **per hour or in small ranges** (`fromHour`/
  `toHour`) — the frontend warms frames lazily as the user scrubs the slider, so
  you don't need the whole 0–48 stack at once. A full stack is fine at `0.2°`
  but grows quickly at finer resolution.

#### What each grid cell contains — **decided: Option A (risk level)**

> **Decision:** the backend sends the **finished risk level** per cell (a number
> `0–4`); the frontend only paints it. The backend does the heavy lifting — it
> pulls the forecast, applies the §5 rules (including the load adjustment), and
> returns colors-ready data. This keeps all the "how risky is this" logic in one
> place (the backend), matching the route checkpoints. The rest of this section
> explains the choice for context.

For every cell of the heatmap, the backend can send **one of two things**:

- **Option A — the finished risk level** (a number `0–4`). The backend has
  already looked at the weather and decided "this spot is High." The frontend
  just paints the color. *(This is the doc's default.)*
- **Option B — the raw weather** (`windGustMph`, `rainInHr`, `snowInHr`). The
  backend sends the ingredients and the **frontend** works out the risk color
  itself.

Think of it like a traffic light: **Option A** sends you the light's color
(green/yellow/red) ready to show. **Option B** sends you the sensor readings and
makes you decide the color.

Why it matters, in plain terms:

- **Size.** Option A is much smaller — one tiny number per cell instead of three
  decimals. Over a big grid × many hours, that adds up.
- **Keeping things consistent.** The route checkpoints already get their risk
  from the backend. If the heatmap also gets its risk from the backend (Option
  A), there's **one place** that decides risk, so the map colors and the route
  colors always agree. With Option B, the "how risky is this weather" rules exist
  in **two places** (backend for routes, frontend for the heatmap) and can slowly
  drift apart if someone edits one and forgets the other.
- **Changing the truck's load.** Heavier loads mean higher risk. With Option A
  the load is already baked into the colors, so if the user changes the load you
  have to ask the server again. With Option B the frontend can recolor instantly
  without re-asking. (Load is usually set once per trip, so this rarely matters.)
- **Showing actual numbers.** If you ever want to show real values on the map
  ("wind 40 mph") or let users move the risk thresholds themselves, you **need**
  Option B — Option A never sends the numbers.

**We chose Option A (risk level)** so the backend carries the weight and the
frontend stays a thin painter. The only reason to revisit later is if you decide
to show real weather numbers on the map or let users move the thresholds
themselves — that would need Option B (raw weather), where the frontend applies
the §5 rules itself. Not planned for now.

---

## 4. Full example — `POST /api/routes/plan`

Dallas → Minneapolis, depart `2026-10-15T06:00:00Z`, 42,000 lb, 25 mi spacing.
(Truncated checkpoint list.)

```json
{
  "departureUtc": "2026-10-15T06:00:00Z",
  "forecastHorizonUtc": "2026-10-16T14:47:00Z",
  "checkpointSpacingMi": 25,
  "loadLb": 42000,
  "recommendedRouteId": "A",
  "ranking": {
    "decidedBy": "fewest_high_miles",
    "order": ["A", "C", "B"],
    "explanation": "0 severe miles, 150 high (C: 175). Also the fastest.",
    "narrative": "A and C tied on Severe miles; A has 25 fewer High miles."
  },
  "routes": [
    {
      "id": "A",
      "name": "via I-35 N",
      "distanceMi": 1005,
      "durationHr": 16.47,
      "avgSpeedMph": 61,
      "geometry": [[32.78,-96.80],[35.47,-97.52],[39.10,-94.58],[41.59,-93.62],[44.98,-93.27]],
      "summary": {
        "severeMi": 0, "highMi": 150, "avgRisk": 1.5, "maxRiskLevel": "moderate",
        "riskBreakdownMi": { "low": 855, "moderate": 150, "high": 0, "severe": 0, "no_travel": 0, "no_data": 0 }
      },
      "checkpoints": [
        {
          "index": 0, "mileMarker": 0,
          "coord": { "lat": 32.78, "lon": -96.80 },
          "etaUtc": "2026-10-15T06:00:00Z",
          "status": "ok",
          "weather": { "windGustMph": 12, "rainInHr": 0.00, "snowInHr": 0.0 },
          "risk": { "level": "low", "levelIndex": 0, "driver": null, "escalationRule": null }
        },
        {
          "index": 20, "mileMarker": 500,
          "coord": { "lat": 39.10, "lon": -94.58 },
          "etaUtc": "2026-10-15T14:12:00Z",
          "status": "ok",
          "weather": { "windGustMph": 38, "rainInHr": 0.18, "snowInHr": 0.0 },
          "risk": { "level": "high", "levelIndex": 2, "driver": "wind", "escalationRule": null }
        }
      ]
    }
  ]
}
```

---

## 5. Risk scoring (the backend must reproduce this)

Reference: `src/domain/weather.js` → `risk()`, and `THRESHOLDS`.

**Per-factor level** (0–4) by upper bound:

| level | wind gust (mph) | rain (in/hr) | snow (in/hr) |
| --- | --- | --- | --- |
| 0 low | `< 25` | `< 0.10` | `< 0.5` |
| 1 moderate | `25–34` | `0.10–0.24` | `0.5–0.9` |
| 2 high | `35–44` | `0.25–0.49` | `1.0–1.9` |
| 3 severe | `45–54` | `0.50–1.00` | `2.0–3.0` |
| 4 no_travel | `≥ 55` | `> 1.00` | `> 3.0` |

**Load-weight escalation** (applied to the wind level before combining):

1. wind level is `severe` (45–54 mph) **and** `loadLb > 30000` → raise to **No Travel**.
   `escalationRule = "Raised to No Travel: 45 to 54 mph wind with over 30,000 lb."`
2. else wind level is `high` (35–44 mph) **and** `loadLb > 40000` → raise to **Severe**.
   `escalationRule = "Raised to Severe: 35 to 44 mph wind with over 40,000 lb."`

**Combine:** `levelIndex = max(windLevel', rainLevel, snowLevel)`.
`driver` = the factor that produced the max (`wind` wins ties, then `rain`, then
`snow`); `null` when level is `low`. `escalationRule` is non-null only when the
escalation above set the level **and** `driver == "wind"`.

---

## 6. Ranking (the backend must reproduce this)

Reference: `src/domain/routes.js` → `rank()`.

Per route, over **scored** checkpoints only (`status == ok`):
- `severeMi` = miles at Severe + No-Travel
- `highMi` = miles at High
- `avgRisk` = mean of `(levelIndex + 1)`
- `durationHr` = distance ÷ avg speed

**Sort ascending by:** `severeMi`, then `highMi`, then `avgRisk`, then `durationHr`.
The first is `recommendedRouteId`. `decidedBy` is the first of those four keys on
which the top two routes differ. **Special case:** if every route stays `low` the
whole way, `decidedBy = "shortest_time"` (the fastest wins).

`explanation` (short) and `narrative` (one sentence) are human strings — see the
exact phrasings in `rank()`.

---

## 7. Errors

Use DRF defaults:

- **400** validation — `{ "departureUtc": ["Departure must be within the next 48 hours."], "loadLb": ["Enter a load between 0 and 80,000 lb."] }`
- **404** — unknown place id, or no drivable route between the two points
  (return `{ "detail": "No drivable route found between these places." }`; the
  frontend shows its no-route banner).

Validation rules: origin ≠ destination; `0 ≤ loadLb ≤ 80000`;
`now − 15 min ≤ departureUtc ≤ now + 48 h`.

---

## 8. DRF implementation notes

- **Keep the heavy compute server-side.** `/routes/plan` and `/weather/field` are
  not CRUD — make them `APIView.post` (or `@action`) endpoints that call your
  weather + routing providers, run the scoring (§5) and ranking (§6), and
  serialize the result. The providers' API keys live here, never in the frontend.
- **`/weather/field` is grid-heavy.** Pull the forecast once per request over the
  bbox, classify each cell with the §5 rules (reuse the same code as
  checkpoints), and return `levelIndex` matrices. Consider caching by
  `(bbox, resolutionDeg, departureUtc, loadLb, hour)` — the frontend re-requests
  hours as the user scrubs. A NumPy array → nested lists keeps the serializer
  trivial; add gzip (`GZipMiddleware`) since these responses compress well.
- **Serializers mirror §3/§4.** Suggested set: `CoordSerializer`,
  `WeatherSerializer`, `RiskSerializer`, `CheckpointSerializer`,
  `RouteSummarySerializer`, `RouteSerializer`, `RankingSerializer`,
  `PlanResponseSerializer`, plus a `PlanRequestSerializer` for input validation
  (put the §7 rules in its `validate_*` methods).
- **Times:** store/compute as timezone-aware UTC `datetime`; DRF's
  `DateTimeField` renders ISO-8601. Ensure `USE_TZ = True` and serialize in UTC
  (`...Z`), not the server's local zone.
- **camelCase:** Python stays `snake_case`; add `djangorestframework-camel-case`
  (or a custom renderer/parser) so the wire format matches this doc.
- **Places:** a model + `ListAPIView` with `SearchFilter` on name, or a static
  dataset — either is fine; the `label` round-trips as the UI's value.
- **Enums:** `TextChoices` for `level`, `status`, `decidedBy`, `driver`.

### 8.1 Chosen providers (backend)

| Capability | Provider | Key? |
| --- | --- | --- |
| **Routing** (geometry + alternatives) | **OpenRouteService (ORS) free tier** | ✅ `ORS_API_KEY` (server-side only) |
| **Weather** (point + grid) | **TBD** — NOAA/NWS (`api.weather.gov`) recommended (free, keyless, US) | — |
| **Geocoding** (`/places`) | **`apps/api/data/places.json`** (static) | ❌ none |

**Routing — OpenRouteService.** Use it to build the `routes` in `/routes/plan`;
the checkpoints, weather, risk, and ranking are still computed by the backend
(ORS only supplies the road geometry, distance, duration, and alternatives).

- **Sign up** free at openrouteservice.org → get an API key. Put it in the DRF
  env as `ORS_API_KEY`; send it as the `Authorization` header. **Never ship it
  to the frontend.**
- **Endpoint:** `POST /v2/directions/driving-hgv` — the **HGV (truck) profile**,
  which fits the load model (later pass weight/height via `options`).
- **Alternatives → A/B/C:** request `alternative_routes: { target_count: 3 }` in
  one call; map the returned routes to ids `A`, `B`, `C`.
- **Coordinate order:** ORS returns `[lon, lat]` (GeoJSON order). Our contract is
  **`[lat, lon]`** — flip them when building `geometry`.
- **Units:** ORS distance is **meters** (→ `distanceMi`), duration is **seconds**
  (→ `durationHr`).
- **Free-tier limits:** roughly **~2,000 requests/day** and a per-minute cap
  (verify current limits on your ORS dashboard). **Cache by (origin, dest,
  profile)** — road routes are stable, so caching keeps you well under the quota;
  only the weather layer changes per departure/load.

---

## 9. What the frontend does with the response

For context — the frontend **derives** the rest for rendering from the fields
above, so you don't send it:

- **Segment coloring** (map): splits `geometry` between consecutive checkpoints
  and colors each by the higher of the two checkpoints' `levelIndex`.
- **`at(mile)` / truck & badge placement:** interpolates along `geometry`.
- **Risk bar:** read directly from `summary.riskBreakdownMi`.
- **ETAs / "+16 h 30 min":** derived from `etaUtc − departureUtc`.
- **Heatmap:** colors the risk grid from `POST /weather/field`, fades it to the
  route corridor, and blurs it — fetched per forecast hour as the slider scrubs
  (§3.4).
