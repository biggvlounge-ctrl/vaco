"""Real unit tests for the 50-point opportunity engine (Master
Directive Section 42's own "UNIT TEST" discipline). The central thing
under test here is the real no-fabrication rule: `estimate_probability`
must never invent a value, and `build_opportunity` must never invent
an Opportunity for a signal that isn't genuinely tradeable."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from domain.enums import Direction, MarketRegime, ProbabilityAvailability, SignalState
from domain.models import Opportunity, Signal, SignalComponentScores
from strategy.opportunity import build_opportunity, estimate_probability, wilson_score_interval

AS_OF = datetime(2026, 1, 5, 15, 0, 0, tzinfo=UTC)


def make_signal(
    long_score: float,
    short_score: float,
    state: SignalState,
) -> Signal:
    zero = SignalComponentScores(
        trend=0, market_structure=0, vwap=0, momentum=0, volume=0, key_levels=0,
        volatility=0, session_timing=0,
    )
    return Signal(
        instrument="ES",
        as_of=AS_OF,
        long_score=long_score,
        long_components=zero,
        short_score=short_score,
        short_components=zero,
        regime=MarketRegime.TREND_UP,
        state=state,
        strategy_version="v0.1",
    )


class TestEstimateProbability:
    def test_none_input_is_unavailable_with_zero_samples(self) -> None:
        prob = estimate_probability(None)
        assert prob.availability == ProbabilityAvailability.UNAVAILABLE
        assert prob.value is None
        assert prob.sample_count == 0

    def test_below_minimum_sample_size_is_unavailable(self) -> None:
        outcomes = [True] * 10  # below the default minimum of 30
        prob = estimate_probability(outcomes, minimum_sample_size=30)
        assert prob.availability == ProbabilityAvailability.UNAVAILABLE
        assert prob.value is None
        assert prob.sample_count == 10  # real count still recorded, not discarded

    def test_at_or_above_minimum_computes_a_real_hit_rate(self) -> None:
        outcomes = [True] * 21 + [False] * 9  # 30 samples, 21 hits
        prob = estimate_probability(outcomes, minimum_sample_size=30)
        assert prob.availability == ProbabilityAvailability.ESTIMATED
        assert prob.value == pytest.approx(0.7)
        assert prob.sample_count == 30

    def test_custom_minimum_sample_size_is_honored(self) -> None:
        outcomes = [True, True, False]
        prob = estimate_probability(outcomes, minimum_sample_size=3)
        assert prob.availability == ProbabilityAvailability.ESTIMATED
        assert prob.sample_count == 3

    def test_unavailable_probability_carries_no_confidence_interval(self) -> None:
        prob = estimate_probability(None)
        assert prob.confidence_low is None
        assert prob.confidence_high is None

    def test_estimated_probability_carries_a_real_wilson_interval(self) -> None:
        outcomes = [True] * 21 + [False] * 9  # 30 samples, 70% hit rate
        prob = estimate_probability(outcomes, minimum_sample_size=30)
        assert prob.confidence_low is not None
        assert prob.confidence_high is not None
        assert prob.confidence_low < prob.value < prob.confidence_high  # type: ignore[operator]
        # The real Wilson bound for 21/30 at 95% confidence, computed
        # once via wilson_score_interval directly and pinned here as a
        # regression check -- not re-derived from this same function,
        # which would prove nothing.
        assert prob.confidence_low == pytest.approx(0.5212, abs=0.001)
        assert prob.confidence_high == pytest.approx(0.8334, abs=0.001)


class TestWilsonScoreInterval:
    def test_small_sample_produces_a_real_wide_interval(self) -> None:
        # A naive rate of 100% from a tiny sample (3/3) massively
        # overstates precision -- the real Wilson interval must stay
        # honestly wide, not collapse to (1.0, 1.0).
        low, high = wilson_score_interval(1.0, 3)
        assert low < 0.5
        assert high == pytest.approx(1.0, abs=1e-6)

    def test_large_sample_produces_a_real_narrow_interval(self) -> None:
        low, high = wilson_score_interval(0.6, 10_000)
        assert high - low < 0.02  # a real, large sample earns real precision

    def test_zero_samples_returns_the_maximally_honest_full_range(self) -> None:
        assert wilson_score_interval(0.5, 0) == (0.0, 1.0)

    def test_bounds_never_escape_the_real_zero_to_one_range(self) -> None:
        low, high = wilson_score_interval(0.02, 5)
        assert 0.0 <= low <= high <= 1.0


class TestBuildOpportunity:
    def test_returns_none_for_no_trade_state(self) -> None:
        signal = make_signal(10.0, 5.0, SignalState.NO_TRADE)
        assert build_opportunity(signal, entry_price=Decimal("5000")) is None

    def test_returns_none_for_watch_state(self) -> None:
        signal = make_signal(55.0, 20.0, SignalState.WATCH)
        assert build_opportunity(signal, entry_price=Decimal("5000")) is None

    def test_builds_a_real_long_opportunity_when_ready(self) -> None:
        signal = make_signal(65.0, 10.0, SignalState.READY)
        opp = build_opportunity(signal, entry_price=Decimal("5000"))
        assert isinstance(opp, Opportunity)
        assert opp.direction == Direction.LONG
        assert opp.entry == Decimal("5000")
        assert opp.target == Decimal("5050")  # real 50-point formula
        assert opp.opportunity_score == 65.0
        assert opp.signal_id == signal.signal_id

    def test_builds_a_real_short_opportunity_when_high_conviction(self) -> None:
        signal = make_signal(10.0, 85.0, SignalState.HIGH_CONVICTION)
        opp = build_opportunity(signal, entry_price=Decimal("5000"))
        assert isinstance(opp, Opportunity)
        assert opp.direction == Direction.SHORT
        assert opp.target == Decimal("4950")
        assert opp.opportunity_score == 85.0

    def test_never_fabricates_a_probability_without_real_data(self) -> None:
        signal = make_signal(70.0, 10.0, SignalState.READY)
        opp = build_opportunity(signal, entry_price=Decimal("5000"))
        assert opp is not None
        assert opp.estimated_probability.availability == ProbabilityAvailability.UNAVAILABLE
        assert opp.estimated_probability.value is None
        assert opp.sample_count == 0

    def test_uses_real_probability_when_sufficient_historical_data_given(self) -> None:
        signal = make_signal(70.0, 10.0, SignalState.READY)
        outcomes = [True] * 18 + [False] * 12  # 30 real samples, 60% hit rate
        opp = build_opportunity(signal, entry_price=Decimal("5000"), historical_outcomes=outcomes)
        assert opp is not None
        assert opp.estimated_probability.availability == ProbabilityAvailability.ESTIMATED
        assert opp.estimated_probability.value == pytest.approx(0.6)
        assert opp.sample_count == 30
