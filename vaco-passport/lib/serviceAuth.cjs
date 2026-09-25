// VACO — the trusted-service allowlist.
//
// **This file is the source. Do not edit the copies.**
// `./sync-shared-runtime.sh` places it, same as `shieldAuth.js` and for
// the same reason: `deploy/Dockerfile.node` builds each app from its own
// directory, so a require reaching outside it resolves in development
// and fails in the container.
//
// **Generalised from V3, where it was built and proven.** The env vars
// were `V3_SERVICE_*` because V3 was the only consumer; the mechanism
// was never V3-specific. `ROUTE_AUTHORIZATION_AUDIT.md` §3B found four
// more services in exactly V3's position — VACA, VACO Analytics, VACO
// Notify and VACON all accept writes from other apps with no end-user
// session, and accepted them from anyone.
//
// **One allowlist, ecosystem-wide.** A caller holds one token and
// presents it to every internal service it talks to. Per-caller-
// per-target tokens would be N×M secrets to rotate, and the thing being
// proven is "I am void", not "I am void talking to V3".
//
// Closes the gap `lib/shieldAuth.js:46` named and deliberately left
// open: `optionalOwnAccount` stops a token-bearing caller from
// impersonating another user, but a request with **no** Authorization
// header at all passes straight through. That is not an oversight in
// that file -- most of V3's real transfer volume is server-to-server
// (pack-opening charges, referral bonuses, VEX settlement) with no
// end-user session to present. Requiring a session everywhere would
// 401 every one of those integrations.
//
// So the missing piece is a second way to be authorized: not "I am
// this user" but "I am this service." A caller presents
// `X-Service-Name` and `X-Service-Token`; the token is checked against
// a per-service secret held in env.
//
// **Per-service tokens, not one shared secret.** One secret shared by
// eighteen callers cannot be rotated without coordinating eighteen
// deploys, and a leak from any one of them compromises all of them.
// Separate tokens mean a compromised service is revoked on its own.
//
// **Three modes, because a hard flip would break production.**
//
//   off      -- no service checking at all. The old behavior exactly.
//   observe  -- unauthenticated calls are ALLOWED and recorded. This
//               is the migration tool: run it, read `GET /api/health`,
//               and you get the real list of which callers still need
//               wiring, from live traffic rather than from grepping.
//   enforce  -- (default) unauthenticated mutating calls are rejected 401.
//
// **The default is `enforce`, and this paragraph used to say
// `observe`.** It was written while the migration was in front of us
// and never corrected when the constant below was set; the constant is
// the truth and the prose was wrong for the whole life of the file.
// The migration it describes is finished — every caller is wired and
// `.env.example` carries an entry for all 27 — so `observe` is now the
// deliberate step *backwards* you take to debug a 401, not the state
// you deploy in. Left in place because that debugging use is real.
//
// **This does not replace the Shield actor check.** They answer
// different questions and both still run: service auth says the caller
// is a known internal service, `requireActor` says a session-bearing
// caller is not impersonating someone else. A request carrying a valid
// user session is already authorized and does not need a service token.
//
// The composition is `actorOrService(field)` — see v3/server.js, which
// is the reference implementation.

const crypto = require('crypto');

const MODES = new Set(['off', 'observe', 'enforce']);

//: Flagged interpretive: no source document specifies a mode default.
//: `enforce` is chosen because every caller is now wired and a service
//: that starts without its token should refuse traffic rather than
//: quietly accept anonymous callers for however long nobody looks.
const DEFAULT_MODE = 'enforce';

//: Cap on remembered distinct unauthenticated callers. This is a
//: diagnostic, not an audit log -- it exists to answer "who still
//: needs wiring," which a few dozen entries answers completely. Left
//: unbounded it would be a slow memory leak fed by request headers,
//: which are attacker-controlled.
const MAX_TRACKED_CALLERS = 200;

function readMode(env = process.env) {
  const mode = (env.VACO_SERVICE_AUTH_MODE || DEFAULT_MODE).toLowerCase();
  if (!MODES.has(mode)) {
    throw new Error(`VACO_SERVICE_AUTH_MODE must be one of ${[...MODES].join(', ')} -- got "${mode}"`);
  }
  return mode;
}

// Parses `VACO_SERVICE_TOKENS="void:tokenA,voken:tokenB"` into a map.
// Malformed entries throw rather than being skipped: a typo that
// silently drops a service from the allowlist would show up later as
// a confusing 401 in production, and a startup error is far cheaper
// to diagnose than that.
function parseServiceTokens(raw) {
  const tokens = new Map();
  if (!raw || !raw.trim()) return tokens;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0 || idx === trimmed.length - 1) {
      throw new Error(`VACO_SERVICE_TOKENS entry "${trimmed}" must be "serviceName:token"`);
    }
    tokens.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
  }
  return tokens;
}

// Constant-time compare. A plain `===` on a secret leaks its prefix
// through timing, and this is cheap enough that there is no reason to
// accept that.
function tokensMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createServiceAuth(options = {}) {
  const env = options.env || process.env;
  const mode = options.mode || readMode(env);
  const tokens = options.tokens || parseServiceTokens(env.VACO_SERVICE_TOKENS);

  // name -> { count, firstSeenAt, lastSeenAt }
  const unauthenticatedCallers = new Map();

  function record(name) {
    const key = name || '(anonymous)';
    const existing = unauthenticatedCallers.get(key);
    const now = Date.now();
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      return;
    }
    if (unauthenticatedCallers.size >= MAX_TRACKED_CALLERS) return;
    unauthenticatedCallers.set(key, { count: 1, firstSeenAt: now, lastSeenAt: now });
  }

  // Returns 'user-session' | 'service' | 'unauthenticated'.
  function classify(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) return 'user-session';

    const name = req.headers['x-service-name'];
    const token = req.headers['x-service-token'];
    if (!name || !token) return 'unauthenticated';

    const expected = tokens.get(String(name));
    if (!expected) return 'unauthenticated';
    return tokensMatch(String(token), expected) ? 'service' : 'unauthenticated';
  }

  const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  function middleware(req, res, next) {
    if (mode === 'off') return next();

    const kind = classify(req);

    // **Identifying a caller and gating one are different jobs, and
    // this used to conflate them.** The early return for reads came
    // first, so `req.callingService` was never set on a GET — which
    // silently broke `actorOrService` in the one direction nobody
    // tested: a verified internal service asking a read route on a
    // user's behalf was refused as anonymous, because the property
    // that would have identified it was never written.
    //
    // Found by V4's `GET /api/calls` answering 401 to a credential
    // that had just been accepted on `POST /api/calls` one request
    // earlier. Same token, same allowlist, different verb.
    //
    // So: classify every request, gate only the mutating ones. The
    // posture below is unchanged — reads are still not gated here,
    // and a route that wants a read authorized still says so itself.
    if (kind === 'service') {
      req.callingService = String(req.headers['x-service-name']);
      return next();
    }

    // Reads are not gated. This layer exists to stop unauthorized
    // *writes*; balance lookups are already covered by whatever the
    // route itself requires.
    if (!MUTATING.has(req.method)) return next();

    if (kind === 'user-session') return next();

    record(req.headers['x-service-name']);
    if (mode === 'enforce') {
      return res.status(401).json({
        error: 'serviceAuth: this route requires either a user session (Authorization: Bearer) '
          + 'or a trusted-service credential (X-Service-Name + X-Service-Token).',
      });
    }
    return next();
  }

  function describe() {
    return {
      mode,
      allowlistedServices: [...tokens.keys()].sort(),
      // Deliberately reports names and counts, never tokens.
      unauthenticatedCallers: [...unauthenticatedCallers.entries()]
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.count - a.count),
      trackingCapReached: unauthenticatedCallers.size >= MAX_TRACKED_CALLERS,
    };
  }

  return { mode, middleware, describe, classify };
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  MAX_TRACKED_CALLERS,
  readMode,
  parseServiceTokens,
  tokensMatch,
  createServiceAuth,
};
