"""Vex Business — Stephanie's real query surface over her own findings. Thin
by design: the real work here is the sourced data in `comparables.py`,
not a clever lookup layer."""

from __future__ import annotations

from research.comparables import DEFAULT_COMPARABLES_REPORT
from research.models import ComparablePlatform, ComparablesReport


def get_comparables_report() -> ComparablesReport:
    """The one real, current snapshot Stephanie has compiled."""
    return DEFAULT_COMPARABLES_REPORT


def find_comparable(name: str) -> ComparablePlatform | None:
    """Case-insensitive exact-name lookup. Returns `None`, never a
    fabricated best-guess match, when nothing real matches."""
    needle = name.strip().casefold()
    for platform in DEFAULT_COMPARABLES_REPORT.platforms:
        if platform.name.casefold() == needle:
            return platform
    return None
