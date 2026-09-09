// VENVM -- likeness consent register, and the hard gate over it.
//
// **Why this is a gate and not a warning**, decided directly rather
// than inferred: generating synthetic video of a real, identifiable
// person is the one capability in this pipeline that can cause
// concrete harm to someone who is not a user of this system. The
// person depicted is not in the room. They cannot decline at render
// time. A warning protects nobody, because the only party who would
// see it is the party who wants the render to proceed.
//
// So consent is enforced the same way this ecosystem enforces money
// and licensing: it throws. `venvm/lib/productionPipeline.js` cannot
// advance a likeness job past script stage without a consent record
// that is on file, unrevoked, unexpired, and specific to the job's
// own use.
//
// **What "specific" means here, and why a general agreement is not
// enough**: an influencer agreeing to a promotion has not thereby
// agreed to have their face and voice synthesized into content they
// have never seen. Those are different permissions. A consent record
// therefore names the actual scopes granted, and a job requesting a
// scope outside them is refused even though consent "exists."
//
// **Deliberately not automatable**: nothing in this module infers,
// derives, or defaults consent. It is recorded by a human action with
// a named recorder and a reference to the real signed instrument
// living outside this system. This module is a register and a gate,
// not a source of authority.

//: The real distinct permissions. Separated because they are
//: genuinely different asks and are routinely granted apart: someone
//: may license a still likeness and refuse a synthetic voice, or
//: permit an organic post and refuse paid media.
const CONSENT_SCOPES = [
  'likeness-still',
  'likeness-animated',
  'voice-synthesis',
  'paid-media-distribution',
];

//: Flagged interpretive: no source document sets a consent term.
//: Requiring an explicit expiry -- rather than defaulting to
//: perpetual -- is the conservative read, and it is the one that
//: matches how likeness rights are actually licensed. Perpetual
//: consent is expressible, but only by saying so.
const DEFAULT_CONSENT_TERM_DAYS = 365;

class ConsentError extends Error {}

function assertScopes(scopes, action) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new ConsentError(`${action} requires a non-empty scopes array`);
  }
  for (const s of scopes) {
    if (!CONSENT_SCOPES.includes(s)) {
      throw new ConsentError(`${action}: unknown consent scope "${s}" (known: ${CONSENT_SCOPES.join(', ')})`);
    }
  }
}

// Recording consent is a human act with a paper trail. Every field
// below is required precisely because a record missing any of them is
// not evidence of anything.
function recordConsent(store, options = {}) {
  const {
    subjectId, subjectName, scopes, recordedBy, agreementReference,
    now = Date.now(), termDays = DEFAULT_CONSENT_TERM_DAYS, perpetual = false,
  } = options;

  if (!subjectId) throw new ConsentError('recordConsent requires a subjectId');
  if (!subjectName) throw new ConsentError('recordConsent requires the subject\'s real name');
  if (!recordedBy) throw new ConsentError('recordConsent requires recordedBy -- who at VACO recorded this');
  //: The pointer to the real signed instrument. Without it this
  //: register is just an assertion that consent exists, which is
  //: exactly what it must not be.
  if (!agreementReference) {
    throw new ConsentError(
      'recordConsent requires an agreementReference identifying the real signed agreement -- '
      + 'this register points at consent, it does not constitute it'
    );
  }
  assertScopes(scopes, 'recordConsent');
  if (!perpetual && (!Number.isFinite(termDays) || termDays <= 0)) {
    throw new ConsentError('recordConsent requires a positive termDays, or perpetual: true');
  }

  const record = {
    id: store.nextConsentId++,
    subjectId,
    subjectName,
    scopes: [...scopes],
    recordedBy,
    agreementReference,
    recordedAt: now,
    expiresAt: perpetual ? null : now + termDays * 24 * 60 * 60 * 1000,
    revokedAt: null,
    revokedReason: null,
  };
  store.likenessConsents.push(record);
  return record;
}

// Revocation is immediate and takes effect on every job not yet
// rendered. A person withdrawing consent should not have to wait for
// a queue to drain.
function revokeConsent(store, options = {}) {
  const { consentId, reason = 'withdrawn by subject', now = Date.now() } = options;
  const record = store.likenessConsents.find((c) => c.id === consentId);
  if (!record) throw new ConsentError(`revokeConsent: no consent record with id ${consentId}`);
  record.revokedAt = now;
  record.revokedReason = reason;
  return record;
}

function findActiveConsent(store, subjectId, now = Date.now()) {
  return store.likenessConsents.find(
    (c) => c.subjectId === subjectId
      && c.revokedAt === null
      && (c.expiresAt === null || c.expiresAt > now)
  ) || null;
}

// The gate itself. Returns nothing on success and throws with a
// specific reason on failure -- the reason matters, because "no
// record", "revoked", "expired", and "scope not granted" are four
// genuinely different situations calling for four different human
// responses.
function requireConsent(store, options = {}) {
  const { subjectId, requestedScopes, now = Date.now(), action = 'requireConsent' } = options;
  if (!subjectId) throw new ConsentError(`${action}: requires a subjectId`);
  assertScopes(requestedScopes, action);

  const all = store.likenessConsents.filter((c) => c.subjectId === subjectId);
  if (all.length === 0) {
    throw new ConsentError(
      `${action}: no likeness consent on file for subject "${subjectId}". Generation is blocked.`
    );
  }
  const active = findActiveConsent(store, subjectId, now);
  if (!active) {
    const latest = all[all.length - 1];
    throw new ConsentError(
      latest.revokedAt
        ? `${action}: consent for "${subjectId}" was revoked (${latest.revokedReason}). Generation is blocked.`
        : `${action}: consent for "${subjectId}" expired at ${latest.expiresAt}. Generation is blocked until it is renewed.`
    );
  }
  const missing = requestedScopes.filter((s) => !active.scopes.includes(s));
  if (missing.length > 0) {
    throw new ConsentError(
      `${action}: consent for "${subjectId}" does not cover ${missing.join(', ')} `
      + `(granted: ${active.scopes.join(', ')}). A general agreement is not consent to these uses. Generation is blocked.`
    );
  }
  return active;
}

function listConsents(store, options = {}) {
  const { subjectId } = options;
  return store.likenessConsents.filter((c) => (subjectId ? c.subjectId === subjectId : true));
}

module.exports = {
  CONSENT_SCOPES,
  DEFAULT_CONSENT_TERM_DAYS,
  ConsentError,
  recordConsent,
  revokeConsent,
  findActiveConsent,
  requireConsent,
  listConsents,
};
