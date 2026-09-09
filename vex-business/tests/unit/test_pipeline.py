"""Real, end-to-end unit tests for the pipeline (Master Directive
Section 42's own "UNIT TEST" discipline). Each test runs the real
feature -> regime -> signal -> opportunity -> risk -> execution chain
against synthetic-but-realistic bar data, confirming the pipeline
stops honestly at the right stage for each real scenario."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from domain.enums import Direction, OrderState, RiskDecisionOutcome, SignalState
from domain.models import Bar, RiskCheckInputs
from execution.broker import MockBrokerAdapter
from execution.pipeline import run_pipeline
from strategy.signal import SignalScoringConfig

BASE_TIME = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)


def make_bar(
    index: int,
    close: str,
    high: str | None = None,
    low: str | None = None,
    volume: int = 200,
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


def make_uptrend_bars(count: int, start: int = 5000, step: int = 1) -> list[Bar]:
    bars = [make_bar(i, str(start + i * step)) for i in range(count)]
    # A real volume spike on the latest bar -- a genuine, common
    # real-world companion to a real breakout/strong-trend move, and
    # needed here so the synthetic series crosses the real signal
    # engine's own READY threshold rather than stalling at WATCH.
    bars[-1] = bars[-1].model_copy(update={"volume": bars[-1].volume * 3})
    return bars


def make_risk_inputs(**overrides: object) -> RiskCheckInputs:
    defaults: dict[str, object] = dict(
        account_equity=Decimal("50000"),
        buying_power=Decimal("50000"),
        entry=Decimal("0"),  # overwritten by the pipeline itself
        stop=Decimal("0"),  # overwritten by the pipeline itself
        quantity=2,
        daily_pnl=Decimal("0"),
        daily_loss_limit=Decimal("2000"),
        maximum_trade_loss=Decimal("1000"),
        maximum_contracts=5,
        maximum_open_positions=3,
        consecutive_losses=0,
        session_state="regular",
        volatility=1.0,
        data_freshness_seconds=10.0,
        broker_health="healthy",
        strategy_status="active",
    )
    defaults.update(overrides)
    return RiskCheckInputs(**defaults)  # type: ignore[arg-type]


class TestRunPipeline:
    @pytest.mark.asyncio
    async def test_full_approval_flow_produces_a_real_filled_position(self) -> None:
        # A strong, real, monotonic uptrend across 60 bars (5 hours) with
        # decent volume gives a real HIGH_CONVICTION LONG signal.
        bars = make_uptrend_bars(60, start=5000, step=2)
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(),
            stop_price=bars[-1].close - Decimal("10"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
        )

        assert result.signal.state in (SignalState.READY, SignalState.HIGH_CONVICTION)
        assert result.opportunity is not None
        assert result.opportunity.direction == Direction.LONG
        assert result.risk_decision is not None
        assert result.risk_decision.outcome == RiskDecisionOutcome.APPROVED
        assert result.order is not None
        assert result.order.state == OrderState.FILLED
        assert result.position is not None
        assert result.position.entry_price == bars[-1].close

    @pytest.mark.asyncio
    async def test_flat_market_stops_at_signal_no_opportunity(self) -> None:
        # A flat, directionless market never crosses the tradeable
        # signal-state threshold -- the pipeline must stop honestly
        # right there, with no fabricated opportunity/risk/order.
        bars = [make_bar(i, "5000") for i in range(60)]
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(),
            stop_price=Decimal("4990"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
        )

        assert result.opportunity is None
        assert result.risk_decision is None
        assert result.order is None
        assert result.position is None

    @pytest.mark.asyncio
    async def test_risk_veto_stops_before_any_order(self) -> None:
        # a real strong uptrend, but the account has already hit its
        # daily loss limit -- risk must veto before any Order exists.
        bars = make_uptrend_bars(60, start=5000, step=2)
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(
                daily_pnl=Decimal("-2000"), daily_loss_limit=Decimal("2000")
            ),
            stop_price=bars[-1].close - Decimal("10"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
        )

        assert result.opportunity is not None  # the signal was real and tradeable
        assert result.risk_decision is not None
        assert result.risk_decision.outcome == RiskDecisionOutcome.REJECTED
        assert result.order is None
        assert result.position is None

    @pytest.mark.asyncio
    async def test_downtrend_produces_a_real_short_opportunity(self) -> None:
        bars = make_uptrend_bars(60, start=5200, step=-2)
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(),
            stop_price=bars[-1].close + Decimal("10"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
        )

        assert result.opportunity is not None
        assert result.opportunity.direction == Direction.SHORT
        assert result.position is not None
        assert result.position.direction == Direction.SHORT

    @pytest.mark.asyncio
    async def test_opportunity_never_fabricates_a_probability(self) -> None:
        bars = make_uptrend_bars(60, start=5000, step=2)
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(),
            stop_price=bars[-1].close - Decimal("10"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
        )

        assert result.opportunity is not None
        assert result.opportunity.estimated_probability.value is None

    @pytest.mark.asyncio
    async def test_signal_config_is_passed_through_to_compute_signal(self) -> None:
        # A real, deliberately extreme SignalScoringConfig (every state
        # threshold at 0) forces HIGH_CONVICTION on data that the
        # default config alone leaves at a lower, non-tradeable state --
        # proving run_pipeline's own signal_config parameter genuinely
        # reaches strategy.signal.compute_signal rather than being
        # silently ignored in favor of the default every time.
        bars = [make_bar(i, "5000") for i in range(60)]  # flat: NO_TRADE under defaults
        broker = MockBrokerAdapter(price_source=lambda _s: bars[-1].close, clock=lambda: BASE_TIME)
        await broker.connect()

        extreme_config = SignalScoringConfig(state_thresholds=(0.0, 0.0, 0.0, 0.0))
        result = await run_pipeline(
            bars=bars,
            session_bars=bars[-12:],
            session_phase="regular",
            risk_inputs=make_risk_inputs(),
            stop_price=Decimal("4990"),
            current_open_positions=0,
            broker=broker,
            strategy_version="v0.1",
            signal_config=extreme_config,
        )

        assert result.signal.state == SignalState.HIGH_CONVICTION
