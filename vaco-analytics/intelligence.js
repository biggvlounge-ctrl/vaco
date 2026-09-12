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

//: Flagged interpretive, like the z-score itself: no source doc sets a
//: baseline window. The baseline used every reading ever recorded,
//: and that is wrong in a way that shows up as a misleading number on
//: an alert rather than as a missed one. Measured on a metric that sat
//: at ~100 for 5,000 readings and then moved to a new normal of ~300
//: sixty readings ago: the spike to 600 was still caught, but the
//: alert reported `baseline mean 104.4` — an operator reading that
//: page is told normal is 104 when the metric has been at 300 all
//: hour.
//:
//: 50 readings is long enough for a stable stddev and short enough
//: that a genuine level change becomes the new normal within an hour
//: at a one-minute cadence.
const BASELINE_WINDOW = 50;

//: Also interpretive. **A metric that steps to a new normal and stays
//: there paged a named human 125 times for one event** — measured, 200
//: readings at the new level, 125 of them flagged, each one persisted
//: into `store.alerts` and each one POSTed to vaco-notify. The z-score
//: decays as the new level dilutes the baseline (140 -> 3.5 -> 2.47 ->
//: 2.02 -> 1.74) so it stops eventually, which is the worst shape for
//: this failure: it self-heals just slowly enough that nobody treats
//: it as a bug.
//:
//: So an ongoing anomaly is one alert with a count on it, not one
//: alert per reading. 15 minutes is the window, measured against the
//: event's own timestamp rather than the wall clock so evaluation
//: stays deterministic and testable.
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

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
  // The most recent `BASELINE_WINDOW` readings before the latest, not
  // every reading ever taken — see the constant for what the
  // unbounded version reported on a metric whose normal had moved.
  const history = events.slice(Math.max(0, events.length - 1 - BASELINE_WINDOW), -1)
    .map((e) => e.value);
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

  // **One alert per episode, with a count — not one per reading.**
  // The caller reads `suppressed` to decide whether to page: an
  // ongoing condition is already on somebody's desk, and paging again
  // every reading is how a channel becomes noise nobody reads (which
  // `notifyAnomaly` in server.js says in its own comment about
  // evaluating healthy metrics, and then did anyway for unhealthy
  // ones).
  //
  // The open alert is searched from the end: it is the most recent one
  // for this series, and alerts are appended in order.
  let open = null;
  for (let i = store.alerts.length - 1; i >= 0; i--) {
    const a = store.alerts[i];
    if (a.app === app && a.metric === metric) { open = a; break; }
  }

  if (open && latest.timestamp - open.lastSeenAt <= ALERT_COOLDOWN_MS) {
    // Update the episode in place rather than filing a second one. The
    // newest value and score are what an operator wants to see, and
    // `occurrences` is what tells them it is still happening.
    open.occurrences += 1;
    open.lastSeenAt = latest.timestamp;
    open.value = latest.value;
    open.zScore = detection.zScore;
    open.baseline = baseline;
    return { ...result, id: open.id, suppressed: true, occurrences: open.occurrences };
  }

  result.id = store.nextAlertId++;
  result.suppressed = false;
  result.occurrences = 1;
  result.firstSeenAt = latest.timestamp;
  result.lastSeenAt = latest.timestamp;
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
