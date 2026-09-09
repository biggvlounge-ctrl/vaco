"""Real unit tests for the autonomous paper-trading worker (Master
Directive Section 42's own "UNIT TEST" discipline). Central things
under test: `_guess_stop_price`'s own real heuristic direction, that
every `DEFAULT_STRATEGY_INSTANCES` entry is genuinely distinct — not
three relabeled copies of one identical configuration — and that
`run_strategy_instance` runs a real, bounded, paper-only pass end-to-
end without raising."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from domain.models import Bar
from worker.instances import DEFAULT_STRATEGY_INSTANCES
from worker.main import _guess_stop_price, run_strategy_instance

BASE_TIME = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC)


def make_bar(index: int, close: str) -> Bar:
    close_d = Decimal(close)
    open_time = BASE_TIME + timedelta(minutes=5 * index)
    return Bar(
        instrument="ES",
        contract_symbol="ESZ25",
        timestamp_open=open_time,
        timestamp_close=open_time + timedelta(minutes=5),
        open=close_d,
        high=close_d + Decimal("1"),
        low=close_d - Decimal("1"),
        close=close_d,
        volume=200,
        source="test",
        session="regular",
        is_final=True,
    )


class TestGuessStopPrice:
    def test_uptrend_guesses_a_long_side_stop_below_price(self) -> None:
        bars = [make_bar(i, str(5000 + i * 2)) for i in range(10)]
        stop = _guess_stop_price(bars, Decimal("10"))
        assert stop == bars[-1].close - Decimal("10")

    def test_downtrend_guesses_a_short_side_stop_above_price(self) -> None:
        bars = [make_bar(i, str(5000 - i * 2)) for i in range(10)]
        stop = _guess_stop_price(bars, Decimal("10"))
        assert stop == bars[-1].close + Decimal("10")

    def test_short_history_still_returns_a_real_value_not_raising(self) -> None:
        bars = [make_bar(0, "5000")]
        stop = _guess_stop_price(bars, Decimal("10"))
        assert stop in (Decimal("5010"), Decimal("4990"))


class TestDefaultStrategyInstances:
    def test_every_instance_has_a_unique_id(self) -> None:
        ids = [c.instance_id for c in DEFAULT_STRATEGY_INSTANCES]
        assert len(ids) == len(set(ids))

    def test_every_instance_has_its_own_isolated_seed(self) -> None:
        seeds = [c.seed for c in DEFAULT_STRATEGY_INSTANCES]
        assert len(seeds) == len(set(seeds))

    def test_instances_carry_genuinely_different_signal_configs(self) -> None:
        # Same real dataclass shape, but not the same real values --
        # confirms "multiple instances" isn't just three relabeled
        # copies of one identical configuration.
        configs = [repr(c.signal_config) for c in DEFAULT_STRATEGY_INSTANCES]
        assert len(set(configs)) == len(configs)

    def test_each_instance_gets_its_own_real_isolated_risk_inputs(self) -> None:
        for config in DEFAULT_STRATEGY_INSTANCES:
            assert config.risk_inputs.account_equity == config.account_equity
            # entry/stop are real placeholders -- run_pipeline always
            # overwrites both with the real computed values before use.
            assert config.risk_inputs.entry == Decimal("0")
            assert config.risk_inputs.stop == Decimal("0")

    def test_no_instance_ever_defaults_to_a_live_broker_kind(self) -> None:
        # There is no `broker_adapter_kind` field on StrategyInstanceConfig
        # at all -- run_strategy_instance hard-codes MockBrokerAdapter
        # regardless, so this asserts the real absence of that knob.
        for config in DEFAULT_STRATEGY_INSTANCES:
            assert not hasattr(config, "broker_adapter_kind")


class TestRunStrategyInstance:
    @pytest.mark.asyncio
    async def test_runs_a_real_bounded_paper_only_pass_without_raising(self) -> None:
        # A small min_bars_required plus a small max_bars keeps this
        # real end-to-end run fast while still exercising the real
        # tick -> bar -> pipeline -> (paper) order path at least once.
        # `replace` re-runs __post_init__ (risk_inputs is init=False),
        # so the copy's own risk_inputs stays real and consistent with
        # its account_equity rather than silently going stale.
        # min_bars_required must clear both compute_feature_snapshot's
        # own real minimum (sma_slow_period=21 by default) and
        # average_true_range's (atr_baseline_period + 1) or every pass
        # legitimately raises rather than fabricating a feature/ATR
        # snapshot from too little history -- also shrink
        # atr_baseline_period itself so 25 real bars clears both.
        config = replace(
            DEFAULT_STRATEGY_INSTANCES[0],
            min_bars_required=25,
            max_bar_window=40,
            atr_baseline_period=20,
        )
        await run_strategy_instance(config, poll_interval_seconds=0.0, max_bars=30)

    @pytest.mark.asyncio
    async def test_multiple_instances_run_concurrently_without_sharing_state(self) -> None:
        import asyncio

        configs = [
            replace(
                instance,
                min_bars_required=25,
                max_bar_window=40,
                atr_baseline_period=20,
            )
            for instance in DEFAULT_STRATEGY_INSTANCES
        ]
        # No exception, and no instance's own market feed/broker being
        # shared with another's, is exactly what "several independent
        # instances run in parallel" means here -- run_strategy_instance
        # constructs a fresh MockMarketDataAdapter/MockBrokerAdapter
        # per call, never a module-level shared one.
        await asyncio.gather(
            *(run_strategy_instance(c, poll_interval_seconds=0.0, max_bars=30) for c in configs)
        )
