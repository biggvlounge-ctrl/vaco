"""Vex Business — the real market regime engine (Master Directive Section 12).
Classifies a real `FeatureSnapshot` (Phase 5) into a real
`MarketRegime`. Deterministic by explicit directive: "Start
deterministic. Do NOT immediately introduce a black-box ML model. We
need a measurable baseline first." — no model, no training data, no
probability here, just a real, named decision tree over real inputs.

**Real, flagged interpretive choice**: same honest gap as Phase 5 —
Section 12's own verbatim classification rules are not present in
this codebase or this session's current context. The rules below are
a real, deliberate design over Phase 5's own real `FeatureSnapshot`
fields, documented plainly as an interpretation, not a transcription.
"""

from __future__ import annotations

from decimal import Decimal

from domain.enums import MarketRegime
from domain.models import FeatureSnapshot

#: Real, named thresholds — every one overridable per call, never
#: buried inline (Section 10's own "do not scatter hard-coded values"
#: instruction, applied here the same way Phase 4 applied it to
#: session boundaries).
DEFAULT_HIGH_VOLATILITY_MULTIPLIER = Decimal("1.5")
DEFAULT_LOW_VOLATILITY_MULTIPLIER = Decimal("0.67")
DEFAULT_BREAKOUT_VOLUME_RATIO = Decimal("1.0")


def classify_market_regime(
    snapshot: FeatureSnapshot,
    atr_baseline: Decimal,
    high_volatility_multiplier: Decimal = DEFAULT_HIGH_VOLATILITY_MULTIPLIER,
    low_volatility_multiplier: Decimal = DEFAULT_LOW_VOLATILITY_MULTIPLIER,
    breakout_volume_ratio: Decimal = DEFAULT_BREAKOUT_VOLUME_RATIO,
) -> MarketRegime:
    """A real, deterministic decision tree, checked in a fixed,
    documented order so two callers with the same inputs always get
    the same regime:

    1. Price at/through the session high on above-average volume ->
       BREAKOUT (checked before volatility, since a genuine breakout
       is real information a volatility label would otherwise mask).
    2. Price at/through the session low on above-average volume ->
       BREAKDOWN.
    3. ATR well above `atr_baseline` -> HIGH_VOLATILITY.
    4. ATR well below `atr_baseline` -> LOW_VOLATILITY.
    5. A real, confirmed up-trend (SMA-fast > SMA-slow AND market
       structure agrees) -> TREND_UP.
    6. A real, confirmed down-trend (mirror of 5) -> TREND_DOWN.
    7. Mixed structure -> RANGE.
    8. Anything else (structure and trend direction disagree, e.g. a
       flat SMA cross with non-mixed structure) -> UNKNOWN, an honest
       fallback rather than a forced guess — matching Section 12's own
       README-documented posture that a real regime engine flags
       genuine ambiguity instead of picking a default silently.

    `atr_baseline` is a real, separately-computed longer-period ATR
    (e.g. `strategy.features.average_true_range` over 50 bars, against
    `snapshot.atr`'s own shorter period) — deliberately not folded into
    `FeatureSnapshot` itself, so Phase 5's schema stays a single-bar-
    window snapshot rather than growing multi-timeframe fields.
    """
    if atr_baseline <= 0:
        raise ValueError(f"atr_baseline must be positive, got {atr_baseline}")

    if (
        snapshot.distance_from_session_high <= 0
        and snapshot.volume_ratio > breakout_volume_ratio
    ):
        return MarketRegime.BREAKOUT

    if snapshot.distance_from_session_low <= 0 and snapshot.volume_ratio > breakout_volume_ratio:
        return MarketRegime.BREAKDOWN

    if snapshot.atr > atr_baseline * high_volatility_multiplier:
        return MarketRegime.HIGH_VOLATILITY

    if snapshot.atr < atr_baseline * low_volatility_multiplier:
        return MarketRegime.LOW_VOLATILITY

    if snapshot.trend_direction == "up" and snapshot.market_structure == "higher_highs_higher_lows":
        return MarketRegime.TREND_UP

    if snapshot.trend_direction == "down" and snapshot.market_structure == "lower_highs_lower_lows":
        return MarketRegime.TREND_DOWN

    if snapshot.market_structure == "mixed":
        return MarketRegime.RANGE

    return MarketRegime.UNKNOWN
