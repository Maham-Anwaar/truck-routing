# api — DRF backend (planned)

The Django REST Framework backend that serves the frontend in `apps/web`.

Not implemented yet. The wire contract it must satisfy — endpoints, request/
response shapes, the risk-scoring and ranking rules, and the division of
responsibility — is specified in [`../../docs/API.md`](../../docs/API.md).

Reference implementation for the scoring/ranking logic to port:
`apps/web/src/domain/` (`weather.js`, `routes.js`).
