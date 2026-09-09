"""Vex Business — the real broker adapter interface (Master Directive Section
19) plus `MockBrokerAdapter` for paper/dev use, and
`create_broker_adapter` — the one real safety gate between
`BrokerAdapterKind.LIVE` and the live-trading interlock
(`config.settings.Settings.is_live_trading_armed`).

**This is the load-bearing wiring Phase 1-2's own interlock was built
for.** `create_broker_adapter` never reaches into global settings
itself — the caller passes `is_live_trading_armed` explicitly
(typically `get_settings().is_live_trading_armed`), so the gate stays
directly, visibly testable without real environment variables. A
`LIVE` request while unarmed raises `LiveTradingNotArmedError` — never
silently downgraded to mock, never proceeds "just this once."

**Honest, real scope boundary**: even *armed*, there is still no real
live-broker integration in this codebase (no real broker API
credentials or protocol implementation exists to build one against
honestly) — `create_broker_adapter` raises a distinct, clearly-worded
error for that case too, rather than fabricating a live adapter that
only pretends to talk to a real broker.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal

from domain.enums import BrokerAdapterKind, OrderState
from domain.models import Order


class BrokerAdapterError(Exception):
    """Raised, never silently swallowed, per Section 43's own rule."""


class LiveTradingNotArmedError(BrokerAdapterError):
    """Raised when anything tries to construct a real `LIVE` broker
    adapter while `is_live_trading_armed` is `False`."""


class BrokerAdapter(ABC):
    """A real, minimal async interface — connect/disconnect/health
    mirrors `market.data_adapter.MarketDataAdapter`'s own real Phase 3
    pattern; `submit_order`/`cancel_order` are Section 19's own real
    lifecycle operations. "Never assume submit = fill" — `submit_order`
    returns whatever real state the broker actually reports, not a
    guaranteed `FILLED`."""

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def health(self) -> bool: ...

    @abstractmethod
    async def submit_order(self, order: Order) -> Order: ...

    @abstractmethod
    async def cancel_order(self, order: Order) -> Order: ...


class MockBrokerAdapter(BrokerAdapter):
    """A real, deterministic, clearly-labeled mock broker for
    development and this repo's own tests — never presented as a real
    fill. Fills the full requested quantity immediately at a real,
    caller-supplied `price_source`'s current price (no partial fills,
    no rejections, no slippage simulation) — real, honest scope for a
    `MOCK`-kind adapter, not a stand-in for `PAPER`'s own more
    realistic simulation (queueing, slippage, partial fills), which
    remains real, separate, unbuilt future scope."""

    def __init__(
        self,
        price_source: Callable[[str], Decimal],
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._price_source = price_source
        self._clock = clock or (lambda: datetime.now(UTC))
        self._connected = False
        self._next_broker_order_id = 1

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def health(self) -> bool:
        return self._connected

    async def submit_order(self, order: Order) -> Order:
        if not self._connected:
            raise BrokerAdapterError("MockBrokerAdapter.submit_order called while disconnected")
        if order.state != OrderState.NEW:
            raise BrokerAdapterError(f"submit_order requires state NEW, got {order.state}")

        fill_price = self._price_source(order.contract_symbol)
        broker_order_id = f"MOCK-{self._next_broker_order_id}"
        self._next_broker_order_id += 1
        now = self._clock()

        return order.model_copy(
            update={
                "state": OrderState.FILLED,
                "broker_order_id": broker_order_id,
                "submitted_at": now,
                "filled_at": now,
                "average_fill_price": fill_price,
            }
        )

    async def cancel_order(self, order: Order) -> Order:
        if order.state == OrderState.FILLED:
            raise BrokerAdapterError("cannot cancel an already-filled order")
        return order.model_copy(update={"state": OrderState.CANCELLED})


def create_broker_adapter(
    kind: BrokerAdapterKind,
    is_live_trading_armed: bool,
    price_source: Callable[[str], Decimal] | None = None,
) -> BrokerAdapter:
    """The one real factory every call site should use instead of
    constructing a `BrokerAdapter` directly — so the live-trading gate
    below is never something an individual call site could forget."""
    if kind == BrokerAdapterKind.LIVE:
        if not is_live_trading_armed:
            raise LiveTradingNotArmedError(
                "BrokerAdapterKind.LIVE requested but live trading is not armed "
                "(see config.settings.Settings.is_live_trading_armed)."
            )
        raise BrokerAdapterError(
            "BrokerAdapterKind.LIVE has no real broker integration implemented yet — "
            "real, honest, unbuilt scope (no real broker API credentials or protocol "
            "exist in this codebase to build one against honestly), not silently "
            "downgraded to a mock fill."
        )

    if kind in (BrokerAdapterKind.MOCK, BrokerAdapterKind.PAPER):
        if price_source is None:
            raise BrokerAdapterError(f"{kind} adapter requires a real price_source")
        return MockBrokerAdapter(price_source)

    raise BrokerAdapterError(f"unknown BrokerAdapterKind: {kind}")
