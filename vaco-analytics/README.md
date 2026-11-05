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
- `public/index.html` — the real interactive app (not the always-on
  wallboard above): three tabs, Dashboard/Alerts/Ingest, built on the
  shared `VACO.app`/`VACO.api`/`VACO.form`/`VACO.table`/`VACO.card`
  runtime every app in this repo uses. See "Frontend coverage pass"
  below for exactly which real routes each tab calls.
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

## Frontend coverage pass (31 Oct 2026)
`public/index.html` made real calls against only 4 of this app's 7
routes. The missing route wasn't a missing tab so much as dead code
already sitting in the file waiting for it — and two of the four
"covered" calls were themselves silently broken. Every field below
was checked against `server.js`, `metricsStore.js` and
`intelligence.js` and curl-verified against a running instance before
being written; nothing here is a guessed shape.

- **Dashboard sparklines, wired for real.** The dashboard tab has
  always had a `sparkline(m.series)` call and a real SVG renderer for
  it — but `GET /api/dashboard` (`getEcosystemSnapshot`) only ever
  returns the aggregate `{count, sum, avg, min, max, latest}`, never a
  `series` field, so the `if (m.series...)` guard was always false and
  the spark never drew. `GET /api/metrics/:app?metric=&limit=` — this
  app's second-most-basic route, and (before this) the one of the
  seven with zero callers anywhere in this file — carries the real
  per-event history that was missing. The dashboard now fetches each
  real series (skipping single-point ones; a line needs two points),
  reverses it to chronological order (the route answers newest-first),
  and hands it to the sparkline code that was already there.
- **`GET /api/health` strip.** Also never called from the UI at all.
  Now a one-line status on the Dashboard tab ("Service reporting
  normally · N app(s) with real ingested metrics") rather than its own
  tab, since it is one cheap field read off the same store.
- **Ingest tab, "Look up one app" — fixed, not just extended.** This
  called `GET /api/metrics/:app/summary` with no `metric` query
  param. The route requires one (`server.js`:
  `if (!metric) return res.status(400)...`), so every real lookup
  400'd. It then read `s.metrics` on the response, a field the real
  return value (a single `{app, metric, count, sum, avg, min, max,
  latest}` object, never a list) doesn't have — a second, independent
  mismatch that the first bug was masking. Fixed to ask for app *and*
  metric (what the route actually requires) and, since a summary alone
  doesn't show what happened, paired it with the real recent events
  from `GET /api/metrics/:app?metric=&limit=` in the same card.
- **Alerts tab — real fields, plus the filters the route already
  took.** The table read `a.severity` and `a.message`; the real alert
  shape (`evaluateMetric` in `intelligence.js`) has neither field, so
  every row rendered the fallback badge and an em-dash no matter what
  was actually raised. Replaced with the fields the handler really
  writes — `routedTo`, `reason`, `zScore`, `occurrences`, `lastSeenAt`
  — and added an App / Routed-to filter form, since
  `GET /api/intelligence/alerts` has always read `?app=` and
  `?routedTo=` off `req.query` with no UI ever sending either.
  `routedTo`'s three options (Leslie/Deskins/Qvan) come straight from
  `intelligence.js`'s own `ALERT_ROUTES` table.

**Left backend-only, by design:** `POST /api/intelligence/evaluate`.
`requireCallingService()` explicitly requires a service credential —
"not a user session" is in the route's own 403 message — and this app
has no login to hold one. Same posture already taken for
service-credential-gated routes elsewhere in this sweep (see void's
own "Frontend coverage pass" in `void/README.md`): a real backend
capability stays real rather than getting a fake admin button that
pretends to hold a credential the page doesn't have.

**Found, not fixed this round:** `POST /api/metrics/ingest` is also
now `requireCallingService()`-gated server-side (added after this
tab's "Push a metric" form was written), and a browser cannot present
`X-Service-Name`/`X-Service-Token` without baking a secret into the
page. The form as written will 403 in a deployment where that mode is
`enforce` (this app's default). Left open rather than papered over: a
server-side proxy credential or relabeling that one form as
backend-only is a real auth-posture call, not a frontend-coverage
one, and belongs in a follow-up pass that actually owns that
decision.

## Scheduled evaluation loop (1 Nov 2026)

Closes the "evaluateMetric() runs on demand via the API, not on a
timer" gap below — `evaluateAllMetrics` (new, `intelligence.js`)
sweeps every real `(app, metric)` pair the store has ever seen and
runs the identical `evaluateMetric` logic on each, deliberately with
no routing category (there is no stored mapping from a metric name to
the category it belongs to — inventing one would be a fabricated
classifier, not a real feature; an anomaly it finds still files and
pages, just `routedTo: null`, the same honest shape a manual call
with no category already produces).

Same real shape VOID's own retry-sweep/ride-pass-renewal loops already
use: a directly callable, `requireCallingService()`-gated route
(`POST /api/intelligence/evaluate-all`, testable without waiting out a
real interval) and a `setInterval` on a real cadence
(`VACO_ANALYTICS_EVAL_INTERVAL_MS`, default 5 minutes) calling the
identical function.

### Verification

`test/analytics.test.js` grew by 4 (every real pair swept exactly
once — not zero, not twice; a real anomaly files unrouted; an empty
store sweeps nothing without throwing; the store-shape guard). Full
suite: 43/43. Mutation-verified: breaking the pair-enumeration logic
turned exactly the two pair-sweep tests red; restored and reconfirmed
green. Live-verified against a real spawned server: ingested real
metrics for two (app, metric) pairs under a real service credential,
ran the sweep with no credential (401) and with one (found and filed
2 real, unrouted anomalies), confirmed a second immediate sweep found
the same 2 pairs but reported 0 new anomalies (the ongoing-episode
suppression already in `evaluateMetric` holding, not re-filing a
duplicate alert).

## Not yet built
- Real ClickHouse/VeloDB backing (infrastructure this sandbox can't
  provision or reach).
- A real hosted Geckoboard integration (the wallboard above is a
  self-hosted substitute, not the actual product).
- Historical charting/sparklines and the per-app drill-down view on
  the wallboard.
- Real integration with the named tools the doc mentions (Spellbook,
  ComplyAdvantage, Ascent, Workiva) — `routedTo` is just an
  identifying string.
- **Correction**: this list used to also say "auth/access control on
  the ingest endpoint" was missing. It wasn't — see this file's own
  "Frontend coverage pass" section just above, which already documents
  `POST /api/metrics/ingest` as `requireCallingService()`-gated.
  Stale line, removed.
- Only 7 of the ecosystem's real revenue-bearing apps feed live metrics
  in so far (vago, chopz-shop, vulture-music, void, vulture-flix,
  voken, vacay — see VACAY's own README for its `stay_platform_fee`
  wiring) — the same fail-soft `pushMetric` pattern extends cleanly to
  any other app that wants to report a real number.
- No VDP district or other UI surface linking to the wallboard yet.
