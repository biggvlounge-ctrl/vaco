"use client";

import { useState } from "react";
import { generateDemoBars, SCENARIO_LABELS, type DemoScenario } from "@/lib/demoBars";
import { PipelineResultSchema, type PipelineResult } from "@/lib/types";

// Vex Business — Phase 13's real dashboard panel: runs the real, live
// execution.pipeline.run_pipeline (via the same-origin proxy at
// /api/pipeline) against a clearly-labeled synthetic demo bar series,
// and renders the real, full PipelineResult trail — every stage,
// including exactly where and why the pipeline stopped when it does.
// Never renders a fabricated result: a network error, a 4xx/5xx
// response, or an unexpected response shape (caught by
// PipelineResultSchema's own real parse) all surface as a real,
// visible error state instead of silently showing stale or invented
// data.

const DEFAULT_RISK_INPUTS = {
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
  | { status: "success"; result: PipelineResult };

export default function PipelineDemo() {
  const [scenario, setScenario] = useState<DemoScenario>("uptrend");
  const [state, setState] = useState<RequestState>({ status: "idle" });

  async function runPipeline() {
    setState({ status: "loading" });
    const bars = generateDemoBars(scenario);
    const sessionBars = bars.slice(-12);
    const latestClose = Number(bars[bars.length - 1].close);
    const stopPrice = scenario === "downtrend" ? latestClose + 10 : latestClose - 10;

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bars,
          session_bars: sessionBars,
          session_phase: "regular",
          risk_inputs: DEFAULT_RISK_INPUTS,
          stop_price: stopPrice.toFixed(2),
          current_open_positions: 0,
          strategy_version: "v0.1",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.detail ?? `API returned ${res.status}` });
        return;
      }
      const parsed = PipelineResultSchema.parse(body);
      setState({ status: "success", result: parsed });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Run the real pipeline</h2>
          <p className="text-neutral-500 text-xs mt-1">
            Feature → regime → signal → opportunity → risk → execution, against a clearly-labeled
            synthetic demo bar series — not live market data.
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
            onClick={runPipeline}
            disabled={state.status === "loading"}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-400 text-white text-sm font-medium px-4 py-1.5 rounded"
          >
            {state.status === "loading" ? "Running…" : "Run pipeline"}
          </button>
        </div>
      </div>

      {state.status === "error" && (
        <div className="rounded border border-red-800 bg-red-950/50 p-4 text-red-300 text-sm">
          {state.message}
        </div>
      )}

      {state.status === "success" && <PipelineResultView result={state.result} />}
    </div>
  );
}

function PipelineResultView({ result }: { result: PipelineResult }) {
  return (
    <div className="space-y-4">
      <Section title="Regime & feature snapshot">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge label={result.regime} tone="neutral" />
          <Badge label={`ATR baseline ${result.atr_baseline}`} tone="neutral" />
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <Field label="Trend" value={result.feature_snapshot.trend_direction} />
          <Field label="Structure" value={result.feature_snapshot.market_structure} />
          <Field label="Session" value={result.feature_snapshot.session_phase} />
          <Field label="VWAP distance" value={result.feature_snapshot.vwap_distance} />
          <Field label="Momentum %" value={result.feature_snapshot.momentum} />
          <Field label="Volume ratio" value={result.feature_snapshot.volume_ratio} />
        </dl>
      </Section>

      <Section title="Signal">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge
            label={result.signal.state}
            tone={
              result.signal.state === "high_conviction" || result.signal.state === "ready"
                ? "positive"
                : "neutral"
            }
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <ScoreBreakdown label="LONG" score={result.signal.long_score} components={result.signal.long_components} />
          <ScoreBreakdown label="SHORT" score={result.signal.short_score} components={result.signal.short_components} />
        </div>
      </Section>

      {result.opportunity === null ? (
        <HonestStop text="No opportunity: the signal wasn't in a genuinely tradeable state (needs READY or HIGH_CONVICTION)." />
      ) : (
        <Section title="Opportunity">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <Field label="Direction" value={result.opportunity.direction} />
            <Field label="Entry" value={result.opportunity.entry} />
            <Field label="Target (50pt)" value={result.opportunity.target} />
            <Field label="Score" value={result.opportunity.opportunity_score.toFixed(1)} />
            <Field
              label="Probability"
              value={
                result.opportunity.estimated_probability.availability === "unavailable"
                  ? "UNAVAILABLE (no real historical data)"
                  : `${(result.opportunity.estimated_probability.value! * 100).toFixed(0)}% (n=${result.opportunity.sample_count}, 95% CI ${(result.opportunity.estimated_probability.confidence_low! * 100).toFixed(0)}–${(result.opportunity.estimated_probability.confidence_high! * 100).toFixed(0)}%)`
              }
            />
          </dl>
        </Section>
      )}

      {result.opportunity !== null && result.risk_decision === null && (
        <HonestStop text="Risk decision missing unexpectedly." />
      )}

      {result.risk_decision !== null && (
        <Section title="Risk decision">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge
              label={result.risk_decision.outcome}
              tone={result.risk_decision.outcome === "approved" ? "positive" : "negative"}
            />
          </div>
          {result.risk_decision.outcome === "rejected" ? (
            <p className="text-red-300 text-xs">{result.risk_decision.rejection_reason}</p>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              <Field label="Approved qty" value={String(result.risk_decision.approved_quantity)} />
              <Field label="Max loss" value={result.risk_decision.maximum_loss ?? "—"} />
              <Field
                label="Risk %"
                value={
                  result.risk_decision.risk_percentage !== null
                    ? `${(result.risk_decision.risk_percentage * 100).toFixed(2)}%`
                    : "—"
                }
              />
            </dl>
          )}
        </Section>
      )}

      {result.risk_decision?.outcome === "approved" && result.order === null && (
        <HonestStop text="Order missing unexpectedly after an approved risk decision." />
      )}

      {result.order !== null && (
        <Section title="Order & position">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <Field label="Order state" value={result.order.state} />
            <Field label="Fill price" value={result.order.average_fill_price ?? "—"} />
            {result.position && (
              <>
                <Field label="Position qty" value={String(result.position.quantity)} />
                <Field label="Stop" value={result.position.stop_price} />
                <Field label="Target" value={result.position.target_price} />
              </>
            )}
          </dl>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-800 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function HonestStop({ text }: { text: string }) {
  return (
    <div className="border-t border-neutral-800 pt-4 text-neutral-400 text-xs italic">{text}</div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-mono text-neutral-200">{value}</dd>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "positive" | "negative" | "neutral" }) {
  const toneClasses =
    tone === "positive"
      ? "bg-emerald-900 text-emerald-200"
      : tone === "negative"
        ? "bg-red-900 text-red-200"
        : "bg-neutral-800 text-neutral-200";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded uppercase ${toneClasses}`}>{label}</span>
  );
}

// Real default weights, matching strategy.signal.SignalScoringConfig's
// own SignalComponentScores() defaults exactly (trend=20 ...
// session_timing=5, total=100) -- used only to normalize each bar's
// fill against its own real max, not to recompute anything.
const COMPONENT_WEIGHTS: Record<string, number> = {
  trend: 20,
  market_structure: 15,
  vwap: 15,
  momentum: 15,
  volume: 10,
  key_levels: 10,
  volatility: 10,
  session_timing: 5,
};

function ScoreBreakdown({
  label,
  score,
  components,
}: {
  label: string;
  score: number;
  components: Record<string, number>;
}) {
  return (
    <div className="rounded border border-neutral-800 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-neutral-400">{label}</span>
        <span className="text-sm font-mono">{score.toFixed(1)} / 100</span>
      </div>
      <div className="space-y-1">
        {Object.entries(components).map(([key, value]) => {
          const weight = COMPONENT_WEIGHTS[key] ?? 20;
          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span className="w-24 text-neutral-500 truncate">{key}</span>
              <div className="flex-1 h-1.5 bg-neutral-800 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${Math.min(100, (value / weight) * 100)}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono text-neutral-400">
                {value.toFixed(1)}/{weight}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
