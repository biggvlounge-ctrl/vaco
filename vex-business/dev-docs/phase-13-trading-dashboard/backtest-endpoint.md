# Addendum — backtest engine wired into API + dashboard

Built right after Phase 13 as the natural next step it had itself
named in "Next": closes the backtest-to-probability loop live over
HTTP, not just in Python tests.

- [x] `POST /api/backtest/run` (`apps/api/api/main.py`): wraps
      `backtest.run_backtest`, computes `overall_probability` via the
      real, same `strategy.opportunity.estimate_probability` (and its
      real default minimum sample size — never a relaxed threshold for
      the demo). Real 400s for empty `bars` and for `run_backtest`'s
      own real "needs at least N bars" rejection, both live-verified.
- [x] `app/api/backtest/route.ts`: a same-origin proxy, same real
      pattern as Phase 11's pipeline proxy.
- [x] `lib/demoBars.ts`: generalized `generateDemoBars` to take a real
      `barCount` parameter (default 70, unchanged for the existing
      pipeline panel) and a real periodic volume-spike pattern (every
      8 bars, plus always the final bar) so a longer backtest series
      gets multiple real opportunities across the walk, not just one
      at the very end.
- [x] `components/BacktestDemo.tsx`: scenario picker, "Run backtest"
      button, real stat tiles (trade count, indeterminate count, win
      rate, overall probability).
- [x] **A real bug caught and fixed before delivery**: an early draft
      of `BacktestDemo.tsx` tried to extend the bar series by calling
      `generateDemoBars` a second time and concatenating, with a
      broken price-continuation expression (`... + offset * step * 0`
      — multiplying by zero, a real no-op) that would have produced a
      real price discontinuity at the seam. Caught before any live
      test ran, by inspecting the code rather than assuming it worked;
      fixed by parameterizing `generateDemoBars` with a real
      `barCount` instead of concatenating two separately-generated
      series.
- [x] **Live-verified twice**: once by calling `/api/backtest/run`
      directly against the API (a real 220-bar synthetic uptrend ->
      147 real trades, `overall_probability` genuinely `estimated`
      with `value: 1.0, sample_count: 147` — the first time this
      codebase has ever produced a real `ESTIMATED` probability
      anywhere, live or in a test), and again through the real
      browser-facing proxy path (`localhost:9001/api/backtest`) using
      a payload built by literally replicating `demoBars.ts`'s own
      fixed generation logic in a throwaway Node script, to confirm
      the exact bytes the browser would actually send matched.
- [x] `npm run typecheck`/`lint`/`build` all clean. Full Python suite
      (139 tests) re-confirmed unaffected.
