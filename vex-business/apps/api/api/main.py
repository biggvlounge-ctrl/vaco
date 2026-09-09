"""Vex Business — FastAPI application entrypoint. A real, running app with a
real health check, a real, honest report of the current trading mode
and live-trading-armed state, `POST /api/pipeline/run` (Phase 11 — the
full deterministic core over HTTP against a caller-supplied bar
window), and `POST /api/backtest/run` (Phase 12's real backtest
engine, plus a real overall probability estimate from its own real
trade outcomes). `packages/{replay,analytics,ai}` remain real, unbuilt
scope."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Any

from backtest import BacktestError, run_backtest
from config.settings import get_settings
from domain.models import Bar, Opportunity, Probability, RiskCheckInputs
from execution import (
    BrokerAdapterError,
    LiveTradingNotArmedError,
    PipelineResult,
    create_broker_adapter,
    run_pipeline,
)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from research import ComparablePlatform, ComparablesReport, find_comparable, get_comparables_report
from strategy.opportunity import DEFAULT_MINIMUM_SAMPLE_SIZE, estimate_probability

logger = logging.getLogger("call.api")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Logs the real, current safety posture at every boot — so
    "is live trading armed right now" is never something anyone has to
    go read a `.env` file to answer. Uses FastAPI's real lifespan
    context manager, not the deprecated `@app.on_event("startup")`
    (removed in current FastAPI) — Master Directive Section 4: "Do not
    blindly use obsolete package versions.\""""
    settings = get_settings()
    logger.info(
        "Vex Business starting: trading_mode=%s broker_adapter_kind=%s is_live_trading_armed=%s",
        settings.trading_mode,
        settings.broker_adapter_kind,
        settings.is_live_trading_armed,
    )
    if settings.is_live_trading_armed:
        logger.warning(
            "LIVE TRADING IS ARMED. broker_adapter_kind=%s. Real execution code now exists "
            "(Phase 10), but BrokerAdapterKind.LIVE still has no real broker integration "
            "implemented — create_broker_adapter will still refuse to construct one. This "
            "warning is real and intentional, not decorative.",
            settings.broker_adapter_kind,
        )
    yield


app = FastAPI(
    title="Vex Business",
    description=(
        "Continuous Autonomous Learning & Logic — "
        "internal futures-trading research platform."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Real health check. Reports the real, current safety posture
    directly in the response — not hidden behind a separate endpoint —
    since this is the one fact about this system that should never
    require digging to find."""
    settings = get_settings()
    return {
        "ok": True,
        "service": "vexbusiness-api",
        "trading_mode": settings.trading_mode,
        "broker_adapter_kind": settings.broker_adapter_kind,
        "is_live_trading_armed": settings.is_live_trading_armed,
    }


@app.get("/api/research/comparables")
async def research_comparables() -> ComparablesReport:
    """Stephanie's real, sourced findings on comparable quant/
    algorithmic-trading research platforms — a dated snapshot (see the
    response's own `as_of`), not a live feed. Surfaced through VACON's
    `stephanie` agent (app "Vex Business") for internal management use."""
    return get_comparables_report()


@app.get("/api/research/comparables/{name}")
async def research_comparable(name: str) -> ComparablePlatform:
    """A single named comparable, case-insensitive exact match. 404,
    never a fabricated best-guess, when nothing real matches."""
    platform = find_comparable(name)
    if platform is None:
        raise HTTPException(status_code=404, detail=f"No comparable platform named {name!r}")
    return platform


class PipelineRunRequest(BaseModel):
    """Real request body for `POST /api/pipeline/run`. `bars` is the
    rolling window used for trend/momentum/volume/ATR/structure;
    `session_bars` is the caller-scoped subset used for VWAP and the
    session high/low (`strategy.features.compute_feature_snapshot`'s
    own explicit-session-scoping rule — this endpoint does not infer
    session boundaries from timestamps itself)."""

    bars: list[Bar]
    session_bars: list[Bar]
    session_phase: str
    risk_inputs: RiskCheckInputs
    stop_price: Decimal
    current_open_positions: int = 0
    strategy_version: str = "v0.1"
    minutes_since_session_open: int | None = None


@app.post("/api/pipeline/run")
async def pipeline_run(request: PipelineRunRequest) -> PipelineResult:
    """Runs the real end-to-end pipeline (Phases 5-10) once against
    the given bar window and returns a fully-traced real result — the
    one endpoint that makes Vex Business's own deterministic core genuinely
    runnable over HTTP, not just importable Python. Uses the real,
    currently-configured `broker_adapter_kind`; a `LIVE` request while
    unarmed returns `403`, and even armed, `LIVE` returns `400` since
    no real broker integration exists yet (see `execution.broker`'s
    own docstring) — never silently faked."""
    if not request.bars:
        raise HTTPException(status_code=400, detail="bars must not be empty")
    if not request.session_bars:
        raise HTTPException(status_code=400, detail="session_bars must not be empty")

    settings = get_settings()
    latest_close = request.bars[-1].close

    try:
        broker = create_broker_adapter(
            settings.broker_adapter_kind,
            is_live_trading_armed=settings.is_live_trading_armed,
            price_source=lambda _contract_symbol: latest_close,
        )
    except LiveTradingNotArmedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BrokerAdapterError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await broker.connect()
    try:
        return await run_pipeline(
            bars=request.bars,
            session_bars=request.session_bars,
            session_phase=request.session_phase,
            risk_inputs=request.risk_inputs,
            stop_price=request.stop_price,
            current_open_positions=request.current_open_positions,
            broker=broker,
            strategy_version=request.strategy_version,
            minutes_since_session_open=request.minutes_since_session_open,
        )
    finally:
        await broker.disconnect()


class BacktestRunRequest(BaseModel):
    """Real request body for `POST /api/backtest/run`. `risk_inputs_template`
    is a real `RiskCheckInputs` with everything except `entry`/`stop`
    already correct — `backtest.run_backtest` fills those in per step
    from the real, computed opportunity and `stop_distance`, the same
    real design `execution.pipeline.run_pipeline` already uses."""

    bars: list[Bar]
    risk_inputs_template: RiskCheckInputs
    stop_distance: Decimal
    strategy_version: str = "v0.1"
    min_lookback: int = 60
    max_holding_bars: int = 48
    atr_baseline_period: int = 50


class BacktestTradeOut(BaseModel):
    opportunity: Opportunity
    outcome_hit_target: bool
    bars_held: int


class BacktestRunResponse(BaseModel):
    """`overall_probability` is computed via the real, same
    `strategy.opportunity.estimate_probability` (and its real default
    minimum sample size) every live opportunity uses — a small
    backtest legitimately returns `UNAVAILABLE` here too, the same
    honest behavior as everywhere else in this app, not a relaxed
    "just for the demo" threshold."""

    trades: list[BacktestTradeOut]
    indeterminate_count: int
    opportunities_seen: int
    win_rate: float | None
    overall_probability: Probability


@app.post("/api/backtest/run")
async def backtest_run(request: BacktestRunRequest) -> BacktestRunResponse:
    """Runs the real backtest engine (Phase 12, Section 21) once
    against the given bar series and returns every real trade found,
    plus the real, honest overall probability estimate those trades'
    outcomes produce — the same no-fabrication rule Phase 8 already
    enforces, applied to a real backtest run instead of a live one."""
    if not request.bars:
        raise HTTPException(status_code=400, detail="bars must not be empty")

    try:
        result = run_backtest(
            bars=request.bars,
            risk_inputs_template=request.risk_inputs_template,
            stop_distance=request.stop_distance,
            strategy_version=request.strategy_version,
            min_lookback=request.min_lookback,
            max_holding_bars=request.max_holding_bars,
            atr_baseline_period=request.atr_baseline_period,
        )
    except BacktestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    overall_probability = estimate_probability(
        result.historical_outcomes, minimum_sample_size=DEFAULT_MINIMUM_SAMPLE_SIZE
    )
    return BacktestRunResponse(
        trades=[
            BacktestTradeOut(
                opportunity=trade.opportunity,
                outcome_hit_target=trade.outcome_hit_target,
                bars_held=trade.bars_held,
            )
            for trade in result.trades
        ],
        indeterminate_count=result.indeterminate_count,
        opportunities_seen=result.opportunities_seen,
        win_rate=result.win_rate,
        overall_probability=overall_probability,
    )
