# Plan — Phase 3: Proactive Ecosystem Intelligence Layer

## Goal
`PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md`'s three-agent monitoring
loop: Data Collection Agent → Pattern Learning Agent → Notification &
Response Agent, sitting on top of Phase 1's data.

## Design
- **Data Collection Agent**: not a separate module. The doc's own
  field list says it reads "continuous-telemetry-from-vaco-analytics"
  — that's exactly `metricsStore.js`'s existing `events` array.
  Building a second collection pipeline duplicating Phase 1 would
  contradict the doc's own description of what this agent does.
- **Pattern Learning Agent**: `computeBaseline(values)` (mean +
  population stddev over a plain array of numbers) and
  `detectAnomaly(value, baseline, { threshold })` (z-score against
  that baseline, default `threshold: 2`). Two real edge cases handled
  explicitly:
  - `baseline.count < 3`: too little history to trust a mean/stddev —
    returns `{ isAnomaly: false, reason: 'insufficient_baseline_data'
    }` rather than a false anomaly on thin data.
  - `baseline.stddev === 0` (every historical value identical): a
    plain z-score divides by zero here. Handled as its own path — any
    different value is flagged anomalous with `reason:
    'zero_variance_deviation'` and `zScore: null` (there's no
    meaningful z-score when the historical spread is exactly zero;
    reporting `null` rather than `Infinity` keeps the field
    JSON-safe).
  - No formula is specified in any source doc — z-score against a
    population baseline is a real, standard, testable choice, flagged
    as interpretive, same honesty as every other undocumented formula
    in this project.
- **Notification & Response Agent**: `routeAlert(category)` against
  `ALERT_ROUTES`, which is **exactly and only** the doc's three named
  examples (`financial → Leslie`, `compliance → Deskins, security →
  Qvan`). A category outside that list returns `routedTo: null` with
  an explicit reason — invented a fourth persona for "everything else"
  was considered and rejected, since no source doc names one; better
  to surface "nobody's mapped to this yet" than silently make someone
  up.
- **`evaluateMetric(store, app, metric, options)`** is the actual
  three-agent pipeline glued together: pulls that app+metric's history
  from `store.events` (Data Collection), builds a baseline from all
  but the latest event and checks the latest value against it (Pattern
  Learning), and — only if it's a real anomaly — routes it and pushes
  it to `store.alerts` (Notification & Response). A non-anomalous
  evaluation is *not* stored — `store.alerts` is a log of things that
  actually mattered, not every check ever run.
- Wired into `server.js`: `POST /api/intelligence/evaluate` (run an
  evaluation on demand), `GET /api/intelligence/alerts` (query the
  alert log, optionally by `app`/`routedTo`).
- `store.alerts` / `store.nextAlertId` added directly to
  `createMetricsStore()`'s return shape (Phase 1) rather than a
  separate store object — this package's one growing shared-state
  object, same convention `world-layer`'s `createWorldLayer()` already
  established across its own phases.

## Explicitly NOT in this task
- No actual scheduled/continuous evaluation loop — `evaluateMetric` is
  called on demand (via the API) in this phase, not on a timer. A
  cron-style "re-evaluate every app+metric every N seconds" driver is
  a believable next step, not built here.
- No real ML/learned model — "Pattern Learning Agent" here means a
  real statistical baseline (mean/stddev), not a trained model. The
  doc's own "documented results already achieved elsewhere" example
  doesn't specify its internals either.
- No wiring to real named-agent tooling (Spellbook, ComplyAdvantage,
  Ascent, Workiva mentioned in the doc) — `routedTo` is just a string
  identifying who should act; actually notifying Leslie/Deskins/Qvan
  through their real tools is out of scope for this pass.

## Done when
- `computeBaseline` validates input and computes correct mean/stddev
  against hand-checked values.
- `detectAnomaly` handles all three cases correctly: insufficient
  data, zero-variance, and normal z-score threshold — verified with
  both a clear non-anomaly and a clear anomaly in the z-score case.
- `routeAlert` returns exactly the doc's three mappings and correctly
  reports "no agent mapped" for anything else, rather than inventing
  one.
- `evaluateMetric` end-to-end: insufficient data short-circuits
  correctly; a real spike (500 against a steady ~50 baseline) is
  detected, correctly routed when a category is given, and correctly
  pushed to `store.alerts` with an id; steady, non-anomalous data is
  *not* pushed; an anomaly without a category is still flagged and
  recorded, just left unrouted; the zero-variance path is exercised
  through the full pipeline, not just the unit function.
- `getAlerts` filters correctly by `app` and `routedTo`.
- All of the above additionally verified against a real running
  server via `curl` (`POST /api/intelligence/evaluate`, `GET
  /api/intelligence/alerts`), not just direct function calls.
- Regression: Phases 1-2 unaffected.
