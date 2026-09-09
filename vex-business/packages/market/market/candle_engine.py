"""Vex Business — the real 5-minute candle engine (Master Directive Section 3:
"5-minute timeframe"; Section 8: bar construction from real market
data). Aggregates a real stream of `last_trade` `Tick`s into real
5-minute `Bar`s, aligned to true UTC 5-minute wall-clock boundaries
(:00, :05, :10, ...), not to "5 minutes after the first tick arrives"
— the real, standard candle convention every charting platform uses.

**Data quality, per Section 43** — "Do not silently repair data. Flag
it." — is enforced here directly, not deferred to a later phase:
- Non-monotonic tick timestamps (a tick that arrives "before" the
  last one processed) are rejected, not silently reordered.
- Only `last_trade` ticks are aggregated into OHLCV — `bid`/`ask`
  ticks are real, valid `Tick`s (Section 8) but don't belong in a
  trade-price candle; passed through untouched, not silently dropped
  or averaged in.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from domain.models import Bar, Tick

BAR_DURATION = timedelta(minutes=5)


class DataQualityError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule."""


def bar_window_start(timestamp: datetime) -> datetime:
    """The real, true UTC 5-minute boundary a given timestamp falls
    into — e.g. 14:07:32 -> 14:05:00, 14:09:59 -> 14:05:00,
    14:10:00 -> 14:10:00."""
    if timestamp.tzinfo is None:
        raise DataQualityError(
            f"bar_window_start requires a timezone-aware timestamp, got naive: {timestamp}"
        )
    epoch_minutes = int(timestamp.timestamp() // 60)
    window_start_minutes = epoch_minutes - (epoch_minutes % 5)
    return datetime.fromtimestamp(window_start_minutes * 60, tz=UTC)


class CandleEngine:
    """Real, stateful, single-instrument-and-contract aggregator.
    `process_tick` is the one real entry point — it either extends the
    in-progress bar, or (when a tick's window has moved on) finalizes
    the previous bar and returns it, then starts the new one. This is
    the real mechanic behind the directive's own `BarStarted`/
    `BarClosed` events (Section 7) — a caller wires those up around
    this engine's own return values, not duplicated here.
    """

    def __init__(self, instrument: str, contract_symbol: str, source: str, session: str) -> None:
        self.instrument = instrument
        self.contract_symbol = contract_symbol
        self.source = source
        self.session = session
        self._current_window_start: datetime | None = None
        self._open: Decimal | None = None
        self._high: Decimal | None = None
        self._low: Decimal | None = None
        self._close: Decimal | None = None
        self._volume: int = 0
        self._trade_count: int = 0
        self._last_tick_timestamp: datetime | None = None

    def process_tick(self, tick: Tick) -> Bar | None:
        """Returns the just-closed `Bar` if this tick started a new
        window, else `None` (the in-progress bar was just extended)."""
        if tick.kind != "last_trade":
            return None  # bid/ask ticks don't participate in OHLCV construction.

        if self._last_tick_timestamp is not None and tick.timestamp < self._last_tick_timestamp:
            raise DataQualityError(
                f"non-monotonic tick: {tick.timestamp} arrived after {self._last_tick_timestamp} "
                f"was already processed for {self.instrument}/{self.contract_symbol}"
            )
        self._last_tick_timestamp = tick.timestamp

        window_start = bar_window_start(tick.timestamp)
        closed_bar: Bar | None = None

        if self._current_window_start is None:
            self._start_new_window(window_start, tick)
        elif window_start > self._current_window_start:
            closed_bar = self._finalize_current_bar()
            self._start_new_window(window_start, tick)
        else:
            self._extend_current_bar(tick)

        return closed_bar

    def flush(self) -> Bar | None:
        """Finalizes whatever bar is currently in progress — the real
        end-of-stream case (Section 21's backtest engine will call
        this after the last historical tick; a live feed calls it on
        graceful shutdown). Returns `None` if no bar is in progress."""
        if self._current_window_start is None:
            return None
        return self._finalize_current_bar()

    def _start_new_window(self, window_start: datetime, tick: Tick) -> None:
        self._current_window_start = window_start
        self._open = tick.price
        self._high = tick.price
        self._low = tick.price
        self._close = tick.price
        self._volume = tick.size
        self._trade_count = 1

    def _extend_current_bar(self, tick: Tick) -> None:
        assert self._high is not None and self._low is not None
        self._high = max(self._high, tick.price)
        self._low = min(self._low, tick.price)
        self._close = tick.price
        self._volume += tick.size
        self._trade_count += 1

    def _finalize_current_bar(self) -> Bar:
        assert self._current_window_start is not None
        assert self._open is not None
        assert self._high is not None
        assert self._low is not None
        assert self._close is not None
        bar = Bar(
            instrument=self.instrument,
            contract_symbol=self.contract_symbol,
            timestamp_open=self._current_window_start,
            timestamp_close=self._current_window_start + BAR_DURATION,
            open=self._open,
            high=self._high,
            low=self._low,
            close=self._close,
            volume=self._volume,
            trade_count=self._trade_count,
            source=self.source,
            session=self.session,
            is_final=True,
        )
        self._current_window_start = None
        self._open = self._high = self._low = self._close = None
        self._volume = 0
        self._trade_count = 0
        return bar
