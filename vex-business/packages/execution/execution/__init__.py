"""Vex Business — execution package (Master Directive Section 19-20). Phase
10 real implementation: `BrokerAdapter`/`MockBrokerAdapter`, the real
live-trading safety gate (`create_broker_adapter`), and real order/
position lifecycle helpers. `BrokerAdapterKind.LIVE` has no real
implementation yet — honest, unbuilt scope, never faked. Phase 11:
`execution.pipeline.run_pipeline` ties Phases 5-10 into one real,
callable end-to-end flow."""

from execution.broker import (
    BrokerAdapter,
    BrokerAdapterError,
    LiveTradingNotArmedError,
    MockBrokerAdapter,
    create_broker_adapter,
)
from execution.orders import (
    ExecutionError,
    build_order_from_risk_decision,
    close_position,
    open_position_from_fill,
)
from execution.pipeline import PipelineResult, run_pipeline

__all__ = [
    "BrokerAdapter",
    "BrokerAdapterError",
    "LiveTradingNotArmedError",
    "MockBrokerAdapter",
    "create_broker_adapter",
    "ExecutionError",
    "build_order_from_risk_decision",
    "close_position",
    "open_position_from_fill",
    "PipelineResult",
    "run_pipeline",
]
