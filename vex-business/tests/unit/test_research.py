"""Real unit tests for Stephanie's comparables research (Master
Directive Section 42's own "UNIT TEST" discipline, applied here even
though this package sits outside the Master Directive's own phase
list — real code still gets real tests)."""

from __future__ import annotations

from research import ComparablePlatform, ComparablesReport, find_comparable, get_comparables_report
from research.comparables import RESEARCHED_ON


class TestGetComparablesReport:
    def test_returns_a_real_dated_report(self) -> None:
        report = get_comparables_report()
        assert isinstance(report, ComparablesReport)
        assert report.as_of == RESEARCHED_ON

    def test_every_platform_has_a_real_source_url(self) -> None:
        report = get_comparables_report()
        assert len(report.platforms) >= 1
        for platform in report.platforms:
            assert isinstance(platform, ComparablePlatform)
            assert str(platform.source_url).startswith("https://")
            assert platform.researched_on == RESEARCHED_ON

    def test_known_real_comparables_are_present(self) -> None:
        names = {p.name for p in get_comparables_report().platforms}
        assert "QuantConnect (LEAN engine)" in names
        assert "AbleTrend / Power E-mini Alert Software" in names

    def test_multi_instance_parallel_comparables_are_present(self) -> None:
        # Added specifically to cover "multiple autonomous strategy
        # instances running in parallel, unattended" -- the angle
        # apps/worker's own scheduler builds and none of the first
        # five researched platforms was a direct comparable for.
        names = {p.name for p in get_comparables_report().platforms}
        assert "MetaTrader 4/5 Expert Advisors (multi-EA)" in names
        assert "3Commas" in names


class TestFindComparable:
    def test_finds_exact_match(self) -> None:
        result = find_comparable("QuantConnect (LEAN engine)")
        assert result is not None
        assert result.name == "QuantConnect (LEAN engine)"

    def test_is_case_insensitive(self) -> None:
        result = find_comparable("quantconnect (lean engine)")
        assert result is not None

    def test_returns_none_rather_than_a_fabricated_guess(self) -> None:
        assert find_comparable("Definitely Not A Real Platform") is None
