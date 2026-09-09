"""Vex Business — the real, complete event catalog (Master Directive Section 7).

Every event name below is copied verbatim from Section 7's own list —
none invented, none omitted, none renamed. `Event` is the real,
common envelope every one of them is emitted through: Section 7 is
explicit that "every important event must have" the five fields
below, so `Event` enforces that at the type level rather than leaving
each call site to remember it.

This module defines the event catalog and its envelope only. Nothing
here emits, stores, or consumes an event yet — the event bus and the
audit-log persistence for these live in Phase 2's database layer
(`vexbusiness-data`) and later phases' actual engines, not here.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class EventType(StrEnum):
    """The real, complete catalog from Master Directive Section 7."""

    MARKET_TICK = "MarketTick"
    QUOTE_UPDATED = "QuoteUpdated"
    BAR_STARTED = "BarStarted"
    BAR_CLOSED = "BarClosed"
    SESSION_STARTED = "SessionStarted"
    SESSION_PHASE_CHANGED = "SessionPhaseChanged"
    CONTRACT_MAPPED = "ContractMapped"
    CONTRACT_ROLLOVER_WARNING = "ContractRolloverWarning"
    SIGNAL_CREATED = "SignalCreated"
    SIGNAL_UPDATED = "SignalUpdated"
    SIGNAL_INVALIDATED = "SignalInvalidated"
    RISK_CHECK_REQUESTED = "RiskCheckRequested"
    RISK_APPROVED = "RiskApproved"
    RISK_REJECTED = "RiskRejected"
    ORDER_INTENT_CREATED = "OrderIntentCreated"
    ORDER_SUBMITTED = "OrderSubmitted"
    ORDER_ACCEPTED = "OrderAccepted"
    ORDER_PARTIALLY_FILLED = "OrderPartiallyFilled"
    ORDER_FILLED = "OrderFilled"
    ORDER_REJECTED = "OrderRejected"
    ORDER_CANCELLED = "OrderCancelled"
    POSITION_OPENED = "PositionOpened"
    POSITION_UPDATED = "PositionUpdated"
    TARGET_REACHED = "TargetReached"
    STOP_TRIGGERED = "StopTriggered"
    POSITION_CLOSED = "PositionClosed"
    SESSION_CLOSED = "SessionClosed"
    BROKER_DISCONNECTED = "BrokerDisconnected"
    MARKET_DATA_DISCONNECTED = "MarketDataDisconnected"
    EMERGENCY_STOP_ACTIVATED = "EmergencyStopActivated"
    STRATEGY_ACTIVATED = "StrategyActivated"
    STRATEGY_DEACTIVATED = "StrategyDeactivated"


class Event(BaseModel):
    """The real, common envelope Section 7 requires for every event.

    `correlation_id` ties a whole causal chain together (e.g. the one
    `BarClosed` that led to a `SignalCreated`, a `RiskApproved`, and an
    `OrderSubmitted` all share one). `session_id`, `trade_id`,
    `strategy_version`, and `model_version` are honestly optional —
    Section 7 says "where applicable," and plenty of events (a
    `MarketTick`, a `BrokerDisconnected`) have no trade or model
    behind them at all. `payload` is deliberately typed as a plain
    dict at this layer: each concrete event's own real shape belongs
    to its own domain model (e.g. `Signal`, `RiskDecision`), not
    duplicated again here.
    """

    event_id: UUID = Field(default_factory=uuid4)
    event_type: EventType
    timestamp: datetime
    correlation_id: UUID
    session_id: UUID | None = None
    trade_id: UUID | None = None
    strategy_version: str | None = None
    model_version: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
