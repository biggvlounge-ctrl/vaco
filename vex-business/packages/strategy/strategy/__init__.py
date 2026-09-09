"""Vex Business — strategy package. Real implementation so far: the feature
engine (Phase 5, Section 11), the market regime engine (Phase 6,
Section 12), the signal engine (Phase 7, Section 13), and the 50-point
opportunity engine (Phase 8, Section 14). The statistical engine
(Section 15) remains real, empty, unstarted scope by deliberate
choice — Section 12's own instruction ("start deterministic, do not
immediately introduce a black-box ML model") plus the total absence of
any real historical dataset in this session means there is nothing
real to train it on yet."""

from strategy.features import (
    FeatureComputationError,
    average_true_range,
    compute_feature_snapshot,
    market_structure,
    rate_of_change,
    session_vwap,
    simple_moving_average,
    volume_ratio,
)
from strategy.opportunity import (
    DEFAULT_MINIMUM_SAMPLE_SIZE,
    DEFAULT_TRADEABLE_STATES,
    TARGET_POINTS,
    build_opportunity,
    estimate_probability,
)
from strategy.regime import (
    DEFAULT_BREAKOUT_VOLUME_RATIO,
    DEFAULT_HIGH_VOLATILITY_MULTIPLIER,
    DEFAULT_LOW_VOLATILITY_MULTIPLIER,
    classify_market_regime,
)
from strategy.signal import SignalScoringConfig, compute_signal

__all__ = [
    "FeatureComputationError",
    "average_true_range",
    "compute_feature_snapshot",
    "market_structure",
    "rate_of_change",
    "session_vwap",
    "simple_moving_average",
    "volume_ratio",
    "DEFAULT_BREAKOUT_VOLUME_RATIO",
    "DEFAULT_HIGH_VOLATILITY_MULTIPLIER",
    "DEFAULT_LOW_VOLATILITY_MULTIPLIER",
    "classify_market_regime",
    "SignalScoringConfig",
    "compute_signal",
    "DEFAULT_MINIMUM_SAMPLE_SIZE",
    "DEFAULT_TRADEABLE_STATES",
    "TARGET_POINTS",
    "build_opportunity",
    "estimate_probability",
]
