"""Vex Business — the real signal engine (Master Directive Section 13). Scores
a real `FeatureSnapshot` (Phase 5) plus a real `MarketRegime` (Phase
6) into a real `Signal`, with independent LONG and SHORT component
scores. "The score is NOT a probability" (Section 13's own rule,
already enforced structurally by `domain.models.Signal`'s plain
`float` fields, distinct from the real `Probability` type Section 14
will use) — these are real, deterministic point totals out of each
category's own configurable weight, not odds.

**Real, flagged interpretive choice**: Section 13's own verbatim
per-category scoring formulas and state thresholds are not present in
this codebase or this session's current context (the same honest gap
already flagged in Phases 5-6). The scoring rules below are a real,
deliberate design over Phase 5's `FeatureSnapshot` and Phase 6's
`MarketRegime`, documented plainly as an interpretation, not a
transcription. Every interpretive scale/threshold is gathered into
`SignalScoringConfig` — real, named, fully overridable — rather than
scattered as inline magic numbers (Section 10's own "do not scatter
hard-coded values" instruction, applied here the same way Phase 4
applied it to session boundaries).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from domain.enums import MarketRegime, SignalState
from domain.models import FeatureSnapshot, Signal, SignalComponentScores


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass(frozen=True)
class SignalScoringConfig:
    """Every real, named interpretive scale/threshold this engine
    uses. `weights` reuses `SignalComponentScores`' own real default
    weights (trend=20 ... total=100) unless a caller overrides them —
    the same real type doing double duty as both a weights config and
    a per-signal score record, per that model's own docstring."""

    weights: SignalComponentScores = field(default_factory=SignalComponentScores)
    #: A 1% SMA-fast/SMA-slow spread scores full trend weight.
    trend_full_strength_pct: float = 1.0
    #: A 1x-ATR distance from VWAP scores full weight.
    vwap_full_strength_atr_multiples: float = 1.0
    #: A 2% rate-of-change scores full momentum weight.
    momentum_full_strength_pct: float = 2.0
    #: 2x the rolling-average volume scores full volume weight.
    volume_full_strength_ratio: float = 2.0
    #: Within 0.5x ATR of the session extreme scores full key-level weight.
    key_level_full_strength_atr_multiples: float = 0.5
    #: ATR between these two multiples of the baseline counts as a real, tradeable range.
    volatility_tradeable_low_multiplier: float = 0.5
    volatility_tradeable_high_multiplier: float = 2.0
    #: EXTENDED session scores this fraction of full session-timing weight.
    session_timing_extended_fraction: float = 0.5
    #: Real state-boundary scores: below the 1st -> NO_TRADE, between
    #: 1st/2nd -> DEVELOPING, 2nd/3rd -> WATCH, 3rd/4th -> READY,
    #: at/above the 4th -> HIGH_CONVICTION.
    state_thresholds: tuple[float, float, float, float] = (20.0, 40.0, 60.0, 80.0)


def _trend_score(snapshot: FeatureSnapshot, config: SignalScoringConfig, direction: str) -> float:
    if snapshot.sma_slow == 0:
        return 0.0
    if direction == "long":
        if snapshot.trend_direction != "up":
            return 0.0
        magnitude = float((snapshot.sma_fast - snapshot.sma_slow) / snapshot.sma_slow) * 100
    else:
        if snapshot.trend_direction != "down":
            return 0.0
        magnitude = float((snapshot.sma_slow - snapshot.sma_fast) / snapshot.sma_slow) * 100
    strength = _clip01(magnitude / config.trend_full_strength_pct)
    return strength * config.weights.trend


def _market_structure_score(
    snapshot: FeatureSnapshot, config: SignalScoringConfig, direction: str
) -> float:
    target = "higher_highs_higher_lows" if direction == "long" else "lower_highs_lower_lows"
    return config.weights.market_structure if snapshot.market_structure == target else 0.0


def _vwap_score(snapshot: FeatureSnapshot, config: SignalScoringConfig, direction: str) -> float:
    if snapshot.atr == 0:
        return 0.0
    distance_atr = float(snapshot.vwap_distance / snapshot.atr)
    if direction == "long":
        if distance_atr <= 0:
            return 0.0
        strength = _clip01(distance_atr / config.vwap_full_strength_atr_multiples)
    else:
        if distance_atr >= 0:
            return 0.0
        strength = _clip01(-distance_atr / config.vwap_full_strength_atr_multiples)
    return strength * config.weights.vwap


def _momentum_score(
    snapshot: FeatureSnapshot, config: SignalScoringConfig, direction: str
) -> float:
    momentum = float(snapshot.momentum)
    if direction == "long":
        if momentum <= 0:
            return 0.0
        strength = _clip01(momentum / config.momentum_full_strength_pct)
    else:
        if momentum >= 0:
            return 0.0
        strength = _clip01(-momentum / config.momentum_full_strength_pct)
    return strength * config.weights.momentum


def _volume_score(snapshot: FeatureSnapshot, config: SignalScoringConfig) -> float:
    """Volume confirms conviction regardless of direction — elevated
    volume scores the same real points for LONG and SHORT alike."""
    ratio = float(snapshot.volume_ratio)
    strength = _clip01((ratio - 1.0) / (config.volume_full_strength_ratio - 1.0))
    return strength * config.weights.volume


def _key_levels_score(
    snapshot: FeatureSnapshot, config: SignalScoringConfig, direction: str
) -> float:
    """Reuses the same real "near the session extreme" signal the
    regime engine's own BREAKOUT/BREAKDOWN branches check — proximity
    to the session high is bullish continuation information for LONG;
    proximity to the session low is bearish continuation information
    for SHORT."""
    if snapshot.atr == 0:
        return 0.0
    distance = (
        snapshot.distance_from_session_high
        if direction == "long"
        else snapshot.distance_from_session_low
    )
    distance_atr = float(distance / snapshot.atr)
    if distance_atr < 0:
        distance_atr = 0.0
    strength = _clip01(1 - (distance_atr / config.key_level_full_strength_atr_multiples))
    return strength * config.weights.key_levels


def _volatility_score(
    snapshot: FeatureSnapshot, config: SignalScoringConfig, atr_baseline: Decimal
) -> float:
    """Not directional — a real, tradeable range benefits LONG and
    SHORT equally; too quiet or too wild scores zero either way."""
    if atr_baseline <= 0:
        return 0.0
    ratio = float(snapshot.atr / atr_baseline)
    low = config.volatility_tradeable_low_multiplier
    high = config.volatility_tradeable_high_multiplier
    if low <= ratio <= high:
        return config.weights.volatility
    return 0.0


def _session_timing_score(snapshot: FeatureSnapshot, config: SignalScoringConfig) -> float:
    """Real continuity with Phase 4's own session engine: a phase
    where entries are barred (NO_NEW_ENTRY, FLATTEN, CLOSED) scores
    zero — not a fabricated non-zero score for a moment Vex Business itself
    would refuse to enter a new position."""
    if snapshot.session_phase == "regular":
        return config.weights.session_timing
    if snapshot.session_phase == "extended":
        return config.weights.session_timing * config.session_timing_extended_fraction
    return 0.0


def _resolve_state(score: float, config: SignalScoringConfig) -> SignalState:
    no_trade_max, developing_max, watch_max, ready_max = config.state_thresholds
    if score < no_trade_max:
        return SignalState.NO_TRADE
    if score < developing_max:
        return SignalState.DEVELOPING
    if score < watch_max:
        return SignalState.WATCH
    if score < ready_max:
        return SignalState.READY
    return SignalState.HIGH_CONVICTION


def compute_signal(
    snapshot: FeatureSnapshot,
    regime: MarketRegime,
    atr_baseline: Decimal,
    strategy_version: str,
    config: SignalScoringConfig | None = None,
) -> Signal:
    """The one real function this module exists for. Computes
    independent LONG and SHORT `SignalComponentScores`, sums each into
    a real 0-100 total (given default weights), and resolves the
    overall `SignalState` from whichever direction scored higher."""
    cfg = config or SignalScoringConfig()

    long_components = SignalComponentScores(
        trend=_trend_score(snapshot, cfg, "long"),
        market_structure=_market_structure_score(snapshot, cfg, "long"),
        vwap=_vwap_score(snapshot, cfg, "long"),
        momentum=_momentum_score(snapshot, cfg, "long"),
        volume=_volume_score(snapshot, cfg),
        key_levels=_key_levels_score(snapshot, cfg, "long"),
        volatility=_volatility_score(snapshot, cfg, atr_baseline),
        session_timing=_session_timing_score(snapshot, cfg),
    )
    short_components = SignalComponentScores(
        trend=_trend_score(snapshot, cfg, "short"),
        market_structure=_market_structure_score(snapshot, cfg, "short"),
        vwap=_vwap_score(snapshot, cfg, "short"),
        momentum=_momentum_score(snapshot, cfg, "short"),
        volume=_volume_score(snapshot, cfg),
        key_levels=_key_levels_score(snapshot, cfg, "short"),
        volatility=_volatility_score(snapshot, cfg, atr_baseline),
        session_timing=_session_timing_score(snapshot, cfg),
    )

    long_score = long_components.total
    short_score = short_components.total
    state = _resolve_state(max(long_score, short_score), cfg)

    return Signal(
        instrument=snapshot.instrument,
        as_of=snapshot.as_of,
        long_score=long_score,
        long_components=long_components,
        short_score=short_score,
        short_components=short_components,
        regime=regime,
        state=state,
        strategy_version=strategy_version,
    )
