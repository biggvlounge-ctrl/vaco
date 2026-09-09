// VACO -- the client every app uses to record an operator-grade
// decision in vaco-audit.
//
// **Fails hard, and that is the argument.** Everywhere else in this
// ecosystem a cross-app call is best-effort: `pushMetric` swallows its
// errors on purpose, because a fractional-share purchase should not be
// held up by analytics being down. The posture is "fail soft on
// signals, hard on money."
//
// A decision record is on the money side of that line, and further
// along it than money usually is. A transfer that fails can be retried;
// an *unattributed settlement* cannot be repaired after the fact,
// because the fact is exactly what was lost. So:
//
//   > **Record before deciding, and refuse to decide if you cannot
//   > record.**
//
// The record is written first and the decision runs only if it lands.
// That ordering is the whole point -- writing afterwards means a crash
// between the two leaves a decision nobody can attribute, which is the
// state this service exists to end.
//
// **The cost, stated plainly:** vaco-audit becomes a hard dependency of
// every group-2 route. If it is down, settlements stop. That is a real
// availability tradeoff and the reason `VACO_AUDIT_MODE` exists, with
// exactly the three settings `serviceAuth` already established:
//
//   enforce   (default) no record, no decision
//   observe   record if you can, proceed either way, count the misses
//   off       do not record at all
//
// `observe` is the tool for onboarding a new app or riding out an
// incident -- not a resting state. An audit log with silent gaps is
// worse than none, because the gaps are invisible in the log itself;
// `describe()` is what makes them visible.

const DEFAULT_URL = 'http://localhost:8819';
const MODES = ['enforce', 'observe', 'off'];
const DEFAULT_MODE = 'enforce';

function readMode(env = process.env) {
  const raw = env.VACO_AUDIT_MODE;
  if (raw === undefined || raw === '') return DEFAULT_MODE;
  if (!MODES.includes(raw)) {
    throw new Error(`VACO_AUDIT_MODE must be one of ${MODES.join(', ')} (got "${raw}")`);
  }
  return raw;
}

class DecisionNotRecordedError extends Error {}

function createDecisionLog(options = {}) {
  const {
    app,
    url = process.env.VACO_AUDIT_URL || DEFAULT_URL,
    mode = readMode(),
    serviceName = process.env.VACO_SERVICE_NAME || app,
    serviceToken = process.env.VACO_SERVICE_TOKEN || '',
    fetchFn = globalThis.fetch,
    timeoutMs = 3000,
  } = options;

  if (!app) throw new Error('createDecisionLog requires the recording app name');

  let recorded = 0;
  const missed = [];

  // Record one decision. Throws in `enforce` if the record does not
  // land -- callers are expected NOT to catch it, so the route 5xxs and
  // the decision does not happen.
  async function record(decision) {
    if (mode === 'off') return { recorded: false, mode };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${url}/api/decisions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(serviceToken
            ? { 'X-Service-Name': serviceName, 'X-Service-Token': serviceToken }
            : {}),
        },
        body: JSON.stringify({ app, ...decision }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new DecisionNotRecordedError(
          body.error || `vaco-audit refused the record (${res.status})`,
        );
      }
      recorded += 1;
      return { recorded: true, mode, id: body.id };
    } catch (err) {
      const reason = err.name === 'AbortError'
        ? `vaco-audit did not answer within ${timeoutMs}ms`
        : err.message;

      if (mode === 'enforce') {
        // Deliberately not wrapped in a generic 502: the caller's own
        // error handler turns this into a response, and the message has
        // to say why a settlement was refused for a reason that has
        // nothing to do with the settlement.
        throw new DecisionNotRecordedError(
          `refusing to proceed: this decision could not be recorded (${reason}). `
          + 'Set VACO_AUDIT_MODE=observe to proceed without attribution.',
        );
      }
      // observe: proceed, but keep the miss visible.
      missed.push({ route: decision.route, reason, at: Date.now() });
      if (missed.length > 100) missed.shift();
      return { recorded: false, mode, reason };
    } finally {
      clearTimeout(timer);
    }
  }

  // Surfaced on each app's own /api/health, so an `observe` window with
  // real gaps in it is visible from outside rather than only in a log.
  function describe() {
    return {
      mode,
      url,
      recorded,
      missed: missed.length,
      recentMisses: missed.slice(-5),
    };
  }

  return { record, describe, mode };
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  readMode,
  DecisionNotRecordedError,
  createDecisionLog,
};
