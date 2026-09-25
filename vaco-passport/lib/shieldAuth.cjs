// VACO — the canonical Shield auth middleware.
//
// **This file is the source. Do not edit the copies.**
// `./sync-shared-runtime.sh` copies it to `<app>/lib/shieldAuth.js` in
// every backend that guards a route, and `--check` fails on drift.
// A copy per app is not a preference: `deploy/Dockerfile.node` builds
// with the *app directory* as its context, so a `require` reaching
// outside that directory would resolve in development and fail in the
// container. Same reason the design system is synced rather than
// imported.
//
// ---------------------------------------------------------------
// **What this replaces, and why it was urgent.**
//
// Every app previously carried its own copy of an `optionalOwnAccount`
// middleware whose first act was:
//
//     if (!token) return next();
//
// It was named honestly — it *is* optional — and its own header said
// so. But it was mounted **alone**, with no `requireSession` in front
// of it, on thirteen money-moving routes across ten apps. The result
// was not a subtle identity gap. It was no authentication at all:
//
//     curl -X POST localhost:8811/api/vcoin/transfer \
//       -d '{"fromUserId":"victim","toUserId":"attacker","amount":500}'
//     → 200, 500 VCoin moved
//
// That was run against this repository and it worked. An attacker did
// not need a stolen token — supplying *no* token was the bypass, since
// the guard only engaged for callers who volunteered one.
//
// ---------------------------------------------------------------
// **The three questions, kept separate.**
//
//   requireSession()          Is there a live Shield session?
//   requireActor(...fields)   Is that session the user this request
//                             claims to be acting as?
//   (service credentials)     Is this a known internal service acting
//                             on nobody's behalf? — V3 only, see
//                             v3/lib/serviceAuth.js
//
// `requireActor` is `requireSession` plus the identity match, because
// the two were separable before and every route that took the first
// without the second was a hole. They are no longer separable by
// accident: `requireActor` mounts both.
//
// **`optionalOwnAccount` is deliberately gone.** It is not deprecated,
// not a warning — the export throws at mount time with a message
// pointing here. A middleware that silently permits anonymous access
// should not remain available to be reached for by a future author, or
// re-introduced by a copy-paste from an older app.

const SHIELD_API_URL = process.env.SHIELD_API_URL || 'http://localhost:8812';

// **Shield answering "no" and Shield failing to answer are different,
// and the status is the only thing that separates them.**
//
// This used to parse the body and look at `body.valid` without ever
// consulting the status. That is correct when Shield refuses the
// connection -- fetch throws, `resolveSession` catches it and returns
// 502 -- but not when Shield *answers* with an error. A 503 from a load
// balancer carrying `{"error": "..."}` parses fine, has no `valid`
// field, and was therefore indistinguishable here from an expired
// token. The caller got 401: told their session had expired when it had
// not, which is precisely what the 502 branch below exists to prevent,
// and the likely shape of a real outage rather than an exotic one.
//
// **404 is not an outage.** Shield answers `404 {"valid": false}` for a
// token it does not know, which is an answer and must stay a 401. A
// blanket `if (!res.ok) throw` would turn every expired session in the
// ecosystem into a 502 -- checked against `shield/server.js` before
// writing this, because that mistake would break the most-travelled
// path in the system while looking like a hardening fix.
async function verifySessionToken(token) {
  if (!token) return null;
  const res = await fetch(`${SHIELD_API_URL}/api/shield/session/${encodeURIComponent(token)}`);
  if (!res.ok && res.status !== 404) {
    throw new Error(`Shield answered ${res.status}`);
  }
  const body = await res.json();
  if (!body.valid) return null;
  return { userId: body.userId, expiresAt: body.expiresAt };
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Resolves the session and puts it on the request, or answers for it.
// Returns the session on success and `null` once a response has been
// sent, so callers must not continue after a null.
async function resolveSession(req, res) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'requireSession: missing Authorization: Bearer <token> header' });
    return null;
  }

  let session;
  try {
    session = await verifySessionToken(token);
  } catch (err) {
    // Shield being unreachable is 502, not 401. Answering 401 would
    // tell a legitimate user their session expired when it did not,
    // and would train callers to re-authenticate against an outage.
    res.status(502).json({ error: `requireSession: Shield unreachable (${err.message})` });
    return null;
  }

  if (!session) {
    res.status(401).json({ error: 'requireSession: invalid or expired session token' });
    return null;
  }

  req.sessionUserId = session.userId;
  req.session = session;
  return session;
}

// Proves a live Shield session exists. Sets `req.sessionUserId`.
//
// **On its own this is not enough for any route that acts on a user's
// behalf.** It answers "is this somebody" — not "is this *that*
// somebody". Use `requireActor` wherever the request body names whose
// money, content, or account is being touched.
function requireSession() {
  return async (req, res, next) => {
    const session = await resolveSession(req, res);
    if (!session) return undefined;
    return next();
  };
}

// Proves a live session AND that it belongs to the user this request
// claims to act as.
//
// **Why it takes several field names.** Thirty-one mutating routes
// across this ecosystem each name the acting user differently —
// `userId`, `fromUserId`, `buyerId`, `investorId`, `authorId`,
// `boosterId`, `requesterId`, `fromOwnerId`, `customerId`, `artistId`.
// A single hardcoded field would have forced either a rename across
// every API (breaking every caller) or a separate middleware per app
// (which is how thirteen of them ended up unguarded). So the route
// declares its own field:
//
//     app.post('/api/vcoin/transfer', requireActor('fromUserId'), ...)
//
// The first named field that is present in the body is the one
// checked. Several may be listed for routes that accept more than one
// shape, but **at least one must be present** — a body that names no
// actor at all is refused rather than waved through, because "the
// field is missing" is exactly what an attacker would arrange if
// absence meant permission.
function requireActor(...fields) {
  if (fields.length === 0) {
    throw new Error('requireActor requires at least one body field name, e.g. requireActor("userId")');
  }
  return async (req, res, next) => {
    const session = await resolveSession(req, res);
    if (!session) return undefined;

    const body = req.body || {};
    const present = fields.filter((field) => body[field] !== undefined && body[field] !== null);

    if (present.length === 0) {
      return res.status(400).json({
        error: `requireActor: request body must name the acting user in one of: ${fields.join(', ')}`,
      });
    }

    // Every named field that IS present must match. Checking only the
    // first would let a caller pass a matching `userId` alongside a
    // victim's `fromUserId` and have the mismatch ignored.
    const mismatched = present.filter((field) => body[field] !== session.userId);
    if (mismatched.length > 0) {
      return res.status(403).json({
        error: `requireActor: session belongs to a different user than '${mismatched[0]}'`,
      });
    }

    return next();
  };
}

// The same check, against `req.params` instead of `req.body`.
//
// **Why a separate function rather than a flag.** Routes that name the
// actor in the path — `POST /api/screen-time/:userId/dismiss-prompt`,
// `POST /api/creators/:artistId/payout` — are common enough across the
// ecosystem that they were being left unguarded simply because
// `requireActor` did not fit them, and "no guard" is the worst possible
// resolution of "the helper does not quite match".
//
// A path parameter is always a string and is always present if the
// route matched, so the missing-actor case cannot arise here the way it
// does for a body. Everything else is identical, deliberately: same
// 403, same all-present-fields-must-match rule.
function requireParamActor(...names) {
  if (names.length === 0) {
    throw new Error('requireParamActor requires at least one route parameter name, e.g. requireParamActor("userId")');
  }
  return async (req, res, next) => {
    const session = await resolveSession(req, res);
    if (!session) return undefined;

    const params = req.params || {};
    const present = names.filter((name) => params[name] !== undefined && params[name] !== null);
    if (present.length === 0) {
      return res.status(500).json({
        error: `requireParamActor: route declares ${names.join(', ')} but the path defines no such parameter`,
      });
    }

    const mismatched = present.filter((name) => params[name] !== session.userId);
    if (mismatched.length > 0) {
      return res.status(403).json({
        error: `requireParamActor: session belongs to a different user than '${mismatched[0]}'`,
      });
    }

    return next();
  };
}

// **Either the end user themselves, or a verified internal service.**
//
// Lifted out of `v3/server.js`, where it was written for the ledger's
// transfer route and then needed verbatim by every other app that both
// serves a browser and receives server-to-server writes. VSAFE is the
// clearest case: `POST /api/check-ins` is called by a person opening
// the app *and* by CVNVO on that person's behalf when a date is
// arranged. Requiring a session would break CVNVO; requiring a service
// credential would break the browser. Requiring one or the other is the
// honest shape.
//
// It composes rather than reimplements — pass it any actor middleware:
//
//     actorOrService(requireActor('userId'))
//     actorOrService(requireParamActor('userId'))
//     actorOrService(requireCheckInOwner())
//
// `req.callingService` is set by `serviceAuth`, so this is only
// meaningful in an app that mounts it. In an app that does not, the
// property is never set and this degrades to the actor check alone —
// safe by construction, but check the mount before relying on it.
function actorOrService(actorMiddleware) {
  if (typeof actorMiddleware !== 'function') {
    throw new Error('actorOrService takes a middleware, e.g. actorOrService(requireActor("userId"))');
  }
  return (req, res, next) => {
    if (req.callingService) return next();
    return actorMiddleware(req, res, next);
  };
}

// Requires a verified internal service specifically — a user session is
// NOT sufficient.
//
// For operational routes with no actor at all: the missed-check-in
// sweeps, retry drains, tick-style jobs. These are run by a scheduler,
// they act on everybody's records at once, and there is no user whose
// session could reasonably authorise them. `requireSession()` would be
// the wrong answer here in the same way it was wrong on vxllage's
// ownership routes — it proves somebody is logged in, and that has no
// bearing on whether they may sweep the whole store.
function requireCallingService() {
  return (req, res, next) => {
    if (!req.callingService) {
      return res.status(403).json({
        error: 'requireCallingService: this route is for internal schedulers and requires a service credential '
          + '(X-Service-Name / X-Service-Token), not a user session',
      });
    }
    return next();
  };
}

// Kept only so that a stale call site fails loudly at boot rather than
// silently permitting anonymous writes. See the header.
function optionalOwnAccount() {
  throw new Error(
    'optionalOwnAccount has been removed: it called next() when no Authorization header was '
    + 'present, so mounting it alone left the route unauthenticated. Use requireActor(field) '
    + 'instead — it requires a live Shield session AND matches it against the acting user.',
  );
}

module.exports = {
  SHIELD_API_URL,
  verifySessionToken,
  requireSession,
  requireActor,
  requireParamActor,
  actorOrService,
  requireCallingService,
  optionalOwnAccount,
};
