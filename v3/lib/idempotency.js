// V3 -- idempotency for the money routes.
//
// **The bug this closes, stated concretely**: `POST /api/vcoin/transfer`
// had no request deduplication. Eighteen backend services call it over
// a network. A network is allowed to be slow, and a caller that times
// out and retries is behaving correctly -- so a retried transfer
// charged the payer twice, and nothing anywhere would notice. Same for
// `POST /api/vash/cashout`.
//
// This is the one gap in this ledger that produces silently wrong
// balances rather than a visible error, which is why it outranks
// everything else still open on V3.
//
// **The contract**: a caller sends `Idempotency-Key` (header) or
// `idempotencyKey` (body). The first request with that key executes
// and its result is stored. Every later request with the same key
// returns that stored result without executing again -- same status,
// same body, plus `idempotentReplay: true` so a caller can tell.
//
// **Deliberately opt-in, and honest about what that means.** A caller
// that sends no key gets the old behavior exactly: execute every time.
// Making the key mandatory would 400 every one of the eighteen live
// integrations on their next deploy. The protection is real for anyone
// who opts in, and the remaining exposure -- callers who never do -- is
// stated here rather than papered over. Wiring a key into each caller
// is real follow-up work, one call site at a time.
//
// **Scope guard, which matters more than it looks.** A key is recorded
// against the route it was used on and a fingerprint of the request
// body. Reusing one key for a different request is a caller bug, and a
// silent wrong answer would be worse than an error -- so it throws
// rather than replaying a result that does not correspond to what was
// asked. Same posture as the rest of this ledger: fail hard on money.

const crypto = require('crypto');

//: Flagged interpretive: no source document specifies a retention
//: window. 24 hours is the real convention (Stripe uses it) -- long
//: enough to cover any sane retry, short enough that the record does
//: not grow without bound. A replay attempted after expiry re-executes,
//: which is the correct failure direction: a duplicate charge a day
//: late is far less likely than a lost one.
const DEFAULT_RETENTION_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

class IdempotencyConflictError extends Error {}

// A stable fingerprint of what was actually asked. Key order is
// normalised so two logically identical bodies hash the same.
function fingerprint(route, body) {
  const stable = JSON.stringify(body, Object.keys(body || {}).sort());
  return crypto.createHash('sha256').update(`${route}\n${stable}`).digest('hex');
}

function readKey(req) {
  const header = req.headers['idempotency-key'];
  const bodyKey = (req.body || {}).idempotencyKey;
  const key = header || bodyKey || null;
  if (key !== null && (typeof key !== 'string' || key.trim() === '')) {
    throw new Error('Idempotency-Key must be a non-empty string');
  }
  return key;
}

function findRecord(store, key) {
  return store.idempotencyRecords.find((r) => r.key === key) || null;
}

// Drops expired records. Swept on use rather than on a timer, so the
// behavior is deterministic and a restart cannot lose a pending sweep
// -- the same posture VOID's retry sweep and V4's ring timeout already
// use.
function sweepExpired(store, now = Date.now()) {
  const before = store.idempotencyRecords.length;
  store.idempotencyRecords = store.idempotencyRecords.filter((r) => r.expiresAt > now);
  return before - store.idempotencyRecords.length;
}

// Express middleware. On a replay it responds directly and never calls
// next(), so the handler underneath does not run and no money moves.
function idempotent(routeName, options = {}) {
  const { retentionHours = DEFAULT_RETENTION_HOURS } = options;
  return (req, res, next) => {
    let key;
    try {
      key = readKey(req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!key) return next();

    const store = req.app.get('v3Store');
    if (!store) return next();
    const now = Date.now();
    sweepExpired(store, now);

    const print = fingerprint(routeName, req.body || {});
    const existing = findRecord(store, key);

    if (existing) {
      if (existing.fingerprint !== print) {
        return res.status(422).json({
          error: `Idempotency-Key "${key}" was already used for a different request on ${existing.route}. `
            + 'Reusing a key with a changed body is a caller bug -- use a new key.',
        });
      }
      return res.status(existing.status).json({ ...existing.body, idempotentReplay: true });
    }

    // Capture the handler's response so a later replay can return it
    // verbatim. Only successful results are recorded: a failed request
    // is not a completed operation, and a caller retrying after a
    // genuine failure should be allowed to succeed.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.idempotencyRecords.push({
          key,
          route: routeName,
          fingerprint: print,
          status: res.statusCode,
          body,
          createdAt: now,
          expiresAt: now + retentionHours * MS_PER_HOUR,
        });
      }
      return originalJson(body);
    };
    return next();
  };
}

function describeIdempotency(store) {
  return {
    enabled: true,
    mode: 'opt-in',
    header: 'Idempotency-Key',
    bodyField: 'idempotencyKey',
    retentionHours: DEFAULT_RETENTION_HOURS,
    storedKeys: store ? store.idempotencyRecords.length : 0,
  };
}

module.exports = {
  DEFAULT_RETENTION_HOURS,
  IdempotencyConflictError,
  fingerprint,
  readKey,
  findRecord,
  sweepExpired,
  idempotent,
  describeIdempotency,
};
