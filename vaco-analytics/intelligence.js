// VACO Analytics — Proactive Ecosystem Intelligence Layer.
// Source of truth: PROACTIVE_ECOSYSTEM_INTELLIGENCE_LAYER.md, "the
// proven 2026 architecture... a three-agent loop":
//
//   Data Collection Agent -> Pattern Learning Agent ->
//   Notification & Response Agent
//
// Data Collection Agent: no separate mechanism is built here — the
// doc's own field list says it "reads the same real-time data already
// flowing into VACO Analytics," which is exactly metricsStore.js's
// `events` array from Phase 1. Building a second collection pipeline
// on top of an already-real one would be duplicated work, not a
// missing piece.
//
// Pattern Learning Agent: computeBaseline() / detectAnomaly() below.
// Notification & Response Agent: routeAlert() / evaluateMetric() below.
//
// No specific anomaly-detection formula, and no alert-routing table
// beyond the doc's three explicitly named examples (a financial
// variance -> Leslie, a compliance flag -> Deskins, a security
// anomaly -> Qvan), is given in any source doc. What's implemented is
// a real, deterministic, testable z-score baseline detector —
// flagged as an interpretive choice, same honesty as every other
// undocumented formula in this project (e.g. VACON-C's territory
// thresholds, world-layer's propagation formula).

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeBaseline(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('computeBaseline requires a non-empty array of values');
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return { mean: round2(mean), stddev: round2(stddev), count: values.length };
}

export function detectAnomaly(value, baseline, options = {}) {
  const { threshold = 2 } = options;

  if (typeof value !== 'number') {
    throw new Error('detectAnomaly requires a numeric value');
  }
  if (!baseline || typeof baseline.mean !== 'number' || typeof baseline.count !== 'number') {
    throw new Error('detectAnomaly requires a baseline from computeBaseline');
  }

  // Fewer than 3 historical points isn't enough to trust a mean/stddev
  // -- flagged as "not enough data yet" rather than a false anomaly.
  if (baseline.count < 3) {
    return { isAnomaly: false, zScore: null, reason: 'insufficient_baseline_data' };
  }

  if (baseline.stddev === 0) {
    const isAnomaly = value !== baseline.mean;
    return {
      isAnomaly,
      zScore: isAnomaly ? null : 0,
      reason: isAnomaly ? 'zero_variance_deviation' : null,
    };
  }

  const zScore = round2((value - baseline.mean) / baseline.stddev);
  const isAnomaly = Math.abs(zScore) >= threshold;
  return { isAnomaly, zScore, reason: isAnomaly ? 'z_score_threshold' : null };
}

// The doc's own three named examples -- not a general-purpose category
// system. A category outside this list is a real "no one is named for
// this yet" case, not an error.
const ALERT_ROUTES = {
  financial: 'Leslie',
  compliance: 'Deskins',
  security: 'Qvan',
};

export function routeAlert(category) {
  const routedTo = ALERT_ROUTES[category] || null;
  return { category, routedTo, reason: routedTo ? null : 'no agent mapped for this category' };
}

export function evaluateMetric(store, app, metric, options = {}) {
  if (!store || !Array.isArray(store.events)) {
    throw new Error('evaluateMetric requires a metricsStore');
  }
  const { category = null, threshold = 2 } = options;

  const events = store.events
    .filter((e) => e.app === app && e.metric === metric)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (events.length < 4) {
    return { app, metric, evaluated: false, reason: 'insufficient_data', isAnomaly: false };
  }

  const latest = events[events.length - 1];
  const history = events.slice(0, -1).map((e) => e.value);
  const baseline = computeBaseline(history);
  const detection = detectAnomaly(latest.value, baseline, { threshold });

  const result = {
    app,
    metric,
    value: latest.value,
    timestamp: latest.timestamp,
    baseline,
    ...detection,
    evaluated: true,
    category,
    routedTo: null,
  };

  if (!detection.isAnomaly) {
    return result;
  }

  if (category) {
    result.routedTo = routeAlert(category).routedTo;
  }
  result.id = store.nextAlertId++;
  store.alerts.push(result);
  return result;
}

export function getAlerts(store, options = {}) {
  if (!store || !Array.isArray(store.alerts)) {
    throw new Error('getAlerts requires a metricsStore');
  }
  const { app, routedTo } = options;
  return store.alerts.filter(
    (a) => (app ? a.app === app : true) && (routedTo ? a.routedTo === routedTo : true)
  );
}

export { ALERT_ROUTES };
