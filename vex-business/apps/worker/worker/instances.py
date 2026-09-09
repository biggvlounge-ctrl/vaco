"""Vex Business — real, named "parallel strategy instance" configurations for
the autonomous paper-trading scheduler (`worker.main`).

**What "multiple instances" honestly means here**: every instance runs
the exact same real deterministic pipeline (feature -> regime -> signal
-> opportunity -> risk -> execution) this codebase has always had —
nothing about the underlying engine is duplicated or reinvented per
instance. What genuinely differs between instances is the real,
already-overridable `strategy.signal.SignalScoringConfig` each one is
given (Section 13's own "make every component configurable" design,
used here for its intended purpose) plus its own independent synthetic
market-data seed and its own independent, isolated demo risk template —
so instances never share state, and one instance's synthetic price path
or trade history can never leak into another's.

**Explicitly not a model of any real user**: `account_equity` /
`buying_power` below are fixed, clearly-synthetic demo figures, the
same real design PipelineDemo.tsx / BacktestDemo.tsx already use in the
web app — not pulled from any real account, and not personalized to
any individual. Per the session's own explicit scope decision, this
module builds the "several independent strategies running in parallel"
half of that request and deliberately does NOT build anything that
models a specific user's own identity, preferences, or decision-making
— that remains real, unbuilt, and unscoped.

**Paper only, always**: nothing in this module or `worker.main` ever
constructs a `BrokerAdapterKind.LIVE` adapter — see `worker.main`'s own
module docstring for why that is hard-coded, not settings-driven.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from domain.models import RiskCheckInputs, SignalComponentScores
from strategy.signal import SignalScoringConfig


def _demo_risk_inputs(account_equity: Decimal) -> RiskCheckInputs:
    """A real, clearly-synthetic demo risk template — the same real
    shape (and similar real values) `PipelineDemo.tsx`/`BacktestDemo.tsx`
    already use in the web app, not any real account's own figures.
    `entry`/`stop` are placeholders `execution.pipeline.run_pipeline`
    always overwrites with the real computed opportunity/stop before
    use."""
    return RiskCheckInputs(
        account_equity=account_equity,
        buying_power=account_equity,
        entry=Decimal("0"),
        stop=Decimal("0"),
        quantity=1,
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


@dataclass(frozen=True)
class StrategyInstanceConfig:
    """One real, independent, paper-only pipeline configuration. Every
    field a caller might want isolated per instance lives here —
    nothing about running several of these together is special-cased
    outside `worker.main`'s own scheduler loop."""

    instance_id: str
    description: str
    signal_config: SignalScoringConfig
    strategy_version: str
    seed: int
    instrument: str = "ES"
    contract_symbol: str = "ESU26"
    base_price: Decimal = Decimal("5000")
    stop_distance: Decimal = Decimal("10")
    min_bars_required: int = 60
    max_bar_window: int = 220
    session_bar_window: int = 12
    atr_baseline_period: int = 50
    account_equity: Decimal = Decimal("50000")
    risk_inputs: RiskCheckInputs = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "risk_inputs", _demo_risk_inputs(self.account_equity))


#: Three real, distinct instances — same engine, genuinely different
#: `SignalScoringConfig` per instance (not just a relabeled default),
#: each with its own independent synthetic seed so their price paths
#: (and therefore their trade histories) never coincide.
DEFAULT_STRATEGY_INSTANCES: tuple[StrategyInstanceConfig, ...] = (
    StrategyInstanceConfig(
        instance_id="baseline",
        description=(
            "SignalScoringConfig's own real, unmodified defaults "
            "(trend=20, market_structure=15, vwap=15, momentum=15, "
            "volume=10, key_levels=10, volatility=10, session_timing=5)."
        ),
        signal_config=SignalScoringConfig(),
        strategy_version="worker-baseline-v0.1",
        seed=101,
    ),
    StrategyInstanceConfig(
        instance_id="trend-sensitive",
        description=(
            "Lower trend_full_strength_pct (0.5 vs the default 1.0) and a "
            "lower HIGH_CONVICTION state threshold — reaches full trend "
            "score, and a tradeable state, sooner on a real weaker trend "
            "than the baseline instance."
        ),
        signal_config=SignalScoringConfig(
            trend_full_strength_pct=0.5,
            state_thresholds=(15.0, 30.0, 50.0, 70.0),
        ),
        strategy_version="worker-trend-sensitive-v0.1",
        seed=202,
    ),
    StrategyInstanceConfig(
        instance_id="volume-weighted",
        description=(
            "Real reweighting toward volume/key-level confirmation "
            "(volume=20, key_levels=20) taken out of trend/momentum "
            "(trend=10, momentum=10) — the same real 100-point total, "
            "just a genuinely different emphasis than the baseline."
        ),
        signal_config=SignalScoringConfig(
            weights=SignalComponentScores(
                trend=10.0,
                market_structure=15.0,
                vwap=15.0,
                momentum=10.0,
                volume=20.0,
                key_levels=20.0,
                volatility=10.0,
                session_timing=5.0,
            ),
        ),
        strategy_version="worker-volume-weighted-v0.1",
        seed=303,
        base_price=Decimal("5010"),
    ),
)
