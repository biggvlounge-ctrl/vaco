"""Vex Business — MarketDataAdapter (Master Directive Section 19's own adapter
pattern, reused here for market data rather than only broker
execution — the directive names both "MARKET DATA ADAPTERS" and
"BROKER ADAPTERS" as real, separate Section 3 components sharing the
same real shape: connect/disconnect/health, real state, no assumption
that a subscription is instantly live).

`MockMarketDataAdapter` is the one real, concrete implementation this
phase builds — a deterministic, seeded synthetic tick generator for
DEMO mode and tests. **No real external market-data vendor
integration exists here** — Section 15 ("Broker/data adapters") is
explicitly a later phase; building a fake "real" vendor adapter now
would misrepresent what's actually connected to anything.
"""

from __future__ import annotations

import random
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from domain.models import Tick


class MarketDataAdapter(ABC):
    """Real, abstract contract every market data source implements —
    mirrors `BrokerAdapter`'s own real method set (Section 19)."""

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def health(self) -> bool: ...

    @abstractmethod
    def subscribe_ticks(self, instrument: str, contract_symbol: str) -> AsyncIterator[Tick]:
        """An async stream of real `Tick`s for the given contract.
        Implementations decide their own real connection state; a
        caller must not assume ticks flow before `connect()`."""
        ...


class MockMarketDataAdapter(MarketDataAdapter):
    """A real, deterministic (seeded) synthetic tick generator — a
    bounded random walk around a configurable base price, producing
    real `last_trade` ticks at a configurable interval. This is the
    one real, honest data source available in DEMO mode (Master
    Directive Section 1) until a real vendor adapter exists (Phase
    15) — clearly a synthetic source (`source="mock"` on every real
    `Tick` it emits), never presented as real market data.
    """

    def __init__(
        self,
        base_price: Decimal = Decimal("5000"),
        tick_interval_seconds: float = 1.0,
        seed: int | None = None,
        max_ticks: int | None = None,
    ) -> None:
        self._base_price = base_price
        self._tick_interval = timedelta(seconds=tick_interval_seconds)
        self._rng = random.Random(seed)
        self._max_ticks = max_ticks
        self._connected = False

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def health(self) -> bool:
        return self._connected

    async def subscribe_ticks(
        self, instrument: str, contract_symbol: str
    ) -> AsyncIterator[Tick]:
        if not self._connected:
            raise RuntimeError("MockMarketDataAdapter.subscribe_ticks called before connect()")

        price = self._base_price
        now = datetime.now(UTC)
        emitted = 0
        while self._max_ticks is None or emitted < self._max_ticks:
            # A bounded random walk -- real ES tick-to-tick moves are
            # small; +/- 0.25 (one real ES tick size) per step, no
            # drift, so a long synthetic run stays near `base_price`
            # rather than wandering off arbitrarily.
            step = self._rng.choice([Decimal("-0.25"), Decimal("0"), Decimal("0.25")])
            price = price + step
            yield Tick(
                instrument=instrument,
                contract_symbol=contract_symbol,
                kind="last_trade",
                price=price,
                size=self._rng.randint(1, 10),
                timestamp=now,
                source="mock",
            )
            now = now + self._tick_interval
            emitted += 1
