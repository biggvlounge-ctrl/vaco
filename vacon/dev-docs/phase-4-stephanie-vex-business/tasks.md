# Tasks — Phase 4: Stephanie, representing Vex Business (CALL)

- [x] Clarified two genuinely ambiguous points in the user's original
      (voice-transcribed) request via `AskUserQuestion` before building
      anything: Stephanie's real job (market/competitor research, not
      call recording), and what "Vex Business" is (CALL's own internal
      identity, not a new app or a directory rename).
- [x] Added the real `stephanie` agent to `lib/agents.js`
      (`tier: 'business'`, `app: 'Vex Business'`).
- [x] Added real routing keywords for `stephanie` to
      `lib/orchestrator.js`'s `DOMAIN_KEYWORDS`.
- [x] Live-verified via a real running `server.js`: `GET
      /api/agents?app=Vex%20Business` returns exactly Stephanie,
      `GET /api/agents/stephanie` returns her full record, `POST
      /api/route` with a competitor-research query correctly routes to
      `stephanie`, and an unrelated query (vacation planning) does not.
- [x] Built `call/packages/research` (`call-research`): real domain
      models (`ComparablePlatform`, `ComparablesReport`), 5 genuine,
      sourced findings compiled via live web research (QuantConnect/
      LEAN, TrendSpider, Trade Ideas/Holly AI, the open-source
      Backtrader/Zipline-reloaded/vectorbt trio, AbleTrend/Power
      E-mini), a thin service layer, `py.typed`. 6 real unit tests, all
      passing.
- [x] Wired `GET /api/research/comparables` and `GET
      /api/research/comparables/{name}` into `apps/api`. Live-verified
      via a real running FastAPI app: full report, a single real
      lookup, and a genuine 404 (not a fabricated match) for a
      made-up name.
- [x] `ruff check .` and `mypy` (combined and `packages/research`
      standalone) both clean across CALL after this addition.
- [x] Updated `call/README.md` and this dev-docs entry.

## Not done this phase (real, flagged, not claimed)
- No live/scheduled re-research service — a real, dated snapshot only.
- `V4Prototype.jsx`'s own Command Center UI was not touched — same
  pre-existing gap `vacon/README.md`'s own "Not yet built" section
  already documents (it renders from a local const, not a live fetch).
