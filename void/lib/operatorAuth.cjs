// VACO -- the guard every group-2 route uses to demand a *person*.
//
// `requireCallingService()` closed those routes to strangers by proving
// the caller was a known service. This is the next question: **which
// person decided this?** A service token cannot answer it, and per
// `dev-docs/OPERATOR_ROLES_SCOPE.md` §3.6 it is not allowed to try --
// there is deliberately **no service-token fallback** on a route
// guarded here.
//
//   > A compromised service should never carry operator authority.
//
// That is the whole reason this is a separate middleware rather than a
// third branch inside `actorOrService`. A fallback would be used, and
// then every route would quietly be back to being service-openable.
//
// **Fails closed, loudly.** If vaco-operator is unreachable, requests
// are refused rather than admitted -- same posture as the decision log,
// and for the same reason: these routes move money and grant
// credentials. `VACO_OPERATOR_MODE` exists for the same three-value
// reason `serviceAuth` and `decisionLog` have one, and `observe` here
// is far more dangerous than it is there, so it says so out loud.

const DEFAULT_URL = 'http://localhost:8820';
const MODES = ['enforce', 'observe', 'off'];
const DEFAULT_MODE = 'enforce';

function readMode(env = process.env) {
  const raw = env.VACO_OPERATOR_MODE;
  if (raw === undefined || raw === '') return DEFAULT_MODE;
  if (!MODES.includes(raw)) {
    throw new Error(`VACO_OPERATOR_MODE must be one of ${MODES.join(', ')} (got "${raw}")`);
  }
  return raw;
}

function createOperatorAuth(options = {}) {
  const {
    url = process.env.VACO_OPERATOR_URL || DEFAULT_URL,
    mode = readMode(),
    serviceName = process.env.VACO_SERVICE_NAME || '',
    serviceToken = process.env.VACO_SERVICE_TOKEN || '',
    fetchFn = globalThis.fetch,
    timeoutMs = 3000,
  } = options;

  let allowed = 0;
  let refused = 0;
  const unreachable = [];

  // Guard a route on one scope. The scope is a literal, written at the
  // route: `requireOperator('vago:settle')`. vaco-operator knows the
  // full list and reports `misconfigured` for anything it does not
  // recognise, so a typo is a loud 500 rather than a permission that
  // silently never matches -- the §5d failure class, applied here
  // because an authorization typo is the worst place for it.
  function requireOperator(scope) {
    if (typeof scope !== 'string' || !scope.includes(':')) {
      throw new Error(`requireOperator needs an "<app>:<action>" scope, got ${JSON.stringify(scope)}`);
    }

    return async function operatorGuard(req, res, next) {
      if (mode === 'off') return next();

      const credential = req.headers['x-operator-credential'];
      if (!credential) {
        refused += 1;
        return res.status(401).json({
          error: `${scope} required: this route decides an outcome somebody loses, so it needs a `
            + 'human operator credential (X-Operator-Credential). A service token is not sufficient '
            + 'and there is no fallback.',
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let verdict;
      try {
        const response = await fetchFn(`${url}/api/verify`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(serviceToken
              ? { 'X-Service-Name': serviceName, 'X-Service-Token': serviceToken }
              : {}),
          },
          body: JSON.stringify({ credential, scope }),
        });
        if (!response.ok) throw new Error(`vaco-operator answered ${response.status}`);
        verdict = await response.json();
      } catch (err) {
        const reason = err.name === 'AbortError'
          ? `vaco-operator did not answer within ${timeoutMs}ms`
          : err.message;
        unreachable.push({ scope, reason, at: Date.now() });
        if (unreachable.length > 50) unreachable.shift();

        if (mode === 'enforce') {
          // Fail closed. An authorization service being down is not
          // permission; treating it as permission is how an outage
          // becomes an incident.
          refused += 1;
          return res.status(503).json({
            error: `cannot verify operator authority for ${scope} (${reason}). Refusing rather than `
              + 'assuming permission.',
          });
        }
        allowed += 1;
        req.operator = { operatorName: 'unverified', scope, mode: 'observe' };
        return next();
      } finally {
        clearTimeout(timer);
      }

      // A route guarding on a scope vaco-operator does not know is a bug
      // in the route, not a denied request. 500, so it is findable.
      if (verdict.misconfigured) {
        refused += 1;
        return res.status(500).json({
          error: `${scope} is not a known operator scope -- this route is misconfigured. `
            + 'Add it to SCOPES in vaco-operator/lib/operators.js if it is real.',
        });
      }
      if (!verdict.ok) {
        refused += 1;
        return res.status(403).json({ error: `${scope} required -- ${verdict.reason}` });
      }

      allowed += 1;
      // Handed to the route so it can put a *name* in the audit log
      // rather than a service token. This is the point of the exercise:
      // `decidedBy: req.operator.operatorName`.
      req.operator = verdict;
      return next();
    };
  }

  function describe() {
    return {
      mode,
      url,
      allowed,
      refused,
      unreachable: unreachable.length,
      recentUnreachable: unreachable.slice(-5),
    };
  }

  return { requireOperator, describe, mode };
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  readMode,
  createOperatorAuth,
};
