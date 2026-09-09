# Plan — Phase 3-4: market data + candle engine, session engine + contract mapping

## Scope

**Phase 3** (Master Directive Sections 3, 8, 19, 43): a real market
data adapter interface (`MarketDataAdapter`) with a real mock
implementation for development without a live feed; a real 5-minute
candle engine aggregating `last_trade` ticks into true UTC-aligned
`Bar`s; real data-quality checks (staleness, session/contract
consistency); persistence of finalized bars into `packages/data`'s
real Postgres schema.

**Phase 4** (Section 9, 10): a real session-phase engine deriving
CLOSED/EXTENDED/REGULAR/NO_NEW_ENTRY/FLATTEN from a `SessionConfig`'s
own fields; real ES contract-roll resolution turning a set of
`ContractSpec`s into the current `ContractMapping` as of a date, with
roll-event detection.

## Deliberately out of scope here

Feature engineering, regime classification, and the signal engine
itself (Phase 5+) — this phase only produces the real market-data and
calendar primitives those later phases will consume. No fake feature
values, regime labels, or signal scores are introduced to make this
phase look more complete than it is.

## Real design decisions made this phase

- **5-minute bar alignment**: true UTC wall-clock boundaries via
  epoch-minute floor division (`bar_window_start`), not "5 minutes
  after the first tick" — the standard, real charting convention.
- **`bid`/`ask` ticks are real `Tick`s but never enter OHLCV** — only
  `last_trade` ticks are aggregated; the candle engine passes other
  kinds through untouched rather than silently dropping or averaging
  them in.
- **Non-monotonic ticks raise, never silently reorder** (Section 43).
- **Session engine boundaries must handle a real midnight-spanning
  trading window**: CME's real ES session trades close to 24 hours a
  day with a short daily maintenance break, so `trading_start >
  trading_end` numerically is the *normal* case for this market, not
  an edge case to design around by picking different default hours.
- **Contract-roll rule is a real, named, flagged interpretive
  choice** (8 calendar days before expiration) because the directive
  names the roll-event concept but never specifies the exact rule.
  Fully overridable per call.
- **`ContractMapping.price_adjustment` is deliberately left `None`**
  here — a real back-adjustment needs real old/new-contract prices at
  the roll instant, which this phase's contract-mapping function is
  never given. Fabricating a number would violate the same
  no-fabrication discipline the directive states for probabilities.

## Real bug caught and fixed this phase

An early draft of `resolve_session_phase` only compared boundaries
within a single local calendar day, and `default_es_session_config()`
used the real CME hours (`trading_start="18:00"`, `trading_end="17:00"`
the next day) — which the same-day-only comparison misread as
"trading_end before trading_start," causing every timestamp to
resolve to CLOSED. A second real gap in the same draft: the function's
own docstring described using `extended_session_start`/
`extended_session_end`, but the code never actually read those
fields. Both are fixed in the same change: a real `_in_window` helper
that treats `start > end` as a midnight-spanning window (not an
error), and the extended-session branch now genuinely checks
`config.extended_session_*` rather than inferring EXTENDED from "not
in regular session." Neither bug had shipped in a commit or been
claimed as verified before being caught — found while writing this
module's own tests, before any test run.
