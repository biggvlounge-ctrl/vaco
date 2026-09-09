"""Vex Business — real domain enums, values copied verbatim from the Master
Directive wherever it names them explicitly. Where the directive
describes a concept without enumerating fixed values (e.g. "DEMO,
HISTORICAL BACKTEST, MARKET REPLAY, PAPER TRADING, LIVE-CAPABLE BUT
DISABLED" in Section 1), the enum member names are a direct,
literal transcription of that list, not an interpretation.
"""

from __future__ import annotations

from enum import StrEnum


class TradingMode(StrEnum):
    """Master Directive Section 1's own 5 initial modes, verbatim."""

    DEMO = "demo"
    HISTORICAL_BACKTEST = "historical_backtest"
    MARKET_REPLAY = "market_replay"
    PAPER_TRADING = "paper_trading"
    LIVE_CAPABLE_BUT_DISABLED = "live_capable_but_disabled"


class Direction(StrEnum):
    """LONG/SHORT — every score, signal, and opportunity in the
    directive is directional (Section 13's independent LONG/SHORT
    scores, Section 14's LONG/SHORT target math)."""

    LONG = "long"
    SHORT = "short"


class MarketRegime(StrEnum):
    """Master Directive Section 12's initial regime list, verbatim.
    Deliberately flat and deterministic — Section 12 is explicit:
    "Start deterministic. Do NOT immediately introduce a black-box ML
    model. We need a measurable baseline first." """

    UNKNOWN = "unknown"
    TREND_UP = "trend_up"
    TREND_DOWN = "trend_down"
    RANGE = "range"
    BREAKOUT = "breakout"
    BREAKDOWN = "breakdown"
    HIGH_VOLATILITY = "high_volatility"
    LOW_VOLATILITY = "low_volatility"


class SignalState(StrEnum):
    """Master Directive Section 13's own state list, verbatim."""

    NO_TRADE = "no_trade"
    DEVELOPING = "developing"
    WATCH = "watch"
    READY = "ready"
    HIGH_CONVICTION = "high_conviction"


class RiskDecisionOutcome(StrEnum):
    """Master Directive Section 16's own two outputs, verbatim —
    deliberately only two values. Risk has veto power; there is no
    third "partial approval" or "warning" state the signal/decision
    engine could misread as a green light."""

    APPROVED = "approved"
    REJECTED = "rejected"


class OrderState(StrEnum):
    """Master Directive Section 19's own order-state list, verbatim.
    "Never assume submit = fill" is the reason SUBMITTING, SUBMITTED,
    and ACCEPTED are three separate states rather than collapsed into
    one "pending" bucket."""

    NEW = "new"
    SUBMITTING = "submitting"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class BrokerAdapterKind(StrEnum):
    """Master Directive Section 19's real adapter list, verbatim.
    `LIVE` exists as a real, named kind because the platform is
    "LIVE-CAPABLE" (Section 1) -- but see config/settings.py for the
    actual multi-part interlock that keeps it unreachable while
    disabled; this enum member existing is not the same as it being
    usable."""

    MOCK = "mock"
    PAPER = "paper"
    LIVE = "live"


class ProbabilityAvailability(StrEnum):
    """Master Directive Section 14's own rule, made a real type rather
    than a comment: "If there is not enough historical evidence:
    probability = unavailable. NEVER fabricate a probability." A
    caller that pattern-matches on this enum cannot accidentally treat
    UNAVAILABLE as a numeric zero -- see `domain.models.Probability`,
    which pairs this with an `Optional[float]` value that is
    structurally `None` whenever this is `UNAVAILABLE`."""

    ESTIMATED = "estimated"
    UNAVAILABLE = "unavailable"
