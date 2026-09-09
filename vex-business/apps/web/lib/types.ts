import { z } from "zod";

// Vex Business — real Zod schemas mirroring apps/api/api/main.py's own real
// response shapes (domain.models field names, verbatim — pydantic's
// JSON encoding of Decimal fields as strings is matched here rather
// than assumed as numbers). Parsed at the real API boundary so a
// malformed response fails loudly here, not by silently rendering
// garbage further down the component tree.

export const BarSchema = z.object({
  instrument: z.string(),
  contract_symbol: z.string(),
  timestamp_open: z.string(),
  timestamp_close: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.number(),
  trade_count: z.number().nullable().optional(),
  source: z.string(),
  session: z.string(),
  is_final: z.boolean(),
});
export type Bar = z.infer<typeof BarSchema>;

export const RiskCheckInputsSchema = z.object({
  account_equity: z.string(),
  buying_power: z.string(),
  entry: z.string(),
  stop: z.string(),
  quantity: z.number(),
  daily_pnl: z.string(),
  daily_loss_limit: z.string(),
  maximum_trade_loss: z.string(),
  maximum_contracts: z.number(),
  maximum_open_positions: z.number(),
  consecutive_losses: z.number(),
  session_state: z.string(),
  volatility: z.number(),
  data_freshness_seconds: z.number(),
  broker_health: z.string(),
  strategy_status: z.string(),
});
export type RiskCheckInputs = z.infer<typeof RiskCheckInputsSchema>;

export const FeatureSnapshotSchema = z.object({
  instrument: z.string(),
  contract_symbol: z.string(),
  as_of: z.string(),
  session_phase: z.string(),
  minutes_since_session_open: z.number().nullable(),
  sma_fast: z.string(),
  sma_slow: z.string(),
  trend_direction: z.string(),
  market_structure: z.string(),
  vwap: z.string(),
  vwap_distance: z.string(),
  momentum: z.string(),
  volume_ratio: z.string(),
  session_high: z.string(),
  session_low: z.string(),
  distance_from_session_high: z.string(),
  distance_from_session_low: z.string(),
  atr: z.string(),
});
export type FeatureSnapshot = z.infer<typeof FeatureSnapshotSchema>;

export const SignalComponentScoresSchema = z.object({
  trend: z.number(),
  market_structure: z.number(),
  vwap: z.number(),
  momentum: z.number(),
  volume: z.number(),
  key_levels: z.number(),
  volatility: z.number(),
  session_timing: z.number(),
});
export type SignalComponentScores = z.infer<typeof SignalComponentScoresSchema>;

export const SignalSchema = z.object({
  signal_id: z.string(),
  instrument: z.string(),
  as_of: z.string(),
  long_score: z.number(),
  long_components: SignalComponentScoresSchema,
  short_score: z.number(),
  short_components: SignalComponentScoresSchema,
  regime: z.string(),
  state: z.string(),
  strategy_version: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const ProbabilitySchema = z.object({
  availability: z.string(),
  value: z.number().nullable(),
  sample_count: z.number(),
  // A real 95% Wilson score interval around `value`, present only
  // when availability is "estimated" -- see
  // strategy.opportunity.wilson_score_interval's own docstring.
  confidence_low: z.number().nullable(),
  confidence_high: z.number().nullable(),
});

export const OpportunitySchema = z.object({
  opportunity_id: z.string(),
  signal_id: z.string(),
  instrument: z.string(),
  as_of: z.string(),
  direction: z.string(),
  entry: z.string(),
  target: z.string(),
  opportunity_score: z.number(),
  estimated_probability: ProbabilitySchema,
  sample_count: z.number(),
  expected_mfe: z.string().nullable(),
  expected_mae: z.string().nullable(),
  blocking_levels: z.array(z.string()),
  expected_duration_minutes: z.number().nullable(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const RiskDecisionSchema = z.object({
  decision_id: z.string(),
  opportunity_id: z.string(),
  as_of: z.string(),
  inputs: RiskCheckInputsSchema,
  outcome: z.string(),
  approved_quantity: z.number(),
  maximum_loss: z.string().nullable(),
  stop_distance: z.string().nullable(),
  risk_percentage: z.number().nullable(),
  rejection_reason: z.string().nullable(),
});
export type RiskDecision = z.infer<typeof RiskDecisionSchema>;

export const OrderSchema = z.object({
  order_id: z.string(),
  risk_decision_id: z.string(),
  contract_symbol: z.string(),
  direction: z.string(),
  quantity: z.number(),
  state: z.string(),
  idempotency_key: z.string(),
  broker_order_id: z.string().nullable(),
  submitted_at: z.string().nullable(),
  filled_at: z.string().nullable(),
  average_fill_price: z.string().nullable(),
});
export type Order = z.infer<typeof OrderSchema>;

export const PositionSchema = z.object({
  position_id: z.string(),
  order_id: z.string(),
  contract_symbol: z.string(),
  direction: z.string(),
  quantity: z.number(),
  entry_price: z.string(),
  stop_price: z.string(),
  target_price: z.string(),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  close_price: z.string().nullable(),
  close_reason: z.string().nullable(),
});
export type Position = z.infer<typeof PositionSchema>;

export const PipelineResultSchema = z.object({
  feature_snapshot: FeatureSnapshotSchema,
  atr_baseline: z.string(),
  regime: z.string(),
  signal: SignalSchema,
  opportunity: OpportunitySchema.nullable(),
  risk_decision: RiskDecisionSchema.nullable(),
  order: OrderSchema.nullable(),
  position: PositionSchema.nullable(),
});
export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export const BacktestTradeOutSchema = z.object({
  opportunity: OpportunitySchema,
  outcome_hit_target: z.boolean(),
  bars_held: z.number(),
});

export const BacktestRunResponseSchema = z.object({
  trades: z.array(BacktestTradeOutSchema),
  indeterminate_count: z.number(),
  opportunities_seen: z.number(),
  win_rate: z.number().nullable(),
  overall_probability: ProbabilitySchema,
});
export type BacktestRunResponse = z.infer<typeof BacktestRunResponseSchema>;
