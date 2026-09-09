"""Real unit tests for the 5-minute candle engine (Master Directive
Section 42: "UNIT TEST: ... features"). A permanent, committed test
suite — Section 3 lists TESTS as a real top-level deliverable, unlike
this session's own scratch-and-delete convention elsewhere in this
repo, which doesn't apply to Vex Business's own explicit test requirement.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from domain.models import Tick
from market.candle_engine import CandleEngine, DataQualityError, bar_window_start


def tick(price: str, minute: int, second: int = 0, size: int = 1, kind: str = "last_trade") -> Tick:
    return Tick(
        instrument="ES",
        contract_symbol="ESZ25",
        kind=kind,
        price=Decimal(price),
        size=size,
        timestamp=datetime(2026, 1, 5, 14, minute, second, tzinfo=UTC),
        source="test",
    )


class TestBarWindowStart:
    def test_aligns_to_true_5_minute_boundary(self) -> None:
        assert bar_window_start(datetime(2026, 1, 5, 14, 7, 32, tzinfo=UTC)) == datetime(
            2026, 1, 5, 14, 5, 0, tzinfo=UTC
        )
        assert bar_window_start(datetime(2026, 1, 5, 14, 9, 59, tzinfo=UTC)) == datetime(
            2026, 1, 5, 14, 5, 0, tzinfo=UTC
        )
        assert bar_window_start(datetime(2026, 1, 5, 14, 10, 0, tzinfo=UTC)) == datetime(
            2026, 1, 5, 14, 10, 0, tzinfo=UTC
        )

    def test_rejects_naive_timestamp(self) -> None:
        with pytest.raises(DataQualityError):
            bar_window_start(datetime(2026, 1, 5, 14, 7, 32))  # noqa: DTZ001


class TestCandleEngine:
    def test_single_bar_ohlcv_correctness(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        assert engine.process_tick(tick("5000", minute=0, second=0)) is None
        assert engine.process_tick(tick("5010", minute=1, second=0)) is None
        assert engine.process_tick(tick("4995", minute=2, second=0)) is None
        assert engine.process_tick(tick("5005", minute=4, second=59, size=3)) is None

        bar = engine.flush()
        assert bar is not None
        assert bar.open == Decimal("5000")
        assert bar.high == Decimal("5010")
        assert bar.low == Decimal("4995")
        assert bar.close == Decimal("5005")
        assert bar.volume == 6  # 1+1+1+3
        assert bar.trade_count == 4
        assert bar.timestamp_open == datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)
        assert bar.timestamp_close == datetime(2026, 1, 5, 14, 5, 0, tzinfo=UTC)
        assert bar.is_final is True

    def test_new_window_closes_previous_bar(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        engine.process_tick(tick("5000", minute=1))
        engine.process_tick(tick("5010", minute=3))
        closed = engine.process_tick(tick("5020", minute=5))  # first tick of the NEXT window
        assert closed is not None
        assert closed.close == Decimal("5010")  # the window-0-5 bar, not including the 5020 tick
        assert closed.timestamp_open == datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)

    def test_bid_ask_ticks_do_not_affect_ohlcv(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        engine.process_tick(tick("5000", minute=0))
        assert engine.process_tick(tick("9999", minute=1, kind="bid")) is None
        assert engine.process_tick(tick("1", minute=1, kind="ask")) is None
        bar = engine.flush()
        assert bar is not None
        assert bar.high == Decimal("5000")  # the bid/ask extremes never entered OHLCV
        assert bar.low == Decimal("5000")

    def test_non_monotonic_tick_raises(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        engine.process_tick(tick("5000", minute=2, second=30))
        with pytest.raises(DataQualityError):
            engine.process_tick(tick("5001", minute=2, second=10))  # arrives "before" the last one

    def test_flush_with_no_ticks_returns_none(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        assert engine.flush() is None

    def test_flush_then_continue_starts_fresh(self) -> None:
        engine = CandleEngine("ES", "ESZ25", source="test", session="regular")
        engine.process_tick(tick("5000", minute=0))
        first = engine.flush()
        assert first is not None
        engine.process_tick(tick("6000", minute=10))
        second = engine.flush()
        assert second is not None
        assert second.open == Decimal("6000")
        assert second.timestamp_open == datetime(2026, 1, 5, 14, 10, 0, tzinfo=UTC)
