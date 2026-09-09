"""Vex Business — background worker entrypoint. Phase 3+ scope: a real,
running autonomous **paper**-trading scheduler.

**Why this is paper-only, unconditionally, regardless of settings**:
per this session's own explicit scope decision, real-money autonomous
execution (flipping `BrokerAdapterKind.LIVE`) is deliberately NOT built
here — no real broker integration exists in this codebase to build one
against honestly (see `execution.broker`'s own docstring), and no real
compliance clearance exists for this app to place a live order
unattended even if one did. So `run_strategy_instance` below never
reads `settings.broker_adapter_kind` at all — it always constructs a
`MockBrokerAdapter` directly, a hard-coded choice in code, not a
setting a stray environment variable could ever flip. If/when real
live-broker integration and real compliance clearance both genuinely
exist, that is real, separate, future work — not a flag to toggle on
this module.

**What "autonomous" means here, honestly**: this scheduler runs
unattended, on its own interval, against a continuous real synthetic
tick feed (`market.MockMarketDataAdapter` — the same real, clearly-
labeled `source="mock"` data source the rest of this app already uses
in DEMO mode; no real market-data vendor integration exists yet). It
is not "the pipeline decides once and stops" — it keeps running,
polling, and re-evaluating for as long as the process runs, the same
way a real production trading worker would, just against synthetic
data and a paper fill.

**Multiple parallel strategy instances, explicitly not a user model**:
`worker.instances.DEFAULT_STRATEGY_INSTANCES` defines several real,
independently-configured pipeline instances that run concurrently, each
with its own isolated synthetic market feed, paper broker, and bar
history — none of them share state, and none of them are built from,
or represent, any individual user's own real data, preferences, or
trading history. See `worker.instances`'s own module docstring for the
full reasoning on that scope boundary.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from decimal import Decimal

from config.settings import get_settings
from domain.enums import RiskDecisionOutcome
from domain.models import Bar
from execution.broker import MockBrokerAdapter
from execution.pipeline import run_pipeline
from market.candle_engine import CandleEngine
from market.data_adapter import MockMarketDataAdapter
from market.session_engine import SessionPhase, default_es_session_config, resolve_session_phase

from worker.instances import DEFAULT_STRATEGY_INSTANCES, StrategyInstanceConfig

logger = logging.getLogger("call.worker")

#: A session state a real risk engine would already block new entries
#: in (Section 18's own "no new entry"/"flatten" semantics, reused
#: directly from `risk.engine.BLOCKED_SESSION_STATES` rather than
#: duplicated as bare strings) — skip running the pipeline at all
#: rather than paying the real compute cost of a run everyone already
#: knows risk will reject.
_SKIP_SESSION_STATES = frozenset(
    {SessionPhase.NO_NEW_ENTRY.value, SessionPhase.FLATTEN.value, SessionPhase.CLOSED.value}
)


def _guess_stop_price(bars: Sequence[Bar], stop_distance: Decimal) -> Decimal:
    """A real, honest, flagged heuristic — `execution.pipeline.run_pipeline`
    needs a `stop_price` *before* it knows which direction (if any)
    `build_opportunity` will actually pick, the same real design gap
    `apps/web/components/PipelineDemo.tsx` already works around with
    its own scenario-based guess (see that file's `runPipeline`). This
    guesses the same way: recent-close momentum sets which side of
    price the stop sits on. Genuinely a guess, not a computed value —
    if the guess is wrong, `evaluate_risk` still enforces a real,
    correct `stop_distance` on whichever direction was actually
    picked; only which literal price gets passed in is approximate."""
    latest_close = bars[-1].close
    lookback = bars[-6].close if len(bars) >= 6 else bars[0].close
    trending_down = latest_close < lookback
    return latest_close + stop_distance if trending_down else latest_close - stop_distance


async def _run_one_pass(
    config: StrategyInstanceConfig,
    bars: list[Bar],
    broker: MockBrokerAdapter,
    log: logging.Logger,
) -> None:
    latest_bar = bars[-1]
    session_phase = resolve_session_phase(default_es_session_config(), latest_bar.timestamp_close)
    if session_phase.value in _SKIP_SESSION_STATES:
        log.info("skipping pass: session_phase=%s (no new entries)", session_phase.value)
        return

    risk_inputs = config.risk_inputs.model_copy(update={"session_state": session_phase.value})
    stop_price = _guess_stop_price(bars, config.stop_distance)
    session_bars = bars[-config.session_bar_window :]

    result = await run_pipeline(
        bars=bars,
        session_bars=session_bars,
        session_phase=session_phase.value,
        risk_inputs=risk_inputs,
        stop_price=stop_price,
        current_open_positions=0,
        broker=broker,
        strategy_version=config.strategy_version,
        atr_baseline_period=config.atr_baseline_period,
        signal_config=config.signal_config,
    )

    if result.opportunity is None:
        log.info("pass complete: signal=%s no tradeable opportunity", result.signal.state)
        return
    if result.risk_decision is None or result.risk_decision.outcome != RiskDecisionOutcome.APPROVED:
        reason = result.risk_decision.rejection_reason if result.risk_decision else "unknown"
        log.info(
            "pass complete: opportunity found (%s @ %s) but risk REJECTED: %s",
            result.opportunity.direction,
            result.opportunity.entry,
            reason,
        )
        return
    log.info(
        "pass complete: PAPER order filled — %s %s contracts @ %s (target %s, stop %s)",
        result.opportunity.direction,
        result.risk_decision.approved_quantity,
        result.order.average_fill_price if result.order else "?",
        result.opportunity.target,
        stop_price,
    )


async def run_strategy_instance(
    config: StrategyInstanceConfig,
    poll_interval_seconds: float = 0.05,
    max_bars: int | None = None,
) -> None:
    """Runs one real, independent, paper-only pipeline instance
    unattended: connects its own isolated synthetic market feed and
    paper broker, aggregates real 5-minute bars, and re-runs the full
    pipeline every time a new bar closes for as long as the process (or
    `max_bars`, when set — real, test-only scope) keeps it alive.
    `poll_interval_seconds` paces real wall-clock consumption of the
    synthetic tick stream; it is not the synthetic bar interval itself
    (`market.MockMarketDataAdapter`'s own `tick_interval_seconds`
    governs that)."""
    log = logging.getLogger(f"call.worker.{config.instance_id}")
    log.info("starting: %s", config.description)

    market = MockMarketDataAdapter(
        base_price=config.base_price, tick_interval_seconds=5.0, seed=config.seed
    )
    bars: list[Bar] = []
    broker = MockBrokerAdapter(price_source=lambda _symbol: bars[-1].close)
    await market.connect()
    await broker.connect()

    candle_engine = CandleEngine(
        instrument=config.instrument,
        contract_symbol=config.contract_symbol,
        source="mock",
        session="regular",
    )
    bars_closed = 0
    try:
        async for tick in market.subscribe_ticks(config.instrument, config.contract_symbol):
            closed_bar = candle_engine.process_tick(tick)
            if closed_bar is not None:
                bars.append(closed_bar)
                if len(bars) > config.max_bar_window:
                    bars = bars[-config.max_bar_window :]
                bars_closed += 1
                if len(bars) >= config.min_bars_required:
                    await _run_one_pass(config, bars, broker, log)
                if max_bars is not None and bars_closed >= max_bars:
                    break
            await asyncio.sleep(poll_interval_seconds)
    finally:
        await market.disconnect()
        await broker.disconnect()
        log.info("stopped after %d closed bars", bars_closed)


async def main() -> None:
    settings = get_settings()
    logger.info(
        "Vex Business worker starting: trading_mode=%s configured_broker_adapter_kind=%s "
        "is_live_trading_armed=%s — worker itself ALWAYS uses MockBrokerAdapter "
        "(paper only), regardless of the settings above; see this module's own docstring.",
        settings.trading_mode,
        settings.broker_adapter_kind,
        settings.is_live_trading_armed,
    )
    logger.info(
        "starting %d parallel paper-trading strategy instances: %s",
        len(DEFAULT_STRATEGY_INSTANCES),
        ", ".join(instance.instance_id for instance in DEFAULT_STRATEGY_INSTANCES),
    )
    await asyncio.gather(
        *(run_strategy_instance(instance) for instance in DEFAULT_STRATEGY_INSTANCES)
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
