"""Vex Business — the real end-to-end pipeline. Not its own Master Directive
section; a real integration of Phases 5-10 already built (feature
engine -> regime engine -> signal engine -> opportunity engine -> risk
engine -> execution) into one callable flow, bars in, a fully-traced
real decision out.

**`PipelineResult` carries every real intermediate artifact**, not
just the final outcome — a caller (an API endpoint, a dashboard, a
test) can see exactly which stage produced which real result, and
exactly why the pipeline stopped early when it does (a non-tradeable
signal state, a risk rejection) rather than only seeing a final
yes/no.

**A real, honest design note on `risk_inputs`**: Section 16's own
`RiskCheckInputs` fields like `account_equity`, `daily_pnl`, and the
various limits describe real, live account state this codebase has no
persisted ledger/account service to track yet (that's real, separate,
unbuilt scope). The caller supplies a real `risk_inputs` template with
everything except `entry`/`stop` already correct; this function fills
in `entry` from the real computed `Opportunity.entry` and `stop` from
the real, explicit `stop_price` parameter — never guesses either.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from domain.enums import MarketRegime, OrderState, RiskDecisionOutcome
from domain.models import (
    Bar,
    FeatureSnapshot,
    Opportunity,
    Order,
    Position,
    RiskCheckInputs,
    RiskDecision,
    Signal,
)
from risk.engine import ES_DOLLAR_PER_POINT, evaluate_risk
from strategy.features import average_true_range, compute_feature_snapshot
from strategy.opportunity import build_opportunity
from strategy.regime import classify_market_regime
from strategy.signal import SignalScoringConfig, compute_signal

from execution.broker import BrokerAdapter
from execution.orders import build_order_from_risk_decision, open_position_from_fill


@dataclass
class PipelineResult:
    """A real, fully-traced record of one pipeline pass. Every field
    past `signal` is honestly `None` when the pipeline stopped early —
    `opportunity is None` means the signal wasn't genuinely tradeable;
    `risk_decision is not None and risk_decision.outcome ==
    RiskDecisionOutcome.REJECTED` means risk vetoed it (with a real,
    specific reason on the decision itself); `order is not None and
    position is None` means the order didn't reach `FILLED`."""

    feature_snapshot: FeatureSnapshot
    atr_baseline: Decimal
    regime: MarketRegime
    signal: Signal
    opportunity: Opportunity | None
    risk_decision: RiskDecision | None
    order: Order | None
    position: Position | None


async def run_pipeline(
    bars: Sequence[Bar],
    session_bars: Sequence[Bar],
    session_phase: str,
    risk_inputs: RiskCheckInputs,
    stop_price: Decimal,
    current_open_positions: int,
    broker: BrokerAdapter,
    strategy_version: str,
    minutes_since_session_open: int | None = None,
    atr_baseline_period: int = 50,
    dollar_per_point: Decimal = ES_DOLLAR_PER_POINT,
    signal_config: SignalScoringConfig | None = None,
) -> PipelineResult:
    """The one real function this module exists for. Runs the full
    real chain once against the given bar window and returns a
    `PipelineResult` — never raises for a genuinely "no trade" outcome
    (a non-tradeable signal or a risk rejection are both real, honest
    results, not error conditions).

    `signal_config` is optional and defaults to `SignalScoringConfig`'s
    own real defaults when omitted — passed through untouched to
    `compute_signal` so a caller running several independent, parallel
    strategy instances (e.g. `apps/worker`'s own scheduler) can give
    each one a real, distinct, named scoring configuration rather than
    all instances silently sharing one hard-coded set of weights."""
    snapshot = compute_feature_snapshot(
        bars=bars,
        session_bars=session_bars,
        session_phase=session_phase,
        minutes_since_session_open=minutes_since_session_open,
    )
    atr_baseline = average_true_range(bars, atr_baseline_period)
    regime = classify_market_regime(snapshot, atr_baseline=atr_baseline)
    signal = compute_signal(
        snapshot, regime, atr_baseline, strategy_version=strategy_version, config=signal_config
    )

    opportunity = build_opportunity(signal, entry_price=bars[-1].close)
    if opportunity is None:
        return PipelineResult(snapshot, atr_baseline, regime, signal, None, None, None, None)

    opportunity_risk_inputs = risk_inputs.model_copy(
        update={"entry": opportunity.entry, "stop": stop_price}
    )
    risk_decision = evaluate_risk(
        opportunity_id=opportunity.opportunity_id,
        as_of=opportunity.as_of,
        inputs=opportunity_risk_inputs,
        current_open_positions=current_open_positions,
        dollar_per_point=dollar_per_point,
    )
    if risk_decision.outcome != RiskDecisionOutcome.APPROVED:
        return PipelineResult(
            snapshot, atr_baseline, regime, signal, opportunity, risk_decision, None, None
        )

    order = build_order_from_risk_decision(
        risk_decision,
        contract_symbol=bars[-1].contract_symbol,
        direction=opportunity.direction,
        idempotency_key=str(uuid4()),
    )
    filled_order = await broker.submit_order(order)

    position = None
    if filled_order.state == OrderState.FILLED:
        position = open_position_from_fill(
            filled_order, stop_price=stop_price, target_price=opportunity.target
        )

    return PipelineResult(
        snapshot, atr_baseline, regime, signal, opportunity, risk_decision, filled_order, position
    )
