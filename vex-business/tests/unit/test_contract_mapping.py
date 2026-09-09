"""Real unit tests for ES contract-roll resolution (Master Directive
Section 42: "UNIT TEST: ... features"). Covers same-root selection,
the roll boundary itself, roll-event detection against a previous
mapping, the past-every-roll-date error case, and the mixed-root
rejection.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from domain.models import ContractMapping, ContractSpec
from market.contract_mapping import (
    ContractMappingError,
    build_contract_mapping,
    resolve_current_contract,
)

ESZ25 = ContractSpec(
    root_symbol="ES",
    contract_month=12,
    contract_year=2025,
    expiration=date(2025, 12, 19),
    contract_symbol="ESZ25",
)
ESH26 = ContractSpec(
    root_symbol="ES",
    contract_month=3,
    contract_year=2026,
    expiration=date(2026, 3, 20),
    contract_symbol="ESH26",
)
SPECS = [ESZ25, ESH26]


class TestResolveCurrentContract:
    def test_well_before_roll_date_stays_on_front_contract(self) -> None:
        assert resolve_current_contract(SPECS, date(2025, 11, 1)) == ESZ25

    def test_on_roll_date_stays_on_front_contract(self) -> None:
        # roll_date = expiration(2025-12-19) - 8 days = 2025-12-11.
        assert resolve_current_contract(SPECS, date(2025, 12, 11)) == ESZ25

    def test_day_after_roll_date_rolls_to_next_contract(self) -> None:
        assert resolve_current_contract(SPECS, date(2025, 12, 12)) == ESH26

    def test_custom_roll_window_is_honored(self) -> None:
        assert (
            resolve_current_contract(SPECS, date(2025, 12, 15), roll_days_before_expiration=3)
            == ESZ25
        )
        assert (
            resolve_current_contract(SPECS, date(2025, 12, 17), roll_days_before_expiration=3)
            == ESH26
        )

    def test_past_every_roll_date_raises(self) -> None:
        with pytest.raises(ContractMappingError, match="no real contract to map to"):
            resolve_current_contract(SPECS, date(2026, 6, 1))

    def test_empty_specs_raises(self) -> None:
        with pytest.raises(ContractMappingError):
            resolve_current_contract([], date(2025, 11, 1))

    def test_mixed_root_symbols_raises(self) -> None:
        nq = ContractSpec(
            root_symbol="NQ",
            contract_month=12,
            contract_year=2025,
            expiration=date(2025, 12, 19),
            contract_symbol="NQZ25",
        )
        with pytest.raises(ContractMappingError, match="single root symbol"):
            resolve_current_contract([ESZ25, nq], date(2025, 11, 1))


class TestBuildContractMapping:
    def test_first_mapping_has_no_roll_event(self) -> None:
        mapping = build_contract_mapping(SPECS, datetime(2025, 11, 1, tzinfo=UTC))
        assert mapping.mapped_contract == ESZ25
        assert mapping.is_roll_event is False
        assert mapping.previous_contract is None
        assert mapping.price_adjustment is None

    def test_crossing_the_roll_date_is_detected_against_previous_mapping(self) -> None:
        before = build_contract_mapping(SPECS, datetime(2025, 12, 1, tzinfo=UTC))
        after = build_contract_mapping(
            SPECS, datetime(2025, 12, 12, tzinfo=UTC), previous_mapping=before
        )
        assert before.mapped_contract == ESZ25
        assert after.mapped_contract == ESH26
        assert after.is_roll_event is True
        assert after.previous_contract == ESZ25

    def test_same_contract_as_previous_mapping_is_not_a_roll_event(self) -> None:
        first = build_contract_mapping(SPECS, datetime(2025, 11, 1, tzinfo=UTC))
        second = build_contract_mapping(
            SPECS, datetime(2025, 11, 15, tzinfo=UTC), previous_mapping=first
        )
        assert second.is_roll_event is False
        assert second.previous_contract is None

    def test_requires_timezone_aware_as_of(self) -> None:
        with pytest.raises(ContractMappingError, match="timezone-aware"):
            build_contract_mapping(SPECS, datetime(2025, 11, 1))  # noqa: DTZ001

    def test_returned_mapping_is_a_real_contract_mapping_instance(self) -> None:
        mapping = build_contract_mapping(SPECS, datetime(2025, 11, 1, tzinfo=UTC))
        assert isinstance(mapping, ContractMapping)
