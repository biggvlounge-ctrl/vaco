"""Vex Business — backtest package (Master Directive Section 21: "event-driven
backtest engine, no-look-ahead-bias enforcement"). Phase 12 real
implementation: `run_backtest` walks a real, chronological bar series
forward, computing each real signal/opportunity/risk decision from
only the bars visible at that step, then grades any risk-approved
opportunity's real forward outcome against the bars that follow. The
resulting `BacktestResult.historical_outcomes` is exactly what Phase
8's `strategy.opportunity.estimate_probability` needs to move
`Probability` out of permanent `UNAVAILABLE`."""

from backtest.engine import (
    BacktestError,
    BacktestResult,
    BacktestTrade,
    evaluate_forward_outcome,
    run_backtest,
)

__all__ = [
    "BacktestError",
    "BacktestResult",
    "BacktestTrade",
    "evaluate_forward_outcome",
    "run_backtest",
]
