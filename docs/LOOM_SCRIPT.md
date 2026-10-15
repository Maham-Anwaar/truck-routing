# 🎬 Loom Walkthrough — Script

A ~5-minute screen recording. Read the **bold spoken lines**; `[SHOW: …]` are stage
directions. Voice: senior engineer — lead with intent and tradeoffs, not a feature tour.

---

## Pre-flight checklist
- Backend up on `:8008`, frontend on `:5190`. Do a throwaway plan first to warm caches.
- Browser full-width, extra tabs closed, editor open on a second desktop for the code beat.
- Demo trip decided: **Dallas → Minneapolis**, depart **~now + 3h**, **10-mile** sampling.
  (Long, roughly north–south — reliably crosses a weather gradient.)

---

## 1 · Framing (~25s)
`[SHOW: empty start screen]`

> **"I'm Maham. This is a weather-aware route planner for trucks. The problem it
> solves: a dispatcher picking a long-haul route cares less about distance and more
> about what weather the truck hits *and when*. So the system generates candidate
> routes, samples the forecast at each route's own ETA, scores risk with a load-aware
> model, and recommends the best risk-versus-time tradeoff. Let me run it, then I'll
> go through the design decisions that actually matter."**

---

## 2 · Demo: generate a plan (~55s)
`[SHOW: fill origin / destination / departure / load]`

> **"Dallas to Minneapolis, departing in about three hours, loaded trailer, sampling
> every ten miles."**

`[SHOW: Plan → routes render]`

> **"Three candidates. The polyline is colored by a per-segment risk level — green
> through red — so the danger profile reads at a glance rather than as a number you
> have to interpret. The recommended route is promoted, and the truck marker sits on
> it."**

`[SHOW: click a checkpoint]`

> **"Each node is a checkpoint. The critical detail is on the popup: this is the
> forecast at that location *for the truck's arrival time*, not the current
> conditions. That time-shift is the whole premise — I'm scoring the weather the
> truck will actually encounter."**

---

## 3 · The core model: ETA → forecast → risk → ranking (~60s)
`[SHOW: side panel — the three routes and the 'why this one' breakdown]`

> **"Walking the pipeline. For each route I interpolate checkpoints along the
> geometry, derive an ETA per checkpoint — cumulative distance over the route's own
> speed, offset from departure — and sample the forecast at that timestamp. The speed
> isn't user input; it's implied by the provider's distance and duration, so the
> model stays honest to the road."**

> **"Risk is the max across wind, precipitation, and snow on a five-level scale, then
> escalated by load: strong crosswind on a heavy trailer is materially more dangerous
> than the raw number suggests, so the load rules bump it up."**

> **"Ranking is lexicographic — severe miles, then high-risk miles, then mean risk,
> then duration. Safety dominates; time is the tiebreaker. That's the literal
> encoding of 'balance risk and time,' and I surface the deciding factor so the
> recommendation is auditable, not a black box."**

---

## 4 · Heatmap + the animation performance work (~55s)
`[SHOW: point at the weather field under the routes]`

> **"The field layer is the regional forecast — real weather from Open-Meteo on a
> grid, rendered to a canvas raster and blurred, so you get continuous spatial
> context, not just point samples on the line."**

`[SHOW: scrub the 0–48h slider, let it play]`

> **"And it's time-aware across the full 48-hour horizon. Playing it advances the
> truck and re-renders the field together, so you can watch a system move into the
> corridor ahead of the truck."**

> **"This was the main performance problem. Naively re-rendering Leaflet every frame
> tanked the frame rate — the layer diff is expensive. So I decoupled the clocks: the
> slider runs at 60fps because it's cheap, the map re-renders at a throttled cadence,
> and the truck interpolates between those steps with a CSS transform transition.
> Perceptually continuous, but the expensive work runs an order of magnitude less
> often. I also memoized the map and panel and precompute the heatmap frames so
> playback doesn't stall on the first pass."**

---

## 5 · Architecture + a decision I'd defend (~55s)
`[SHOW: editor — repo structure, or keep the app up]`

> **"Structurally: React frontend, Django REST backend, and all the domain
> logic — routing, sampling, scoring, ranking — lives server-side. The frontend is a
> rendering layer. One source of truth for the math; the two tiers can't drift."**

> **"Weather and routing are both behind provider interfaces, selected by config. The
> defaults are keyless so it runs clean out of the box, and the real integrations drop
> in without touching call sites. That's also what makes it testable — I pin the
> synthetic providers and mock the HTTP, so the suite is deterministic and offline."**

> **"The decision I'd call out: weather fetching. Per-checkpoint calls were ~120
> requests, near 40 seconds, and rate-limited. I collect every checkpoint across all
> routes into a single batched forecast request — sub-second. Same correctness, two
> orders of magnitude better latency. That's the kind of tradeoff I look for."**

---

## 6 · Honest limitations + close (~25s)
`[SHOW: full app]`

> **"Two deliberate limitations, stated up front. Routes are synthetic by default,
> because the free routing tier only returns alternatives under ~100km, and comparing
> three candidates is the point — the real provider is wired in for shorter runs. And
> the heatmap is real but coarse; full resolution would be thousands of lookups per
> frame, so I trade spatial detail for a single batched call. Both are swap-in, not
> rewrites. That's the system — thanks for watching."**

---

## Delivery notes
- Beat of silence after each click — let the UI land before you talk over it.
- If a request is in flight, name it ("that's hitting live weather now") instead of filler.
- Say the numbers out loud — "120 calls, 40 seconds, down to sub-second." Specifics read as senior.
- Record in one pass but don't chase perfection; re-record a section rather than the whole thing.
- Target 4–5 min. If you're over, cut section 3's second paragraph and tighten section 5.
