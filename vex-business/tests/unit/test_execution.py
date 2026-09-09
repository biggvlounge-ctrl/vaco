"""Real unit tests for the execution package (Master Directive Section
42's own "UNIT TEST" discipline). The central thing under test in
`TestLiveTradingGate` is Vex Business's own second governing principle made
concrete at the execution layer: a LIVE broker adapter must never be
constructible while live trading is unarmed, and even armed, must
never be silently faked."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from domain.enums import BrokerAdapterKind, Direction, OrderState, RiskDecisionOutcome
from domain.models import Order, Position, RiskCheckInputs, RiskDecision
from execution.broker import (
    BrokerAdapterError,
    LiveTradingNotArmedError,
    MockBrokerAdapter,
    create_broker_adapter,
)
from execution.orders import (
    ExecutionError,
    build_order_from_risk_decision,
    close_position,
    open_position_from_fill,
)

AS_OF = datetime(2026, 1, 5, 15, 0, 0, tzinfo=UTC)


def make_risk_inputs() -> RiskCheckInputs:
    return RiskCheckInputs(
        account_equity=Decimal("50000"),
        buying_power=Decimal("50000"),
        entry=Decimal("5000"),
        stop=Decimal("4990"),
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


def make_approved_decision(approved_quantity: int = 2) -> RiskDecision:
    return RiskDecision(
        opportunity_id=uuid4(),
        as_of=AS_OF,
        inputs=make_risk_inputs(),
        outcome=RiskDecisionOutcome.APPROVED,
        approved_quantity=approved_quantity,
        maximum_loss=Decimal("1000"),
        stop_distance=Decimal("10"),
        risk_percentage=0.02,
    )


def make_rejected_decision() -> RiskDecision:
    return RiskDecision(
        opportunity_id=uuid4(),
        as_of=AS_OF,
        inputs=make_risk_inputs(),
        outcome=RiskDecisionOutcome.REJECTED,
        rejection_reason="test rejection",
    )


class TestLiveTradingGate:
    def test_live_kind_unarmed_raises_live_trading_not_armed(self) -> None:
        with pytest.raises(LiveTradingNotArmedError):
            create_broker_adapter(BrokerAdapterKind.LIVE, is_live_trading_armed=False)

    def test_live_kind_armed_still_has_no_real_implementation(self) -> None:
        # even armed, LIVE must not silently fall back to a fake fill --
        # it raises a distinct, honest "not implemented" error instead.
        with pytest.raises(BrokerAdapterError) as exc_info:
            create_broker_adapter(BrokerAdapterKind.LIVE, is_live_trading_armed=True)
        assert not isinstance(exc_info.value, LiveTradingNotArmedError)
        assert "no real broker integration" in str(exc_info.value)

    def test_mock_kind_never_requires_the_armed_flag(self) -> None:
        adapter = create_broker_adapter(
            BrokerAdapterKind.MOCK,
            is_live_trading_armed=False,
            price_source=lambda _s: Decimal("5000"),
        )
        assert isinstance(adapter, MockBrokerAdapter)

    def test_paper_kind_also_uses_the_real_mock_implementation(self) -> None:
        adapter = create_broker_adapter(
            BrokerAdapterKind.PAPER,
            is_live_trading_armed=False,
            price_source=lambda _s: Decimal("5000"),
        )
        assert isinstance(adapter, MockBrokerAdapter)

    def test_mock_kind_without_price_source_raises(self) -> None:
        with pytest.raises(BrokerAdapterError):
            create_broker_adapter(BrokerAdapterKind.MOCK, is_live_trading_armed=False)


class TestMockBrokerAdapter:
    @pytest.mark.asyncio
    async def test_submit_order_fills_immediately(self) -> None:
        adapter = MockBrokerAdapter(price_source=lambda _s: Decimal("5005"), clock=lambda: AS_OF)
        await adapter.connect()
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=2,
            state=OrderState.NEW,
            idempotency_key="test-key-1",
        )
        filled = await adapter.submit_order(order)
        assert filled.state == OrderState.FILLED
        assert filled.average_fill_price == Decimal("5005")
        assert filled.filled_at == AS_OF
        assert filled.broker_order_id is not None

    @pytest.mark.asyncio
    async def test_submit_order_while_disconnected_raises(self) -> None:
        adapter = MockBrokerAdapter(price_source=lambda _s: Decimal("5005"))
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=1,
            state=OrderState.NEW,
            idempotency_key="test-key-2",
        )
        with pytest.raises(BrokerAdapterError):
            await adapter.submit_order(order)

    @pytest.mark.asyncio
    async def test_cancel_order(self) -> None:
        adapter = MockBrokerAdapter(price_source=lambda _s: Decimal("5005"))
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=1,
            state=OrderState.NEW,
            idempotency_key="test-key-3",
        )
        cancelled = await adapter.cancel_order(order)
        assert cancelled.state == OrderState.CANCELLED

    @pytest.mark.asyncio
    async def test_cannot_cancel_a_filled_order(self) -> None:
        adapter = MockBrokerAdapter(price_source=lambda _s: Decimal("5005"), clock=lambda: AS_OF)
        await adapter.connect()
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=1,
            state=OrderState.NEW,
            idempotency_key="test-key-4",
        )
        filled = await adapter.submit_order(order)
        with pytest.raises(BrokerAdapterError):
            await adapter.cancel_order(filled)

    @pytest.mark.asyncio
    async def test_health_reflects_connection_state(self) -> None:
        adapter = MockBrokerAdapter(price_source=lambda _s: Decimal("5005"))
        assert await adapter.health() is False
        await adapter.connect()
        assert await adapter.health() is True
        await adapter.disconnect()
        assert await adapter.health() is False


class TestBuildOrderFromRiskDecision:
    def test_builds_a_real_order_from_an_approved_decision(self) -> None:
        decision = make_approved_decision(approved_quantity=3)
        order = build_order_from_risk_decision(
            decision, contract_symbol="ESZ25", direction=Direction.LONG, idempotency_key="k1"
        )
        assert order.quantity == 3
        assert order.state == OrderState.NEW
        assert order.risk_decision_id == decision.decision_id

    def test_refuses_a_rejected_decision(self) -> None:
        decision = make_rejected_decision()
        with pytest.raises(ExecutionError, match="risk has veto power"):
            build_order_from_risk_decision(
                decision, contract_symbol="ESZ25", direction=Direction.LONG, idempotency_key="k2"
            )


class TestPositionLifecycle:
    def test_open_position_from_a_filled_order(self) -> None:
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=2,
            state=OrderState.FILLED,
            idempotency_key="k3",
            filled_at=AS_OF,
            average_fill_price=Decimal("5000"),
        )
        position = open_position_from_fill(
            order, stop_price=Decimal("4990"), target_price=Decimal("5050")
        )
        assert isinstance(position, Position)
        assert position.entry_price == Decimal("5000")
        assert position.opened_at == AS_OF
        assert position.closed_at is None

    def test_refuses_to_open_from_an_unfilled_order(self) -> None:
        order = Order(
            risk_decision_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=2,
            state=OrderState.SUBMITTED,
            idempotency_key="k4",
        )
        with pytest.raises(ExecutionError):
            open_position_from_fill(order, stop_price=Decimal("4990"), target_price=Decimal("5050"))

    def test_close_position(self) -> None:
        position = Position(
            order_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=2,
            entry_price=Decimal("5000"),
            stop_price=Decimal("4990"),
            target_price=Decimal("5050"),
            opened_at=AS_OF,
        )
        closed = close_position(
            position, close_price=Decimal("5050"), close_reason="target_reached", closed_at=AS_OF
        )
        assert closed.closed_at == AS_OF
        assert closed.close_price == Decimal("5050")
        assert closed.close_reason == "target_reached"

    def test_refuses_to_close_an_already_closed_position(self) -> None:
        position = Position(
            order_id=uuid4(),
            contract_symbol="ESZ25",
            direction=Direction.LONG,
            quantity=2,
            entry_price=Decimal("5000"),
            stop_price=Decimal("4990"),
            target_price=Decimal("5050"),
            opened_at=AS_OF,
            closed_at=AS_OF,
            close_price=Decimal("5050"),
            close_reason="target_reached",
        )
        with pytest.raises(ExecutionError):
            close_position(
                position, close_price=Decimal("5060"), close_reason="double_close", closed_at=AS_OF
            )
