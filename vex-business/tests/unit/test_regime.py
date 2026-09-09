"""Real unit tests for the market regime engine (Master Directive
Section 42's own "UNIT TEST" discipline). Covers every branch of
`classify_market_regime`'s decision tree, in the order it checks them."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from domain.enums import MarketRegime
from domain.models import FeatureSnapshot
from strategy.regime import classify_market_regime

AS_OF = datetime(2026, 1, 5, 15, 0, 0, tzinfo=UTC)


def make_snapshot(
    trend_direction: str = "flat",
    market_structure: str = "mixed",
    atr: str = "10",
    volume_ratio: str = "1.0",
    distance_from_session_high: str = "5",
    distance_from_session_low: str = "5",
) -> FeatureSnapshot:
    return FeatureSnapshot(
        instrument="ES",
        contract_symbol="ESZ25",
        as_of=AS_OF,
        session_phase="regular",
        minutes_since_session_open=60,
        sma_fast=Decimal("100"),
        sma_slow=Decimal("100"),
        trend_direction=trend_direction,
        market_structure=market_structure,
        vwap=Decimal("100"),
        vwap_distance=Decimal("0"),
        momentum=Decimal("0"),
        volume_ratio=Decimal(volume_ratio),
        session_high=Decimal("110"),
        session_low=Decimal("90"),
        distance_from_session_high=Decimal(distance_from_session_high),
        distance_from_session_low=Decimal(distance_from_session_low),
        atr=Decimal(atr),
    )


class TestClassifyMarketRegime:
    def test_breakout_at_session_high_with_volume(self) -> None:
        snapshot = make_snapshot(distance_from_session_high="0", volume_ratio="1.5")
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.BREAKOUT

    def test_no_breakout_at_session_high_without_volume(self) -> None:
        # at the high, but volume isn't elevated -- must not fire BREAKOUT
        snapshot = make_snapshot(distance_from_session_high="0", volume_ratio="0.8")
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) != MarketRegime.BREAKOUT

    def test_breakdown_at_session_low_with_volume(self) -> None:
        snapshot = make_snapshot(distance_from_session_low="0", volume_ratio="1.5")
        assert (
            classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.BREAKDOWN
        )

    def test_high_volatility_when_atr_well_above_baseline(self) -> None:
        snapshot = make_snapshot(atr="20")
        assert (
            classify_market_regime(snapshot, atr_baseline=Decimal("10"))
            == MarketRegime.HIGH_VOLATILITY
        )

    def test_low_volatility_when_atr_well_below_baseline(self) -> None:
        snapshot = make_snapshot(atr="5")
        assert (
            classify_market_regime(snapshot, atr_baseline=Decimal("10"))
            == MarketRegime.LOW_VOLATILITY
        )

    def test_trend_up_when_direction_and_structure_agree(self) -> None:
        snapshot = make_snapshot(
            trend_direction="up", market_structure="higher_highs_higher_lows", atr="10"
        )
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.TREND_UP

    def test_trend_down_when_direction_and_structure_agree(self) -> None:
        snapshot = make_snapshot(
            trend_direction="down", market_structure="lower_highs_lower_lows", atr="10"
        )
        assert (
            classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.TREND_DOWN
        )

    def test_range_when_structure_is_mixed(self) -> None:
        snapshot = make_snapshot(trend_direction="flat", market_structure="mixed", atr="10")
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.RANGE

    def test_unknown_when_direction_and_structure_disagree(self) -> None:
        # trend says up, but structure says lower highs/lows -- a real,
        # honest disagreement, not silently resolved either way.
        snapshot = make_snapshot(
            trend_direction="up", market_structure="lower_highs_lower_lows", atr="10"
        )
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.UNKNOWN

    def test_breakout_checked_before_volatility(self) -> None:
        # both a breakout condition AND a high-volatility condition are
        # true -- breakout must win, since it's checked first.
        snapshot = make_snapshot(
            distance_from_session_high="0", volume_ratio="1.5", atr="50"
        )
        assert classify_market_regime(snapshot, atr_baseline=Decimal("10")) == MarketRegime.BREAKOUT

    def test_rejects_non_positive_baseline(self) -> None:
        snapshot = make_snapshot()
        with pytest.raises(ValueError, match="atr_baseline must be positive"):
            classify_market_regime(snapshot, atr_baseline=Decimal("0"))
