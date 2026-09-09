# Plan — Phase 5: feature engine

## Scope

Master Directive Section 11: the feature engine. Turns a real window
of finalized `Bar`s into the real, numeric technical inputs the later
market regime engine (Section 12) and signal engine (Section 13) will
consume — pure functions, no state, no I/O, no fabricated data.

## Honest gap acknowledged up front

Section 11's own verbatim field list is not present anywhere in this
codebase, and is no longer present in this session's current working
context — it existed only as pasted chat text in an earlier segment
of a very long session and has since scrolled out. Rather than either
(a) refusing to build Phase 5 at all, or (b) inventing a "verbatim"
field list and presenting it as a direct transcription the way Phase
1-2's domain models legitimately were, this phase takes a third,
honestly-flagged path: design a real, grounded feature set from the
one concrete anchor still available in the codebase — Section 13's
own `SignalComponentScores`, which already names exactly 8 real
categories (trend, market_structure, vwap, momentum, volume,
key_levels, volatility, session_timing). `domain.FeatureSnapshot`'s
own docstring states this plainly rather than quietly presenting an
interpretation as verbatim transcription.

## What this phase adds

- `domain.models.FeatureSnapshot` — the real output type.
- `strategy.features`: `simple_moving_average`, `rate_of_change`,
  `volume_ratio`, `average_true_range`, `session_vwap`,
  `market_structure`, and the orchestrating
  `compute_feature_snapshot`.

## Real design decisions

- **ATR uses a plain average, not Wilder's exponential smoothing** —
  matches Section 12's own "start deterministic" instruction (already
  established for `MarketRegime`) rather than reaching for a heavier
  standard by default.
- **`market_structure` is a real, deliberately simple first cut**:
  compares the high/low extremes of the first half vs. second half of
  a window, not confirmed swing-pivot detection. Flagged explicitly as
  not the same thing.
- **VWAP and session high/low take an explicitly pre-scoped
  `session_bars` argument**, separate from the broader `bars` window
  used for trend/momentum/volume/ATR — this function does not infer
  session boundaries from timestamps itself (Section 8's own "session
  metadata must be explicit" rule, already established in Phase 1-2's
  `Bar` model).
- **Every function raises `FeatureComputationError` on a too-short bar
  window** rather than computing over fewer bars than requested — the
  same "flag, don't silently repair" discipline Phase 3's
  `candle_engine` and Phase 4's `session_engine`/`contract_mapping`
  already apply.

## Deliberately out of scope here

The market regime engine (Section 12) that will classify a
`FeatureSnapshot` into a `MarketRegime`, and the signal engine
(Section 13) that will score one into a `Signal` — Phase 6+, not
attempted. No fake regime classification or signal score was added to
make this phase look more complete than it is.
