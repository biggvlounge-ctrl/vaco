"use client";

import { useState } from "react";
import { generateDemoBars, SCENARIO_LABELS, type DemoScenario } from "@/lib/demoBars";
import { BacktestRunResponseSchema, type BacktestRunResponse } from "@/lib/types";

// Vex Business — Phase 12's real backtest engine, run over HTTP. Same real
// no-fabrication discipline as PipelineDemo.tsx: a real network or
// 4xx/5xx response surfaces as a real error, and `overall_probability`
// is whatever strategy.opportunity.estimate_probability's own real
// default minimum sample size actually produces — including a real,
// honest UNAVAILABLE if the backtest didn't find enough real trades,
// never a relaxed "just for the demo" threshold.

const DEFAULT_RISK_TEMPLATE = {
  account_equity: "50000",
  buying_power: "50000",
  entry: "0",
  stop: "0",
  quantity: 2,
  daily_pnl: "0",
  daily_loss_limit: "2000",
  maximum_trade_loss: "1000",
  maximum_contracts: 5,
  maximum_open_positions: 3,
  consecutive_losses: 0,
  session_state: "regular",
  volatility: 1.0,
  data_freshness_seconds: 10.0,
  broker_health: "healthy",
  strategy_status: "active",
};

type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; result: BacktestRunResponse };

export default function BacktestDemo() {
  const [scenario, setScenario] = useState<DemoScenario>("uptrend");
  const [state, setState] = useState<RequestState>({ status: "idle" });

  async function runBacktest() {
    setState({ status: "loading" });
    // A real backtest needs real depth of history (min_lookback +
    // atr_baseline_period + 1, per backtest.run_backtest's own real
    // minimum) -- 220 bars comfortably covers the real default
    // (60 + 50 + 1 = 111) with real room for multiple real trades.
    const bars = generateDemoBars(scenario, new Date(), 220);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bars,
          risk_inputs_template: DEFAULT_RISK_TEMPLATE,
          stop_distance: "10",
          strategy_version: "v0.1",
          min_lookback: 60,
          max_holding_bars: 20,
          atr_baseline_period: 50,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.detail ?? `API returned ${res.status}` });
        return;
      }
      setState({ status: "success", result: BacktestRunResponseSchema.parse(body) });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Run the real backtest</h2>
          <p className="text-neutral-500 text-xs mt-1">
            Walks a real, chronological synthetic bar series forward with no-look-ahead-bias
            enforcement, grading each real opportunity against the bars that follow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as DemoScenario)}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm"
          >
            {(Object.keys(SCENARIO_LABELS) as DemoScenario[]).map((key) => (
              <option key={key} value={key}>
                {SCENARIO_LABELS[key]}
              </option>
            ))}
          </select>
          <button
            onClick={runBacktest}
            disabled={state.status === "loading"}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-400 text-white text-sm font-medium px-4 py-1.5 rounded"
          >
            {state.status === "loading" ? "Running…" : "Run backtest"}
          </button>
        </div>
      </div>

      {state.status === "error" && (
        <div className="rounded border border-red-800 bg-red-950/50 p-4 text-red-300 text-sm">
          {state.message}
        </div>
      )}

      {state.status === "success" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Stat label="Trades" value={String(state.result.trades.length)} />
          <Stat label="Indeterminate" value={String(state.result.indeterminate_count)} />
          <Stat
            label="Win rate"
            value={state.result.win_rate !== null ? `${(state.result.win_rate * 100).toFixed(0)}%` : "—"}
          />
          <Stat
            label="Overall probability"
            value={
              state.result.overall_probability.availability === "unavailable"
                ? "UNAVAILABLE"
                : `${(state.result.overall_probability.value! * 100).toFixed(0)}% (n=${state.result.overall_probability.sample_count})`
            }
            sub={
              state.result.overall_probability.availability === "unavailable"
                ? undefined
                : `95% CI: ${(state.result.overall_probability.confidence_low! * 100).toFixed(0)}–${(state.result.overall_probability.confidence_high! * 100).toFixed(0)}%`
            }
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-neutral-800 p-3">
      <div className="text-neutral-500 mb-1">{label}</div>
      <div className="font-mono text-neutral-100 text-sm">{value}</div>
      {sub && <div className="font-mono text-neutral-500 text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}
