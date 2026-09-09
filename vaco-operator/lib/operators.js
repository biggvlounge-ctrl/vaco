// VACO OPERATOR — operator authority: issued, scoped, revoked, verified.
//
// **What this is for.** The authorization sweep closed 27 routes that
// `dev-docs/OPERATOR_ROLES_SCOPE.md` calls "decisions with a loser" —
// settling an event, grading a bet, sighting a licence, distributing
// revenue. Each is currently reachable only by a service credential,
// which means the honest answer to "who decided this" is "a token."
// This module is the other half: a credential that belongs to a
// *person*.
//
// **Separate from Shield, deliberately.** Shield answers "who is this?"
// This answers "what may they decide?" Two different questions, and
// this ecosystem's own structure argues for keeping them apart — V3 is
// the only place money lives, VACA the only place identity grades live,
// vaco-notify the only place alerts go.
//
// **Scoped, never boolean.** A grant is one operator and one
// `<app>:<action>` scope. There is no `isOperator` flag and no `*`, for
// the reason in §3.2: one credential that opens all 27 routes is a
// master key with a smaller name.
//
// **Nobody grants themselves.** The route that hands out authority is
// itself a decision with a loser, so it obeys the rule the VOID
// licensing exploit taught: *a claim may be self-service, a credential
// never is.* Without that refusal one compromised operator escalates to
// every scope in a single request.

const crypto = require('crypto');

class OperatorError extends Error {}

// The scopes that exist. Enumerated rather than free-form, and this is
// load-bearing in both directions:
//
//   - a typo in a route's guard (`vago:setle`) is a startup error here
//     instead of a permission that silently never matches, which is the
//     §5d failure class applied to authorization
//   - a scope nobody can hold cannot be granted by accident
//
// Derived from the 27 group-2 routes in the scope document. Adding a
// group-2 route means adding its scope here, which is the intended
// friction.
const SCOPES = [
  'operator:grant',        // hand out and revoke authority (the bootstrap's only scope)

  'vago:settle',           // settle a sports event
  'vago:grade',            // grade a fantasy contest / bet
  'vago:state',            // lifecycle steps gating a later payout

  'void:vetting',          // sight a licence, verify a provider credential
  // The second half of the two-person rule, and deliberately a separate
  // scope rather than a second holder of `void:vetting`. If approving
  // were the same scope as proposing, the "different person" check
  // would be the only thing standing between one operator and both
  // halves -- this way the two acts are separately grantable, and an
  // operator who should only ever approve never holds the ability to
  // originate. Applies to licensing-gated verticals only.
  'void:vetting:approve',
  'void:enforce',          // suspend, remove, take down

  'hvntz:settle',          // pay out a revenue event
  'hvntz:grade',           // assess a claim
  'hvntz:enforce',         // remove a listing or an affiliate

  'voken:settle',          // resolve a market, distribute
  'voken:grade',           // assess a pack/asset outcome

  'vulture-music:settle',  // distribute revenue to artists and labels
  'vulture-music:state',   // release lifecycle

  'vulture-studios:settle', // project revenue distribution
  'vulture-studios:state',  // greenlight and production lifecycle

  'vaco-shell:reversal',   // refund a store purchase

  // Clearing a compliance interlock. VEX's brokerage gate holds all
  // trading until it is lifted, and its own error message says "held
  // pending real broker-dealer compliance review" -- so lifting it is
  // exactly the kind of act that must name a person. It was previously
  // `requireActor('operatorId')`, which proves the session belongs to
  // whoever the *body names* and therefore let any account holder clear
  // it for themselves.
  'vex:compliance',

  // The rest of the same class, found by sweeping for
  // `requireActor(<a decider field>)` after VEX's turned up. Each of
  // these proved the session matched whoever the *body named* as the
  // reviewer/operator -- which is self-certification wearing a guard's
  // clothing, and reads as "ok" in the route audit.
  'voken:compliance',       // clear a VOKEN compliance gate
  'vaca:verify',            // approve or reject an identity verification
  'vaco-notify:subscribe',  // who receives alerts
  'vacon-c:tick',           // advance the civ-sim clock
];

// The bootstrap holds this and only this. Stated as a constant so the
// "seed, not admin" property is checkable rather than a claim in a
// comment.
const BOOTSTRAP_SCOPE = 'operator:grant';

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OperatorError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function assertKnownScope(scope, action) {
  if (!SCOPES.includes(scope)) {
    throw new OperatorError(
      `${action}: unknown scope "${scope}" -- add it to SCOPES if it is real. `
      + `Known: ${SCOPES.join(', ')}`,
    );
  }
  return scope;
}

// 32 random bytes, hex. Same strength as the service tokens, and
// generated here rather than accepted from the caller: a credential a
// client can choose is a credential a client can guess.
function newCredential() {
  return `vop_${crypto.randomBytes(32).toString('hex')}`;
}

// Stored as a SHA-256 digest, never in the clear. The store is written
// to disk and read by `restore-stores.mjs`, and an operator credential
// in a backup file is the same class of problem as a token in the audit
// log -- which is why that one redacts on the way in.
function digest(credential) {
  return crypto.createHash('sha256').update(credential).digest('hex');
}

function constantTimeEquals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// -- Operators -------------------------------------------------------

// Returns { operator, credential }. The credential is returned exactly
// once, here, and is not recoverable afterwards -- only its digest is
// stored. Losing it means issuing a new one, which is the correct
// tradeoff for a credential that can settle money.
function createOperator(store, options = {}) {
  const a = 'createOperator';
  const name = requireString(options.name, 'name', a);
  const createdBy = requireString(options.createdBy, 'createdBy', a);
  const now = options.now ?? Date.now();

  if (store.operators.some((o) => o.name === name)) {
    throw new OperatorError(`${a}: an operator named "${name}" already exists`);
  }

  const credential = options.credential || newCredential();
  const operator = {
    id: store.nextOperatorId++,
    name,
    credentialDigest: digest(credential),
    createdBy,
    createdAt: now,
    disabledAt: null,
  };
  store.operators.push(operator);
  return { operator, credential };
}

function getOperator(store, operatorId) {
  return store.operators.find((o) => o.id === operatorId) || null;
}

function findOperatorByName(store, name) {
  return store.operators.find((o) => o.name === name) || null;
}

// Disabling is the whole-person switch, distinct from revoking one
// scope: it is what you reach for when a credential leaks. Not a
// delete, for the same reason a revoked grant is not deleted -- "who
// could do this in March" is the question the record exists to answer.
function disableOperator(store, options = {}) {
  const a = 'disableOperator';
  const operator = getOperator(store, options.operatorId);
  if (!operator) throw new OperatorError(`${a}: no operator with id ${options.operatorId}`);
  const disabledBy = requireString(options.disabledBy, 'disabledBy', a);

  if (operator.id === options.actingOperatorId) {
    throw new OperatorError(`${a}: an operator may not disable themselves`);
  }

  operator.disabledAt = options.now ?? Date.now();
  operator.disabledBy = disabledBy;
  return operator;
}

// -- Grants ----------------------------------------------------------

// Grant one scope to one operator.
//
// `grantedBy` is the acting operator's id, and it is compared against
// the target: **nobody grants themselves anything**, including
// `operator:grant`. That single line is what stops one compromised
// credential from becoming every credential.
function grantScope(store, options = {}) {
  const a = 'grantScope';
  const scope = assertKnownScope(requireString(options.scope, 'scope', a), a);
  const now = options.now ?? Date.now();

  const operator = getOperator(store, options.operatorId);
  if (!operator) throw new OperatorError(`${a}: no operator with id ${options.operatorId}`);
  if (operator.disabledAt) {
    throw new OperatorError(`${a}: operator "${operator.name}" is disabled`);
  }

  const grantedBy = options.grantedBy;
  if (grantedBy === undefined || grantedBy === null || `${grantedBy}`.trim() === '') {
    throw new OperatorError(`${a} requires a non-empty grantedBy`);
  }
  // Compared loosely on purpose: the id arrives as a number from lib
  // calls and as a string from route params, and a self-grant that
  // slips through because 3 !== '3' would defeat the whole rule.
  if (String(grantedBy) === String(operator.id)) {
    throw new OperatorError(
      `${a}: an operator may not grant themselves a scope -- a claim may be self-service, `
      + 'a credential never is',
    );
  }

  const existing = store.grants.find(
    (g) => g.operatorId === operator.id && g.scope === scope && !g.revokedAt,
  );
  if (existing) return existing;

  const grant = {
    id: store.nextGrantId++,
    operatorId: operator.id,
    scope,
    grantedBy: String(grantedBy),
    grantedAt: now,
    revokedAt: null,
    revokedBy: null,
  };
  store.grants.push(grant);
  return grant;
}

// Revocation marks, never deletes -- and takes effect immediately,
// because `verify` reads `revokedAt` on every call rather than trusting
// anything cached.
function revokeScope(store, options = {}) {
  const a = 'revokeScope';
  const scope = assertKnownScope(requireString(options.scope, 'scope', a), a);
  const revokedBy = requireString(String(options.revokedBy ?? ''), 'revokedBy', a);

  const operator = getOperator(store, options.operatorId);
  if (!operator) throw new OperatorError(`${a}: no operator with id ${options.operatorId}`);

  const grant = store.grants.find(
    (g) => g.operatorId === operator.id && g.scope === scope && !g.revokedAt,
  );
  if (!grant) {
    throw new OperatorError(`${a}: operator "${operator.name}" does not hold "${scope}"`);
  }

  grant.revokedAt = options.now ?? Date.now();
  grant.revokedBy = revokedBy;
  return grant;
}

function scopesFor(store, operatorId) {
  return store.grants
    .filter((g) => g.operatorId === operatorId && !g.revokedAt)
    .map((g) => g.scope)
    .sort();
}

// -- Verification ----------------------------------------------------

// The question every guarded route asks: "does this credential hold
// this scope, right now?"
//
// Returns { ok: false, reason } rather than throwing, because the
// caller turns it into a 401/403 and the reason is what makes a refused
// settlement diagnosable. Never returns *which* operator failed on a
// bad credential -- that would confirm a name to someone guessing.
function verify(store, options = {}) {
  const { credential, scope } = options;

  if (typeof credential !== 'string' || credential.length === 0) {
    return { ok: false, reason: 'no operator credential presented' };
  }
  if (!SCOPES.includes(scope)) {
    // A route asking for a scope that does not exist is a bug in the
    // route, and it must fail closed and loudly rather than being
    // treated as "not permitted" and quietly denied forever.
    return { ok: false, reason: `route requires unknown scope "${scope}"`, misconfigured: true };
  }

  const presented = digest(credential);
  const operator = store.operators.find((o) => constantTimeEquals(o.credentialDigest, presented));
  if (!operator) return { ok: false, reason: 'operator credential not recognised' };
  if (operator.disabledAt) {
    return { ok: false, reason: `operator "${operator.name}" is disabled` };
  }

  const held = store.grants.some(
    (g) => g.operatorId === operator.id && g.scope === scope && !g.revokedAt,
  );
  if (!held) {
    return {
      ok: false,
      reason: `operator "${operator.name}" does not hold "${scope}"`,
      operatorName: operator.name,
    };
  }

  return { ok: true, operatorId: operator.id, operatorName: operator.name, scope };
}

// -- Bootstrap -------------------------------------------------------

// The first operator cannot be granted by an operator, so it comes from
// the environment. It holds `operator:grant` and nothing else: a seed,
// not an admin. It cannot settle, grade, vet or enforce anything, so
// the first thing whoever holds it must do is grant real scopes to real
// people -- and every one of those grants is attributable.
//
// If the variable is unset the service starts with no operators, which
// is correct: an authority service that invents its own first authority
// is not one.
function bootstrap(store, credential, options = {}) {
  const a = 'bootstrap';
  if (!credential) return null;
  if (store.operators.length > 0) return null;

  const { operator } = createOperator(store, {
    name: options.name || 'bootstrap',
    createdBy: 'VACO_OPERATOR_BOOTSTRAP',
    credential,
    now: options.now,
  });

  // Pushed directly rather than through grantScope, because grantScope
  // correctly refuses a self-grant and there is nobody else yet. This
  // is the one place that rule is bypassed, it is bypassed at process
  // start from an environment variable rather than over HTTP, and the
  // grant records that plainly.
  store.grants.push({
    id: store.nextGrantId++,
    operatorId: operator.id,
    scope: BOOTSTRAP_SCOPE,
    grantedBy: 'VACO_OPERATOR_BOOTSTRAP',
    grantedAt: options.now ?? Date.now(),
    revokedAt: null,
    revokedBy: null,
  });

  return operator;
}

// Coverage, in the same spirit as vaco-audit's: which scopes exist and
// nobody holds. A scope with no holder means a group-2 route that
// cannot be operated by anyone, which is a real outage waiting to be
// discovered at the worst moment.
function describeCoverage(store) {
  const active = store.grants.filter((g) => !g.revokedAt);
  const held = new Set(active.map((g) => g.scope));
  return {
    operators: store.operators.filter((o) => !o.disabledAt).length,
    disabledOperators: store.operators.filter((o) => o.disabledAt).length,
    activeGrants: active.length,
    revokedGrants: store.grants.length - active.length,
    scopes: SCOPES.length,
    unheldScopes: SCOPES.filter((s) => !held.has(s)),
  };
}

module.exports = {
  OperatorError,
  SCOPES,
  BOOTSTRAP_SCOPE,
  createOperator,
  getOperator,
  findOperatorByName,
  disableOperator,
  grantScope,
  revokeScope,
  scopesFor,
  verify,
  bootstrap,
  describeCoverage,
};
