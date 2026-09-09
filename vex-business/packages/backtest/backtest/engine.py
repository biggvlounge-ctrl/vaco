"""Vex Business — the real backtest engine (Master Directive Section 21:
"event-driven backtest engine, no-look-ahead-bias enforcement").

**No-look-ahead-bias enforcement, made structural, not just
promised**: `run_backtest` computes every real signal/opportunity/risk
decision at step `i` using only `bars[:i+1]` — the walk-forward window
never contains a bar with an index greater than `i`. Forward outcome
evaluation (`evaluate_forward_outcome`) is a real, separate pass that
only ever looks *after* `i`, and only to grade an opportunity that
already, honestly, existed at `i` — never to inform the decision at
`i` itself.

**This is the real, honest source of `historical_outcomes`** that
Phase 8's `strategy.opportunity.estimate_probability` needs to ever
return a genuine `ESTIMATED` probability instead of permanent
`UNAVAILABLE` — before this engine existed, no real historical outcome
data existed anywhere in this codebase.

**Real, flagged simplifications, stated plainly** (not silently
assumed more sophisticated than they are): every step is evaluated as
if flat (`current_open_positions=0` at every step — no real
concurrent-open-position tracking across the backtest); every bar is
treated as an ongoing real `"regular"` session (real session-phase-
aware backtesting across historical session transitions is separate,
unbuilt future scope); `risk_inputs_template`'s account equity and
limits stay fixed for the whole run (no real evolving equity curve).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal

from domain.enums import Direction, RiskDecisionOutcome
from domain.models import Bar, Opportunity, RiskCheckInputs
from risk.engine import ES_DOLLAR_PER_POINT, evaluate_risk
from strategy.features import average_true_range, compute_feature_snapshot
from strategy.opportunity import build_opportunity
from strategy.regime import classify_market_regime
from strategy.signal import compute_signal


class BacktestError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule."""


@dataclass
class BacktestTrade:
    """One real, completed backtest trade — a real `Opportunity` that
    was risk-approved and whose real forward outcome (against the same
    bar series it came from) was determinable within
    `max_holding_bars`."""

    opportunity: Opportunity
    outcome_hit_target: bool
    bars_held: int


@dataclass
class BacktestResult:
    """A real, honest summary. `indeterminate_count` is tracked
    separately and explicitly — never silently folded into wins or
    losses, since doing so would fabricate a result for a real setup
    whose true outcome (within the real holding window) is unknown."""

    trades: list[BacktestTrade] = field(default_factory=list)
    indeterminate_count: int = 0
    opportunities_seen: int = 0

    @property
    def historical_outcomes(self) -> list[bool]:
        """Exactly what `strategy.opportunity.estimate_probability`
        expects — real, determinable trade outcomes only."""
        return [t.outcome_hit_target for t in self.trades]

    @property
    def win_rate(self) -> float | None:
        if not self.trades:
            return None
        return sum(1 for t in self.trades if t.outcome_hit_target) / len(self.trades)


def evaluate_forward_outcome(
    bars: Sequence[Bar],
    start_index: int,
    direction: Direction,
    target: Decimal,
    stop_price: Decimal,
    max_holding_bars: int,
) -> tuple[bool, int] | None:
    """Walks forward from `start_index + 1` through real, already-
    recorded bars, checking each one's real high/low against `target`/
    `stop_price`. Returns `(hit_target, bars_held)` the moment either
    is genuinely touched, or `None` if neither is touched within
    `max_holding_bars` — a real, honest "indeterminate," never
    silently scored as a win or a loss."""
    end = min(start_index + max_holding_bars, len(bars) - 1)
    for offset, i in enumerate(range(start_index + 1, end + 1), start=1):
        bar = bars[i]
        if direction == Direction.LONG:
            hit_target = bar.high >= target
            hit_stop = bar.low <= stop_price
        else:
            hit_target = bar.low <= target
            hit_stop = bar.high >= stop_price

        if hit_target and hit_stop:
            # Both real touched within the same bar — a genuine,
            # honest intrabar ambiguity this bar's own OHLC can't
            # resolve. Conservatively scored as the stop (the same
            # "risk first" posture the risk engine itself takes), not
            # silently counted as a win.
            return False, offset
        if hit_target:
            return True, offset
        if hit_stop:
            return False, offset
    return None


def run_backtest(
    bars: Sequence[Bar],
    risk_inputs_template: RiskCheckInputs,
    stop_distance: Decimal,
    strategy_version: str,
    min_lookback: int = 60,
    session_bars_count: int = 12,
    max_holding_bars: int = 48,
    atr_baseline_period: int = 50,
    dollar_per_point: Decimal = ES_DOLLAR_PER_POINT,
) -> BacktestResult:
    """The one real function this module exists for. Walks forward
    through `bars` one real step at a time, computing a real signal/
    opportunity/risk decision at each step from only the bars visible
    up to that point, then grades any risk-approved opportunity's real
    forward outcome against the bars that follow."""
    minimum_bars = min_lookback + atr_baseline_period + 1
    if len(bars) < minimum_bars:
        raise BacktestError(f"run_backtest needs at least {minimum_bars} bars, got {len(bars)}")

    result = BacktestResult()

    for i in range(min_lookback, len(bars)):
        window = bars[: i + 1]
        if len(window) <= atr_baseline_period:
            continue

        session_bars = window[-session_bars_count:]
        snapshot = compute_feature_snapshot(window, session_bars, session_phase="regular")
        atr_baseline = average_true_range(window, atr_baseline_period)
        regime = classify_market_regime(snapshot, atr_baseline=atr_baseline)
        signal = compute_signal(snapshot, regime, atr_baseline, strategy_version=strategy_version)

        opportunity = build_opportunity(signal, entry_price=window[-1].close)
        if opportunity is None:
            continue

        result.opportunities_seen += 1
        stop_price = (
            opportunity.entry - stop_distance
            if opportunity.direction == Direction.LONG
            else opportunity.entry + stop_distance
        )
        opportunity_risk_inputs = risk_inputs_template.model_copy(
            update={"entry": opportunity.entry, "stop": stop_price}
        )
        risk_decision = evaluate_risk(
            opportunity_id=opportunity.opportunity_id,
            as_of=opportunity.as_of,
            inputs=opportunity_risk_inputs,
            current_open_positions=0,
            dollar_per_point=dollar_per_point,
        )
        if risk_decision.outcome != RiskDecisionOutcome.APPROVED:
            continue

        outcome = evaluate_forward_outcome(
            bars, i, opportunity.direction, opportunity.target, stop_price, max_holding_bars
        )
        if outcome is None:
            result.indeterminate_count += 1
            continue

        hit_target, bars_held = outcome
        result.trades.append(BacktestTrade(opportunity, hit_target, bars_held))

    return result
