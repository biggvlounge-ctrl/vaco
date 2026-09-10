"""Vex Business — real SQLAlchemy 2.0 ORM models (Master Directive Section 6:
INFRASTRUCTURE, database half). Mirrors `domain.models`' real field
lists table-for-table, but is a genuinely separate layer — the domain
package has no SQLAlchemy dependency, and nothing in `domain` imports
from here. `vexbusiness-data` depends on `vexbusiness-domain`; never the reverse.

Every table below traces to a real, cited Master Directive section —
none invented beyond what a real relational schema needs to actually
store the cited fields (surrogate primary keys, foreign keys, an
`inserted_at` audit column) that the directive doesn't itself specify
one way or the other.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    # Section 8: "Store timestamps in UTC." A real, live insert test
    # caught this the honest way -- a bare `Mapped[datetime]` maps to
    # Postgres' `TIMESTAMP WITHOUT TIME ZONE` by default, which
    # actually REJECTS a real timezone-aware UTC datetime at insert
    # time (asyncpg: "can't subtract offset-naive and offset-aware
    # datetimes"). Every `datetime` column across every table uses
    # `TIMESTAMP WITH TIME ZONE` instead, enforced once here rather
    # than repeated (and possibly forgotten) per column.
    type_annotation_map = {datetime: DateTime(timezone=True)}


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# ---------------------------------------------------------------------------
# Section 9 — ES contract handling.
# ---------------------------------------------------------------------------


class ContractSpecORM(Base):
    """Section 9: "root symbol, contract month, contract year,
    expiration" — one row per real, individual futures contract."""

    __tablename__ = "contract_specs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    root_symbol: Mapped[str]
    contract_month: Mapped[int]
    contract_year: Mapped[int]
    expiration: Mapped[date]
    contract_symbol: Mapped[str] = mapped_column(unique=True, index=True)

    __table_args__ = (
        Index(
            "ix_contract_specs_root_month_year",
            "root_symbol",
            "contract_month",
            "contract_year",
        ),
    )


class ContractMappingORM(Base):
    """Section 9: "mapping / roll event / mapped contract / previous
    contract / price adjustment metadata" — the real, timestamped
    record of which individual contract the continuous research series
    pointed at, at a given moment."""

    __tablename__ = "contract_mappings"

    id: Mapped[uuid.UUID] = _uuid_pk()
    root_symbol: Mapped[str] = mapped_column(index=True)
    as_of: Mapped[datetime]
    mapped_contract_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contract_specs.id"))
    previous_contract_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contract_specs.id"))
    is_roll_event: Mapped[bool] = mapped_column(default=False)
    price_adjustment: Mapped[Decimal | None]

    mapped_contract: Mapped[ContractSpecORM] = relationship(foreign_keys=[mapped_contract_id])
    previous_contract: Mapped[ContractSpecORM | None] = relationship(
        foreign_keys=[previous_contract_id]
    )


# ---------------------------------------------------------------------------
# Section 8 — market data. Field-for-field with the directive's own
# "5-minute bar schema."
# ---------------------------------------------------------------------------


class BarORM(Base):
    __tablename__ = "bars"

    id: Mapped[uuid.UUID] = _uuid_pk()
    instrument: Mapped[str] = mapped_column(index=True)
    contract_symbol: Mapped[str] = mapped_column(index=True)
    timestamp_open: Mapped[datetime]
    timestamp_close: Mapped[datetime]
    open: Mapped[Decimal]
    high: Mapped[Decimal]
    low: Mapped[Decimal]
    close: Mapped[Decimal]
    volume: Mapped[int]
    trade_count: Mapped[int | None]
    source: Mapped[str]
    session: Mapped[str]
    is_final: Mapped[bool]

    __table_args__ = (
        # Section 8: "Detect duplicate bars" — a real, enforced
        # uniqueness constraint, not just a detection routine
        # somewhere in application code that could be skipped.
        Index(
            "ux_bars_instrument_contract_open",
            "instrument",
            "contract_symbol",
            "timestamp_open",
            unique=True,
        ),
    )


# ---------------------------------------------------------------------------
# Section 10 — session engine configuration.
# ---------------------------------------------------------------------------


class SessionConfigORM(Base):
    __tablename__ = "session_configs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(unique=True)
    timezone: Mapped[str]
    regular_session_start: Mapped[str]
    regular_session_end: Mapped[str]
    extended_session_start: Mapped[str | None]
    extended_session_end: Mapped[str | None]
    trading_start: Mapped[str]
    trading_end: Mapped[str]
    opening_range_minutes: Mapped[int]
    no_new_entry_cutoff: Mapped[str]
    flatten_cutoff: Mapped[str]


# ---------------------------------------------------------------------------
# Section 13 — signal engine.
# ---------------------------------------------------------------------------


class SignalORM(Base):
    __tablename__ = "signals"

    id: Mapped[uuid.UUID] = _uuid_pk()
    instrument: Mapped[str] = mapped_column(index=True)
    as_of: Mapped[datetime] = mapped_column(index=True)
    long_score: Mapped[float]
    long_components: Mapped[dict[str, Any]] = mapped_column(JSONB)
    short_score: Mapped[float]
    short_components: Mapped[dict[str, Any]] = mapped_column(JSONB)
    regime: Mapped[str]
    state: Mapped[str]
    strategy_version: Mapped[str]


# ---------------------------------------------------------------------------
# Section 14 — the 50-point opportunity engine. `probability_value` is
# genuinely nullable — the no-fabricated-probability rule, enforced at
# the domain layer (`domain.models.Probability`), is preserved here by
# never defaulting this column to a number.
# ---------------------------------------------------------------------------


class OpportunityORM(Base):
    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = _uuid_pk()
    signal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("signals.id"), index=True)
    instrument: Mapped[str] = mapped_column(index=True)
    as_of: Mapped[datetime]
    direction: Mapped[str]
    entry: Mapped[Decimal]
    target: Mapped[Decimal]
    opportunity_score: Mapped[float]
    probability_availability: Mapped[str]
    probability_value: Mapped[float | None]
    sample_count: Mapped[int]
    expected_mfe: Mapped[Decimal | None]
    expected_mae: Mapped[Decimal | None]
    blocking_levels: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    expected_duration_minutes: Mapped[int | None]

    signal: Mapped[SignalORM] = relationship()


# ---------------------------------------------------------------------------
# Section 16 — the risk engine. RISK HAS VETO POWER: `outcome` is the
# one column every later order-creation query must join against and
# check for `'approved'` before an order is ever allowed to exist.
# ---------------------------------------------------------------------------


class RiskDecisionORM(Base):
    __tablename__ = "risk_decisions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    opportunity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("opportunities.id"), index=True)
    as_of: Mapped[datetime]
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB)
    outcome: Mapped[str] = mapped_column(index=True)
    approved_quantity: Mapped[int] = mapped_column(default=0)
    maximum_loss: Mapped[Decimal | None]
    stop_distance: Mapped[Decimal | None]
    risk_percentage: Mapped[float | None]
    rejection_reason: Mapped[str | None]

    opportunity: Mapped[OpportunityORM] = relationship()


# ---------------------------------------------------------------------------
# Section 19 — orders/positions. `risk_decision_id` is NOT NULL and
# foreign-keyed — structurally, an order row cannot exist in this
# schema without a real, prior RiskDecision behind it.
# ---------------------------------------------------------------------------


class OrderORM(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = _uuid_pk()
    risk_decision_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risk_decisions.id"), index=True)
    contract_symbol: Mapped[str] = mapped_column(index=True)
    direction: Mapped[str]
    quantity: Mapped[int]
    state: Mapped[str] = mapped_column(index=True)
    idempotency_key: Mapped[str] = mapped_column(unique=True)
    broker_order_id: Mapped[str | None] = mapped_column(index=True)
    submitted_at: Mapped[datetime | None]
    filled_at: Mapped[datetime | None]
    average_fill_price: Mapped[Decimal | None]

    risk_decision: Mapped[RiskDecisionORM] = relationship()


class PositionORM(Base):
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    contract_symbol: Mapped[str] = mapped_column(index=True)
    direction: Mapped[str]
    quantity: Mapped[int]
    entry_price: Mapped[Decimal]
    stop_price: Mapped[Decimal]
    target_price: Mapped[Decimal]
    opened_at: Mapped[datetime]
    closed_at: Mapped[datetime | None]
    close_price: Mapped[Decimal | None]
    close_reason: Mapped[str | None]

    order: Mapped[OrderORM] = relationship()


# ---------------------------------------------------------------------------
# Section 7 — the real event/audit log. Every event this system ever
# emits, in every phase, lands here — "The system must know: WHAT
# happened... WHY Vex Business made the decision... WHAT the result was."
# ---------------------------------------------------------------------------


class EventORM(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = _uuid_pk()
    event_type: Mapped[str] = mapped_column(index=True)
    timestamp: Mapped[datetime] = mapped_column(index=True)
    correlation_id: Mapped[uuid.UUID] = mapped_column(index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    trade_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    strategy_version: Mapped[str | None]
    model_version: Mapped[str | None]
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    inserted_at: Mapped[datetime] = mapped_column(server_default=func.now())


# ---------------------------------------------------------------------------
# Section 15 — model versioning.
# ---------------------------------------------------------------------------


class ModelVersionORM(Base):
    __tablename__ = "model_versions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    model_id: Mapped[str] = mapped_column(index=True)
    version: Mapped[str]
    training_period_start: Mapped[date]
    training_period_end: Mapped[date]
    validation_period_start: Mapped[date]
    validation_period_end: Mapped[date]
    test_period_start: Mapped[date]
    test_period_end: Mapped[date]
    feature_set: Mapped[list[Any]] = mapped_column(JSONB)
    hyperparameters: Mapped[dict[str, Any]] = mapped_column(JSONB)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB)
    artifact_hash: Mapped[str]

    __table_args__ = (Index("ux_model_versions_model_version", "model_id", "version", unique=True),)
