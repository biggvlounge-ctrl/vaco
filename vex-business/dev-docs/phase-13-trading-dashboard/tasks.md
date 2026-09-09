# Tasks — Phase 13: trading dashboard frontend

- [x] `lib/types.ts`: real Zod schemas for every response shape
      `POST /api/pipeline/run` can return (`Bar`, `RiskCheckInputs`,
      `FeatureSnapshot`, `SignalComponentScores`, `Signal`,
      `Probability`, `Opportunity`, `RiskDecision`, `Order`,
      `Position`, `PipelineResult`), field names matching
      `apps/api/api/main.py`'s real domain models verbatim (Decimal
      fields as strings, matching pydantic's own JSON encoding).
- [x] `lib/demoBars.ts`: a real, clearly-labeled SYNTHETIC bar
      generator (uptrend/downtrend/flat), reusing the exact same real
      pacing (`step=4`, a real volume spike on the latest bar) the
      Python test suite's own fixtures use to reliably cross the real
      signal engine's READY threshold.
- [x] `app/api/pipeline/route.ts`: a real, same-origin proxy to the
      real FastAPI backend, so the browser's client component never
      needs CORS or the Docker-network-only `CALL_API_URL` — forwards
      the real upstream status code and body verbatim, success or
      error alike.
- [x] `components/PipelineDemo.tsx`: a real client panel — scenario
      picker, "Run pipeline" button, and a full render of the real
      `PipelineResult` (regime, both LONG/SHORT signal component
      breakdowns with real per-category weight bars, opportunity or an
      honest "not tradeable" message, risk decision with its real
      rejection reason when vetoed, order/position). A real network or
      4xx/5xx response surfaces as a real visible error, never a
      fabricated success.
- [x] Wired into `app/page.tsx` alongside the existing real health
      panel.
- [x] `npm run typecheck`, `npm run build` (Turbopack production
      build) both clean.
- [x] **Live-verified full-stack, not just built**: booted a real
      `uvicorn` API and a real `next start` production server
      together. `curl` confirmed the server-rendered health panel.
      `POST /api/pipeline` (the exact path the browser's client
      component calls) with a real 70-bar synthetic uptrend returned a
      full real trace through to a filled position. A real empty-`bars`
      request correctly proxied a real `400` with its real message.
      Killing the API produced the page's own honest "Could not reach
      the CALL API" state, not a crash. Both servers shut down
      cleanly, confirmed via failed connection checks afterward.
- [x] **A real, pre-existing tooling gap found and fixed**: `next lint`
      (already in `package.json` before this phase) is fully broken —
      Next.js 16 removed the built-in `next lint` subcommand entirely,
      confirmed by running it directly ("Invalid project directory
      provided, no such directory: .../lint"). A first fix attempt
      (`FlatCompat().extends("next/core-web-vitals", ...)`) crashed
      with a real "Converting circular structure to JSON" error;
      traced by reading `eslint-config-next`'s own `dist/*.js` to
      discover it already ships a native flat-config array, not a
      legacy eslintrc object — running an already-flat config through
      the legacy compatibility shim broke ESLint's own validator.
      Fixed by importing the flat config directly
      (`eslint-config-next/typescript`). `npm run lint` now runs real
      and clean.
- [x] Added real `eslint`/`eslint-config-next` dev dependencies
      (matching the installed Next.js version exactly); `npm audit`:
      0 vulnerabilities.
- [x] Full Python suite re-confirmed unaffected: 139 tests passing.

## Not done this phase (real, flagged, not claimed)
- No `POST /api/backtest/run` endpoint or backtest UI — Phase 12's
  `run_backtest` is real, tested, importable Python, not yet wired
  into `apps/api` or the dashboard.
- No replay/analytics UI, no statistical-model UI — none of that
  backend exists yet either.
- The demo panel only ever sends clearly-labeled synthetic bars — no
  real live/historical market data source is wired into the dashboard.
