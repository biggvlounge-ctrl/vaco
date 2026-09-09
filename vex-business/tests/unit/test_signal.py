"""Real unit tests for the signal engine (Master Directive Section
42's own "UNIT TEST" discipline)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from domain.enums import MarketRegime, SignalState
from domain.models import FeatureSnapshot, Signal
from strategy.signal import SignalScoringConfig, compute_signal

AS_OF = datetime(2026, 1, 5, 15, 0, 0, tzinfo=UTC)


def make_snapshot(
    trend_direction: str = "flat",
    market_structure: str = "mixed",
    sma_fast: str = "100",
    sma_slow: str = "100",
    vwap_distance: str = "0",
    momentum: str = "0",
    volume_ratio: str = "1.0",
    session_phase: str = "regular",
    atr: str = "10",
    distance_from_session_high: str = "5",
    distance_from_session_low: str = "5",
) -> FeatureSnapshot:
    return FeatureSnapshot(
        instrument="ES",
        contract_symbol="ESZ25",
        as_of=AS_OF,
        session_phase=session_phase,
        minutes_since_session_open=60,
        sma_fast=Decimal(sma_fast),
        sma_slow=Decimal(sma_slow),
        trend_direction=trend_direction,
        market_structure=market_structure,
        vwap=Decimal("100"),
        vwap_distance=Decimal(vwap_distance),
        momentum=Decimal(momentum),
        volume_ratio=Decimal(volume_ratio),
        session_high=Decimal("110"),
        session_low=Decimal("90"),
        distance_from_session_high=Decimal(distance_from_session_high),
        distance_from_session_low=Decimal(distance_from_session_low),
        atr=Decimal(atr),
    )


NEUTRAL_ATR_BASELINE = Decimal("10")


class TestComputeSignal:
    def test_returns_a_real_signal(self) -> None:
        snapshot = make_snapshot()
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert isinstance(signal, Signal)
        assert signal.instrument == "ES"
        assert signal.regime == MarketRegime.RANGE
        assert signal.strategy_version == "v0.1"

    def test_fully_bullish_inputs_score_high_on_long_only(self) -> None:
        snapshot = make_snapshot(
            trend_direction="up",
            market_structure="higher_highs_higher_lows",
            sma_fast="101.5",
            sma_slow="100",
            vwap_distance="15",  # 1.5x ATR above VWAP
            momentum="3",  # 3% > full-strength 2%
            volume_ratio="2.5",  # >= full-strength 2x
            distance_from_session_high="0",  # at the session high -> full key-level weight
        )
        signal = compute_signal(
            snapshot, MarketRegime.TREND_UP, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.long_score == pytest.approx(100.0)
        # short_score isn't zero -- volume/volatility/session_timing are
        # real, deliberately non-directional components (25 points here)
        # that score identically on both sides; only the directional
        # components below must be genuinely zero on the losing side.
        assert signal.short_score == pytest.approx(25.0)
        assert signal.short_components.trend == 0.0
        assert signal.short_components.market_structure == 0.0
        assert signal.short_components.vwap == 0.0
        assert signal.short_components.momentum == 0.0
        assert signal.short_components.key_levels == 0.0
        assert signal.state == SignalState.HIGH_CONVICTION

    def test_fully_bearish_inputs_score_high_on_short_only(self) -> None:
        snapshot = make_snapshot(
            trend_direction="down",
            market_structure="lower_highs_lower_lows",
            sma_fast="98.5",
            sma_slow="100",
            vwap_distance="-15",
            momentum="-3",
            volume_ratio="2.5",
            distance_from_session_low="0",  # at the session low -> full key-level weight
        )
        signal = compute_signal(
            snapshot, MarketRegime.TREND_DOWN, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.short_score == pytest.approx(100.0)
        # long_score isn't zero for the same real, non-directional-
        # component reason as the bullish test above (mirrored).
        assert signal.long_score == pytest.approx(25.0)
        assert signal.long_components.trend == 0.0
        assert signal.long_components.market_structure == 0.0
        assert signal.long_components.vwap == 0.0
        assert signal.long_components.momentum == 0.0
        assert signal.long_components.key_levels == 0.0
        assert signal.state == SignalState.HIGH_CONVICTION

    def test_fully_neutral_inputs_score_only_the_non_directional_components(self) -> None:
        # all defaults: flat/mixed/no distance/no momentum, but a real,
        # normal-volatility regular session -- volatility (10) and
        # session_timing (5) are deliberately non-directional and score
        # the same real 15 points on BOTH sides; every directional
        # component (trend/structure/vwap/momentum/key_levels) is zero.
        snapshot = make_snapshot()
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.long_score == pytest.approx(15.0)
        assert signal.short_score == pytest.approx(15.0)
        for components in (signal.long_components, signal.short_components):
            assert components.trend == 0.0
            assert components.market_structure == 0.0
            assert components.vwap == 0.0
            assert components.momentum == 0.0
            assert components.key_levels == 0.0
        assert signal.state == SignalState.NO_TRADE

    def test_component_scores_never_exceed_their_own_weight(self) -> None:
        # extreme, out-of-range inputs must clip, not overshoot the weight
        snapshot = make_snapshot(
            trend_direction="up",
            sma_fast="500",
            sma_slow="100",
            vwap_distance="10000",
            momentum="500",
            volume_ratio="1000",
            distance_from_session_high="-1000",
        )
        signal = compute_signal(
            snapshot, MarketRegime.TREND_UP, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        weights = SignalScoringConfig().weights
        assert signal.long_components.trend <= weights.trend
        assert signal.long_components.vwap <= weights.vwap
        assert signal.long_components.momentum <= weights.momentum
        assert signal.long_components.volume <= weights.volume
        assert signal.long_components.key_levels <= weights.key_levels
        assert signal.long_score <= 100.0

    def test_volume_score_is_symmetric_across_directions(self) -> None:
        snapshot = make_snapshot(volume_ratio="2.5")
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.long_components.volume == signal.short_components.volume
        assert signal.long_components.volume > 0

    def test_volatility_scores_zero_outside_tradeable_range(self) -> None:
        # ATR far below baseline -- too quiet to trade, both directions.
        quiet = make_snapshot(atr="1")
        signal = compute_signal(
            quiet, MarketRegime.LOW_VOLATILITY, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.long_components.volatility == 0.0
        assert signal.short_components.volatility == 0.0

    def test_session_timing_zero_outside_regular_or_extended(self) -> None:
        snapshot = make_snapshot(session_phase="closed")
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert signal.long_components.session_timing == 0.0
        assert signal.short_components.session_timing == 0.0

    def test_extended_session_scores_half_weight(self) -> None:
        snapshot = make_snapshot(session_phase="extended")
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        weights = SignalScoringConfig().weights
        assert signal.long_components.session_timing == pytest.approx(weights.session_timing / 2)

    def test_state_thresholds_are_real_boundaries(self) -> None:
        config = SignalScoringConfig()
        no_trade_max = config.state_thresholds[0]
        # a snapshot that scores exactly on session_timing alone (5 points,
        # well under the NO_TRADE boundary) should resolve to NO_TRADE.
        snapshot = make_snapshot()
        signal = compute_signal(
            snapshot, MarketRegime.RANGE, NEUTRAL_ATR_BASELINE, strategy_version="v0.1"
        )
        assert max(signal.long_score, signal.short_score) < no_trade_max
        assert signal.state == SignalState.NO_TRADE
