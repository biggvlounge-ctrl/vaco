"""Vex Business — real LLM-based trade rationale.

**Governing constraint, stated plainly, not just implied**: this
module explains a decision the deterministic pipeline already made
(`strategy.opportunity.build_opportunity`, `risk.engine.evaluate_risk`)
— it never makes or overrides one. Risk keeps veto power, this app's
own first governing principle: `generate_trade_rationale` only ever
runs *after* a real `RiskDecision` already exists, its own output
never feeds back into risk or execution, and nothing here can approve
a trade risk rejected or invent a probability the opportunity engine
itself left `UNAVAILABLE`.

**Same real no-fabrication discipline as the rest of this app,
extended to AI output specifically**: without a real, configured
`ANTHROPIC_API_KEY`, this raises `RationaleUnavailableError` — it
never returns a fabricated-sounding "AI rationale" generated offline.
Same real Anthropic Messages API contract `v4-proxy/server.js`
already established elsewhere in this ecosystem (same endpoint,
header shape, and model default) — a second, independent client, not
a shared one, since this app is architecturally separate from the
rest of VACO on purpose (see README.md's own "Architecturally
separate" note).
"""

from __future__ import annotations

import os

import httpx
from pydantic import BaseModel

from domain.enums import ProbabilityAvailability, RiskDecisionOutcome
from domain.models import FeatureSnapshot, Opportunity, RiskDecision

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
#: Same real default model v4-proxy already uses — one real, named
#: default for the whole ecosystem's own Anthropic calls, not a
#: second, independently-chosen one.
DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_MAX_TOKENS = 300


class RationaleUnavailableError(RuntimeError):
    """Raised, never silently swallowed into a fabricated string, when
    no real LLM call could be made — missing API key, a real network
    failure, or a non-200 response from Anthropic's own API."""


class TradeRationale(BaseModel):
    """The real output: `opportunity_id` ties it back to the real
    `Opportunity` it explains; `model` records which real model
    actually generated it (never omitted, so a caller can tell this
    apart from a stale or differently-configured run); `summary` is
    the real, live model output — never post-processed into something
    more confident-sounding than what the model actually said."""

    opportunity_id: str
    model: str
    summary: str


def _describe_probability(opportunity: Opportunity) -> str:
    prob = opportunity.estimated_probability
    if prob.availability == ProbabilityAvailability.UNAVAILABLE:
        return "Historical hit rate: UNAVAILABLE — not enough real historical data yet."
    assert prob.value is not None  # guaranteed by Probability's own validator
    interval = ""
    if prob.confidence_low is not None and prob.confidence_high is not None:
        interval = f", 95% CI {prob.confidence_low:.0%}–{prob.confidence_high:.0%}"
    return f"Historical hit rate: {prob.value:.0%} (n={prob.sample_count}{interval})"


def _build_prompt(
    opportunity: Opportunity,
    risk_decision: RiskDecision,
    feature_snapshot: FeatureSnapshot | None,
) -> str:
    lines = [
        "You are a trading-desk analyst assistant. Below is a real, "
        "already-finalized decision from a deterministic risk/opportunity "
        "engine. Explain it in plain English for a human trader, in 3-4 "
        "sentences. Do not suggest changing, overriding, or "
        "second-guessing the decision — risk has already had veto power "
        "and the outcome below is final. If the historical hit rate is "
        "UNAVAILABLE, say so plainly; never invent a number.",
        "",
        f"Instrument: {opportunity.instrument}",
        f"Direction: {opportunity.direction.value}",
        f"Entry: {opportunity.entry}",
        f"Target: {opportunity.target}",
        f"Opportunity score (of 50): {opportunity.opportunity_score}",
        _describe_probability(opportunity),
        f"Risk decision: {risk_decision.outcome.value}",
    ]
    if risk_decision.outcome == RiskDecisionOutcome.REJECTED:
        lines.append(f"Rejection reason: {risk_decision.rejection_reason}")
    else:
        lines.append(f"Approved quantity: {risk_decision.approved_quantity}")
        if risk_decision.maximum_loss is not None:
            lines.append(f"Maximum loss at this size: {risk_decision.maximum_loss}")
    if feature_snapshot is not None:
        lines.append(f"ATR: {feature_snapshot.atr}")
        lines.append(f"Trend direction: {feature_snapshot.trend_direction}")
        lines.append(f"Market structure: {feature_snapshot.market_structure}")
    return "\n".join(lines)


async def generate_trade_rationale(
    opportunity: Opportunity,
    risk_decision: RiskDecision,
    feature_snapshot: FeatureSnapshot | None = None,
    *,
    api_key: str | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> TradeRationale:
    """Real, live call to Anthropic's Messages API — `api_key` may be
    passed explicitly (e.g. from a caller's own config), otherwise
    read from the real `ANTHROPIC_API_KEY` environment variable. No
    key, no call, no fabricated rationale — a real
    `RationaleUnavailableError` instead, always."""
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RationaleUnavailableError(
            "generate_trade_rationale: ANTHROPIC_API_KEY is not set — no real LLM "
            "call can be made, so no rationale is returned. Never fabricated offline."
        )

    prompt = _build_prompt(opportunity, risk_decision, feature_snapshot)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": key,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
    except httpx.HTTPError as err:
        raise RationaleUnavailableError(
            f"generate_trade_rationale: Anthropic API request failed ({err})"
        ) from err

    if response.status_code != 200:
        raise RationaleUnavailableError(
            f"generate_trade_rationale: Anthropic API returned {response.status_code}: {response.text}"
        )

    body = response.json()
    text = "".join(
        block.get("text", "") for block in body.get("content", []) if block.get("type") == "text"
    )
    if not text.strip():
        raise RationaleUnavailableError(
            "generate_trade_rationale: Anthropic API returned no real text content."
        )

    return TradeRationale(opportunity_id=str(opportunity.opportunity_id), model=model, summary=text.strip())
