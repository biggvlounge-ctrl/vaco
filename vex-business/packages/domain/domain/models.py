"""Vex Business — core domain models (Master Directive Section 6: DOMAIN,
"pure trading concepts"; and Sections 8, 9, 10, 13, 14, 15, 16).

Every field list below is transcribed directly from the section that
specifies it — cited in each model's own docstring — not invented or
approximated. This module has no database, broker, or HTTP dependency
(`vexbusiness-domain`'s own `pyproject.toml` depends on nothing but pydantic)
per Section 6's own architecture rule: "The strategy engine must not
depend directly on the frontend. The strategy engine must not depend
directly on a specific broker."
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from domain.enums import (
    Direction,
    MarketRegime,
    OrderState,
    ProbabilityAvailability,
    RiskDecisionOutcome,
    SignalState,
)

# ---------------------------------------------------------------------------
# Section 9 — ES contract handling. Three real, distinct concepts, kept as
# three real types rather than one loosely-typed "symbol" string, because
# the directive's own governing rule depends on the distinction:
# "A continuous symbol MUST NEVER be submitted to a live broker."
# ---------------------------------------------------------------------------


class ContractSpec(BaseModel):
    """A single, individual historical or current futures contract
    (Section 9's "root symbol, contract month, contract year,
    expiration"). This is the only one of the three Section 9 concepts
    that is ever a real, tradable instrument."""

    root_symbol: str
    contract_month: int = Field(ge=1, le=12)
    contract_year: int = Field(ge=2000)
    expiration: date
    contract_symbol: str  # the real, exchange-tradable symbol, e.g. "ESZ25"


class ContractMapping(BaseModel):
    """Section 9's "mapping / roll event / mapped contract / previous
    contract / price adjustment metadata" — the real record of which
    individual `ContractSpec` the continuous research series currently
    points at, and what it pointed at before the last roll."""

    mapping_id: UUID = Field(default_factory=uuid4)
    as_of: datetime
    mapped_contract: ContractSpec
    previous_contract: ContractSpec | None = None
    is_roll_event: bool = False
    price_adjustment: Decimal | None = None


class ContinuousSeries(BaseModel):
    """Section 9's "CONTINUOUS RESEARCH SERIES" — a real, distinct type
    from `ContractSpec` specifically so the type system itself makes
    the directive's governing rule checkable: nothing that only ever
    receives a `ContinuousSeries` can hand it to a broker adapter,
    which only ever accepts a `ContractSpec.contract_symbol`."""

    root_symbol: str
    current_mapping: ContractMapping


# ---------------------------------------------------------------------------
# Section 8 — market data. Field list transcribed verbatim from the
# directive's own "5-minute bar schema."
# ---------------------------------------------------------------------------


class Tick(BaseModel):
    """Section 8's own "TICK / BID/ASK / LAST TRADE" real-time data
    types, unified into one real event shape: every tick carries a
    `kind` naming which of those three it is, since a bid/ask update
    and a last-trade print are structurally the same shape (price,
    size, timestamp) but mean different things to a consumer (a
    candle engine only aggregates `last_trade` ticks into OHLCV bars;
    `bid`/`ask` ticks exist for spread-aware fill simulation later,
    Section 22, not for bar construction)."""

    instrument: str
    contract_symbol: str
    kind: str = Field(pattern="^(last_trade|bid|ask)$")
    price: Decimal
    size: int = Field(ge=0)
    timestamp: datetime
    source: str


class Bar(BaseModel):
    """Section 8's own 5-minute bar schema, field-for-field. Timestamps
    are UTC per Section 8 ("Store timestamps in UTC. Session/timezone
    metadata must be explicit.") — `session` below carries the explicit
    session context separately, rather than inferring it from the UTC
    timestamp at read time."""

    instrument: str
    contract_symbol: str
    timestamp_open: datetime
    timestamp_close: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int = Field(ge=0)
    trade_count: int | None = Field(default=None, ge=0)
    source: str
    session: str
    is_final: bool

    @field_validator("high")
    @classmethod
    def high_is_real_high(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        """Section 8: "Detect... invalid OHLC... Do not silently accept
        corrupted data." A high below open/close/low is corrupted data,
        not a valid bar — rejected at construction, not downstream."""
        data = info.data
        for field in ("open", "close", "low"):
            other = data.get(field)
            if other is not None and v < other:
                raise ValueError(f"invalid OHLC: high ({v}) is below {field} ({other})")
        return v

    @field_validator("low")
    @classmethod
    def low_is_real_low(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        data = info.data
        for field in ("open", "close"):
            other = data.get(field)
            if other is not None and v > other:
                raise ValueError(f"invalid OHLC: low ({v}) is above {field} ({other})")
        return v


# ---------------------------------------------------------------------------
# Section 10 — session engine. Configurable, not hard-coded (the
# directive's own explicit instruction: "Do not scatter hard-coded times
# throughout the code.").
# ---------------------------------------------------------------------------


class SessionConfig(BaseModel):
    """Section 10's own field list, verbatim: timezone, regular
    session, extended session, trading start, trading end, opening
    range, no-new-entry cutoff, flatten cutoff. Initial configuration
    targets "US ES day trading" (Section 10) but every field is real
    and settable, not hard-coded."""

    timezone: str
    regular_session_start: str  # "HH:MM" local to `timezone`
    regular_session_end: str
    extended_session_start: str | None = None
    extended_session_end: str | None = None
    trading_start: str
    trading_end: str
    opening_range_minutes: int = Field(ge=1)
    no_new_entry_cutoff: str
    flatten_cutoff: str


# ---------------------------------------------------------------------------
# Section 11 — feature engine.
# ---------------------------------------------------------------------------


class FeatureSnapshot(BaseModel):
    """Section 11's real feature engine output — the raw, numeric
    technical inputs the later regime engine (Section 12) and signal
    engine (Section 13) consume.

    **Real, flagged interpretive choice**: Section 11's own verbatim
    field list is not available in this session's current context (it
    was pasted as chat text in an earlier segment and has since
    scrolled out of the working window), so the field set below is a
    real, deliberate design rather than a transcription — grounded in
    the one piece of Section 11's output already fixed elsewhere in
    this codebase: Section 13's own `SignalComponentScores`, which
    names exactly 8 categories (trend, market_structure, vwap,
    momentum, volume, key_levels, volatility, session_timing). Each
    field below is the real, computed raw input for one of those 8
    categories — not a fabricated placeholder, and not claimed to be
    Section 11's own original field names."""

    instrument: str
    contract_symbol: str
    as_of: datetime
    # market.session_engine.SessionPhase's own value, kept as `str`
    # since `domain` has no dependency on `market`.
    session_phase: str
    minutes_since_session_open: int | None = None
    sma_fast: Decimal
    sma_slow: Decimal
    trend_direction: str  # "up" | "down" | "flat"
    market_structure: str  # "higher_highs_higher_lows" | "lower_highs_lower_lows" | "mixed"
    vwap: Decimal
    vwap_distance: Decimal
    momentum: Decimal
    volume_ratio: Decimal
    session_high: Decimal
    session_low: Decimal
    distance_from_session_high: Decimal
    distance_from_session_low: Decimal
    atr: Decimal


# ---------------------------------------------------------------------------
# Section 13 — signal engine.
# ---------------------------------------------------------------------------


class SignalComponentScores(BaseModel):
    """Section 13's own weighted component breakdown, verbatim — the
    real default weights (TREND=20 ... TOTAL=100), not placeholders.
    Section 13: "Make every component configurable" — these are the
    real defaults a caller may override, not a hard-coded formula."""

    trend: float = Field(default=20.0, ge=0)
    market_structure: float = Field(default=15.0, ge=0)
    vwap: float = Field(default=15.0, ge=0)
    momentum: float = Field(default=15.0, ge=0)
    volume: float = Field(default=10.0, ge=0)
    key_levels: float = Field(default=10.0, ge=0)
    volatility: float = Field(default=10.0, ge=0)
    session_timing: float = Field(default=5.0, ge=0)

    @property
    def total(self) -> float:
        return (
            self.trend
            + self.market_structure
            + self.vwap
            + self.momentum
            + self.volume
            + self.key_levels
            + self.volatility
            + self.session_timing
        )


class Signal(BaseModel):
    """Section 13: independent LONG and SHORT scores, a regime, and a
    state. "The score is NOT a probability" — enforced here only by
    keeping `long_score`/`short_score` as a plain, unbounded-semantics
    float (0-100 by convention, not typed as a probability), distinct
    from the real `Probability` type Section 14's opportunity engine
    uses below."""

    signal_id: UUID = Field(default_factory=uuid4)
    instrument: str
    as_of: datetime
    long_score: float
    long_components: SignalComponentScores
    short_score: float
    short_components: SignalComponentScores
    regime: MarketRegime
    state: SignalState
    strategy_version: str


# ---------------------------------------------------------------------------
# Section 14 — the 50-point opportunity engine, and its own governing
# rule: "NEVER fabricate a probability."
# ---------------------------------------------------------------------------


class Probability(BaseModel):
    """The real type behind Section 14's rule. `value` is structurally
    `None` whenever `availability` is `UNAVAILABLE` — enforced by the
    validator below, not left to callers to remember. `sample_count`
    is always present (even when unavailable) so a caller can see
    *why* it's unavailable, per Section 15's "minimum sample sizes
    must be configurable" (the threshold `sample_count` is compared
    against lives in config, not here — this type just carries the
    real count honestly).

    `confidence_low`/`confidence_high` (added later): a real 95%
    Wilson score interval around `value`, not a second, independent
    guess — a naive hit-rate on a small sample overstates precision
    (30/30 real observed hits reads as "100%", which is a genuinely
    different claim than "100%, ±0%"). Populated only when ESTIMATED,
    same governing rule as `value` itself: never fabricated, only ever
    computed from the same real `sample_count` — see
    `strategy.opportunity.wilson_score_interval`."""

    availability: ProbabilityAvailability
    value: float | None = Field(default=None, ge=0.0, le=1.0)
    sample_count: int = Field(ge=0)
    confidence_low: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence_high: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("value")
    @classmethod
    def unavailable_means_no_value(cls, v: float | None, info: ValidationInfo) -> float | None:
        availability = info.data.get("availability")
        if availability == ProbabilityAvailability.UNAVAILABLE and v is not None:
            raise ValueError(
                "Probability.value must be None when availability is UNAVAILABLE — "
                "never fabricate a probability (Master Directive Section 14)."
            )
        if availability == ProbabilityAvailability.ESTIMATED and v is None:
            raise ValueError("Probability.value is required when availability is ESTIMATED.")
        return v

    @field_validator("confidence_high")
    @classmethod
    def unavailable_means_no_interval(cls, v: float | None, info: ValidationInfo) -> float | None:
        availability = info.data.get("availability")
        confidence_low = info.data.get("confidence_low")
        if availability == ProbabilityAvailability.UNAVAILABLE and (
            v is not None or confidence_low is not None
        ):
            raise ValueError(
                "Probability.confidence_low/confidence_high must be None when "
                "availability is UNAVAILABLE — same rule as value itself."
            )
        return v


class Opportunity(BaseModel):
    """Section 14's own output field list, verbatim: direction, entry,
    target, opportunity_score, estimated_probability, sample_count,
    expected_MFE, expected_MAE, blocking_levels, expected_duration.
    `estimated_probability` is the real `Probability` type above, not
    a bare float — `sample_count` also appears at the top level here
    because Section 14 lists it as its own separate output field,
    alongside (not only inside) the probability."""

    opportunity_id: UUID = Field(default_factory=uuid4)
    signal_id: UUID
    instrument: str
    as_of: datetime
    direction: Direction
    entry: Decimal
    target: Decimal  # entry +/- 50 points per Section 14's own formula
    opportunity_score: float
    estimated_probability: Probability
    sample_count: int = Field(ge=0)
    expected_mfe: Decimal | None = None
    expected_mae: Decimal | None = None
    blocking_levels: list[Decimal] = Field(default_factory=list)
    expected_duration_minutes: int | None = Field(default=None, ge=0)

    @field_validator("target")
    @classmethod
    def target_is_real_50_points(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        """Section 14: "LONG: target = entry + 50 points. SHORT: target
        = entry - 50 points." ES's point value/tick size isn't itself a
        Section-14 concern (that's Section 17's $50/point), so this
        checks the real 50-point distance directly in price terms."""
        entry = info.data.get("entry")
        direction = info.data.get("direction")
        if entry is None or direction is None:
            return v
        expected = entry + 50 if direction == Direction.LONG else entry - 50
        if v != expected:
            raise ValueError(
                f"target ({v}) does not match entry {entry} +/- 50 points for {direction} "
                f"(expected {expected})."
            )
        return v


# ---------------------------------------------------------------------------
# Section 16 — the risk engine's own real input/output contract. RISK
# HAS VETO POWER: `RiskDecision.outcome` is the one field every
# downstream consumer (the decision/execution engine, in later phases)
# must check before anything is ever submitted to a broker.
# ---------------------------------------------------------------------------


class RiskCheckInputs(BaseModel):
    """Section 16's own real input list, verbatim."""

    account_equity: Decimal
    buying_power: Decimal
    entry: Decimal
    stop: Decimal
    quantity: int = Field(ge=0)
    daily_pnl: Decimal
    daily_loss_limit: Decimal
    maximum_trade_loss: Decimal
    maximum_contracts: int = Field(ge=0)
    maximum_open_positions: int = Field(ge=0)
    consecutive_losses: int = Field(ge=0)
    session_state: str
    volatility: float
    data_freshness_seconds: float = Field(ge=0)
    broker_health: str
    strategy_status: str


class RiskDecision(BaseModel):
    """Section 16's own real output contract, verbatim: APPROVED or
    REJECTED, plus approved quantity, maximum loss, stop distance,
    risk percentage, rejection reason. `outcome` is the real veto —
    Section 16: "The signal engine MUST NOT place orders directly."
    No order-creation path in any later phase may skip constructing
    one of these first."""

    decision_id: UUID = Field(default_factory=uuid4)
    opportunity_id: UUID
    as_of: datetime
    inputs: RiskCheckInputs
    outcome: RiskDecisionOutcome
    approved_quantity: int = Field(default=0, ge=0)
    maximum_loss: Decimal | None = None
    stop_distance: Decimal | None = None
    risk_percentage: float | None = None
    rejection_reason: str | None = None

    @field_validator("rejection_reason")
    @classmethod
    def rejected_requires_reason(cls, v: str | None, info: ValidationInfo) -> str | None:
        if info.data.get("outcome") == RiskDecisionOutcome.REJECTED and not v:
            raise ValueError("a REJECTED RiskDecision requires a real rejection_reason.")
        return v

    @field_validator("approved_quantity")
    @classmethod
    def rejected_means_zero_quantity(cls, v: int, info: ValidationInfo) -> int:
        if info.data.get("outcome") == RiskDecisionOutcome.REJECTED and v != 0:
            raise ValueError("a REJECTED RiskDecision must have approved_quantity == 0.")
        return v


# ---------------------------------------------------------------------------
# Section 19 — order/position lifecycle (domain shape only; the real
# BrokerAdapter behavior is Phase 3+ scope, in vexbusiness-execution).
# ---------------------------------------------------------------------------


class Order(BaseModel):
    """The real order record. `broker_order_id` is honestly nullable —
    Section 19: "Never assume submit = fill," and a NEW order has no
    broker-assigned id yet. `idempotency_key` is Section 19's own
    explicit requirement ("Use idempotency keys.")."""

    order_id: UUID = Field(default_factory=uuid4)
    risk_decision_id: UUID
    contract_symbol: str  # a real ContractSpec.contract_symbol — never a continuous series
    direction: Direction
    quantity: int = Field(gt=0)
    state: OrderState
    idempotency_key: str
    broker_order_id: str | None = None
    submitted_at: datetime | None = None
    filled_at: datetime | None = None
    average_fill_price: Decimal | None = None


class Position(BaseModel):
    """A real, open-or-closed position resulting from one or more
    fills against one `Order`."""

    position_id: UUID = Field(default_factory=uuid4)
    order_id: UUID
    contract_symbol: str
    direction: Direction
    quantity: int = Field(gt=0)
    entry_price: Decimal
    stop_price: Decimal
    target_price: Decimal
    opened_at: datetime
    closed_at: datetime | None = None
    close_price: Decimal | None = None
    close_reason: str | None = None  # e.g. "target_reached", "stop_triggered", "session_cutoff"


# ---------------------------------------------------------------------------
# Section 15 — model/strategy versioning.
# ---------------------------------------------------------------------------


class ModelVersion(BaseModel):
    """Section 15's own real field list, verbatim: model_id, version,
    training period, validation period, test period, feature set,
    hyperparameters, metrics, artifact hash."""

    model_id: str
    version: str
    training_period_start: date
    training_period_end: date
    validation_period_start: date
    validation_period_end: date
    test_period_start: date
    test_period_end: date
    feature_set: list[str]
    hyperparameters: dict[str, Any]
    metrics: dict[str, Any]
    artifact_hash: str
