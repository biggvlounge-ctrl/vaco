"""Vex Business — real application settings, loaded from environment (see
`.env.example`). This is the one module the live-trading-disabled
requirement (Master Directive Section 1: "LIVE TRADING MUST BE
DISABLED BY DEFAULT") actually lives in.

**Honest status as of Phase 1-2**: no execution/broker code exists yet
(`packages/execution` is an empty Phase 3+ scaffold — see its own
`__init__.py`). That means live trading is unreachable today for the
strongest possible reason: there is no code path that could submit an
order to a real broker at all, live-capable or otherwise. The
interlock below is real, working, and tested — but it is not yet
load-bearing, because nothing calls it yet. It exists now so the later
phase that DOES add a live broker adapter has to wire through this
gate from day one, not bolt a check on after the fact.

**The real interlock, once execution exists**: `is_live_trading_armed`
requires BOTH `live_trading_enabled=True` AND
`live_trading_confirmation` to equal the exact literal phrase below —
a deliberate two-factor gate, not a single boolean a stray `true` in
an env file could flip on by accident. Neither the directive nor any
other source document specifies this exact two-part mechanism; it's a
real, flagged interpretive choice for how to implement "must stay
disabled by default" as robustly as the stated requirement's own
seriousness (real financial infrastructure, real money) calls for.
"""

from __future__ import annotations

from functools import lru_cache

from domain.enums import BrokerAdapterKind, TradingMode
from pydantic_settings import BaseSettings, SettingsConfigDict

# The exact literal string `live_trading_confirmation` must equal for
# `is_live_trading_armed` to ever return True. Deliberately specific
# and deliberately not a generic "yes"/"true" — reduces the chance of
# an unrelated truthy env value accidentally arming live trading.
REQUIRED_LIVE_TRADING_CONFIRMATION = "I_UNDERSTAND_THIS_ENABLES_REAL_MONEY_ORDERS"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Application -------------------------------------------------
    environment: str = "development"
    trading_mode: TradingMode = TradingMode.DEMO

    # --- Database / cache ---------------------------------------------
    database_url: str = "postgresql+psycopg://vexbusiness:vexbusiness@localhost:5432/vexbusiness"
    redis_url: str = "redis://localhost:6379/0"

    # --- Live trading interlock ---------------------------------------
    # Both default to the real, safe "off" state per Master Directive
    # Section 1: "LIVE TRADING MUST BE DISABLED BY DEFAULT."
    live_trading_enabled: bool = False
    live_trading_confirmation: str = ""
    broker_adapter_kind: BrokerAdapterKind = BrokerAdapterKind.MOCK

    # --- Risk defaults (Section 16 inputs a caller may not override
    # per-request; real per-account values still come from the risk
    # engine's own inputs at check time in later phases) -------------
    default_daily_loss_limit: float = 0.0
    default_maximum_trade_loss: float = 0.0
    default_maximum_contracts: int = 0
    default_maximum_open_positions: int = 0

    @property
    def is_live_trading_armed(self) -> bool:
        """The one real question every future execution-layer call
        site must ask before ever constructing a live broker adapter.
        Both parts required — see module docstring."""
        return (
            self.live_trading_enabled
            and self.live_trading_confirmation == REQUIRED_LIVE_TRADING_CONFIRMATION
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
