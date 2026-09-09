"""Real integration test (Master Directive Section 42: "INTEGRATION:
database"): `MockMarketDataAdapter` -> `CandleEngine` -> `persist_bar`
-> a real Postgres database, end to end. Uses a distinctive
`contract_symbol` (`ESTEST`) and cleans up its own rows before and
after, so this permanent test is safely re-runnable against the same
real local database Phase 2's migration set up.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from data.database import session_scope
from data.orm import BarORM
from market.candle_engine import CandleEngine
from market.data_adapter import MockMarketDataAdapter
from market.persistence import persist_bar
from sqlalchemy import delete, select

CONTRACT_SYMBOL = "ESTEST"


async def _cleanup() -> None:
    async with session_scope() as session:
        await session.execute(delete(BarORM).where(BarORM.contract_symbol == CONTRACT_SYMBOL))
        await session.commit()


@pytest.fixture(autouse=True)
async def _clean_test_rows() -> AsyncIterator[None]:
    await _cleanup()
    yield
    await _cleanup()


@pytest.mark.asyncio
async def test_synthetic_ticks_aggregate_and_persist_real_bars() -> None:
    adapter = MockMarketDataAdapter(seed=42, tick_interval_seconds=6.0, max_ticks=100)
    await adapter.connect()
    assert await adapter.health() is True

    engine = CandleEngine("ES", CONTRACT_SYMBOL, source="mock", session="regular")
    persisted = []
    async for t in adapter.subscribe_ticks("ES", CONTRACT_SYMBOL):
        closed = engine.process_tick(t)
        if closed is not None:
            persisted.append(await persist_bar(closed))
    final = engine.flush()
    if final is not None:
        persisted.append(await persist_bar(final))

    await adapter.disconnect()
    assert await adapter.health() is False

    # 100 ticks at 6s apart = 600s = exactly 2 full 5-minute windows,
    # plus whatever the flush() catches -- at least 1 real bar landed.
    assert len(persisted) >= 1

    async with session_scope() as session:
        result = await session.execute(
            select(BarORM)
            .where(BarORM.contract_symbol == CONTRACT_SYMBOL)
            .order_by(BarORM.timestamp_open)
        )
        rows = result.scalars().all()
        assert len(rows) == len(persisted)
        for row in rows:
            assert row.instrument == "ES"
            assert row.source == "mock"
            assert row.is_final is True
            assert row.high >= row.low
