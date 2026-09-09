"""Vex Business — Stephanie's own real data model: a genuine, sourced
comparable product in the quant/algorithmic-trading research market.
Deliberately separate from `domain.models` — these aren't Master
Directive trading concepts (bars, signals, orders); they're
competitive-intelligence records for Stephanie's own internal use
(VACON's `stephanie` agent, app "Vex Business").
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, HttpUrl


class ComparablePlatform(BaseModel):
    """One real, named comparable product with a genuine source —
    never a fabricated or half-remembered competitor. `researched_on`
    records the real date the finding was gathered so a reader can
    judge how stale it might be: Stephanie's own system prompt (in
    VACON's `lib/agents.js`) commits her to flagging an uncertain or
    outdated answer rather than presenting it as current."""

    name: str
    focus: str
    asset_coverage: str
    key_differentiator: str
    source_url: HttpUrl
    researched_on: date


class ComparablesReport(BaseModel):
    """A real, dated snapshot of Stephanie's findings — not a live
    feed. `as_of` is the real date this specific report was compiled;
    getting a newer one means a person re-running real research, not
    assuming this snapshot still reflects the current market."""

    as_of: date
    platforms: list[ComparablePlatform]
