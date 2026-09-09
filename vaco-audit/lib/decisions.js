// VACO AUDIT — the decision log.
//
// **What this is for.** The authorization sweep closed ~26 routes that
// `dev-docs/OPERATOR_ROLES_SCOPE.md` calls "decisions with a loser":
// settling a sports event, grading a bet, drawing a raffle, resolving a
// market, approving an ad, sighting a licence, distributing revenue.
// Somebody is worse off after each one, and a specific person decided
// it.
//
// Today the honest answer to *"who settled this event"* is "a service
// token — we don't know which person." That is the gap this closes, and
// it closes ahead of the operator-role work rather than after it,
// because attribution is useful the moment it exists and does not
// depend on any of the role decisions being made.
//
// **Append-only, and that is the whole design.** There is no update and
// no delete, here or in the HTTP layer. An audit trail the audited
// party can edit is not evidence — the same principle VOID's
// `recordVetting` already states about `verifiedBy` ("a result nobody
// can be traced back to is not evidence") and the same reason the
// custody chain on a regulated box is service-only. A separate service
// rather than a table in each app is what makes "cannot rewrite" a
// property of the architecture instead of a promise.
//
// **What a record is NOT.** Not a metric (that is vaco-analytics), not
// an alert (that is vaco-notify), and not a general application log.
// One row per irreversible decision, with enough on it to answer a
// dispute six months later without reading application logs that have
// long rotated away.

class DecisionError extends Error {}

// The decision's own vocabulary, deliberately small. A free-text
// `action` would drift into a hundred spellings of the same six things
// and make the log unqueryable, which is the failure mode of every
// audit table that gets built and then never read.
const OUTCOME_KINDS = [
  'settlement',      // money moved as a result of a decided outcome
  'grade',           // a claim was assessed: won/lost, pass/fail
  'credential',      // asserted -> verified, or a credential revoked
  'enforcement',     // suspension, takedown, removal
  'state-change',    // a lifecycle step that gates a later payout
  'reversal',        // a refund or an undo of a prior decision
];

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DecisionError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

// **Redaction happens on the way in, not on the way out.** A decision
// body can carry a credential, a token, or a password if a caller is
// careless, and an append-only store has no way to take it back. So the
// filter runs before anything is written. Keys are matched loosely on
// purpose -- `X-Service-Token`, `serviceToken` and `token` all go.
const SENSITIVE_KEY = /(token|secret|password|credential|authorization|apikey|api_key)/i;
const MAX_INPUT_BYTES = 4096;

function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function boundedInputs(inputs, action) {
  const redacted = redact(inputs ?? {});
  const encoded = JSON.stringify(redacted);
  if (encoded === undefined) {
    throw new DecisionError(`${action}: inputs must be JSON-serialisable`);
  }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_INPUT_BYTES) {
    // Refused rather than truncated: a silently truncated record reads
    // as complete and is worse than one that never existed.
    throw new DecisionError(
      `${action}: inputs exceed ${MAX_INPUT_BYTES} bytes -- record the identifiers, not the payload`,
    );
  }
  return redacted;
}

// Record one decision.
//
// `decidedBy` is who, and it is required with no default. That is the
// point of the whole module: a record that cannot name a decider is not
// evidence, and defaulting it to 'system' or the calling service would
// manufacture exactly the false comfort this exists to remove.
function recordDecision(store, options = {}) {
  const {
    app, route, outcomeKind, subjectType, subjectId,
    decidedBy, decidedByKind = 'service', inputs = {},
    reason = null, recordedByService = null, now = Date.now(),
  } = options;

  const a = 'recordDecision';
  if (!OUTCOME_KINDS.includes(outcomeKind)) {
    throw new DecisionError(`${a}: outcomeKind must be one of ${OUTCOME_KINDS.join(', ')}`);
  }
  if (!['operator', 'service'].includes(decidedByKind)) {
    throw new DecisionError(`${a}: decidedByKind must be 'operator' or 'service'`);
  }

  const record = {
    id: store.nextDecisionId++,
    app: requireString(app, 'app', a),
    route: requireString(route, 'route', a),
    outcomeKind,
    subjectType: requireString(subjectType, 'subjectType', a),
    subjectId: requireString(String(subjectId ?? ''), 'subjectId', a),
    decidedBy: requireString(decidedBy, 'decidedBy', a),
    // **Recorded, not inferred.** Until operator credentials exist every
    // row is `service`, and that is the honest state of the world rather
    // than a gap: the log says "a service token decided this, here is
    // which one." When operator credentials arrive the same rows start
    // carrying `operator`, and the difference is queryable — which is
    // how you find routes that were never migrated.
    decidedByKind,
    inputs: boundedInputs(inputs, a),
    reason: reason === null ? null : requireString(reason, 'reason', a),
    // Which credential carried the record, from the verified service
    // token rather than the body. `decidedBy` is a claim; this is a
    // fact. Today they usually agree, and the value of keeping both is
    // that later they might not -- a row where a `vago` token reports a
    // decision `decidedBy` a VOID operator is worth looking at.
    recordedByService: recordedByService === null ? null : String(recordedByService),
    recordedAt: now,
  };

  store.decisions.push(record);
  return record;
}

function getDecision(store, decisionId) {
  return store.decisions.find((d) => d.id === decisionId) || null;
}

// Query. The shapes a dispute actually arrives in: "what happened to
// this record", "what did this person decide", "what did this app
// decide this week".
function queryDecisions(store, options = {}) {
  const {
    app = null, route = null, outcomeKind = null,
    subjectType = null, subjectId = null, decidedBy = null,
    decidedByKind = null, since = null, until = null, limit = 100,
  } = options;

  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new DecisionError('queryDecisions: limit must be an integer between 1 and 1000');
  }

  const eq = (field, want) => want === null || field === want;
  return store.decisions
    .filter((d) => eq(d.app, app)
      && eq(d.route, route)
      && eq(d.outcomeKind, outcomeKind)
      && eq(d.subjectType, subjectType)
      && eq(d.subjectId, subjectId === null ? null : String(subjectId))
      && eq(d.decidedBy, decidedBy)
      && eq(d.decidedByKind, decidedByKind)
      && (since === null || d.recordedAt >= since)
      && (until === null || d.recordedAt <= until))
    .sort((x, y) => y.recordedAt - x.recordedAt)
    .slice(0, limit);
}

// The one question this service exists to answer, as a first-class
// call rather than a query the caller has to compose correctly.
function historyFor(store, subjectType, subjectId) {
  return store.decisions
    .filter((d) => d.subjectType === subjectType && d.subjectId === String(subjectId))
    .sort((x, y) => x.recordedAt - y.recordedAt);
}

// Coverage, for the migration this log is meant to survive: how much of
// the decision volume is still attributed to a service rather than a
// person. Goes to 0% as operator credentials roll out, and is the
// honest progress metric for that work.
function describeCoverage(store) {
  const total = store.decisions.length;
  const byOperator = store.decisions.filter((d) => d.decidedByKind === 'operator').length;
  const apps = [...new Set(store.decisions.map((d) => d.app))].sort();
  return {
    totalDecisions: total,
    attributedToOperator: byOperator,
    attributedToService: total - byOperator,
    operatorCoveragePercent: total === 0 ? 0 : Math.round((byOperator / total) * 100),
    reportingApps: apps,
  };
}

module.exports = {
  DecisionError,
  OUTCOME_KINDS,
  MAX_INPUT_BYTES,
  recordDecision,
  getDecision,
  queryDecisions,
  historyFor,
  describeCoverage,
};
