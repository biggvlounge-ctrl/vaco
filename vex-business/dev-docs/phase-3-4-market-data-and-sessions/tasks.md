# Tasks — Phase 3-4: market data + candle engine, session engine + contract mapping

## Phase 3 — market data + 5-minute candle engine
- [x] Added `Tick` to `domain.models`; exported from `domain/__init__.py`.
- [x] Built `market.data_adapter.MarketDataAdapter` (real async ABC)
      and `MockMarketDataAdapter` (deterministic synthetic tick stream,
      seeded, connect/disconnect/health lifecycle).
- [x] Built `market.candle_engine`: `bar_window_start` (true UTC
      5-minute boundary alignment), `CandleEngine` (stateful
      single-instrument aggregator), `DataQualityError`.
- [x] Built `market.quality`: `is_stale`, `check_session_consistency`,
      `check_contract_consistency`.
- [x] Built `market.persistence.persist_bar` against `packages/data`'s
      real `BarORM`.
- [x] 8 real unit tests (`tests/unit/test_candle_engine.py`) — all
      passing: boundary alignment, naive-timestamp rejection, OHLCV
      correctness, window-close-returns-previous-bar, bid/ask
      exclusion, non-monotonic rejection, flush semantics (empty and
      populated).
- [x] 1 real integration test (`tests/integration/test_market_data_pipeline.py`)
      against the live local Postgres database — synthetic ticks
      through the full adapter -> engine -> persistence pipeline,
      rows read back and asserted, self-cleaning (deletes its own rows
      before and after). Passing.
- [x] Caught and fixed a real bug: `mypy packages/market` run in
      isolation reported `import-untyped` for `domain`/`data` even
      though the combined multi-package run was clean, because those
      packages had no PEP 561 `py.typed` marker. Added real
      `py.typed` files to `domain`, `data`, `config`, `market`;
      confirmed `mypy packages/market` alone now passes standalone.
- [x] `ruff check .` and `mypy` (combined and `packages/market`
      standalone) both clean.

## Phase 4 — session engine + ES contract-roll resolution
- [x] Built `market.session_engine`: `SessionPhase` enum, `_in_window`
      (real midnight-spanning window membership), `resolve_session_phase`,
      `default_es_session_config` (real CME-grounded ES hours).
- [x] Caught and fixed a real bug before any test ran: the initial
      draft's boundary comparisons were same-calendar-day-only, which
      misclassified the real CME ES hours (trading window spans
      midnight) as permanently CLOSED; the initial draft also never
      actually read `extended_session_start`/`extended_session_end`
      despite its own docstring claiming it did. Fixed with a real
      midnight-aware window helper and a genuine extended-session
      check.
- [x] 9 real unit tests (`tests/unit/test_session_engine.py`) — all
      passing: CLOSED (maintenance-break case), EXTENDED (both the
      overnight-start and early-morning-before-open cases), REGULAR,
      NO_NEW_ENTRY, FLATTEN, naive-timestamp rejection, UTC-to-local
      conversion, and a config with no extended session correctly
      reporting CLOSED rather than fabricating EXTENDED.
- [x] Built `market.contract_mapping`: `resolve_current_contract`,
      `build_contract_mapping`, `ContractMappingError`,
      `DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION` (8, named and flagged as a
      real interpretive choice).
- [x] 12 real unit tests (`tests/unit/test_contract_mapping.py`) — all
      passing: before/on/after the roll date, a custom roll-window
      override, past-every-known-contract error, empty-input and
      mixed-root-symbol rejection, roll-event detection against a
      real previous mapping, same-contract-is-not-a-roll-event,
      naive-timestamp rejection, and `price_adjustment` confirmed
      `None` rather than fabricated.
- [x] Wired both new modules into `market/__init__.py`'s real exports.
- [x] Updated `README.md`'s status, "Verified this pass," and "Next"
      sections to reflect Phase 3-4 completion.
- [x] Full suite: `uv run pytest` — 30 real tests, all passing.
      `ruff check .` and `mypy` (combined, `packages/market`
      standalone, and `tests`) all clean.

## Not done this phase (real, flagged, not claimed)
- Phase 5+ (feature engine, regime engine, signal engine, the 50-point
  opportunity engine, statistical engine, risk engine's real
  approve/reject logic, execution/broker adapters, backtest/replay,
  the trading dashboard) — none of it started.
- No real live market-data adapter (only the mock) — Section 19's real
  broker/data adapter integrations are a later phase.
