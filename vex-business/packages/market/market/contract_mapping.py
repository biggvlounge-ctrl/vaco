"""Vex Business — real ES futures contract-roll resolution (Master Directive
Section 9: "root symbol, contract month, contract year, expiration...
mapping / roll event / mapped contract / previous contract / price
adjustment metadata"). Turns a real set of `ContractSpec`s for one
root symbol into the real `ContractMapping` a caller should use as of
a given timestamp — which individual, tradable contract is "current,"
and whether this call crossed a roll.

**Real, flagged interpretive choice**: the directive names roll events
as a real concept but never specifies the roll rule itself. This
module uses a fixed number of calendar days before expiration
(`DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION`, 8 — a common real-world
approximation several market-data vendors use for CME equity-index
futures) as the real default, fully overridable per call — not the
only rule this module could ever support, and never silently assumed
correct for a market other than the one it's grounded in.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, timedelta

from domain.models import ContractMapping, ContractSpec

DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION = 8


class ContractMappingError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule —
    covers both a mixed-root-symbol input set and an `as_of` date past
    every known contract's roll date (no real contract to map to)."""


def resolve_current_contract(
    specs: Sequence[ContractSpec],
    as_of: date,
    roll_days_before_expiration: int = DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION,
) -> ContractSpec:
    """The real, tradable `ContractSpec` a continuous series should
    point at on `as_of`, given a set of candidate contracts for one
    root symbol. Rolls to the next contract by expiration once `as_of`
    passes the current contract's roll date (`expiration -
    roll_days_before_expiration` days) — never later than that, so a
    caller is never left holding a contract past its real roll point.
    """
    if not specs:
        raise ContractMappingError("resolve_current_contract requires at least one ContractSpec")

    root_symbols = {spec.root_symbol for spec in specs}
    if len(root_symbols) > 1:
        raise ContractMappingError(
            f"resolve_current_contract requires a single root symbol, got {sorted(root_symbols)}"
        )

    for spec in sorted(specs, key=lambda s: s.expiration):
        roll_date = spec.expiration - timedelta(days=roll_days_before_expiration)
        if as_of <= roll_date:
            return spec

    raise ContractMappingError(
        f"as_of={as_of} is past the roll date of every known contract for "
        f"{next(iter(root_symbols))!r} — no real contract to map to (add a later ContractSpec)"
    )


def build_contract_mapping(
    specs: Sequence[ContractSpec],
    as_of: datetime,
    previous_mapping: ContractMapping | None = None,
    roll_days_before_expiration: int = DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION,
) -> ContractMapping:
    """Builds the real `ContractMapping` record Section 9 describes,
    detecting a roll event by comparing against `previous_mapping`'s
    own `mapped_contract` — never assumed, always evidence-based.

    **Real, flagged simplification**: `as_of` must be timezone-aware
    (Section 8's own UTC discipline); the roll-date comparison uses
    its UTC calendar date directly. No source doc specifies which
    session's calendar date should govern a roll that happens to fall
    near a session boundary, so that finer distinction isn't attempted
    here.

    **`price_adjustment` is deliberately left `None`**: computing a
    real back-adjustment requires the real old- and new-contract
    prices at the roll instant, which this function is never given —
    filling it with anything else would be exactly the kind of
    fabricated number the directive's own no-fabrication rule (Section
    14/15) forbids, even though that rule is stated for probabilities,
    not prices. A caller with real price data computes this
    separately.
    """
    if as_of.tzinfo is None:
        raise ContractMappingError("build_contract_mapping requires a timezone-aware as_of")

    mapped = resolve_current_contract(specs, as_of.date(), roll_days_before_expiration)

    is_roll_event = False
    previous_contract: ContractSpec | None = None
    if (
        previous_mapping is not None
        and previous_mapping.mapped_contract.contract_symbol != mapped.contract_symbol
    ):
        is_roll_event = True
        previous_contract = previous_mapping.mapped_contract

    return ContractMapping(
        as_of=as_of,
        mapped_contract=mapped,
        previous_contract=previous_contract,
        is_roll_event=is_roll_event,
        price_adjustment=None,
    )
