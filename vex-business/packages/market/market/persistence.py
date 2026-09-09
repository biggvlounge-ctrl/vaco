"""Vex Business — real bar persistence. A closed `Bar` (from `candle_engine`)
gets written to the real `bars` table via `vexbusiness-data`'s own real
session/engine wiring — no separate, second persistence mechanism.

Duplicate-bar rejection is NOT re-implemented here — it's a real
Postgres unique constraint (`packages/data/data/orm.py`,
`ux_bars_instrument_contract_open`) that this function lets raise
naturally (Section 43: "Do not silently repair data. Flag it." — a
caller catching `IntegrityError` here gets the real, honest signal
that a duplicate arrived, not a silently-ignored double-write).
"""

from __future__ import annotations

from data.database import session_scope
from data.orm import BarORM
from domain.models import Bar as DomainBar


async def persist_bar(bar: DomainBar) -> BarORM:
    async with session_scope() as session:
        row = BarORM(
            instrument=bar.instrument,
            contract_symbol=bar.contract_symbol,
            timestamp_open=bar.timestamp_open,
            timestamp_close=bar.timestamp_close,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
            trade_count=bar.trade_count,
            source=bar.source,
            session=bar.session,
            is_final=bar.is_final,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row
