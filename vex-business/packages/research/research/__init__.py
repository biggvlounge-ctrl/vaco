"""Vex Business — Stephanie's real market/competitor research package. Real,
sourced findings on comparable quant/algorithmic-trading research
platforms; a dated snapshot, not a live-updating feed (see
`comparables.RESEARCHED_ON`)."""

from research.models import ComparablePlatform, ComparablesReport
from research.service import find_comparable, get_comparables_report

__all__ = [
    "ComparablePlatform",
    "ComparablesReport",
    "find_comparable",
    "get_comparables_report",
]
