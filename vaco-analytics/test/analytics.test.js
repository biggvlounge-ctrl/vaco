// VACO Analytics — the app every other app feeds, and the last one
// with no tests.
//
// **Why this suite exists.** Twelve apps POST their real numbers here
// and nothing checked that any of it was computed correctly. That is
// worse than an untested leaf app: a wrong summary here is a wrong
// number on the management dashboard, and a wrong baseline here is an
// anomaly detector that either cries wolf or — much worse — stays
// quiet. `intelligence.js` says so in its own header: "a poisoned
// baseline hides the anomaly rather than raising it."
//
// Four properties matter more than the arithmetic:
//
//   1. **A thin baseline is not a confident one.** Two data points can
//      produce a stddev, and a z-score built on it is noise wearing a
//      number. The detector must say "not enough data" rather than
//      guess.
//   2. **Zero variance is not zero information.** A metric that has
//      been exactly 100 for a week and is suddenly 4000 has a stddev of
//      0, and a plain z-score divides by it. That case is handled
//      separately and has to stay handled.
//   3. **Unrouted is not unimportant.** A category nobody is named for
//      routes to null, and null must not be confused with "no alert".
//   4. **Ingest validates, because the baseline is downstream of it.**

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMetricsStore, ingestMetric, getMetrics, getSummary,
  getApps, getMetricNames, getEcosystemSnapshot,
} from '../metricsStore.js';
import {
  computeBaseline, detectAnomaly, routeAlert, evaluateMetric, getAlerts, ALERT_ROUTES,
} from '../intelligence.js';

// A store with `values` ingested for one app/metric, one tick apart, so
// ordering is deterministic rather than dependent on Date.now().
function storeWith(values, { app = 'DREAMS', metric = 'screen_revenue' } = {}) {
  const store = createMetricsStore();
  values.forEach((value, i) => {
    ingestMetric(store, { app, metric, value, timestamp: 1000 + i });
  });
  return store;
}

// ---------------------------------------------------------------------------
// Ingest — the front door
// ---------------------------------------------------------------------------

test('a metric event is stored with an id and a timestamp', () => {
  const store = createMetricsStore();
  const event = ingestMetric(store, { app: 'VOID', metric: 'jobs_completed', value: 12 });
  assert.equal(event.id, 1);
  assert.equal(event.app, 'VOID');
  assert.equal(event.value, 12);
  assert.equal(typeof event.timestamp, 'number');
  assert.equal(store.events.length, 1);
});

test('ingest refuses anything it cannot compute on later', () => {
  // Every one of these would survive ingestion and then poison a mean.
  const store = createMetricsStore();
  assert.throws(() => ingestMetric(store, { metric: 'x', value: 1 }), /requires an app/);
  assert.throws(() => ingestMetric(store, { app: 'x', value: 1 }), /requires a metric/);
  assert.throws(() => ingestMetric(store, { app: 'x', metric: 'y' }), /numeric value/);
  assert.throws(() => ingestMetric(store, { app: 'x', metric: 'y', value: 'lots' }), /numeric value/);
  assert.throws(() => ingestMetric(store, { app: 'x', metric: 'y', value: NaN }), /numeric value/);
  assert.equal(store.events.length, 0, 'and nothing partial was written');
});

test('a value of zero is a real measurement, not a missing one', () => {
  // The falsy trap. `if (!value)` here would silently reject the most
  // interesting reading a metric can have: the day revenue was 0.
  const store = createMetricsStore();
  const event = ingestMetric(store, { app: 'DREAMS', metric: 'screen_revenue', value: 0 });
  assert.equal(event.value, 0);
  assert.equal(store.events.length, 1);
});

test('a negative value is kept — refunds and losses are real numbers', () => {
  const store = createMetricsStore();
  assert.equal(ingestMetric(store, { app: 'VOKEN', metric: 'net_flow', value: -250 }).value, -250);
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

test('metrics come back newest first and respect their limit', () => {
  const store = storeWith([1, 2, 3, 4, 5]);
  const all = getMetrics(store, 'DREAMS', 'screen_revenue');
  assert.equal(all.length, 5);
  assert.equal(all[0].value, 5, 'newest first');
  assert.equal(getMetrics(store, 'DREAMS', 'screen_revenue', { limit: 2 }).length, 2);
});

test('reads are scoped to one app and one metric', () => {
  const store = createMetricsStore();
  ingestMetric(store, { app: 'A', metric: 'm', value: 1, timestamp: 1 });
  ingestMetric(store, { app: 'B', metric: 'm', value: 2, timestamp: 2 });
  ingestMetric(store, { app: 'A', metric: 'other', value: 3, timestamp: 3 });

  assert.equal(getMetrics(store, 'A').length, 2, 'both of A\'s metrics');
  assert.equal(getMetrics(store, 'A', 'm').length, 1, 'only A\'s m');
  assert.deepEqual(getMetrics(store, 'A', 'm')[0].value, 1);
});

test('a summary of nothing is zeroed counts and NULL extremes', () => {
  // The distinction that matters on a dashboard: a metric with no data
  // has no minimum. Reporting 0 would draw a line at zero and look like
  // a measurement.
  const summary = getSummary(createMetricsStore(), 'NOBODY', 'nothing');
  assert.equal(summary.count, 0);
  assert.equal(summary.min, null, 'unknown is not a zero');
  assert.equal(summary.max, null);
  assert.equal(summary.latest, null);
});

test('a summary computes what the dashboard actually shows', () => {
  const store = storeWith([10, 20, 30, 40]);
  const s = getSummary(store, 'DREAMS', 'screen_revenue');
  assert.equal(s.count, 4);
  assert.equal(s.sum, 100);
  assert.equal(s.avg, 25);
  assert.equal(s.min, 10);
  assert.equal(s.max, 40);
  assert.equal(s.latest, 40, 'latest is by timestamp, not by array position');
});

test('latest is the newest by timestamp even when ingested out of order', () => {
  // Events arrive over HTTP from twelve apps; nothing guarantees the
  // order they land in.
  const store = createMetricsStore();
  ingestMetric(store, { app: 'A', metric: 'm', value: 1, timestamp: 500 });
  ingestMetric(store, { app: 'A', metric: 'm', value: 99, timestamp: 900 });
  ingestMetric(store, { app: 'A', metric: 'm', value: 5, timestamp: 700 });
  assert.equal(getSummary(store, 'A', 'm').latest, 99);
});

test('the ecosystem snapshot lists every app and each of its metrics', () => {
  const store = createMetricsStore();
  ingestMetric(store, { app: 'VOID', metric: 'jobs', value: 3, timestamp: 1 });
  ingestMetric(store, { app: 'VOID', metric: 'revenue', value: 30, timestamp: 2 });
  ingestMetric(store, { app: 'DREAMS', metric: 'screens', value: 8, timestamp: 3 });

  assert.deepEqual(getApps(store), ['DREAMS', 'VOID'], 'sorted, and each app once');
  assert.deepEqual(getMetricNames(store, 'VOID'), ['jobs', 'revenue']);

  const snapshot = getEcosystemSnapshot(store);
  assert.equal(snapshot.length, 2);
  const voidApp = snapshot.find((s) => s.app === 'VOID');
  assert.equal(voidApp.metrics.length, 2);
  assert.equal(voidApp.metrics.find((m) => m.metric === 'revenue').sum, 30);
});

// ---------------------------------------------------------------------------
// The baseline — where a wrong number becomes a missed alert
// ---------------------------------------------------------------------------

test('a baseline is the mean and spread of what actually happened', () => {
  const b = computeBaseline([10, 10, 10, 10]);
  assert.equal(b.mean, 10);
  assert.equal(b.stddev, 0);
  assert.equal(b.count, 4);
});

test('a baseline of nothing is refused, not invented', () => {
  assert.throws(() => computeBaseline([]), /non-empty/);
  assert.throws(() => computeBaseline(null), /non-empty/);
});

test('fewer than three points is not enough to call anything anomalous', () => {
  // Two points always have a mean and a stddev, and a z-score built on
  // them is noise with a decimal place. This has to report its own
  // ignorance rather than produce a confident wrong answer.
  const thin = computeBaseline([10, 200]);
  const out = detectAnomaly(5000, thin);
  assert.equal(out.isAnomaly, false);
  assert.equal(out.zScore, null, 'and it does not offer a number it cannot stand behind');
  assert.equal(out.reason, 'insufficient_baseline_data');
});

test('a flat metric that suddenly jumps is caught, despite dividing by zero', () => {
  // **The case a plain z-score gets wrong.** A metric that has been
  // exactly 100 every day has stddev 0, so (value - mean) / stddev is
  // Infinity or NaN. Handled explicitly — and it is the single most
  // obvious kind of real anomaly there is.
  const flat = computeBaseline([100, 100, 100, 100]);
  assert.equal(flat.stddev, 0);

  const jumped = detectAnomaly(4000, flat);
  assert.equal(jumped.isAnomaly, true);
  assert.equal(jumped.reason, 'zero_variance_deviation');
  assert.ok(!Number.isNaN(jumped.zScore), 'and no NaN escapes into the alert');

  const same = detectAnomaly(100, flat);
  assert.equal(same.isAnomaly, false, 'and a flat metric staying flat is not an event');
  assert.equal(same.zScore, 0);
});

test('the threshold is a real dial', () => {
  const b = computeBaseline([10, 12, 11, 13, 10, 12]);
  const value = 16;
  const strict = detectAnomaly(value, b, { threshold: 1 });
  const loose = detectAnomaly(value, b, { threshold: 10 });
  assert.equal(strict.isAnomaly, true);
  assert.equal(loose.isAnomaly, false, 'the same value, a different question');
  assert.equal(strict.zScore, loose.zScore, 'and the score itself does not move');
});

test('the detector refuses inputs it cannot score', () => {
  const b = computeBaseline([1, 2, 3, 4]);
  assert.throws(() => detectAnomaly('big', b), /numeric value/);
  assert.throws(() => detectAnomaly(5, null), /requires a baseline/);
  assert.throws(() => detectAnomaly(5, { mean: 1 }), /requires a baseline/);
});

test('a drop is as anomalous as a spike', () => {
  // Revenue going to zero matters at least as much as revenue tripling,
  // and a detector that only watches one direction misses the outage.
  const b = computeBaseline([100, 102, 98, 101, 99]);
  const crash = detectAnomaly(0, b);
  assert.equal(crash.isAnomaly, true);
  assert.ok(crash.zScore < 0, 'and the sign says which way it went');
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

test('the three named categories route to the three named people', () => {
  // intelligence.js is explicit that this is the source doc's own list
  // and not a general-purpose category system.
  assert.equal(routeAlert('financial').routedTo, 'Leslie');
  assert.equal(routeAlert('compliance').routedTo, 'Deskins');
  assert.equal(routeAlert('security').routedTo, 'Qvan');
  assert.deepEqual(Object.keys(ALERT_ROUTES).sort(), ['compliance', 'financial', 'security']);
});

test('an unmapped category routes to nobody, and says so', () => {
  // Silently dropping it would be an alert that fires into the void.
  const out = routeAlert('vibes');
  assert.equal(out.routedTo, null);
  assert.match(out.reason, /no agent mapped/);
});

// ---------------------------------------------------------------------------
// evaluateMetric — the whole loop
// ---------------------------------------------------------------------------

test('an evaluation with too little history says so and records nothing', () => {
  const store = storeWith([10, 500, 20]);
  const out = evaluateMetric(store, 'DREAMS', 'screen_revenue');
  assert.equal(out.evaluated, false);
  assert.equal(out.reason, 'insufficient_data');
  assert.equal(out.isAnomaly, false);
  assert.equal(store.alerts.length, 0, 'and no alert was filed on a guess');
});

test('a healthy metric is evaluated and files no alert', () => {
  const store = storeWith([100, 102, 98, 101, 99]);
  const out = evaluateMetric(store, 'DREAMS', 'screen_revenue');
  assert.equal(out.evaluated, true);
  assert.equal(out.isAnomaly, false);
  assert.equal(store.alerts.length, 0, 'evaluating the common case must not page anybody');
});

test('a real anomaly is filed with everything a responder needs', () => {
  const store = storeWith([100, 102, 98, 101, 4000]);
  const out = evaluateMetric(store, 'DREAMS', 'screen_revenue', { category: 'financial' });

  assert.equal(out.isAnomaly, true);
  assert.equal(out.value, 4000, 'the value that tripped it');
  assert.ok(out.baseline.mean, 'what it was measured against');
  assert.ok(out.zScore > 0, 'and how far out it was');
  assert.equal(out.routedTo, 'Leslie', 'and who owns it');
  assert.equal(store.alerts.length, 1);
  assert.equal(store.alerts[0].id, 1, 'filed with an id, so it can be referred to');
});

test('the latest point is judged, not included in its own baseline', () => {
  // A value that contributes to the mean it is compared against drags
  // that mean toward itself, and a big enough spike hides inside the
  // baseline it created.
  const store = storeWith([100, 100, 100, 100, 4000]);
  const out = evaluateMetric(store, 'DREAMS', 'screen_revenue');
  assert.equal(out.baseline.mean, 100, 'the 4000 is the subject, not part of the history');
  assert.equal(out.baseline.count, 4);
  assert.equal(out.isAnomaly, true);
});

test('an evaluation reads only its own app and metric', () => {
  // Another app's numbers leaking into this baseline is the poisoning
  // the header warns about, arriving by accident instead of by attack.
  const store = createMetricsStore();
  [100, 101, 99, 100].forEach((v, i) => ingestMetric(store,
    { app: 'A', metric: 'm', value: v, timestamp: 100 + i }));
  [1, 2, 3, 4].forEach((v, i) => ingestMetric(store,
    { app: 'B', metric: 'm', value: v, timestamp: 200 + i }));
  [7000, 8000].forEach((v, i) => ingestMetric(store,
    { app: 'A', metric: 'other', value: v, timestamp: 300 + i }));

  const out = evaluateMetric(store, 'A', 'm');
  assert.equal(out.baseline.count, 3, 'three of A.m\'s four points, the fourth being the subject');
  assert.ok(out.baseline.mean > 90 && out.baseline.mean < 110,
    `baseline ${out.baseline.mean} was contaminated by another app or metric`);
});

test('an evaluation refuses a store that is not one', () => {
  assert.throws(() => evaluateMetric(null, 'A', 'm'), /requires a metricsStore/);
  assert.throws(() => evaluateMetric({}, 'A', 'm'), /requires a metricsStore/);
});

test('an anomalous metric with no category still files, routed to nobody', () => {
  // "Nobody is named for this yet" must not mean "do not record it".
  const store = storeWith([100, 102, 98, 101, 4000]);
  const out = evaluateMetric(store, 'DREAMS', 'screen_revenue');
  assert.equal(out.isAnomaly, true);
  assert.equal(out.routedTo, null);
  assert.equal(store.alerts.length, 1, 'unrouted is not unrecorded');
});

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

test('alerts are filterable by app and by who they were routed to', () => {
  const store = createMetricsStore();
  const seed = (app, metric, values) => values.forEach((v, i) => ingestMetric(store,
    { app, metric, value: v, timestamp: Date.now() + i }));

  seed('A', 'm', [100, 102, 98, 101, 4000]);
  seed('B', 'm', [10, 11, 9, 10, 900]);
  evaluateMetric(store, 'A', 'm', { category: 'financial' });
  evaluateMetric(store, 'B', 'm', { category: 'security' });

  assert.equal(getAlerts(store).length, 2);
  assert.equal(getAlerts(store, { app: 'A' }).length, 1);
  assert.equal(getAlerts(store, { routedTo: 'Qvan' })[0].app, 'B');
  assert.equal(getAlerts(store, { app: 'A', routedTo: 'Qvan' }).length, 0, 'filters combine');
});

test('getAlerts refuses a store that is not one', () => {
  assert.throws(() => getAlerts(null), /requires a metricsStore/);
  assert.throws(() => getAlerts({ events: [] }), /requires a metricsStore/);
});
