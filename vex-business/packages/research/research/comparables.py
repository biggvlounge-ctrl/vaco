"""Vex Business — Stephanie's real, sourced seed findings. Compiled 2026-08-20
via live web research (see `call/README.md`'s own "Stephanie /
comparables research" entry for how these were gathered and what was
deliberately left out). This is a real, dated snapshot, not a live-
updating feed — `DEFAULT_COMPARABLES_REPORT.as_of` names exactly when
it was compiled so nobody mistakes it for current-as-of-today.

Two more entries (MetaTrader Expert Advisors, 3Commas) were added in a
second real research pass the same day, specifically to cover the
"multiple autonomous strategy instances running in parallel, unattended"
angle — Vex Business's own worker now runs several independent, paper-only
pipeline configurations side by side (`apps/worker`), and neither of the
first five platforms researched was a direct comparable for that specific
capability.
"""

from __future__ import annotations

from datetime import date

from pydantic import HttpUrl

from research.models import ComparablePlatform, ComparablesReport

RESEARCHED_ON = date(2026, 8, 20)

_PLATFORMS = [
    ComparablePlatform(
        name="QuantConnect (LEAN engine)",
        focus=(
            "Open-source, event-driven backtesting and live-trading engine — the closest "
            "thing to an institutional-grade backtester retail researchers can access."
        ),
        asset_coverage="Equities, futures, options, forex, crypto",
        key_differentiator=(
            "Event-driven backtests where each tick triggers the algorithm exactly as it "
            "would live, plus pluggable passive/active risk models — the same 'never "
            "simulate faster or looser than reality' discipline Vex Business's own future backtest "
            "engine (Section 21) will need to earn, not something Vex Business gets for free."
        ),
        source_url=HttpUrl("https://www.lean.io/"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="TrendSpider",
        focus=(
            "Rule-based strategy design, backtesting, and automated bots across multiple "
            "asset classes, aimed at non-programmer traders via a no-code rule builder."
        ),
        asset_coverage="Stocks, futures, forex, crypto",
        key_differentiator=(
            "Genuine futures coverage (unlike Trade Ideas, below). No public documentation "
            "found of a real risk-veto layer or a no-fabricated-probability rule comparable "
            "to Vex Business's own two governing principles — a real, notable gap, not assumed."
        ),
        source_url=HttpUrl("https://www.trade-ideas.com/compare/trendspider"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="Trade Ideas (Holly AI)",
        focus=(
            "Real-time scanning across 8,000+ US symbols; 'Holly AI' runs roughly 50 "
            "pre-defined strategies nightly, stress-tests them against current conditions, "
            "and surfaces the top performers each morning."
        ),
        asset_coverage="US equities only — no futures",
        key_differentiator=(
            "Real-time scanning breadth is the strength, not futures coverage or risk "
            "discipline. Not a direct ES comparable — the closer real comparable is on the "
            "'AI-scored opportunity' concept itself, which Vex Business's own future 50-point "
            "opportunity engine (Section 13+) will need to earn honestly, not inherit."
        ),
        source_url=HttpUrl("https://www.trade-ideas.com/compare/trendspider"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="Backtrader / Zipline-reloaded / vectorbt",
        focus=(
            "Free, open-source Python backtesting libraries researchers run locally "
            "against their own data."
        ),
        asset_coverage=(
            "Whatever data the researcher brings or connects — no first-party market data"
        ),
        key_differentiator=(
            "The closest architectural cousin to Vex Business itself — a real Python research "
            "codebase, not a SaaS black box. None of the three ship a documented real "
            "risk-veto layer or probability-availability discipline; that governance is "
            "Vex Business's own real differentiator, not something to assume these tools "
            "already do."
        ),
        source_url=HttpUrl("https://theledgermind.com/best-algo-trading-platforms-2026/"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="AbleTrend / Power E-mini Alert Software",
        focus=(
            "ES/MES-specific day-trading signal-alert software issuing buy/sell/hold/exit "
            "alerts."
        ),
        asset_coverage="E-mini and Micro E-mini S&P 500 futures specifically",
        key_differentiator=(
            "The narrowest, most direct comparable to Vex Business's own initial ES/5-minute "
            "target market found in this research pass. No documented risk-veto "
            "architecture or probability-availability discipline comparable to Vex Business's own "
            "two governing principles was found in the public material reviewed."
        ),
        source_url=HttpUrl("https://poweremini.com/"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="MetaTrader 4/5 Expert Advisors (multi-EA)",
        focus=(
            "Retail forex/CFD platform allowing many independent Expert Advisors — each a "
            "self-contained automated strategy — to run unattended in parallel on one "
            "terminal, commonly 24/7 on a rented VPS."
        ),
        asset_coverage="Forex, CFDs, some futures/stocks depending on broker",
        key_differentiator=(
            "The real, direct comparable for 'multiple autonomous strategy instances running "
            "in parallel, unattended' — MT4/5 documents running dozens of EAs simultaneously "
            "on one terminal, each independently configured. What its own public documentation "
            "does not describe is any shared, centralized risk-veto layer across those EAs: "
            "each EA enforces its own risk logic (or none), and conflicting EAs can and do "
            "place opposing orders on the same account. That absence is exactly the gap Vex "
            "Business's own single, shared `risk.engine.evaluate_risk` veto — applied "
            "identically to every parallel strategy instance, not delegated to each one — is "
            "built to close, not something to assume MT4/5 already provides."
        ),
        source_url=HttpUrl("https://www.metatrader5.com/en/terminal/help/algotrading/testing"),
        researched_on=RESEARCHED_ON,
    ),
    ComparablePlatform(
        name="3Commas",
        focus=(
            "SaaS crypto bot platform running multiple independent bots (DCA, Signal, "
            "composite) per user across multiple exchanges and pairs simultaneously from one "
            "account."
        ),
        asset_coverage="Crypto spot and futures, across multiple connected exchanges",
        key_differentiator=(
            "Confirms multi-instance parallelism (several strategies per user, running "
            "unattended, compared side by side) is a real, established product pattern at "
            "consumer scale, not a novel or unproven idea. Bot capacity is gated by "
            "subscription tier rather than by any documented account-wide risk check, and no "
            "public documentation found describes a probability-availability discipline "
            "comparable to Vex Business's own UNAVAILABLE-means-no-fabricated-number rule for "
            "any individual bot's advertised performance."
        ),
        source_url=HttpUrl("https://3commas.io/"),
        researched_on=RESEARCHED_ON,
    ),
]

DEFAULT_COMPARABLES_REPORT = ComparablesReport(as_of=RESEARCHED_ON, platforms=_PLATFORMS)
