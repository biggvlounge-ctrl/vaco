"""Real unit tests for the risk engine (Master Directive Section 42's
own "UNIT TEST" discipline). This is Vex Business's own central governing
principle under test: risk has veto power. Every veto path is covered,
plus the real position-sizing math on the approval path."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from domain.enums import RiskDecisionOutcome
from domain.models import RiskCheckInputs, RiskDecision
from risk.engine import ES_DOLLAR_PER_POINT, RiskEngineConfig, evaluate_risk

AS_OF = datetime(2026, 1, 5, 15, 0, 0, tzinfo=UTC)


def make_inputs(**overrides: object) -> RiskCheckInputs:
    defaults: dict[str, object] = dict(
        account_equity=Decimal("50000"),
        buying_power=Decimal("50000"),
        entry=Decimal("5000"),
        stop=Decimal("4990"),  # 10-point stop
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


def evaluate(inputs: RiskCheckInputs, **kwargs: Any) -> RiskDecision:
    kwargs.setdefault("current_open_positions", 0)
    kwargs.setdefault("dollar_per_point", ES_DOLLAR_PER_POINT)
    return evaluate_risk(
        opportunity_id=uuid4(),
        as_of=AS_OF,
        inputs=inputs,
        **kwargs,
    )


def reason_of(decision: RiskDecision) -> str:
    """A REJECTED decision always has a real, non-None reason
    (`domain.models.RiskDecision`'s own validator enforces this) — this
    helper just gives mypy strict a real `str`, not `str | None`."""
    assert decision.rejection_reason is not None
    return decision.rejection_reason


class TestVetoes:
    def test_inactive_strategy_is_rejected(self) -> None:
        decision = evaluate(make_inputs(strategy_status="paused"))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert decision.approved_quantity == 0
        assert "strategy_status" in reason_of(decision)

    def test_unhealthy_broker_is_rejected(self) -> None:
        decision = evaluate(make_inputs(broker_health="degraded"))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "broker_health" in reason_of(decision)

    def test_no_new_entry_session_is_rejected(self) -> None:
        decision = evaluate(make_inputs(session_state="no_new_entry"))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "session_state" in reason_of(decision)

    def test_flatten_session_is_rejected(self) -> None:
        decision = evaluate(make_inputs(session_state="flatten"))
        assert decision.outcome == RiskDecisionOutcome.REJECTED

    def test_closed_session_is_rejected(self) -> None:
        decision = evaluate(make_inputs(session_state="closed"))
        assert decision.outcome == RiskDecisionOutcome.REJECTED

    def test_extended_session_is_not_blocked_by_itself(self) -> None:
        decision = evaluate(make_inputs(session_state="extended"))
        assert decision.outcome == RiskDecisionOutcome.APPROVED

    def test_stale_data_is_rejected(self) -> None:
        decision = evaluate(make_inputs(data_freshness_seconds=999.0))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "stale" in reason_of(decision)

    def test_daily_loss_limit_hit_is_rejected(self) -> None:
        decision = evaluate(
            make_inputs(daily_pnl=Decimal("-2000"), daily_loss_limit=Decimal("2000"))
        )
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "daily_loss_limit" in reason_of(decision)

    def test_daily_pnl_within_limit_is_not_blocked_by_itself(self) -> None:
        decision = evaluate(
            make_inputs(daily_pnl=Decimal("-1999"), daily_loss_limit=Decimal("2000"))
        )
        assert decision.outcome == RiskDecisionOutcome.APPROVED

    def test_max_consecutive_losses_is_rejected(self) -> None:
        decision = evaluate(make_inputs(consecutive_losses=3))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "consecutive_losses" in reason_of(decision)

    def test_max_open_positions_is_rejected(self) -> None:
        decision = evaluate(
            make_inputs(maximum_open_positions=3), current_open_positions=3
        )
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "maximum_open_positions" in reason_of(decision)

    def test_non_positive_quantity_is_rejected(self) -> None:
        decision = evaluate(make_inputs(quantity=0))
        assert decision.outcome == RiskDecisionOutcome.REJECTED

    def test_zero_stop_distance_is_rejected(self) -> None:
        decision = evaluate(make_inputs(entry=Decimal("5000"), stop=Decimal("5000")))
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert "stop distance" in reason_of(decision)

    def test_vetoes_are_checked_in_order_first_failure_wins(self) -> None:
        # both strategy_status AND broker_health are bad -- the
        # strategy_status check (checked first) must be the reported
        # reason, not broker_health.
        decision = evaluate(make_inputs(strategy_status="paused", broker_health="degraded"))
        assert "strategy_status" in reason_of(decision)


class TestApprovalAndSizing:
    def test_real_approved_decision_has_no_rejection_reason(self) -> None:
        decision = evaluate(make_inputs())
        assert decision.outcome == RiskDecisionOutcome.APPROVED
        assert decision.rejection_reason is None
        assert decision.approved_quantity > 0

    def test_real_position_sizing_math(self) -> None:
        # 10-point stop * $50/point = $500/contract. maximum_trade_loss
        # $1000 -> max 2 contracts by trade-loss cap. requested=2,
        # maximum_contracts=5 -- trade-loss cap (2) should bind.
        decision = evaluate(make_inputs(quantity=2, maximum_trade_loss=Decimal("1000")))
        assert decision.approved_quantity == 2
        assert decision.maximum_loss == Decimal("1000")
        assert decision.stop_distance == Decimal("10")
        assert decision.risk_percentage == pytest.approx(1000 / 50000)

    def test_maximum_trade_loss_caps_below_requested_quantity(self) -> None:
        # same $500/contract, but maximum_trade_loss only allows 1.
        decision = evaluate(
            make_inputs(quantity=5, maximum_trade_loss=Decimal("500"), maximum_contracts=5)
        )
        assert decision.outcome == RiskDecisionOutcome.APPROVED
        assert decision.approved_quantity == 1

    def test_maximum_contracts_caps_below_requested_quantity(self) -> None:
        decision = evaluate(
            make_inputs(quantity=5, maximum_contracts=2, maximum_trade_loss=Decimal("10000"))
        )
        assert decision.outcome == RiskDecisionOutcome.APPROVED
        assert decision.approved_quantity == 2

    def test_trade_loss_too_small_for_even_one_contract_is_rejected(self) -> None:
        decision = evaluate(make_inputs(maximum_trade_loss=Decimal("100")))  # < $500/contract
        assert decision.outcome == RiskDecisionOutcome.REJECTED
        assert decision.approved_quantity == 0
        assert "zero" in reason_of(decision)

    def test_margin_per_contract_further_caps_quantity(self) -> None:
        decision = evaluate(
            make_inputs(
                quantity=5,
                maximum_contracts=5,
                maximum_trade_loss=Decimal("10000"),
                buying_power=Decimal("6000"),
            ),
            margin_per_contract=Decimal("3000"),
        )
        assert decision.outcome == RiskDecisionOutcome.APPROVED
        assert decision.approved_quantity == 2  # floor(6000 / 3000)

    def test_requested_quantity_overrides_inputs_quantity(self) -> None:
        decision = evaluate(
            make_inputs(quantity=1, maximum_contracts=5, maximum_trade_loss=Decimal("10000")),
            requested_quantity=4,
        )
        assert decision.approved_quantity == 4

    def test_custom_config_thresholds_are_honored(self) -> None:
        config = RiskEngineConfig(max_consecutive_losses=1)
        decision = evaluate(make_inputs(consecutive_losses=1), config=config)
        assert decision.outcome == RiskDecisionOutcome.REJECTED
