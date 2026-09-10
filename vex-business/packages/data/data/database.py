"""Vex Business — real database engine/session wiring. Reads `DATABASE_URL`
from `vexbusiness-config`'s own `Settings`, not a second, separate config
mechanism."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from config.settings import get_settings
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def _async_url(database_url: str) -> str:
    """`config.settings.Settings.database_url` defaults to a
    `postgresql+psycopg://` (sync) URL, since Alembic's own migration
    runner uses the sync driver. The real API/worker processes need
    the async driver instead — this swaps the dialect prefix rather
    than requiring two separately-configured URLs that could drift."""
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    return database_url


def make_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(_async_url(settings.database_url), pool_pre_ping=True)


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _engine, _session_factory
    if _session_factory is None:
        _engine = make_engine()
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _session_factory


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session
