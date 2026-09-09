"""Real unit tests for the AI trade-rationale module (Master Directive
Section 42's own "UNIT TEST" discipline). The central thing under test:
this module never fabricates a rationale offline, and its own prompt
never asks the model to make or override the already-final risk/
opportunity decision -- it only explains one that already exists."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from ai.rationale import RationaleUnavailableError, _build_prompt, generate_trade_rationale
from domain.enums import (
    Direction,
    ProbabilityAvailability,
    RiskDecisionOutcome,
)
from domain.models import Opportunity, Probability, RiskCheckInputs, RiskDecision

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


def make_opportunity(estimated: bool = True) -> Opportunity:
    probability = (
        Probability(
            availability=ProbabilityAvailability.ESTIMATED,
            value=0.7,
            sample_count=30,
            confidence_low=0.521,
            confidence_high=0.833,
        )
        if estimated
        else Probability(availability=ProbabilityAvailability.UNAVAILABLE, sample_count=5)
    )
    return Opportunity(
        signal_id=uuid4(),
        instrument="ES",
        as_of=AS_OF,
        direction=Direction.LONG,
        entry=Decimal("5000"),
        target=Decimal("5050"),
        opportunity_score=65.0,
        estimated_probability=probability,
        sample_count=probability.sample_count,
    )


def make_approved_decision(opportunity_id: str) -> RiskDecision:
    return RiskDecision(
        opportunity_id=opportunity_id,
        as_of=AS_OF,
        inputs=make_risk_inputs(),
        outcome=RiskDecisionOutcome.APPROVED,
        approved_quantity=2,
        maximum_loss=Decimal("1000"),
        stop_distance=Decimal("10"),
        risk_percentage=0.02,
    )


def make_rejected_decision(opportunity_id: str) -> RiskDecision:
    return RiskDecision(
        opportunity_id=opportunity_id,
        as_of=AS_OF,
        inputs=make_risk_inputs(),
        outcome=RiskDecisionOutcome.REJECTED,
        rejection_reason="daily loss limit exceeded",
    )


class TestBuildPrompt:
    def test_approved_decision_includes_real_approved_quantity_not_rejection_reason(self) -> None:
        opp = make_opportunity()
        decision = make_approved_decision(opp.opportunity_id)
        prompt = _build_prompt(opp, decision, None)
        assert "Approved quantity: 2" in prompt
        assert "Rejection reason" not in prompt

    def test_rejected_decision_includes_the_real_rejection_reason(self) -> None:
        opp = make_opportunity()
        decision = make_rejected_decision(opp.opportunity_id)
        prompt = _build_prompt(opp, decision, None)
        assert "Rejection reason: daily loss limit exceeded" in prompt
        assert "Approved quantity" not in prompt

    def test_unavailable_probability_is_stated_plainly_not_omitted(self) -> None:
        opp = make_opportunity(estimated=False)
        decision = make_approved_decision(opp.opportunity_id)
        prompt = _build_prompt(opp, decision, None)
        assert "UNAVAILABLE" in prompt

    def test_estimated_probability_includes_the_real_confidence_interval(self) -> None:
        opp = make_opportunity(estimated=True)
        decision = make_approved_decision(opp.opportunity_id)
        prompt = _build_prompt(opp, decision, None)
        assert "70%" in prompt
        assert "95% CI" in prompt

    def test_prompt_never_asks_the_model_to_change_the_decision(self) -> None:
        opp = make_opportunity()
        decision = make_approved_decision(opp.opportunity_id)
        prompt = _build_prompt(opp, decision, None)
        assert "final" in prompt.lower()
        assert "do not suggest changing" in prompt.lower()


class TestGenerateTradeRationale:
    async def test_raises_without_a_real_api_key_never_fabricates(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        opp = make_opportunity()
        decision = make_approved_decision(opp.opportunity_id)
        with pytest.raises(RationaleUnavailableError):
            await generate_trade_rationale(opp, decision, api_key=None)

    async def test_raises_on_a_real_non_200_response(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import httpx

        class FakeResponse:
            status_code = 401
            text = '{"error": "invalid api key"}'

        class FakeAsyncClient:
            def __init__(self, *args: object, **kwargs: object) -> None:
                pass

            async def __aenter__(self) -> "FakeAsyncClient":
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, *args: object, **kwargs: object) -> FakeResponse:
                return FakeResponse()

        monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
        opp = make_opportunity()
        decision = make_approved_decision(opp.opportunity_id)
        with pytest.raises(RationaleUnavailableError, match="401"):
            await generate_trade_rationale(opp, decision, api_key="fake-key-for-this-test-only")

    async def test_real_successful_response_shape_is_parsed_correctly(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import httpx

        class FakeResponse:
            status_code = 200

            def json(self) -> dict[str, object]:
                return {"content": [{"type": "text", "text": "This is a real test rationale."}]}

        class FakeAsyncClient:
            def __init__(self, *args: object, **kwargs: object) -> None:
                pass

            async def __aenter__(self) -> "FakeAsyncClient":
                return self

            async def __aexit__(self, *args: object) -> None:
                return None

            async def post(self, *args: object, **kwargs: object) -> FakeResponse:
                return FakeResponse()

        monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
        opp = make_opportunity()
        decision = make_approved_decision(opp.opportunity_id)
        result = await generate_trade_rationale(opp, decision, api_key="fake-key-for-this-test-only")
        assert result.summary == "This is a real test rationale."
        assert result.opportunity_id == str(opp.opportunity_id)
