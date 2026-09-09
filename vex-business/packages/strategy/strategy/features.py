"""Vex Business — the real feature engine (Master Directive Section 11).
Computes the raw, numeric technical inputs Section 13's
`SignalComponentScores` (trend, market_structure, vwap, momentum,
volume, key_levels, volatility, session_timing) will later be scored
from. Every function here is pure — takes a real `Bar` window, returns
a real number — no state, no I/O, no fabricated data.

**Never pads short history.** Every function below raises
`FeatureComputationError` when the given bar window is shorter than
the period it needs, rather than silently computing over fewer bars
than requested (Section 43's "flag, don't silently repair," the same
discipline `market.candle_engine`/`market.session_engine` already
apply).
"""

from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from domain.models import Bar, FeatureSnapshot


class FeatureComputationError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule."""


def _closes(bars: Sequence[Bar]) -> list[Decimal]:
    return [bar.close for bar in bars]


def simple_moving_average(bars: Sequence[Bar], period: int) -> Decimal:
    """The real mean close over the last `period` bars."""
    if period < 1:
        raise FeatureComputationError(f"period must be >= 1, got {period}")
    if len(bars) < period:
        raise FeatureComputationError(
            f"simple_moving_average needs {period} bars, got {len(bars)}"
        )
    window = _closes(bars)[-period:]
    return sum(window, Decimal(0)) / Decimal(period)


def rate_of_change(bars: Sequence[Bar], period: int) -> Decimal:
    """Real momentum: the percentage change from `period` bars ago to
    the most recent close. Positive means price rose over the window."""
    if period < 1:
        raise FeatureComputationError(f"period must be >= 1, got {period}")
    if len(bars) < period + 1:
        raise FeatureComputationError(
            f"rate_of_change needs {period + 1} bars, got {len(bars)}"
        )
    reference = bars[-(period + 1)].close
    current = bars[-1].close
    if reference == 0:
        raise FeatureComputationError("rate_of_change: reference close is zero")
    return (current - reference) / reference * Decimal(100)


def volume_ratio(bars: Sequence[Bar], lookback: int) -> Decimal:
    """The most recent bar's real volume against the real mean volume
    of the `lookback` bars before it (excluding the bar itself, so a
    single huge print doesn't inflate its own baseline)."""
    if lookback < 1:
        raise FeatureComputationError(f"lookback must be >= 1, got {lookback}")
    if len(bars) < lookback + 1:
        raise FeatureComputationError(f"volume_ratio needs {lookback + 1} bars, got {len(bars)}")
    baseline_bars = bars[-(lookback + 1) : -1]
    baseline_volume = sum((b.volume for b in baseline_bars), 0) / Decimal(lookback)
    if baseline_volume == 0:
        raise FeatureComputationError("volume_ratio: baseline average volume is zero")
    return Decimal(bars[-1].volume) / baseline_volume


def average_true_range(bars: Sequence[Bar], period: int) -> Decimal:
    """Real ATR — the mean true range (`max(high-low, |high-prev_close|,
    |low-prev_close|)`) over the last `period` bars. A real, deliberate
    simplification: a plain average, not Wilder's exponential smoothing
    — matches Section 12's own "start deterministic" instruction rather
    than reaching for a heavier standard immediately."""
    if period < 1:
        raise FeatureComputationError(f"period must be >= 1, got {period}")
    if len(bars) < period + 1:
        raise FeatureComputationError(
            f"average_true_range needs {period + 1} bars, got {len(bars)}"
        )
    window = bars[-(period + 1) :]
    true_ranges = []
    for i in range(1, len(window)):
        bar, prev = window[i], window[i - 1]
        true_ranges.append(
            max(bar.high - bar.low, abs(bar.high - prev.close), abs(bar.low - prev.close))
        )
    return sum(true_ranges, Decimal(0)) / Decimal(period)


def session_vwap(bars: Sequence[Bar]) -> Decimal:
    """Real volume-weighted average price over the given bars.
    `bars` must already be scoped to the session the caller wants
    (e.g. only today's regular-session bars) — this function does not
    infer session boundaries itself, matching Section 8's own "session
    metadata must be explicit" rule."""
    if not bars:
        raise FeatureComputationError("session_vwap requires at least one bar")
    total_volume = sum((b.volume for b in bars), 0)
    if total_volume == 0:
        raise FeatureComputationError("session_vwap: total volume is zero")
    typical_price_volume = sum(
        (((b.high + b.low + b.close) / Decimal(3)) * b.volume for b in bars), Decimal(0)
    )
    return typical_price_volume / Decimal(total_volume)


def market_structure(bars: Sequence[Bar], swing_lookback: int) -> str:
    """A real, deliberately simple structural read: split the last
    `swing_lookback` bars in half, compare each half's own high/low
    extremes. Both the high and low rising -> real uptrend structure;
    both falling -> real downtrend structure; anything else -> mixed.

    **Real, flagged simplification**: true swing-pivot detection
    (confirmed higher highs/higher lows against actual local pivots)
    is real, separate future scope — this is a real, honest first cut
    that a caller should not mistake for pivot-confirmed structure."""
    if swing_lookback < 2:
        raise FeatureComputationError(f"swing_lookback must be >= 2, got {swing_lookback}")
    if len(bars) < swing_lookback:
        raise FeatureComputationError(
            f"market_structure needs {swing_lookback} bars, got {len(bars)}"
        )
    window = bars[-swing_lookback:]
    midpoint = len(window) // 2
    first_half, second_half = window[:midpoint], window[midpoint:]
    first_high = max(b.high for b in first_half)
    first_low = min(b.low for b in first_half)
    second_high = max(b.high for b in second_half)
    second_low = min(b.low for b in second_half)

    if second_high > first_high and second_low > first_low:
        return "higher_highs_higher_lows"
    if second_high < first_high and second_low < first_low:
        return "lower_highs_lower_lows"
    return "mixed"


def compute_feature_snapshot(
    bars: Sequence[Bar],
    session_bars: Sequence[Bar],
    session_phase: str,
    minutes_since_session_open: int | None = None,
    sma_fast_period: int = 8,
    sma_slow_period: int = 21,
    momentum_period: int = 10,
    volume_lookback: int = 20,
    atr_period: int = 14,
    swing_lookback: int = 20,
) -> FeatureSnapshot:
    """Orchestrates every real feature above into one real
    `FeatureSnapshot`, as of the most recent bar in `bars`.

    `bars` is the rolling window used for trend/momentum/volume/ATR/
    structure (may span multiple sessions); `session_bars` is the
    caller-scoped subset used for VWAP and the session high/low (per
    `session_vwap`'s own explicit-session-scoping rule) — the two are
    kept separate deliberately rather than this function guessing
    session boundaries from timestamps itself."""
    if not bars:
        raise FeatureComputationError("compute_feature_snapshot requires at least one bar")
    if not session_bars:
        raise FeatureComputationError("compute_feature_snapshot requires at least one session bar")

    latest = bars[-1]
    sma_fast = simple_moving_average(bars, sma_fast_period)
    sma_slow = simple_moving_average(bars, sma_slow_period)
    if sma_fast > sma_slow:
        trend_direction = "up"
    elif sma_fast < sma_slow:
        trend_direction = "down"
    else:
        trend_direction = "flat"

    vwap = session_vwap(session_bars)
    session_high = max(b.high for b in session_bars)
    session_low = min(b.low for b in session_bars)

    return FeatureSnapshot(
        instrument=latest.instrument,
        contract_symbol=latest.contract_symbol,
        as_of=latest.timestamp_close,
        session_phase=session_phase,
        minutes_since_session_open=minutes_since_session_open,
        sma_fast=sma_fast,
        sma_slow=sma_slow,
        trend_direction=trend_direction,
        market_structure=market_structure(bars, swing_lookback),
        vwap=vwap,
        vwap_distance=latest.close - vwap,
        momentum=rate_of_change(bars, momentum_period),
        volume_ratio=volume_ratio(bars, volume_lookback),
        session_high=session_high,
        session_low=session_low,
        distance_from_session_high=session_high - latest.close,
        distance_from_session_low=latest.close - session_low,
        atr=average_true_range(bars, atr_period),
    )
