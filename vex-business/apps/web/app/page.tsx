import { z } from "zod";
import PipelineDemo from "@/components/PipelineDemo";
import BacktestDemo from "@/components/BacktestDemo";

// Vex Business — the real dashboard (Master Directive Section 3's own target:
// "docker compose up. Then: Vex Business dashboard opens."). This page's own
// safety-posture panel is a real server-component fetch against the
// real running API, not mock data. Phase 13 adds <PipelineDemo />, a
// real client panel that runs the actual live pipeline
// (feature -> regime -> signal -> opportunity -> risk -> execution)
// against a clearly-labeled synthetic demo bar series and renders the
// real, full trace — see components/PipelineDemo.tsx's own docstring.

const HealthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  trading_mode: z.string(),
  broker_adapter_kind: z.string(),
  is_live_trading_armed: z.boolean(),
});

async function getHealth() {
  const apiUrl = process.env.VEXBUSINESS_API_URL ?? "http://localhost:9000";
  try {
    const res = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
    if (!res.ok) return { error: `API returned ${res.status}` as const };
    return HealthSchema.parse(await res.json());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "unknown error" };
  }
}

export default async function DashboardPage() {
  const health = await getHealth();

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Vex Business</h1>
        <p className="text-neutral-400 text-sm">
          Continuous Autonomous Learning &amp; Logic — internal futures-trading research platform.
        </p>
      </div>

      {"error" in health ? (
        <div className="rounded border border-red-800 bg-red-950/50 p-4 text-red-300 text-sm">
          Could not reach the Vex Business API: {health.error}
        </div>
      ) : (
        <div className="rounded border border-neutral-800 bg-neutral-900 p-6 space-y-3">
          <Row label="Trading mode" value={health.trading_mode} />
          <Row label="Broker adapter" value={health.broker_adapter_kind} />
          <Row
            label="Live trading armed"
            value={health.is_live_trading_armed ? "ARMED" : "disabled"}
            danger={health.is_live_trading_armed}
          />
        </div>
      )}

      <PipelineDemo />
      <BacktestDemo />

      <p className="text-neutral-500 text-xs">
        No replay or analytics UI, and no statistical-model UI/backend, exist yet. See the
        repo&apos;s own README for the real, current phase status.
      </p>
    </main>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400 text-sm">{label}</span>
      <span
        className={`text-sm font-mono px-2 py-0.5 rounded ${
          danger ? "bg-red-900 text-red-200" : "bg-neutral-800 text-neutral-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
