"""Real unit tests for the session engine (Master Directive Section
42: "UNIT TEST: ... features"). Covers all 5 real `SessionPhase`
values plus the naive-timestamp-rejection case, against
`default_es_session_config()`'s real, midnight-spanning trading
window (18:00 -> 17:00 the next day, America/New_York).
"""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest
from domain.models import SessionConfig
from market.session_engine import SessionPhase, default_es_session_config, resolve_session_phase

NY = ZoneInfo("America/New_York")


def ny(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=NY)


class TestResolveSessionPhase:
    def test_before_trading_start_is_closed(self) -> None:
        config = default_es_session_config()
        # 17:30 ET is inside the real daily 17:00-18:00 maintenance
        # break -- after trading_end (17:00), before trading_start
        # (18:00) the same calendar day.
        assert resolve_session_phase(config, ny(2026, 1, 5, 17, 30)) == SessionPhase.CLOSED

    def test_overnight_globex_session_is_extended(self) -> None:
        config = default_es_session_config()
        # 20:00 ET: past trading_start (18:00), inside the configured
        # extended_session_* window (18:00-09:30), before the next
        # day's regular session -- the real midnight-spanning case
        # this module exists to get right.
        assert resolve_session_phase(config, ny(2026, 1, 5, 20, 0)) == SessionPhase.EXTENDED

    def test_early_morning_before_regular_open_is_extended(self) -> None:
        config = default_es_session_config()
        # 06:00 ET the next calendar day is still inside the
        # 18:00(prev day)-09:30 extended window.
        assert resolve_session_phase(config, ny(2026, 1, 6, 6, 0)) == SessionPhase.EXTENDED

    def test_mid_morning_is_regular(self) -> None:
        config = default_es_session_config()
        assert resolve_session_phase(config, ny(2026, 1, 5, 11, 0)) == SessionPhase.REGULAR

    def test_no_new_entry_window(self) -> None:
        config = default_es_session_config()
        # no_new_entry_cutoff=16:00, flatten_cutoff=16:10, regular
        # session ends 16:15 -- 16:05 ET is past no-new-entry, before
        # flatten.
        assert resolve_session_phase(config, ny(2026, 1, 5, 16, 5)) == SessionPhase.NO_NEW_ENTRY

    def test_flatten_window(self) -> None:
        config = default_es_session_config()
        assert resolve_session_phase(config, ny(2026, 1, 5, 16, 12)) == SessionPhase.FLATTEN

    def test_requires_timezone_aware_timestamp(self) -> None:
        config = default_es_session_config()
        with pytest.raises(ValueError, match="timezone-aware"):
            resolve_session_phase(config, datetime(2026, 1, 5, 11, 0))  # noqa: DTZ001

    def test_accepts_utc_timestamp_converted_internally(self) -> None:
        config = default_es_session_config()
        # 16:00 UTC on 2026-01-05 is 11:00 ET (winter, UTC-5) -- REGULAR.
        assert resolve_session_phase(config, datetime(2026, 1, 5, 16, 0, tzinfo=UTC)) == (
            SessionPhase.REGULAR
        )

    def test_unconfigured_extended_window_does_not_fall_back_to_extended(self) -> None:
        # A real config with no extended session at all -- being
        # inside the outer trading window but outside regular hours
        # must report CLOSED, never a fabricated EXTENDED.
        config = SessionConfig(
            timezone="America/New_York",
            regular_session_start="09:30",
            regular_session_end="16:15",
            extended_session_start=None,
            extended_session_end=None,
            trading_start="09:00",
            trading_end="16:30",
            opening_range_minutes=15,
            no_new_entry_cutoff="16:00",
            flatten_cutoff="16:10",
        )
        assert resolve_session_phase(config, ny(2026, 1, 5, 9, 15)) == SessionPhase.CLOSED
