// VACO Analytics — real-time metrics data layer.
// Source of truth: VACO_ANALYTICS_MANAGEMENT_DASHBOARD.md.
//
// The source doc recommends ClickHouse or VeloDB for this layer —
// real, purpose-built, high-volume event stores for sub-second
// queries across every app's activity. Neither is available in this
// sandboxed environment: no database provisioning, and (confirmed
// directly while building world-layer's UNESCO import) no outbound
// network access to a hosted instance either. This module is a real,
// working, in-memory substitute with the same read/write contract a
// ClickHouse-backed store would need — ingest an event, query by
// app/metric, aggregate — so swapping in a real client later means
// writing a new module against this same contract, not redesigning
// the API layer (server.js) that calls it.
//
// `app` and `metric` are free-form strings, not fixed enums — the
// source doc's own point is "each app's own genuinely relevant
// numbers, not one generic metric forced across all of them," so
// constraining either to a fixed list would contradict that.

export function createMetricsStore() {
  return { events: [], nextEventId: 1, alerts: [], nextAlertId: 1 };
}

export function ingestMetric(store, options = {}) {
  const { app, metric, value, timestamp } = options;

  if (!app) {
    throw new Error('ingestMetric requires an app');
  }
  if (!metric) {
    throw new Error('ingestMetric requires a metric');
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('ingestMetric requires a numeric value');
  }

  const event = {
    id: store.nextEventId++,
    app,
    metric,
    value,
    timestamp: timestamp ?? Date.now(),
  };

  store.events.push(event);
  return event;
}

export function getMetrics(store, app, metric, options = {}) {
  if (!app) {
    throw new Error('getMetrics requires an app');
  }
  const { limit = 100 } = options;
  if (typeof limit !== 'number' || limit <= 0) {
    throw new Error('getMetrics requires a positive numeric limit');
  }

  return store.events
    .filter((e) => e.app === app && (metric ? e.metric === metric : true))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getSummary(store, app, metric) {
  if (!app) {
    throw new Error('getSummary requires an app');
  }
  if (!metric) {
    throw new Error('getSummary requires a metric');
  }

  // **`Math.min(...values)` crashed this route, and the threshold is
  // low enough to reach.** Spreading an array into a call passes one
  // argument per element, and the engine's argument limit is a stack
  // limit: measured by bisection, a series of ~125,375 events works
  // and ~126,929 throws `RangeError: Maximum call stack size
  // exceeded`. Nothing here bounds how many events one metric can
  // accumulate, so a single app posting a metric every few seconds
  // reaches that in weeks — and it takes the whole dashboard down,
  // because `getEcosystemSnapshot` calls this for every series.
  //
  // One loop instead. It also removes the two extra passes the old
  // version made (`map` to values, `reduce` for the latest).
  let count = 0;
  let sum = 0;
  let min = null;
  let max = null;
  let latestEvent = null;
  // An indexed loop, not `for...of`: the iterator protocol measured
  // slower here than the native `filter` this replaced (12.4 ms against
  // 6.8 ms on a 360k-event store), which would have traded a fixed
  // crash for a slower common path. Indexed, it is 7.9 ms.
  const events = store.events;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.app !== app || e.metric !== metric) continue;
    count += 1;
    sum += e.value;
    if (min === null || e.value < min) min = e.value;
    if (max === null || e.value > max) max = e.value;
    if (latestEvent === null || e.timestamp > latestEvent.timestamp) latestEvent = e;
  }

  if (count === 0) {
    return { app, metric, count: 0, sum: 0, avg: 0, min: null, max: null, latest: null };
  }

  return {
    app,
    metric,
    count,
    sum: Math.round(sum * 100) / 100,
    avg: Math.round((sum / count) * 100) / 100,
    min,
    max,
    latest: latestEvent.value,
  };
}

export function getApps(store) {
  return [...new Set(store.events.map((e) => e.app))].sort();
}

export function getMetricNames(store, app) {
  return [...new Set(store.events.filter((e) => e.app === app).map((e) => e.metric))].sort();
}

// **The dashboard query, and it scanned the whole event array once per
// series.** Written as `getApps` then `getMetricNames` per app then
// `getSummary` per pair, it made `1 + A + A×M` full passes — 217 of
// them at 36 apps with 5 metrics each. Measured on this machine:
//
//    3,600 events    12 ms
//   36,000 events   102 ms
//  360,000 events  1592 ms
//
// One pass, grouping into a Map, gives the identical structure. The
// same-shaped output is asserted against the per-series form in
// `test/analytics.test.js` rather than assumed, because "faster and
// equivalent" is a claim worth checking.
export function getEcosystemSnapshot(store) {
  // `\u0000` as the key separator: an app or metric name could
  // otherwise contain whatever ordinary character was chosen and
  // collide two series into one. Both are free-form strings by design
  // (see this file's header), so the separator has to be one they
  // cannot contain.
  const series = new Map();
  for (const e of store.events) {
    const key = `${e.app}\u0000${e.metric}`;
    let s = series.get(key);
    if (s === undefined) {
      s = { app: e.app, metric: e.metric, count: 0, sum: 0, min: e.value, max: e.value, latest: e };
      series.set(key, s);
    }
    s.count += 1;
    s.sum += e.value;
    if (e.value < s.min) s.min = e.value;
    if (e.value > s.max) s.max = e.value;
    if (e.timestamp > s.latest.timestamp) s.latest = e;
  }

  const byApp = new Map();
  for (const s of series.values()) {
    if (!byApp.has(s.app)) byApp.set(s.app, []);
    byApp.get(s.app).push({
      app: s.app,
      metric: s.metric,
      count: s.count,
      sum: Math.round(s.sum * 100) / 100,
      avg: Math.round((s.sum / s.count) * 100) / 100,
      min: s.min,
      max: s.max,
      latest: s.latest.value,
    });
  }

  // Sorted the same way the per-series version was: apps by name, and
  // metrics within an app by name, because both came from a sorted
  // `Set`. Insertion order here is first-seen order, which is not the
  // same thing.
  return [...byApp.keys()].sort().map((app) => ({
    app,
    metrics: byApp.get(app).sort((a, b) => (a.metric < b.metric ? -1 : a.metric > b.metric ? 1 : 0)),
  }));
}
