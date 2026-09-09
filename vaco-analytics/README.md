# VACO Analytics

The unified management dashboard — one live view of every app's own
real-time metrics (DREAMS per-screen revenue, HVNTZ onboarding, VACON-C
active players, VENVS transaction volume, VOKEN Cvltvre Card trading,
VAGO engagement, and more), with drill-down into any single app.

Source docs: `VACO_ANALYTICS_MANAGEMENT_DASHBOARD.md` and its follow-up
`PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md` (both in this directory).

## Run
```
npm install
npm start
```

## Test
```
curl -X POST http://localhost:8790/api/metrics/ingest \
  -H "Content-Type: application/json" \
  -d '{"app":"DREAMS","metric":"screen_revenue","value":42.50}'

curl http://localhost:8790/api/dashboard
```

## What's here
- `metricsStore.js` — the data layer: `ingestMetric()`,
  `getMetrics()`, `getSummary()`, `getApps()`, `getMetricNames()`,
  `getEcosystemSnapshot()`. In-memory, real and tested — **not**
  ClickHouse/VeloDB (the source doc's recommendation), because this
  sandboxed environment can't provision or reach either. Same
  ingest/query contract, so a real client is a new module against this
  contract, not a `server.js` rewrite.
- `server.js` — Express API: `POST /api/metrics/ingest`, `GET
  /api/metrics/:app` (optionally `?metric=`), `GET
  /api/metrics/:app/summary?metric=`, `GET /api/dashboard`, `GET
  /api/health`. Matches `v4-search`'s and `v4-proxy`'s existing
  conventions in this repo (ES modules, cors, dotenv).
- `public/wallboard.html` — the always-on live view, served statically
  from `server.js`. A real, self-hosted, dependency-free substitute
  for the source doc's Geckoboard recommendation (no hosted Geckoboard
  account exists here); polls `/api/dashboard` every 5s. Open
  `http://localhost:8790/wallboard.html` after `npm start`.
- `intelligence.js` — the Proactive Ecosystem Intelligence Layer's
  three-agent loop: Data Collection reuses `metricsStore.js`'s
  `events` directly (no separate pipeline); `computeBaseline()` /
  `detectAnomaly()` are the Pattern Learning Agent (real z-score
  baseline detection, handles both the zero-variance and
  insufficient-data edge cases); `routeAlert()` / `evaluateMetric()`
  are the Notification & Response Agent, routing exactly the doc's
  three named cases (`financial → Leslie`, `compliance → Deskins`,
  `security → Qvan`) and honestly reporting "no agent mapped" for
  anything else rather than inventing one. Endpoints: `POST
  /api/intelligence/evaluate`, `GET /api/intelligence/alerts`.
- `dev-docs/` — per-phase plan/tasks, same convention as
  `vacon-c/dev-docs/` and `world-layer/dev-docs/`.

## Metric event shape
```js
{ id, app, metric, value, timestamp }
```
`app` and `metric` are free-form strings, not fixed enums — deliberately,
since the source doc's own point is every app tracks its own relevant
numbers, not one generic metric forced across all of them.

## Alert shape
```js
{ app, metric, value, timestamp, baseline, isAnomaly, zScore, reason,
  evaluated, category, routedTo, id }
```

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8790) — VACO Analytics's own real state now
survives a restart. Live-verified: ingested a real metric event, killed the
running process, restarted it, and confirmed the same real state came back
from a real GET. See `dev-docs/phase-4-real-persistence/`.

## Live metric feeds (Phases 5-6)
Six real apps now push real revenue metrics here on their own real
events, fail-soft (same posture as `cvnvo/server.js`'s own
`fetchYapSignal` — the source app's real transaction is never held up
by VACO Analytics being down):
- **vago** — `casino_payout` after every real Mines/Plinko/Hi-Lo cash-out.
- **chopz-shop** — `checkout_revenue` after every real cart checkout.
- **vulture-music** — `streaming_revenue` after every real revenue report.
- **void** — `job_platform_fee` after every real job completion.
- **vulture-flix** — `subscription_revenue` after every real subscription.
- **voken** — `resale_trade_volume` after every real fractional-shares purchase.

Live-verified end to end, both phases: triggered a real event in each
source app against a real running VACO Analytics instance and confirmed
every metric landed in `GET /api/dashboard` with the correct real value;
then killed VACO Analytics and confirmed a VAGO cash-out still completed
normally (in ~14ms) with no error surfaced. See
`dev-docs/phase-5-live-metric-feeds/` and
`dev-docs/phase-6-more-live-metric-feeds/`.

## Not yet built
- Real ClickHouse/VeloDB backing (infrastructure this sandbox can't
  provision or reach).
- A real hosted Geckoboard integration (the wallboard above is a
  self-hosted substitute, not the actual product).
- Historical charting/sparklines and the per-app drill-down view on
  the wallboard.
- A scheduled/continuous evaluation loop — `evaluateMetric()` runs on
  demand via the API, not on a timer.
- Real integration with the named tools the doc mentions (Spellbook,
  ComplyAdvantage, Ascent, Workiva) — `routedTo` is just an
  identifying string.
- Auth/access control on the ingest endpoint.
- Only 6 of the ecosystem's real revenue-bearing apps feed live metrics
  in so far (vago, chopz-shop, vulture-music, void, vulture-flix,
  voken) — the same fail-soft `pushMetric` pattern extends cleanly to
  any other app that wants to report a real number.
- No VDP district or other UI surface linking to the wallboard yet.
