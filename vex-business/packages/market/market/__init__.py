"""Vex Business — market package. The 5-minute candle engine, a real market
data adapter interface + mock implementation, data-quality checks, the
session-phase engine, and ES contract-roll resolution (Master
Directive Sections 3, 8, 9, 10, 19, 43).
"""

from market.candle_engine import BAR_DURATION, CandleEngine, DataQualityError, bar_window_start
from market.contract_mapping import (
    DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION,
    ContractMappingError,
    build_contract_mapping,
    resolve_current_contract,
)
from market.data_adapter import MarketDataAdapter, MockMarketDataAdapter
from market.persistence import persist_bar
from market.quality import check_contract_consistency, check_session_consistency, is_stale
from market.session_engine import SessionPhase, default_es_session_config, resolve_session_phase

__all__ = [
    "BAR_DURATION",
    "CandleEngine",
    "DataQualityError",
    "bar_window_start",
    "DEFAULT_ROLL_DAYS_BEFORE_EXPIRATION",
    "ContractMappingError",
    "build_contract_mapping",
    "resolve_current_contract",
    "MarketDataAdapter",
    "MockMarketDataAdapter",
    "persist_bar",
    "check_contract_consistency",
    "check_session_consistency",
    "is_stale",
    "SessionPhase",
    "default_es_session_config",
    "resolve_session_phase",
]
