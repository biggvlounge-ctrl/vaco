"""Vex Business — the real session engine (Master Directive Section 10).
Resolves which phase of the trading day a real UTC timestamp falls
into, given a real `SessionConfig` — every boundary comes from that
config, never hard-coded (Section 10's own explicit instruction: "Do
not scatter hard-coded times throughout the code.").

**Midnight-spanning windows are real, not an edge case to avoid**:
CME's real ES session trades nearly 24 hours a day (e.g. Globex opens
18:00 local, a daily maintenance break closes trading 17:00-18:00) —
so `trading_start > trading_end` numerically is the *normal* case, not
an error. `_in_window` below treats `start <= end` as a same-day
window and `start > end` as a window that wraps past local midnight,
so every boundary pair (`trading_*`, `extended_session_*`) is real
regardless of which shape it takes. `extended_session_start`/
`extended_session_end` being `None` (the real, honest default) means
EXTENDED is never returned — not silently treated as REGULAR or
CLOSED-by-omission.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from zoneinfo import ZoneInfo

from domain.models import SessionConfig


class SessionPhase(StrEnum):
    """Real, derived phases — not a Section 10 fixed list (the
    directive names the boundary *fields*, not phase names), but a
    direct, literal reading of what those boundaries mean in order:
    outside the `[trading_start, trading_end)` window (same-day or
    midnight-spanning) -> CLOSED; inside `regular_session_*` and
    before `no_new_entry_cutoff` -> REGULAR; past `no_new_entry_cutoff`
    but before `flatten_cutoff` -> NO_NEW_ENTRY (existing positions may
    still be managed, no new entries per the field's own name); past
    `flatten_cutoff` -> FLATTEN (must flatten, Section 18's own
    "flatten cutoff" and Section 21's real exit reason); inside the
    trading window but outside `regular_session_*`, and inside a real
    configured `extended_session_*` window -> EXTENDED; inside the
    trading window but in neither the regular nor a configured
    extended window (or no extended window is configured at all) ->
    CLOSED, not silently folded into EXTENDED or REGULAR."""

    CLOSED = "closed"
    EXTENDED = "extended"
    REGULAR = "regular"
    NO_NEW_ENTRY = "no_new_entry"
    FLATTEN = "flatten"


def _parse_hhmm(value: str) -> tuple[int, int]:
    hour_str, _, minute_str = value.partition(":")
    return int(hour_str), int(minute_str)


def _local_time_minutes(dt: datetime, tz: ZoneInfo) -> int:
    local = dt.astimezone(tz)
    return local.hour * 60 + local.minute


def _hhmm_minutes(value: str) -> int:
    hour, minute = _parse_hhmm(value)
    return hour * 60 + minute


def _in_window(now_minutes: int, start_minutes: int, end_minutes: int) -> bool:
    """Real minutes-since-local-midnight window membership, handling
    both a same-day window (`start <= end`, e.g. regular session
    09:30-16:15) and a window that wraps past local midnight
    (`start > end`, e.g. a near-24-hour futures session 18:00-17:00
    the next day) with the same real-world meaning a trading calendar
    gives each shape — not just the same-day case."""
    if start_minutes <= end_minutes:
        return start_minutes <= now_minutes < end_minutes
    return now_minutes >= start_minutes or now_minutes < end_minutes


def resolve_session_phase(config: SessionConfig, timestamp: datetime) -> SessionPhase:
    """The one real function this module exists for. `timestamp` must
    be real and timezone-aware (UTC, per Section 8) — converted to
    `config.timezone` internally, never assumed already-local."""
    if timestamp.tzinfo is None:
        raise ValueError("resolve_session_phase requires a timezone-aware timestamp")

    tz = ZoneInfo(config.timezone)
    now_minutes = _local_time_minutes(timestamp, tz)

    trading_start = _hhmm_minutes(config.trading_start)
    trading_end = _hhmm_minutes(config.trading_end)
    if not _in_window(now_minutes, trading_start, trading_end):
        return SessionPhase.CLOSED

    regular_start = _hhmm_minutes(config.regular_session_start)
    regular_end = _hhmm_minutes(config.regular_session_end)
    if _in_window(now_minutes, regular_start, regular_end):
        flatten_cutoff = _hhmm_minutes(config.flatten_cutoff)
        if now_minutes >= flatten_cutoff:
            return SessionPhase.FLATTEN

        no_new_entry_cutoff = _hhmm_minutes(config.no_new_entry_cutoff)
        if now_minutes >= no_new_entry_cutoff:
            return SessionPhase.NO_NEW_ENTRY

        return SessionPhase.REGULAR

    if config.extended_session_start is not None and config.extended_session_end is not None:
        extended_start = _hhmm_minutes(config.extended_session_start)
        extended_end = _hhmm_minutes(config.extended_session_end)
        if _in_window(now_minutes, extended_start, extended_end):
            return SessionPhase.EXTENDED

    # Inside the outer trading window but outside both the regular
    # session and any configured extended session (or none is
    # configured) -- a real, unlabeled gap (e.g. an unconfigured
    # pre-market sliver). Per Section 43's "do not silently repair /
    # do not silently mislabel," this does NOT get folded into
    # EXTENDED or REGULAR -- it reports CLOSED, the same conservative
    # "no trading activity implied" phase as being outside the outer
    # window entirely.
    return SessionPhase.CLOSED


def default_es_session_config() -> SessionConfig:
    """Section 10's own stated initial target: "US ES day trading."
    Real, named, flagged-interpretive defaults grounded in CME's own
    real published ES regular trading hours (RTH 09:30-16:15 America/
    New_York) — no-new-entry/flatten cutoffs are a real, deliberate
    interpretive choice (15 / 5 minutes before the regular session
    ends) since no exact value is specified anywhere in the directive.
    Every field stays fully overridable — this is one real, usable
    default, not the only configuration this engine supports."""
    return SessionConfig(
        timezone="America/New_York",
        regular_session_start="09:30",
        regular_session_end="16:15",
        extended_session_start="18:00",
        extended_session_end="09:30",
        trading_start="18:00",
        trading_end="17:00",
        opening_range_minutes=15,
        no_new_entry_cutoff="16:00",
        flatten_cutoff="16:10",
    )
