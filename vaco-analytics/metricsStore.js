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

  const matches = store.events.filter((e) => e.app === app && e.metric === metric);
  if (matches.length === 0) {
    return { app, metric, count: 0, sum: 0, avg: 0, min: null, max: null, latest: null };
  }

  const values = matches.map((e) => e.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const latestEvent = matches.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));

  return {
    app,
    metric,
    count: matches.length,
    sum: Math.round(sum * 100) / 100,
    avg: Math.round((sum / matches.length) * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    latest: latestEvent.value,
  };
}

export function getApps(store) {
  return [...new Set(store.events.map((e) => e.app))].sort();
}

export function getMetricNames(store, app) {
  return [...new Set(store.events.filter((e) => e.app === app).map((e) => e.metric))].sort();
}

export function getEcosystemSnapshot(store) {
  return getApps(store).map((app) => ({
    app,
    metrics: getMetricNames(store, app).map((metric) => getSummary(store, app, metric)),
  }));
}
