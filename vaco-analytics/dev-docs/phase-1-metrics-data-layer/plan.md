# Plan — Phase 1: Metrics data layer

## Goal
First piece of `VACO_ANALYTICS_MANAGEMENT_DASHBOARD.md`: "a genuine,
live operations dashboard... generalized across all 14 real apps."
This phase is the data layer + ingestion/query API — the foundation
everything else (wallboard display, Proactive Intelligence Layer)
reads from.

## Real infrastructure constraint, confirmed up front
The doc recommends ClickHouse or VeloDB for "sub-second queries across
high-volume event data... with many people able to view live
simultaneously without lag." This sandboxed environment cannot
provision either — no database hosting available, and (confirmed
directly while building `world-layer`'s UNESCO import — a live `curl`
to an external host was rejected by the outbound proxy itself) no
network path to a hosted ClickHouse/VeloDB instance either. Built a
real, working in-memory substitute instead, with the same contract:
ingest an event, query by app/metric, aggregate. Swapping in a real
client later is a new module against this contract, not a rewrite of
`server.js`.

## Design
- `metricsStore.js`: `createMetricsStore()`, `ingestMetric(store,
  {app, metric, value, timestamp})`, `getMetrics(store, app, metric,
  {limit})`, `getSummary(store, app, metric)`, `getApps(store)`,
  `getMetricNames(store, app)`, `getEcosystemSnapshot(store)`.
- `app` and `metric` are free-form strings, not fixed enums — the
  source doc's own framing is "each app's own genuinely relevant
  numbers, not one generic metric forced across all of them," so a
  fixed metric list per app would contradict the doc's actual design
  intent. Same reasoning as `world-layer/propagation.js`'s free-form
  `eventType`.
- `server.js`: Express + cors + dotenv, matching `v4-search`'s and
  `v4-proxy`'s existing conventions in this repo (ES modules,
  `express.json()`, same health-check pattern) rather than
  introducing a third style into the same monorepo.
- Endpoints: `POST /api/metrics/ingest`, `GET /api/metrics/:app`
  (optionally filtered by `?metric=`), `GET
  /api/metrics/:app/summary?metric=`, `GET /api/dashboard` (full
  ecosystem snapshot), `GET /api/health`.
- `getSummary` on a metric with zero events returns a real zero-value
  object (`count: 0, sum: 0, avg: 0, min: null, max: null, latest:
  null`) rather than throwing — a dashboard querying a metric that
  hasn't reported yet is a normal case, not an error case.

## Explicitly NOT in this task
- No real ClickHouse/VeloDB — see constraint above.
- No wallboard/display layer (Geckoboard-style) — Phase 2.
- No Proactive Intelligence Layer (anomaly detection, alert routing)
  — Phase 3, from the follow-up
  `PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md` doc.
- No auth/access control on the ingest endpoint — this is an internal
  operations tool per the source doc's framing (a team-facing
  wallboard), not a public API; adding real auth is a real requirement
  once this leaves a prototype, not invented here.
- No persistence — an in-memory store means data doesn't survive a
  restart, same tradeoff every other in-memory `WorldState`-style
  store in this repo already makes (VACON-C's pre-Postgres phases,
  `world-layer`).

## Done when
- `ingestMetric` validates `app`, `metric`, and a numeric `value`,
  rejecting each failure case correctly.
- Ingesting real per-app metrics (DREAMS screen revenue, HVNTZ
  onboarding, VACON-C active players, VENVS transaction volume — the
  doc's own named examples) and querying them back returns correct
  data.
- `getSummary` computes correct `sum`/`avg`/`min`/`max`/`latest`
  across multiple events for the same app+metric, verified against
  hand-computed expected values, not just "did it return something."
- `getSummary` on an unqueried app+metric returns the zero-value shape
  instead of throwing.
- `GET /api/dashboard` returns a real cross-app snapshot after
  multiple apps have reported metrics.
- All of the above verified against a real running server via `curl`,
  not just unit-level function calls — matching how `v4-search` was
  verified, since this is also a live HTTP service, not a library.
