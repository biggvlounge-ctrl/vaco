# Tasks — Phase 1: Metrics data layer

- [x] Create `metricsStore.js`: `createMetricsStore`, `ingestMetric`,
      `getMetrics`, `getSummary`, `getApps`, `getMetricNames`,
      `getEcosystemSnapshot`.
- [x] Create `server.js`: Express app matching `v4-search`'s
      conventions (ES modules, cors, dotenv, `/api/health`).
- [x] Create `package.json`, `.env.example`, `.gitignore`.
- [x] `npm install`, start the real server, verify live via `curl`
      (not just direct function calls — deleted no test files here
      since there weren't any, everything ran against the live HTTP
      server):
      - `/api/health` returns `{ ok: true, apps: [] }` before any data.
      - `POST /api/metrics/ingest` rejects missing `app`, missing
        `value`, and a non-numeric `value`, each with the correct
        error message.
      - Ingested 6 real events across 4 apps (DREAMS x3, HVNTZ,
        VACON-C, VENVS), matching the source doc's own named example
        metrics (`screen_revenue`, `scan_count`,
        `business_onboarding`, `active_players`,
        `transaction_volume`).
      - `GET /api/metrics/DREAMS?metric=screen_revenue` returns both
        events, newest first.
      - `GET /api/metrics/DREAMS/summary?metric=screen_revenue`
        returns `count: 2, sum: 100.75, avg: 50.38, min: 42.5, max:
        58.25, latest: 58.25` — hand-verified against the two ingested
        values (42.50 + 58.25).
      - Summary endpoint without `?metric=` returns a 400 with a clear
        error, not a crash.
      - Summary for an app+metric with zero events returns the
        zero-value shape (`count: 0`, nulls for min/max/latest), not
        an error.
      - `GET /api/metrics/DREAMS?limit=-1` rejects with a 400.
      - `GET /api/dashboard` returns a correct 4-app snapshot with
        correct per-metric summaries nested under each app.
      - `GET /api/health` after ingestion correctly lists all 4 apps
        that have reported.
      - Server shut down cleanly; confirmed via a follow-up `curl`
        that the port is no longer accepting connections.
- [x] Commit as its own change.

## Next
Phase 2 (wallboard display layer) and Phase 3 (Proactive Intelligence
Layer, from `PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md`) are the
believable next steps, not started here.
