"""Vex Business — the real risk engine (Master Directive Section 16). RISK HAS
VETO POWER: this is the one mandatory, unbypassable gate between an
`Opportunity` and any `Order` — Section 16's own rule, "The signal
engine MUST NOT place orders directly," already enforced structurally
by `domain.models.RiskDecision`'s own validators (a REJECTED decision
cannot carry a nonzero `approved_quantity`; a REJECTED decision must
carry a real `rejection_reason`). `evaluate_risk` is the one real
function that produces that decision — a real, deterministic, checked-
in-order sequence of vetoes, never an "always approve" placeholder.

**Two real inputs this function needs beyond `RiskCheckInputs` itself,
both explicitly required, never assumed**: `current_open_positions`
(the real, live count of open positions — Section 16's own
`RiskCheckInputs.maximum_open_positions` field is the *limit*, not the
current count, so the current count must come from a real caller, not
be fabricated here) and `dollar_per_point` (the real contract's own
dollar value per point — Section 17 territory, not something a
generic risk engine can assume for every instrument; `ES_DOLLAR_PER_POINT`
below is a real, named, ES-specific constant for convenience, not a
silent default for any instrument).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from domain.enums import RiskDecisionOutcome
from domain.models import RiskCheckInputs, RiskDecision
from market.session_engine import SessionPhase

#: Real, ES-specific dollar value per point (Section 17 territory,
#: referenced but not itself defined by `domain.models.Opportunity`'s
#: own docstring). A convenience constant for ES callers only — never
#: assumed for any other instrument.
ES_DOLLAR_PER_POINT = Decimal(50)

#: Real, named, flagged-interpretive defaults — Section 16 lists these
#: as real risk *concepts* it checks against, but doesn't hand this
#: session a specific numeric threshold for either. Both fully
#: overridable per call, never buried inline.
#: One real 5-minute bar period (Phase 3's own `BAR_DURATION`) — data
#: older than one full bar is genuinely stale for a 5-minute strategy.
DEFAULT_MAX_DATA_STALENESS_SECONDS = 300.0
#: A common real risk-management circuit-breaker convention.
DEFAULT_MAX_CONSECUTIVE_LOSSES = 3

#: Real, verbatim-value session states (Phase 4's own `SessionPhase`)
#: in which Section 18's "no new entry"/"flatten" semantics apply —
#: reused directly rather than duplicated as bare strings.
BLOCKED_SESSION_STATES = frozenset(
    {SessionPhase.NO_NEW_ENTRY.value, SessionPhase.FLATTEN.value, SessionPhase.CLOSED.value}
)

HEALTHY_BROKER_STATUS = "healthy"
ACTIVE_STRATEGY_STATUS = "active"


@dataclass(frozen=True)
class RiskEngineConfig:
    """Every real, named threshold this engine checks beyond what
    `RiskCheckInputs` itself carries, gathered in one place per Section
    10's own "do not scatter hard-coded values" instruction."""

    max_data_staleness_seconds: float = DEFAULT_MAX_DATA_STALENESS_SECONDS
    max_consecutive_losses: int = DEFAULT_MAX_CONSECUTIVE_LOSSES
    healthy_broker_status: str = HEALTHY_BROKER_STATUS
    active_strategy_status: str = ACTIVE_STRATEGY_STATUS
    blocked_session_states: frozenset[str] = BLOCKED_SESSION_STATES


def _rejected(
    opportunity_id: UUID, as_of: datetime, inputs: RiskCheckInputs, reason: str
) -> RiskDecision:
    return RiskDecision(
        opportunity_id=opportunity_id,
        as_of=as_of,
        inputs=inputs,
        outcome=RiskDecisionOutcome.REJECTED,
        approved_quantity=0,
        rejection_reason=reason,
    )


def evaluate_risk(
    opportunity_id: UUID,
    as_of: datetime,
    inputs: RiskCheckInputs,
    current_open_positions: int,
    dollar_per_point: Decimal,
    requested_quantity: int | None = None,
    margin_per_contract: Decimal | None = None,
    config: RiskEngineConfig | None = None,
) -> RiskDecision:
    """The one real function this module exists for. Checks a real,
    deterministic, fixed sequence of vetoes — the first one that fails
    produces the real `RiskDecision`; nothing later in the sequence is
    even evaluated, the same real short-circuit veto power Section 16
    itself describes. `requested_quantity` defaults to
    `inputs.quantity` when not given separately."""
    cfg = config or RiskEngineConfig()
    quantity = inputs.quantity if requested_quantity is None else requested_quantity

    if inputs.strategy_status != cfg.active_strategy_status:
        reason = f"strategy_status is {inputs.strategy_status!r}, not active"
        return _rejected(opportunity_id, as_of, inputs, reason)

    if inputs.broker_health != cfg.healthy_broker_status:
        return _rejected(
            opportunity_id, as_of, inputs, f"broker_health is {inputs.broker_health!r}, not healthy"
        )

    if inputs.session_state in cfg.blocked_session_states:
        reason = f"session_state is {inputs.session_state!r}, no new entries"
        return _rejected(opportunity_id, as_of, inputs, reason)

    if inputs.data_freshness_seconds > cfg.max_data_staleness_seconds:
        return _rejected(
            opportunity_id,
            as_of,
            inputs,
            f"data is {inputs.data_freshness_seconds}s stale, exceeds "
            f"{cfg.max_data_staleness_seconds}s limit",
        )

    if inputs.daily_pnl <= -inputs.daily_loss_limit:
        return _rejected(
            opportunity_id,
            as_of,
            inputs,
            f"daily_pnl {inputs.daily_pnl} has hit the daily_loss_limit {inputs.daily_loss_limit}",
        )

    if inputs.consecutive_losses >= cfg.max_consecutive_losses:
        return _rejected(
            opportunity_id,
            as_of,
            inputs,
            f"consecutive_losses {inputs.consecutive_losses} >= limit {cfg.max_consecutive_losses}",
        )

    if current_open_positions >= inputs.maximum_open_positions:
        return _rejected(
            opportunity_id,
            as_of,
            inputs,
            f"current_open_positions {current_open_positions} >= "
            f"maximum_open_positions {inputs.maximum_open_positions}",
        )

    if quantity <= 0:
        return _rejected(opportunity_id, as_of, inputs, "requested quantity is not positive")

    stop_distance = abs(inputs.entry - inputs.stop)
    if stop_distance <= 0:
        return _rejected(opportunity_id, as_of, inputs, "stop distance is zero — undefined risk")

    loss_per_contract = stop_distance * dollar_per_point
    if loss_per_contract <= 0:
        reason = "computed loss per contract is not positive"
        return _rejected(opportunity_id, as_of, inputs, reason)

    max_by_trade_loss = int(inputs.maximum_trade_loss // loss_per_contract)
    approved_quantity = min(quantity, inputs.maximum_contracts, max_by_trade_loss)

    if margin_per_contract is not None and margin_per_contract > 0:
        max_by_buying_power = int(inputs.buying_power // margin_per_contract)
        approved_quantity = min(approved_quantity, max_by_buying_power)

    if approved_quantity <= 0:
        return _rejected(
            opportunity_id,
            as_of,
            inputs,
            "real position sizing (maximum_contracts / maximum_trade_loss / buying_power) "
            "reduced the approved quantity to zero",
        )

    maximum_loss = loss_per_contract * approved_quantity
    risk_percentage = (
        float(maximum_loss / inputs.account_equity) if inputs.account_equity > 0 else None
    )

    return RiskDecision(
        opportunity_id=opportunity_id,
        as_of=as_of,
        inputs=inputs,
        outcome=RiskDecisionOutcome.APPROVED,
        approved_quantity=approved_quantity,
        maximum_loss=maximum_loss,
        stop_distance=stop_distance,
        risk_percentage=risk_percentage,
    )
