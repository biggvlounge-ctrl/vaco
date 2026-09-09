"""Vex Business — real order/position lifecycle helpers (Master Directive
Section 19-20). `build_order_from_risk_decision` is the one real place
an `Order` may be constructed — refuses anything but a real `APPROVED`
`RiskDecision`, enforcing Section 16's "the signal engine MUST NOT
place orders directly" rule at this layer too (defense in depth
alongside `RiskDecision`'s own structural validators, which already
make a `REJECTED` decision structurally incapable of carrying a
nonzero `approved_quantity`)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from domain.enums import Direction, OrderState, RiskDecisionOutcome
from domain.models import Order, Position, RiskDecision


class ExecutionError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule."""


def build_order_from_risk_decision(
    risk_decision: RiskDecision,
    contract_symbol: str,
    direction: Direction,
    idempotency_key: str,
) -> Order:
    """The one real place an `Order` may be constructed."""
    if risk_decision.outcome != RiskDecisionOutcome.APPROVED:
        raise ExecutionError(
            "cannot build an Order from a non-APPROVED RiskDecision — "
            "risk has veto power (Master Directive Section 16)"
        )
    return Order(
        risk_decision_id=risk_decision.decision_id,
        contract_symbol=contract_symbol,
        direction=direction,
        quantity=risk_decision.approved_quantity,
        state=OrderState.NEW,
        idempotency_key=idempotency_key,
    )


def open_position_from_fill(
    order: Order, stop_price: Decimal, target_price: Decimal
) -> Position:
    """A real `Position` only ever comes from a real, actually-filled
    `Order` — "never assume submit = fill" applies here too."""
    if order.state != OrderState.FILLED:
        raise ExecutionError(f"cannot open a Position from an order in state {order.state}")
    if order.filled_at is None or order.average_fill_price is None:
        raise ExecutionError("a FILLED order is missing its real fill data")

    return Position(
        order_id=order.order_id,
        contract_symbol=order.contract_symbol,
        direction=order.direction,
        quantity=order.quantity,
        entry_price=order.average_fill_price,
        stop_price=stop_price,
        target_price=target_price,
        opened_at=order.filled_at,
    )


def close_position(
    position: Position, close_price: Decimal, close_reason: str, closed_at: datetime
) -> Position:
    """Real position closure — refuses to close an already-closed
    position rather than silently overwriting its real close data."""
    if position.closed_at is not None:
        raise ExecutionError(f"position {position.position_id} is already closed")

    return position.model_copy(
        update={"closed_at": closed_at, "close_price": close_price, "close_reason": close_reason}
    )
