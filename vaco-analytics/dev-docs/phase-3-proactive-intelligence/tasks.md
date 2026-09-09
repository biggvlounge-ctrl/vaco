# Tasks — Phase 3: Proactive Ecosystem Intelligence Layer

- [x] Add `alerts: []`, `nextAlertId: 1` to `createMetricsStore()` in
      `metricsStore.js`.
- [x] Create `intelligence.js`: `computeBaseline`, `detectAnomaly`,
      `routeAlert`, `evaluateMetric`, `getAlerts`, `ALERT_ROUTES`.
- [x] Wire `server.js`: `POST /api/intelligence/evaluate`, `GET
      /api/intelligence/alerts`.
- [x] Verify (throwaway script, run with `node`, deleted after — 27
      checks):
      - `computeBaseline` throws on an empty/non-array input; computes
        correct mean/stddev on `[10,10,10,10]` (mean 10, stddev 0) and
        `[10,20,30]` (mean 20, stddev ≈8.16, hand-checked).
      - `detectAnomaly` throws on a non-numeric value or a missing/
        invalid baseline.
      - `baseline.count < 3` → `insufficient_baseline_data`, not a
        false anomaly.
      - Zero-variance baseline: identical value → not anomalous,
        `zScore: 0`; different value → anomalous,
        `reason: 'zero_variance_deviation'`.
      - Normal z-score path: mild deviation (22 vs. mean 20) → not
        anomalous; strong deviation (45 vs. mean 20) → anomalous.
      - `routeAlert` returns exactly `financial→Leslie`,
        `compliance→Deskins`, `security→Qvan`; an unmapped category
        (`'marketing'`) returns `routedTo: null` with an explicit
        reason, not an invented agent.
      - `evaluateMetric` with fewer than 4 events → `evaluated:
        false`, `reason: 'insufficient_data'`.
      - A real spike (steady ~50 then 500) is correctly detected,
        baseline correctly built from only the first 4 events (mean
        50.5), correctly routed to Leslie under `category: 'financial'`,
        and correctly pushed to `store.alerts` with an id.
      - Steady, non-anomalous data (HVNTZ onboarding) evaluates to
        `isAnomaly: false` and is *not* added to `store.alerts`.
      - The zero-variance anomaly path exercised end-to-end (VOKEN
        trading_activity steady at 10 then a jump to 40), correctly
        routed to Qvan under `category: 'security'`.
      - An anomaly evaluated without a `category` (VAGO engagement) is
        still flagged and still recorded in `store.alerts`, with
        `routedTo: null`.
      - `getAlerts()` returns all 3 recorded alerts; filtered by
        `app: 'DREAMS'` returns 1; filtered by `routedTo: 'Qvan'`
        returns 1.
- [x] Verified again against a real running server via `curl`:
      - `POST /api/intelligence/evaluate` with missing `app`/`metric`
        returns a 400.
      - Evaluating before any data exists returns `evaluated: false`.
      - Ingesting the same 4-steady-then-spike sequence live and
        evaluating with `category: 'financial'` correctly returns
        `routedTo: 'Leslie'`.
      - `GET /api/intelligence/alerts` and the `?routedTo=Leslie`
        filter both return the correct alert.
      - Server shut down cleanly.
- [x] Commit as its own change.

## Next
This completes both source docs (`VACO_ANALYTICS_MANAGEMENT_
DASHBOARD.md` and `PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md`). A
scheduled/continuous evaluation loop (instead of on-demand via the
API) is the clearest believable next step, not built here. Real
integration with the named tools (Spellbook, ComplyAdvantage, Ascent,
Workiva) is also not attempted — `routedTo` is just an identifying
string in this pass.
