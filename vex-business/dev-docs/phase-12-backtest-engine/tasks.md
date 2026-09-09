# Tasks — Phase 12: backtest engine

## Section 21 — event-driven backtest engine, no-look-ahead-bias enforcement
- [x] `backtest.engine.evaluate_forward_outcome`: walks forward from a
      real opportunity's own bar index, checking each subsequent real
      bar's high/low against target/stop. Real, honest resolution for
      intrabar ambiguity (both touched in one bar -> stop, matching
      the risk engine's own "risk first" posture) and for running out
      of `max_holding_bars` (a real, separate "indeterminate," never
      folded into wins or losses).
- [x] `backtest.engine.run_backtest` + `BacktestResult`/`BacktestTrade`:
      walks a real bar series forward one step at a time, computing
      each real feature/regime/signal/opportunity/risk decision from
      only `bars[:i+1]` — the real, structural no-look-ahead-bias
      property Section 21 names explicitly. Real, flagged
      simplifications stated directly in the module docstring: no
      concurrent-open-position tracking across the backtest (every
      step evaluated as if flat), every bar treated as an ongoing
      `"regular"` session, and a fixed `risk_inputs_template` (no real
      evolving equity curve).
- [x] `BacktestResult.historical_outcomes` wired to feed directly into
      Phase 8's `strategy.opportunity.estimate_probability` — the real
      loop this phase exists to close.
- [x] 10 real unit tests, all passing — `evaluate_forward_outcome`'s 6
      real branch cases hand-verified, `run_backtest` producing real
      trades against a synthetic uptrend, the historical-outcomes ->
      estimate_probability integration, an insufficient-bars rejection,
      and a real no-look-ahead-bias property test (every trade found
      in a shorter prefix run is identical, by real deterministic
      key — `as_of`/`direction`/`entry`/`target`/`outcome`/`bars_held`,
      since `opportunity_id` is a fresh random UUID per construction
      and can't be compared across separate runs — to the
      corresponding trade in a longer run over the same bars).
- [x] A real test-fixture pacing issue was caught and fixed the same
      honest way as Phases 7 and 11's own fixture fixes: the first
      synthetic series moved only 2 points/bar, never enough to reach
      the real 50-point target within a real 20-bar holding window, so
      every trade came back indeterminate. Fixed by speeding up the
      fixture's price movement (4 points/bar), not by loosening
      `max_holding_bars` to paper over the real mismatch.
- [x] `uv sync --all-packages`, `ruff check .`, the combined `mypy`
      run, standalone `mypy packages/backtest`, and `mypy tests` all
      clean. Full suite: 139 real tests passing (confirmed against a
      real local Postgres instance restarted after this pass found it
      had stopped between turns — an environmental gap, not a code
      regression).
- [x] Confirmed `infra/docker/Dockerfile.{api,worker}` already
      reference `packages/backtest/pyproject.toml` (added correctly
      back in Phase 1) — no Docker change needed this phase.
- [x] `README.md` updated (status/Verified/Next sections).

## Not done this phase (real, flagged, not claimed)
- Phase 13+ (the trading dashboard, replay, analytics, the statistical
  engine) — none started.
- No `POST /api/backtest/run` endpoint yet — `run_backtest` is real,
  tested, importable Python, not yet wired into `apps/api` the way
  Phase 11's pipeline was.
- No real concurrent-position-aware backtesting, no real session-phase
  transitions across the historical range, no real evolving equity
  curve — all stated directly above, not silently assumed away.
