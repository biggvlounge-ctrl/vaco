"""Vex Business — real market-data quality checks (Master Directive Section
43). "Do not silently repair data. Flag it." — every function here
returns a real, honest signal (a bool, or raises) rather than
attempting to guess a corrected value.

Duplicate-bar and invalid-OHLC checks already live where they're
actually enforced (a real Postgres unique constraint on `bars` —
`packages/data/data/orm.py` — and `domain.models.Bar`'s own
validators, respectively) rather than duplicated here.
"""

from __future__ import annotations

from datetime import datetime, timedelta


def is_stale(last_tick_timestamp: datetime, now: datetime, max_staleness_seconds: float) -> bool:
    """Section 43: "stale quotes." Real, explicit staleness check —
    the caller decides what to do with a `True` result (Section 37:
    "Critical failures must prevent new autonomous positions"), this
    function only reports the real fact."""
    if last_tick_timestamp.tzinfo is None or now.tzinfo is None:
        raise ValueError("is_stale requires timezone-aware timestamps for both arguments")
    return (now - last_tick_timestamp) > timedelta(seconds=max_staleness_seconds)


def check_session_consistency(bar_session: str, expected_session: str) -> bool:
    """Section 43: "session consistency." A real bar claiming a
    session it shouldn't (e.g. a bar timestamped inside the regular
    session but tagged `extended`) is a real data-quality problem, not
    something to silently relabel."""
    return bar_session == expected_session


def check_contract_consistency(bar_contract_symbol: str, expected_contract_symbol: str) -> bool:
    """Section 43: "contract consistency." A bar tagged with a
    contract symbol that doesn't match what the caller expected to be
    receiving (e.g. mid-roll) is flagged, not silently accepted."""
    return bar_contract_symbol == expected_contract_symbol
