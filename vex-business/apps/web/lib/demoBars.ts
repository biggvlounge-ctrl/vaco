import type { Bar } from "./types";

// Vex Business — a real, clearly-labeled SYNTHETIC bar generator for the
// dashboard's own demo mode. Not live market data, not historical
// data — deterministic, generated client-side, the same real
// uptrend/downtrend/flat pacing this repo's own Python test suite
// uses (see call/tests/unit/test_pipeline.py's own make_uptrend_bars)
// so a demo run reliably reaches a real tradeable signal state
// instead of stalling at NO_TRADE/WATCH.

export type DemoScenario = "uptrend" | "downtrend" | "flat";

const DEFAULT_BAR_COUNT = 70;
const BAR_MINUTES = 5;
const VOLUME_SPIKE_PERIOD = 8;

function decimalStr(value: number): string {
  return value.toFixed(2);
}

/**
 * `barCount` defaults to 70 (enough for a single Phase-11 pipeline
 * run); the Phase-12 backtest panel passes a larger real count (needs
 * `min_lookback + atr_baseline_period + 1` bars minimum —
 * `backtest.run_backtest`'s own real requirement).
 */
export function generateDemoBars(
  scenario: DemoScenario,
  anchor: Date = new Date(),
  barCount: number = DEFAULT_BAR_COUNT,
): Bar[] {
  const startPrice = 5000;
  const step = scenario === "uptrend" ? 4 : scenario === "downtrend" ? -4 : 0;

  const bars: Bar[] = [];
  let price = startPrice;

  for (let i = 0; i < barCount; i++) {
    const isLastBar = i === barCount - 1;
    // A real, periodic volume spike (plus always on the final bar) --
    // a genuine, common real-world companion to a real breakout/
    // strong-trend move. A single spike on the last bar is enough for
    // a one-shot pipeline run to reach the real signal engine's own
    // READY threshold; the periodic pattern additionally gives a
    // real, multi-decision backtest walk several real opportunities
    // across the series, not just one at the very end (the same real
    // fixture technique the Python test suite's own backtest tests
    // use).
    const isSpikeBar = i % VOLUME_SPIKE_PERIOD === 0 || isLastBar;
    const volume = isSpikeBar && scenario !== "flat" ? 600 : 200;

    const open = new Date(anchor.getTime() + i * BAR_MINUTES * 60_000);
    const close = new Date(open.getTime() + BAR_MINUTES * 60_000);

    bars.push({
      instrument: "ES",
      contract_symbol: "ESZ25",
      timestamp_open: open.toISOString(),
      timestamp_close: close.toISOString(),
      open: decimalStr(price),
      high: decimalStr(price + 1),
      low: decimalStr(price - 1),
      close: decimalStr(price),
      volume,
      source: "demo",
      session: "regular",
      is_final: true,
    });

    price += step;
  }

  return bars;
}

export const SCENARIO_LABELS: Record<DemoScenario, string> = {
  uptrend: "Uptrend (synthetic)",
  downtrend: "Downtrend (synthetic)",
  flat: "Flat / no signal (synthetic)",
};
