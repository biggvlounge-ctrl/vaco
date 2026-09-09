"""Real unit tests for the backtest engine (Master Directive Section
42's own "UNIT TEST" discipline). `evaluate_forward_outcome` is tested
against hand-verifiable bar sequences; `run_backtest` is tested
end-to-end against a real, synthetic bar series with a known, engineered
outcome, and its own real no-look-ahead-bias property is checked
directly."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from backtest.engine import BacktestResult, evaluate_forward_outcome, run_backtest
from domain.enums import Direction, ProbabilityAvailability
from domain.models import Bar, RiskCheckInputs
from strategy.opportunity import estimate_probability

BASE_TIME = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)


def make_bar(
    index: int,
    close: str,
    high: str | None = None,
    low: str | None = None,
    volume: int = 200,
) -> Bar:
    close_d = Decimal(close)
    high_d = Decimal(high) if high is not None else close_d + Decimal("1")
    low_d = Decimal(low) if low is not None else close_d - Decimal("1")
    open_time = BASE_TIME + timedelta(minutes=5 * index)
    return Bar(
        instrument="ES",
        contract_symbol="ESZ25",
        timestamp_open=open_time,
        timestamp_close=open_time + timedelta(minutes=5),
        open=close_d,
        high=high_d,
        low=low_d,
        close=close_d,
        volume=volume,
        source="test",
        session="regular",
        is_final=True,
    )


def make_risk_inputs(**overrides: object) -> RiskCheckInputs:
    defaults: dict[str, object] = dict(
        account_equity=Decimal("50000"),
        buying_power=Decimal("50000"),
        entry=Decimal("0"),
        stop=Decimal("0"),
        quantity=2,
        daily_pnl=Decimal("0"),
        daily_loss_limit=Decimal("2000"),
        maximum_trade_loss=Decimal("1000"),
        maximum_contracts=5,
        maximum_open_positions=3,
        consecutive_losses=0,
        session_state="regular",
        volatility=1.0,
        data_freshness_seconds=10.0,
        broker_health="healthy",
        strategy_status="active",
    )
    defaults.update(overrides)
    return RiskCheckInputs(**defaults)  # type: ignore[arg-type]


class TestEvaluateForwardOutcome:
    def test_hits_target_before_stop_for_long(self) -> None:
        bars = [
            make_bar(0, "5000"),
            make_bar(1, "5010", high="5015", low="5005"),
            make_bar(2, "5060", high="5065", low="5055"),  # touches target 5050
        ]
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.LONG,
            target=Decimal("5050"), stop_price=Decimal("4990"), max_holding_bars=10,
        )
        assert outcome == (True, 2)

    def test_hits_stop_before_target_for_long(self) -> None:
        bars = [
            make_bar(0, "5000"),
            make_bar(1, "4980", high="4995", low="4975"),  # touches stop 4990
        ]
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.LONG,
            target=Decimal("5050"), stop_price=Decimal("4990"), max_holding_bars=10,
        )
        assert outcome == (False, 1)

    def test_short_direction_is_mirrored(self) -> None:
        bars = [
            make_bar(0, "5000"),
            make_bar(1, "4940", high="4945", low="4935"),  # touches target 4950 for a short
        ]
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.SHORT,
            target=Decimal("4950"), stop_price=Decimal("5010"), max_holding_bars=10,
        )
        assert outcome == (True, 1)

    def test_neither_touched_within_holding_window_is_indeterminate(self) -> None:
        bars = [make_bar(i, "5000") for i in range(5)]  # flat, never moves
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.LONG,
            target=Decimal("5050"), stop_price=Decimal("4950"), max_holding_bars=3,
        )
        assert outcome is None

    def test_both_touched_same_bar_resolves_to_stop(self) -> None:
        bars = [
            make_bar(0, "5000"),
            make_bar(1, "5000", high="5060", low="4940"),  # both target and stop touched
        ]
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.LONG,
            target=Decimal("5050"), stop_price=Decimal("4950"), max_holding_bars=10,
        )
        assert outcome == (False, 1)

    def test_respects_the_end_of_the_bar_series(self) -> None:
        bars = [make_bar(0, "5000"), make_bar(1, "5000")]
        outcome = evaluate_forward_outcome(
            bars, start_index=0, direction=Direction.LONG,
            target=Decimal("5050"), stop_price=Decimal("4950"), max_holding_bars=100,
        )
        assert outcome is None


class TestRunBacktest:
    def test_produces_a_real_backtest_result(self) -> None:
        # A long, real, monotonic uptrend with periodic volume spikes
        # so multiple real opportunities are found across the walk.
        bars = []
        price = 5000
        for i in range(200):
            volume = 600 if i % 10 == 0 else 200
            bars.append(make_bar(i, str(price), volume=volume))
            price += 4

        result = run_backtest(
            bars=bars,
            risk_inputs_template=make_risk_inputs(),
            stop_distance=Decimal("10"),
            strategy_version="v0.1",
            min_lookback=60,
            max_holding_bars=20,
        )

        assert isinstance(result, BacktestResult)
        assert result.opportunities_seen >= 1
        # a strong, real, monotonic uptrend should produce real, resolved trades
        assert result.trades
        assert result.win_rate is not None

    def test_historical_outcomes_feed_directly_into_estimate_probability(self) -> None:
        # Closes the real loop: a real backtest's own real outcomes are
        # exactly what estimate_probability needs to stop returning
        # permanent UNAVAILABLE.
        bars = []
        price = 5000
        for i in range(220):
            volume = 600 if i % 8 == 0 else 200
            bars.append(make_bar(i, str(price), volume=volume))
            price += 4

        result = run_backtest(
            bars=bars,
            risk_inputs_template=make_risk_inputs(),
            stop_distance=Decimal("10"),
            strategy_version="v0.1",
            min_lookback=60,
            max_holding_bars=20,
        )

        probability = estimate_probability(result.historical_outcomes, minimum_sample_size=1)
        if result.trades:
            assert probability.availability == ProbabilityAvailability.ESTIMATED
            assert probability.value is not None
            assert 0.0 <= probability.value <= 1.0

    def test_raises_on_insufficient_bars(self) -> None:
        bars = [make_bar(i, "5000") for i in range(10)]
        try:
            run_backtest(
                bars=bars,
                risk_inputs_template=make_risk_inputs(),
                stop_distance=Decimal("10"),
                strategy_version="v0.1",
            )
            raise AssertionError("expected BacktestError")
        except Exception as exc:
            assert "needs at least" in str(exc)

    def test_no_look_ahead_bias_same_prefix_yields_same_early_trades(self) -> None:
        # The real no-look-ahead-bias property: running the backtest on
        # a bar series and on a strict prefix of it must produce
        # identical trades for every opportunity whose full outcome
        # window fit inside the shorter series -- a later bar must
        # never have influenced an earlier decision.
        bars = []
        price = 5000
        for i in range(150):
            volume = 600 if i % 10 == 0 else 200
            bars.append(make_bar(i, str(price), volume=volume))
            price += 4

        full_result = run_backtest(
            bars=bars,
            risk_inputs_template=make_risk_inputs(),
            stop_distance=Decimal("10"),
            strategy_version="v0.1",
            min_lookback=60,
            max_holding_bars=20,
        )
        prefix_result = run_backtest(
            bars=bars[:120],
            risk_inputs_template=make_risk_inputs(),
            stop_distance=Decimal("10"),
            strategy_version="v0.1",
            min_lookback=60,
            max_holding_bars=20,
        )

        # opportunity_id is a fresh random UUID per construction (real,
        # deliberate per Opportunity's own default_factory), so it
        # can't be compared across separate runs -- key on the real,
        # deterministic fields derived from the bar data itself
        # instead: as_of/direction/entry/target/outcome/bars_held.
        def trade_key(trade: object) -> tuple[object, ...]:
            opp = trade.opportunity  # type: ignore[attr-defined]
            return (
                opp.as_of,
                opp.direction,
                opp.entry,
                opp.target,
                trade.outcome_hit_target,  # type: ignore[attr-defined]
                trade.bars_held,  # type: ignore[attr-defined]
            )

        full_keys = {trade_key(t) for t in full_result.trades}
        prefix_keys = {trade_key(t) for t in prefix_result.trades}
        # every trade found in the shorter prefix run must have been
        # found identically in the full run (same real outcome),
        # proving the full run's extra future bars never altered an
        # earlier decision or its already-determinable outcome.
        assert prefix_keys
        assert prefix_keys.issubset(full_keys)
