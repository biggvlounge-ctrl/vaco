// Backdrop simulation and the expansion trigger.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

import test from "node:test";
import assert from "node:assert";

import {
  COST_PER_CITY_LOW, COST_PER_CITY_HIGH, MIN_SAMPLES, DEFAULT_THRESHOLDS, ExpansionError,
  createArea, recordSample, realGrowthSignal, expansionCostEstimate,
  evaluateExpansion, expansionQueue, describeArea,
} from "../src/lib/worldExpansion.js";

// Grow an area across `n` samples at a per-sample rate.
function grow(area, { from = 10000, rate = 0.1, n = MIN_SAMPLES, activity = 0.8 } = {}) {
  let pop = from;
  for (let i = 0; i < n; i += 1) {
    recordSample(area, { simulatedPopulation: pop, economicActivityLevel: activity, at: i });
    pop *= 1 + rate;
  }
  return area;
}

// -- The separation the module exists to enforce -------------------------

test("the simulation runs identically whether or not an area is playable", () => {
  // This is the document's central claim: "the simulation doesn't
  // require full, human-artist-built visual detail to keep running."
  // If backdrop areas ever simulate differently, the trigger is
  // measuring the wrong thing.
  const backdrop = createArea({ areaId: "lagos", isVisuallyPlayable: false });
  const playable = createArea({ areaId: "stl", isVisuallyPlayable: true });

  for (const area of [backdrop, playable]) grow(area, { from: 50000, rate: 0.2, n: 6 });

  assert.equal(backdrop.simulatedPopulation, playable.simulatedPopulation);
  assert.equal(backdrop.economicActivityLevel, playable.economicActivityLevel);
  assert.equal(realGrowthSignal(backdrop), realGrowthSignal(playable));
  assert.equal(backdrop.samples.length, playable.samples.length);
});

test("an area already playable is never an expansion candidate", () => {
  // Without this the trigger recommends spending on the places that
  // already had the spend -- by construction the busiest ones.
  const area = grow(createArea({ areaId: "stl", isVisuallyPlayable: true }), { from: 500000, rate: 0.5, n: 8 });
  const v = evaluateExpansion(area);
  assert.equal(v.warranted, false);
  assert.match(v.reason, /already visually playable/);
});

// -- The signal ----------------------------------------------------------

test("no history means no signal -- and that is not the same as no growth", () => {
  const area = createArea({ areaId: "quiet" });
  assert.equal(realGrowthSignal(area), null);

  grow(area, { from: 1000, rate: 0.5, n: MIN_SAMPLES - 1 });
  assert.equal(realGrowthSignal(area), null, "a signal appeared before MIN_SAMPLES");

  const v = evaluateExpansion(area);
  assert.equal(v.warranted, false);
  assert.equal(v.signal, null);
  assert.match(v.reason, /not enough observed history/);
  // The distinction stated in the reason, because it changes what a
  // designer does next: wait, versus look elsewhere.
  assert.match(v.reason, /no signal is not the same as no growth/);
});

test("growth is measured from observed samples, not assigned", () => {
  const area = grow(createArea({ areaId: "kyoto" }), { from: 10000, rate: 0.1, n: 5 });
  const signal = realGrowthSignal(area);
  assert.ok(signal > 0, "measured growth was not positive on a growing area");

  // Assigning the field does nothing -- it is derived on every read.
  area.realGrowthSignal = 99;
  assert.equal(realGrowthSignal(area), signal, "an assigned field overrode the measurement");
});

test("a shrinking area reports negative growth rather than nothing", () => {
  const area = createArea({ areaId: "decline" });
  let pop = 50000;
  for (let i = 0; i < 5; i += 1) {
    recordSample(area, { simulatedPopulation: pop, economicActivityLevel: 0.7, at: i });
    pop *= 0.9;
  }
  assert.ok(realGrowthSignal(area) < 0);
});

test("an area with no baseline population has no signal", () => {
  // Growth from zero is division by zero, and "infinite growth" is
  // exactly the wrong thing to hand a spending trigger.
  const area = createArea({ areaId: "empty" });
  for (let i = 0; i < 6; i += 1) {
    recordSample(area, { simulatedPopulation: i === 0 ? 0 : i * 1000, economicActivityLevel: 0.9, at: i });
  }
  assert.equal(realGrowthSignal(area), null);
  assert.equal(evaluateExpansion(area).warranted, false);
});

// -- The thresholds ------------------------------------------------------

test("all three thresholds must be met, and the reason names the ones that were not", () => {
  const area = grow(createArea({ areaId: "small" }), { from: 100, rate: 0.5, n: 6, activity: 0.1 });
  const v = evaluateExpansion(area);
  assert.equal(v.warranted, false);
  assert.match(v.reason, /population/);
  assert.match(v.reason, /economic activity/);
  // Growth is strong here, so it must NOT appear in the failures --
  // otherwise the test would pass while the reason was nonsense.
  assert.doesNotMatch(v.reason, /growth 0/);
});

test("a genuinely thriving backdrop area is warranted, with a cost attached", () => {
  const area = grow(createArea({ areaId: "lagos" }), { from: 40000, rate: 0.15, n: 6, activity: 0.8 });
  const v = evaluateExpansion(area);
  assert.equal(v.warranted, true, v.reason);
  assert.deepEqual(v.estimatedCost, { cities: 1, low: COST_PER_CITY_LOW, high: COST_PER_CITY_HIGH });
  assert.match(v.reason, /all thresholds met/);
});

test("a big, busy, but flat area is refused on growth alone", () => {
  // The growth threshold was the one rule no test reached: every
  // "cold" fixture also failed population and activity, so the module
  // could have ignored growth entirely and stayed green. Caught by
  // mutation, not by reading. This area clears the other two
  // thresholds comfortably and is refused only for being flat.
  const area = createArea({ areaId: "plateau" });
  for (let i = 0; i < 6; i += 1) {
    recordSample(area, { simulatedPopulation: 200000, economicActivityLevel: 0.95, at: i });
  }
  const v = evaluateExpansion(area);
  assert.equal(v.warranted, false);
  assert.match(v.reason, /growth/);
  assert.doesNotMatch(v.reason, /population/, "refused for the wrong reason");
  assert.doesNotMatch(v.reason, /economic activity/, "refused for the wrong reason");
});

test("thresholds are overridable per call without editing the module", () => {
  const area = grow(createArea({ areaId: "tiny" }), { from: 100, rate: 0.5, n: 6, activity: 0.9 });
  assert.equal(evaluateExpansion(area).warranted, false);
  assert.equal(
    evaluateExpansion(area, { thresholds: { minPopulation: 10 } }).warranted, true,
  );
});

test("population just under the threshold is refused, just over is allowed", () => {
  const under = createArea({ areaId: "under" });
  const over = createArea({ areaId: "over" });
  const p = DEFAULT_THRESHOLDS.minPopulation;
  for (const [area, target] of [[under, p - 1], [over, p + 1]]) {
    let pop = target / 1.5;
    for (let i = 0; i < 5; i += 1) {
      recordSample(area, { simulatedPopulation: i === 4 ? target : pop, economicActivityLevel: 0.9, at: i });
      pop *= 1.1;
    }
  }
  assert.equal(evaluateExpansion(under).warranted, false);
  assert.match(evaluateExpansion(under).reason, /population/);
  assert.equal(evaluateExpansion(over).warranted, true, evaluateExpansion(over).reason);
});

// -- Validation ----------------------------------------------------------

test("nonsense inputs are refused rather than stored", () => {
  assert.throws(() => createArea({ areaId: "" }), /areaId/);
  assert.throws(() => createArea({ areaId: "x", simulatedPopulation: -1 }), /negative/);
  assert.throws(() => createArea({ areaId: "x", economicActivityLevel: 1.5 }), /0-1 ratio/);
  assert.throws(() => createArea({ areaId: "x", isVisuallyPlayable: "yes" }), /boolean/);
  // NaN is the class this repo already swept for on every money path.
  assert.throws(() => createArea({ areaId: "x", simulatedPopulation: NaN }), /finite/);

  const area = createArea({ areaId: "x" });
  assert.throws(() => recordSample(area, { simulatedPopulation: NaN, economicActivityLevel: 0.5 }), /finite/);
  assert.throws(() => recordSample(area, { simulatedPopulation: 5, economicActivityLevel: 2 }), /0-1 ratio/);
  assert.equal(area.samples.length, 0, "a rejected sample was still recorded");
});

test("cost estimates scale, and the document's own figures are the constants", () => {
  assert.deepEqual(expansionCostEstimate(0), { cities: 0, low: 0, high: 0 });
  assert.deepEqual(expansionCostEstimate(10), { cities: 10, low: 30000, high: 50000 });
  assert.deepEqual(expansionCostEstimate(50), { cities: 50, low: 150000, high: 250000 });
  // The three rollout scales named in the source document.
  assert.equal(COST_PER_CITY_LOW, 3000);
  assert.equal(COST_PER_CITY_HIGH, 5000);
  assert.throws(() => expansionCostEstimate(-1), /non-negative/);
  assert.throws(() => expansionCostEstimate(1.5), /integer/);
});

test("the full-globe figure matches the document's multi-million estimate", () => {
  // 2,500+ Cesium-covered cities -> $7.5M-$12.5M. Asserted so the
  // constants cannot drift away from the number the decision was made on.
  const all = expansionCostEstimate(2500);
  assert.equal(all.low, 7500000);
  assert.equal(all.high, 12500000);
});

// -- The queue -----------------------------------------------------------

test("the queue ranks warranted areas by measured growth, strongest first", () => {
  const fast = grow(createArea({ areaId: "fast" }), { from: 40000, rate: 0.30, n: 6 });
  const slow = grow(createArea({ areaId: "slow" }), { from: 40000, rate: 0.12, n: 6 });
  const cold = grow(createArea({ areaId: "cold" }), { from: 100, rate: 0.01, n: 6, activity: 0.1 });
  const done = grow(createArea({ areaId: "stl", isVisuallyPlayable: true }), { from: 90000, rate: 0.4, n: 6 });

  const queue = expansionQueue([slow, cold, done, fast]);
  assert.deepEqual(queue.map((r) => r.areaId), ["fast", "slow"]);
  assert.equal(queue[0].rank, 1);
  assert.ok(queue[0].signal > queue[1].signal);
});

test("an empty queue is empty, not a default recommendation", () => {
  const cold = grow(createArea({ areaId: "cold" }), { from: 10, rate: 0.001, n: 6, activity: 0.05 });
  assert.deepEqual(expansionQueue([cold]), []);
});

test("describeArea labels the tier and carries the reason", () => {
  const backdrop = describeArea(createArea({ areaId: "lagos" }));
  assert.equal(backdrop.tier, "backdrop");
  assert.equal(backdrop.expansionWarranted, false);
  assert.ok(backdrop.reason);

  const playable = describeArea(createArea({ areaId: "stl", isVisuallyPlayable: true }));
  assert.equal(playable.tier, "playable");
});
