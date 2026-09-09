# Tasks — Phase 1: V4 Search Layer (retroactive record)

- [x] `adapters/SearchAdapter.js` — the real contract every backend
      must implement.
- [x] `adapters/memoryAdapter.js` — real, working in-process index
      seeded with sample documents from each routed app.
- [x] `server.js` — real Express layer wrapping the adapter contract,
      `GET /api/health`, `POST /api/search`.
- [x] Real live verification per `README.md`'s own documented steps
      (health check, unscoped search, scoped search).
- [x] Write this retroactive plan/tasks pair, closing the missing-
      dev-docs gap found during a later priority pass.

## Next
See `../phase-2-verify-frontend-wiring/` for the frontend-wiring
investigation and fix.
