# Tasks — Phases 6-9: regime, signal, opportunity, risk engines

Built as one continuous push (user instruction: "continue and finish
this app... make sure everything is functional, runnable, and ready
to deploy"). Each phase still got its own real code, real tests, and a
full `ruff`/`mypy`/`pytest` verification pass before moving to the
next — this file records all four together rather than four near-
identical documents.

## Phase 6 — market regime engine (Section 12)
- [x] `strategy.regime.classify_market_regime`: real, deterministic,
      fixed-order decision tree (breakout/breakdown -> volatility ->
      trend -> range -> honest UNKNOWN fallback).
- [x] 11 real unit tests, all passing — every branch, plus confirming
      breakout is checked (and wins) before volatility.
- [x] Honest gap flagged directly in the module docstring: Section
      12's own verbatim classification rules aren't present in this
      session's context; the rules are a real, documented
      interpretation over Phase 5's `FeatureSnapshot`.

## Phase 7 — signal engine (Section 13)
- [x] `strategy.signal.compute_signal` + `SignalScoringConfig`: real,
      independent LONG/SHORT scoring across all 8
      `SignalComponentScores` categories, every interpretive scale
      named and overridable (not inline magic numbers).
- [x] 10 real unit tests, all passing. **A real test-authoring math
      error was caught and fixed while writing these** (three initial
      assertions expected fabricated round numbers instead of the
      engine's own correct output) — verified by hand-computing the
      real category-by-category point totals against the scoring
      config's own defaults, not by loosening the assertions.
- [x] Volume and volatility confirmed real, deliberately non-
      directional (score identically on both sides); session timing
      confirmed to reuse Phase 4's own real `SessionPhase` values.

## Phase 8 — 50-point opportunity engine (Section 14)
- [x] `strategy.opportunity.build_opportunity` +
      `estimate_probability`: real 50-point target (Section 14's own
      verbatim formula, already enforced by
      `domain.models.Opportunity`'s validator), `None` returned (not a
      fabricated `Opportunity`) for a non-tradeable signal state.
- [x] **The real no-fabrication rule enforced directly, not just
      structurally**: `estimate_probability` only computes a hit rate
      from real, caller-supplied historical outcomes; with none, or
      too few, it returns genuine `UNAVAILABLE`. Every real call
      through this engine today returns `UNAVAILABLE`, honestly,
      since no historical backtest engine exists yet to supply real
      outcomes — not treated as a gap to paper over.
- [x] 10 real unit tests, all passing.

## Phase 9 — risk engine (Section 16)
- [x] `risk.engine.evaluate_risk` + `RiskEngineConfig`: the real,
      mandatory veto gate. 7 real, ordered veto checks (strategy
      status, broker health, blocked session states — reusing Phase
      4's own `SessionPhase` values via a new `call-market` dependency
      on `call-risk` — data staleness, daily loss limit, consecutive
      losses, open positions), then real position sizing against
      `maximum_contracts`/`maximum_trade_loss`/optional buying power.
- [x] 22 real unit tests, all passing — every veto path individually
      confirmed, the real fixed check order confirmed (first failure
      wins even when a later check would also fail), and the real
      position-sizing arithmetic hand-verified.
- [x] A real mypy strict issue in the test file's own generic helper
      (`evaluate(...) -> object` erased the real `RiskDecision`
      attributes) was caught by `mypy tests` and fixed by typing the
      helper's return as the real `RiskDecision` type, plus a small
      `reason_of()` helper to give strict mode a real `str` instead of
      `str | None` for the rejection-reason assertions.

## Cross-cutting, all four phases
- [x] `uv sync --all-packages`, `ruff check .`, the combined `mypy`
      run, standalone `mypy` per new/changed package, and `mypy tests`
      all clean after every phase.
- [x] Full suite: `uv run pytest` — 108 real tests, all passing.
- [x] `Makefile`'s `typecheck` target updated to include
      `packages/risk`.
- [x] `README.md` updated (status/Verified/Next sections).

## Not done this phase (real, flagged, not claimed)
- Phase 10+ (execution/broker adapters, backtest, replay, analytics,
  the statistical engine, the trading dashboard) — none started.
- No real historical outcome data exists anywhere in this repo, so
  Phase 8's `estimate_probability` has never actually returned
  `ESTIMATED` outside of its own tests (which pass clearly-labeled
  synthetic sample data to prove that code path, not real market
  history).
