# Tasks — Phase 5: feature engine

- [x] Added `domain.models.FeatureSnapshot`, with its own docstring
      honestly flagging that Section 11's verbatim field list is not
      available in this session's current context, and that the field
      set is a real, grounded interpretation anchored on Section 13's
      already-established `SignalComponentScores` 8 categories.
      Exported from `domain/__init__.py`.
- [x] Built `strategy.features`: `simple_moving_average`,
      `rate_of_change`, `volume_ratio`, `average_true_range`,
      `session_vwap`, `market_structure`, `compute_feature_snapshot`,
      `FeatureComputationError`. Wired into `strategy/__init__.py`'s
      real exports; added `py.typed`.
- [x] 19 real unit tests (`tests/unit/test_features.py`) — all
      passing: SMA/ROC against hand-computed values, volume ratio's
      baseline correctly excluding the current bar, ATR on flat bars
      (0) and a hand-verified real gap-up case, VWAP's volume
      weighting, all 3 real market-structure outcomes
      (up/down/mixed), the full orchestrator producing a populated
      `FeatureSnapshot`, and every function's insufficient-history
      rejection path.
- [x] `uv sync --all-packages` picked up the new/changed packages
      cleanly.
- [x] `ruff check .` clean (2 real line-length findings fixed by hand).
- [x] `mypy` clean: combined run (26 source files), `packages/strategy`
      standalone (2 files), and `mypy tests` (6 files).
- [x] Full suite: `uv run pytest` — 55 real tests, all passing.
- [x] Updated `call/README.md`'s status/Verified/Next sections and
      this dev-docs entry.
- [x] Updated `Makefile`'s `typecheck` target to include
      `packages/strategy`.

## Not done this phase (real, flagged, not claimed)
- Section 12 (market regime engine) and Section 13 (signal engine) —
  not started; `FeatureSnapshot` is a real, tested input those phases
  will consume, not itself a regime or a signal.
- True swing-pivot-based market structure detection — the real,
  simpler first/second-half comparison built here is explicitly not
  the same thing (see `strategy/features.py`'s own docstring).
