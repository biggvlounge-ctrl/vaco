"""Real unit tests for the feature engine (Master Directive Section
42's own "UNIT TEST: ... features" — the literal example the
directive itself names)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from domain.models import Bar, FeatureSnapshot
from strategy.features import (
    FeatureComputationError,
    average_true_range,
    compute_feature_snapshot,
    market_structure,
    rate_of_change,
    session_vwap,
    simple_moving_average,
    volume_ratio,
)

BASE_TIME = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)


def make_bar(
    index: int,
    close: str,
    high: str | None = None,
    low: str | None = None,
    volume: int = 100,
) -> Bar:
    close_d = Decimal(close)
    high_d = Decimal(high) if high is not None else close_d + Decimal("1")
    low_d = Decimal(low) if low is not None else close_d - Decimal("1")
    open_time = BASE_TIME + timedelta(minutes=5 * index)
    return Bar(
        instrument="ES",
        contract_symbol="ESZ25",
        timestamp_open=open_time,
        timestamp_close=open_time + timedelta(minutes=5),
        open=close_d,
        high=high_d,
        low=low_d,
        close=close_d,
        volume=volume,
        source="test",
        session="regular",
        is_final=True,
    )


def make_bars(closes: list[str], volumes: list[int] | None = None) -> list[Bar]:
    vols = volumes or [100] * len(closes)
    return [make_bar(i, c, volume=v) for i, (c, v) in enumerate(zip(closes, vols, strict=True))]


class TestSimpleMovingAverage:
    def test_computes_real_mean_of_last_n_closes(self) -> None:
        bars = make_bars(["10", "20", "30", "40"])
        assert simple_moving_average(bars, 2) == Decimal("35")

    def test_raises_on_insufficient_bars(self) -> None:
        bars = make_bars(["10", "20"])
        with pytest.raises(FeatureComputationError):
            simple_moving_average(bars, 5)


class TestRateOfChange:
    def test_positive_when_price_rose(self) -> None:
        bars = make_bars(["100", "100", "110"])
        assert rate_of_change(bars, 2) == Decimal("10")

    def test_negative_when_price_fell(self) -> None:
        bars = make_bars(["100", "100", "90"])
        assert rate_of_change(bars, 2) == Decimal("-10")

    def test_raises_on_insufficient_bars(self) -> None:
        bars = make_bars(["100"])
        with pytest.raises(FeatureComputationError):
            rate_of_change(bars, 5)


class TestVolumeRatio:
    def test_double_the_baseline_average(self) -> None:
        bars = make_bars(["1", "2", "3", "4"], volumes=[100, 100, 100, 200])
        assert volume_ratio(bars, 3) == Decimal("2")

    def test_raises_on_insufficient_bars(self) -> None:
        bars = make_bars(["1", "2"])
        with pytest.raises(FeatureComputationError):
            volume_ratio(bars, 5)


class TestAverageTrueRange:
    def test_flat_bars_have_zero_atr(self) -> None:
        bars = [make_bar(i, "100", high="100", low="100") for i in range(3)]
        assert average_true_range(bars, 2) == Decimal("0")

    def test_real_true_range_wider_than_bar_range_when_gapping(self) -> None:
        b0 = make_bar(0, "100", high="101", low="99")
        b1 = make_bar(1, "110", high="111", low="109")  # gapped up from prev close 100
        atr = average_true_range([b0, b1], 1)
        # true range = max(111-109=2, |111-100|=11, |109-100|=9) = 11
        assert atr == Decimal("11")

    def test_raises_on_insufficient_bars(self) -> None:
        bars = make_bars(["1"])
        with pytest.raises(FeatureComputationError):
            average_true_range(bars, 5)


class TestSessionVwap:
    def test_weights_by_volume(self) -> None:
        low_vol = make_bar(0, "100", high="100", low="100", volume=1)
        high_vol = make_bar(1, "200", high="200", low="200", volume=99)
        vwap = session_vwap([low_vol, high_vol])
        # dominated by the high-volume bar's price
        assert vwap > Decimal("190")

    def test_raises_on_empty_bars(self) -> None:
        with pytest.raises(FeatureComputationError):
            session_vwap([])


class TestMarketStructure:
    def test_detects_uptrend_structure(self) -> None:
        bars = [
            make_bar(0, "100", high="101", low="99"),
            make_bar(1, "101", high="102", low="100"),
            make_bar(2, "110", high="111", low="109"),
            make_bar(3, "112", high="113", low="111"),
        ]
        assert market_structure(bars, 4) == "higher_highs_higher_lows"

    def test_detects_downtrend_structure(self) -> None:
        bars = [
            make_bar(0, "110", high="111", low="109"),
            make_bar(1, "109", high="110", low="108"),
            make_bar(2, "100", high="101", low="99"),
            make_bar(3, "98", high="99", low="97"),
        ]
        assert market_structure(bars, 4) == "lower_highs_lower_lows"

    def test_detects_mixed_structure(self) -> None:
        bars = [
            make_bar(0, "100", high="105", low="95"),
            make_bar(1, "100", high="105", low="95"),
            make_bar(2, "100", high="103", low="97"),
            make_bar(3, "100", high="103", low="97"),
        ]
        assert market_structure(bars, 4) == "mixed"

    def test_raises_on_insufficient_bars(self) -> None:
        bars = make_bars(["1", "2"])
        with pytest.raises(FeatureComputationError):
            market_structure(bars, 5)


class TestComputeFeatureSnapshot:
    def test_produces_a_real_populated_snapshot(self) -> None:
        closes = [str(100 + i) for i in range(25)]
        bars = make_bars(closes)
        snapshot = compute_feature_snapshot(
            bars=bars,
            session_bars=bars[-5:],
            session_phase="regular",
            minutes_since_session_open=30,
        )
        assert isinstance(snapshot, FeatureSnapshot)
        assert snapshot.instrument == "ES"
        assert snapshot.contract_symbol == "ESZ25"
        assert snapshot.trend_direction == "up"  # monotonically rising closes
        assert snapshot.session_phase == "regular"
        assert snapshot.minutes_since_session_open == 30
        assert snapshot.vwap > Decimal("0")
        assert snapshot.atr >= Decimal("0")

    def test_raises_on_empty_bars(self) -> None:
        with pytest.raises(FeatureComputationError):
            compute_feature_snapshot(bars=[], session_bars=[], session_phase="regular")

    def test_raises_on_empty_session_bars(self) -> None:
        bars = make_bars([str(100 + i) for i in range(25)])
        with pytest.raises(FeatureComputationError):
            compute_feature_snapshot(bars=bars, session_bars=[], session_phase="regular")
