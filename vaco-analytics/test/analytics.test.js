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

// **The snapshot is the dashboard query, and it was rewritten for
// speed.** It used to call `getApps`, then `getMetricNames` per app,
// then `getSummary` per pair — `1 + A + A*M` full scans of the event
// array, 217 of them at 36 apps with 5 metrics each, measured at
// 1592 ms on a 360k-event store. One grouped pass does it in 53 ms.
//
// "Faster and equivalent" is two claims, and only the first one is
// easy to check. So this asserts the second against the per-series
// functions the rewrite replaced: for every app and metric, the
// snapshot must carry exactly what `getSummary` computes for that
// pair, and the apps and metrics must be the same sorted lists
// `getApps`/`getMetricNames` return. Those still exist and are still
// used by the single-series routes, so they are a live oracle rather
// than a copy of the old code kept around for the test.
test('the snapshot matches what the per-series functions compute, series by series', () => {
  const store = createMetricsStore();
  // Names chosen to make the ordering assertions do work: 'b' before
  // 'a' on ingest, an app whose name sorts after its metrics, and two
  // apps sharing a metric name.
  const rows = [
    ['b-app', 'zeta', 5, 3], ['b-app', 'alpha', 1, 1], ['a-app', 'zeta', -2, 2],
    ['a-app', 'zeta', 9.005, 5], ['a-app', 'alpha', 0, 4], ['b-app', 'alpha', 7, 9],
    ['a-app', 'zeta', 0, 8], ['c-app', 'only', 42, 6],
  ];
  for (const [app, metric, value, timestamp] of rows) {
    ingestMetric(store, { app, metric, value, timestamp });
  }

  const snapshot = getEcosystemSnapshot(store);
  assert.deepEqual(snapshot.map((s) => s.app), getApps(store),
    'the snapshot lists different apps, or in a different order, than getApps');

  for (const entry of snapshot) {
    assert.deepEqual(entry.metrics.map((m) => m.metric), getMetricNames(store, entry.app),
      `${entry.app}: the snapshot's metrics differ from getMetricNames`);
    for (const m of entry.metrics) {
      assert.deepEqual(m, getSummary(store, entry.app, m.metric),
        `${entry.app}/${m.metric}: the snapshot and getSummary disagree`);
    }
  }
});

// **A series large enough to crash the old code.** `getSummary` did
// `Math.min(...values)`, which passes one argument per element, and
// that is a stack limit: bisected, ~125,375 events worked and ~126,929
// threw `RangeError: Maximum call stack size exceeded`. Nothing bounds
// how many events one metric accumulates, so a metric posted every few
// seconds reaches it in weeks — and it took the dashboard down with
// it, because the snapshot summarises every series.
//
// Pushed directly rather than through `ingestMetric` to keep the test
// under a second; the arithmetic being checked does not care how the
// rows arrived.
test('a series far past the argument limit summarises instead of crashing', () => {
  const store = createMetricsStore();
  const n = 200000;
  for (let i = 0; i < n; i++) {
    store.events.push({ id: i + 1, app: 'a', metric: 'm', value: i % 17, timestamp: 1000 + i });
  }
  store.nextEventId = n + 1;

  const summary = getSummary(store, 'a', 'm');
  assert.equal(summary.count, n);
  assert.equal(summary.min, 0);
  assert.equal(summary.max, 16);
  assert.equal(summary.latest, (n - 1) % 17);

  // And through the dashboard query, which is where it actually broke.
  const snapshot = getEcosystemSnapshot(store);
  assert.deepEqual(snapshot[0].metrics[0], summary);
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

// ---------------------------------------------------------------------------
// One alert per episode — the "cries wolf" half of the header's warning
// ---------------------------------------------------------------------------

// **Measured before the fix: 125 pages to a named human for one
// event.** A metric that steps to a new normal and stays there was
// evaluated once per reading, and each reading was flagged, filed into
// `store.alerts`, and POSTed to vaco-notify. The z-score decays as the
// new level dilutes the baseline (140 -> 3.5 -> 2.47 -> 2.02 -> 1.74),
// so it stops eventually — the worst shape for this failure, because it
// self-heals just slowly enough that nobody treats it as a bug.
//
// This file's own preamble names the failure: "an anomaly detector that
// either cries wolf or — much worse — stays quiet." It stays quiet
// correctly, and cried wolf 125 times.
test('an ongoing anomaly is one alert with a count, not one per reading', () => {
  const store = createMetricsStore();
  let t = 1000;
  const ingest = (value) => {
    ingestMetric(store, { app: 'a', metric: 'm', value, timestamp: t });
    t += 60 * 1000; // a reading a minute, the cadence the cooldown assumes
  };
  const post = (value) => {
    ingest(value);
    return evaluateMetric(store, 'a', 'm', { category: 'financial' });
  };

  // The warm-up is ingested but not evaluated. Evaluating it files a
  // real alert of its own: five readings cycling 100..104 give a
  // baseline of three points tight enough that the fourth scores
  // z = 3.67. That is the detector working, not a defect, but it is a
  // different episode and it would be counted here.
  for (let i = 0; i < 60; i++) ingest(100 + (i % 5));

  const first = post(300);
  assert.equal(first.isAnomaly, true, 'the step to a new normal must still raise an alert');
  assert.equal(first.suppressed, false, 'the first alert of an episode must page somebody');
  assert.equal(first.occurrences, 1);
  assert.equal(store.alerts.length, 1);

  // Ten more readings at the new level, inside the cooldown.
  let paged = 0;
  for (let i = 0; i < 10; i++) {
    const r = post(300 + (i % 5));
    if (r.isAnomaly && !r.suppressed) paged += 1;
  }
  assert.equal(paged, 0, `${paged} further readings paged somebody during one episode`);
  assert.equal(store.alerts.length, 1, `one episode filed ${store.alerts.length} alerts`);

  // The single row carries the episode, not just its first reading.
  const alert = store.alerts[0];
  assert.equal(alert.occurrences, 11);
  assert.ok(alert.lastSeenAt > alert.firstSeenAt, 'the episode has no duration on it');
  assert.equal(alert.routedTo, 'Leslie', 'and it is still routed to the named person');
});

test('a fresh anomaly after the cooldown is a new alert, not a bump', () => {
  // Suppression must not swallow a genuinely separate incident. The
  // cooldown is measured against the event timestamp rather than the
  // wall clock, which is what makes this assertable at all.
  const store = createMetricsStore();
  let t = 1000;
  const post = (value, jumpMs = 60 * 1000) => {
    ingestMetric(store, { app: 'a', metric: 'm', value, timestamp: t });
    t += jumpMs;
    return evaluateMetric(store, 'a', 'm', { category: 'financial' });
  };

  // Warm-up ingested, not evaluated — same reason as the test above.
  for (let i = 0; i < 60; i++) {
    ingestMetric(store, { app: 'a', metric: 'm', value: 100 + (i % 5), timestamp: t });
    t += 60 * 1000;
  }
  const first = post(900, 16 * 60 * 1000); // then jump past the 15-minute cooldown
  assert.equal(first.suppressed, false);

  const later = post(4000);
  assert.equal(later.isAnomaly, true);
  assert.equal(later.suppressed, false, 'a separate incident an hour later was suppressed');
  assert.equal(store.alerts.length, 2);
  assert.notEqual(store.alerts[0].id, store.alerts[1].id);
});

test('the baseline is the recent normal, not every reading ever taken', () => {
  // **The unbounded baseline did not miss anomalies — checked, the
  // spike was still caught in every case — it reported a misleading
  // number on the page.** A metric that sat at ~100 for 5,000 readings
  // and moved to a new normal of ~300 an hour ago produced
  // `baseline mean 104.4`, telling whoever was paged that normal is
  // 104 while the metric had been at 300 all hour.
  const store = createMetricsStore();
  let t = 1000;
  for (let i = 0; i < 5000; i++) ingestMetric(store, { app: 'a', metric: 'm', value: 100 + (i % 5), timestamp: t++ });
  for (let i = 0; i < 60; i++) ingestMetric(store, { app: 'a', metric: 'm', value: 300 + (i % 5), timestamp: t++ });
  ingestMetric(store, { app: 'a', metric: 'm', value: 600, timestamp: t++ });

  const out = evaluateMetric(store, 'a', 'm');
  assert.equal(out.isAnomaly, true);
  assert.ok(out.baseline.mean > 295 && out.baseline.mean < 305,
    `the baseline reports ${out.baseline.mean} as normal; the metric has been at ~300 for an hour`);
  assert.equal(out.baseline.count, 50, 'the window is not the window the constant says it is');
});
