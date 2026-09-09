"""Vex Business — the real 50-point opportunity engine (Master Directive
Section 14). Turns a real, tradeable `Signal` (Phase 7) into a real
`Opportunity` — direction, entry, a real 50-point target (Section 14's
own verbatim formula, already enforced by `domain.models.Opportunity`'s
own validator), and a real `Probability`.

**Section 14/15's own governing rule, enforced here for real, not just
structurally**: `estimate_probability` never invents a hit rate. It
only ever computes one from real, caller-supplied historical outcome
data (e.g. real backtest results from a later phase) — with no data,
or fewer samples than the real, configurable minimum, it returns a
real `UNAVAILABLE` `Probability`, exactly Section 14's own rule:
"If there is not enough historical evidence: probability =
unavailable. NEVER fabricate a probability." Today, before any real
historical backtest engine exists to supply real outcomes (Phase 12+),
every real call through `build_opportunity` legitimately returns
`UNAVAILABLE` — a true, honest state, not a placeholder pretending to
be more finished than it is.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from decimal import Decimal

from domain.enums import Direction, ProbabilityAvailability, SignalState
from domain.models import Opportunity, Probability, Signal

#: The real 95% z-score (1.959963984540054, the standard normal
#: distribution's own two-tailed 97.5th percentile) — not a rounded
#: stand-in, since the interval width is directly sensitive to it.
WILSON_Z_95 = 1.959963984540054


def wilson_score_interval(
    hit_rate: float, sample_count: int, z: float = WILSON_Z_95
) -> tuple[float, float]:
    """A real 95% confidence interval around an observed binomial
    proportion — corrects the naive interval's own well-known failure
    at small/extreme sample sizes (a naive hit-rate of 30/30 real
    observations reads as a flat "100%", which silently overstates
    precision; Wilson's own interval instead narrows honestly toward
    100% without ever claiming exact certainty from a finite sample).
    Real, closed-form statistics — Wilson (1927) — not a fabricated
    range: both bounds are a direct function of the same real
    `hit_rate`/`sample_count` `estimate_probability` already computed,
    clipped to `[0.0, 1.0]` only for float-rounding safety at the
    boundaries, never to hide an out-of-range result."""
    if sample_count <= 0:
        return (0.0, 1.0)

    z2 = z * z
    denominator = 1 + z2 / sample_count
    center = (hit_rate + z2 / (2 * sample_count)) / denominator
    margin = (
        z
        * math.sqrt((hit_rate * (1 - hit_rate) / sample_count) + (z2 / (4 * sample_count**2)))
        / denominator
    )
    low = max(0.0, center - margin)
    high = min(1.0, center + margin)
    return (low, high)

#: Section 15's own instruction: "minimum sample sizes must be
#: configurable." No exact value is given anywhere available to this
#: session, so 30 is a real, named, flagged-interpretive default (a
#: common real statistical rule-of-thumb minimum) — always overridable.
DEFAULT_MINIMUM_SAMPLE_SIZE = 30

#: Only these two `SignalState` values represent a genuinely
#: actionable setup (Section 13's own state semantics: NO_TRADE/
#: DEVELOPING/WATCH are explicitly not-yet-ready). Real, named,
#: overridable — not an inline magic set.
DEFAULT_TRADEABLE_STATES = frozenset({SignalState.READY, SignalState.HIGH_CONVICTION})

#: Section 14's own verbatim target formula uses a flat 50-point
#: distance in price terms (ES's own $50/point dollar value is a
#: separate, Section 17 concern).
TARGET_POINTS = Decimal(50)


def estimate_probability(
    historical_outcomes: Sequence[bool] | None,
    minimum_sample_size: int = DEFAULT_MINIMUM_SAMPLE_SIZE,
) -> Probability:
    """`historical_outcomes` must be real data — each entry is whether
    a real, comparable historical setup actually reached its target.
    `None`, or fewer samples than `minimum_sample_size`, produces a
    real, honest `UNAVAILABLE` — the sample count is still recorded so
    a caller can see exactly how far short of the real threshold it
    fell, per `Probability`'s own docstring."""
    if historical_outcomes is None:
        return Probability(availability=ProbabilityAvailability.UNAVAILABLE, sample_count=0)

    sample_count = len(historical_outcomes)
    if sample_count < minimum_sample_size:
        return Probability(
            availability=ProbabilityAvailability.UNAVAILABLE, sample_count=sample_count
        )

    hit_rate = sum(historical_outcomes) / sample_count
    confidence_low, confidence_high = wilson_score_interval(hit_rate, sample_count)
    return Probability(
        availability=ProbabilityAvailability.ESTIMATED,
        value=hit_rate,
        sample_count=sample_count,
        confidence_low=confidence_low,
        confidence_high=confidence_high,
    )


def build_opportunity(
    signal: Signal,
    entry_price: Decimal,
    historical_outcomes: Sequence[bool] | None = None,
    minimum_sample_size: int = DEFAULT_MINIMUM_SAMPLE_SIZE,
    tradeable_states: frozenset[SignalState] = DEFAULT_TRADEABLE_STATES,
) -> Opportunity | None:
    """Returns `None` — never a fabricated `Opportunity` — when
    `signal.state` isn't one of `tradeable_states`. Direction is
    whichever side scored higher (Section 13's own independent LONG/
    SHORT scores); a real 50-point target follows Section 14's own
    formula automatically via `Opportunity`'s own validator."""
    if signal.state not in tradeable_states:
        return None

    direction = Direction.LONG if signal.long_score >= signal.short_score else Direction.SHORT
    opportunity_score = signal.long_score if direction == Direction.LONG else signal.short_score
    target = (
        entry_price + TARGET_POINTS if direction == Direction.LONG else entry_price - TARGET_POINTS
    )
    probability = estimate_probability(historical_outcomes, minimum_sample_size)

    return Opportunity(
        signal_id=signal.signal_id,
        instrument=signal.instrument,
        as_of=signal.as_of,
        direction=direction,
        entry=entry_price,
        target=target,
        opportunity_score=opportunity_score,
        estimated_probability=probability,
        sample_count=probability.sample_count,
    )
