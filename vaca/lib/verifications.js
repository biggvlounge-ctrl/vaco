// VACA -- Verifications, the real core loop.
// Source of truth: real references scattered across the ecosystem's
// own docs, gathered directly rather than invented, since no single
// VACA spec doc exists in this session -- VSAFE's own architecture
// doc names V3's three components as "V3 (AI), DREAMS (ads), and VACA
// (identity)"; VOKEN's `VOKEN_ARCHITECTURE.md` calls a card's
// ownership timeline "VACA-verified"; VOKEN's own `valueAlgorithm.js`
// takes a real `authenticityGrade` input described as "VACA-verified
// authenticity." Confirmed directly (by reading `valueAlgorithm.js`
// and `server.js` together) that this "VACA-verified" grade was, until
// this module existed, never actually verified by anything -- VOKEN's
// `POST /api/card/:id/value-score` trusted whatever grade the caller
// put in the request body. VACA is the real, missing authority that
// closes that gap.
//
// Real, deliberately broad scope: VACA verifies claims about a
// subject -- not just VOKEN card authenticity. `subjectType` +
// `claimType` are real, but `claimType` is a free-form string, not a
// fixed enum (the same design choice `world-layer/propagation.js`
// already made for its own `eventType`, for the same real reason: the
// whole mechanism doesn't branch on it, so a fixed list would just be
// friction for the next real use this session hasn't imagined yet).
//
// Real, deliberate design decision: `grade` (the A/B/C scale VOKEN's
// value algorithm consumes) is only meaningful for `claimType ===
// 'authenticity'` -- other claim types (identity, ownership-
// provenance, anything else) resolve with a plain verified/rejected
// outcome and no grade, since a letter grade doesn't mean anything for
// "is this person who they say they are."
//
// Real, deliberate design decision: grading is a real reviewer
// decision made at approval time (`approveVerification`'s own
// `reviewedBy` + `grade` arguments), not an auto-computed score from
// free-text evidence -- authenticity attestation is fundamentally a
// human/institutional judgment call in every real comparable (KYC
// review, provenance authentication houses), the same posture VSAFE's
// own `idVerification.js` already takes for identity documents.

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'];
const AUTHENTICITY_GRADES = ['A', 'B', 'C'];

function submitVerification(store, options = {}) {
  const {
    subjectType, subjectId, claimType, evidence, now = Date.now(),
  } = options;

  if (!subjectType) throw new Error('submitVerification requires a subjectType');
  if (!subjectId) throw new Error('submitVerification requires a subjectId');
  if (!claimType) throw new Error('submitVerification requires a claimType');
  if (!evidence) throw new Error('submitVerification requires evidence');

  const verification = {
    id: store.nextVerificationId++,
    subjectType,
    subjectId,
    claimType,
    evidence,
    status: 'pending',
    grade: null,
    reviewedBy: null,
    reviewNotes: null,
    reviewedAt: null,
    createdAt: now,
  };
  store.verifications.push(verification);
  return verification;
}

function getVerification(store, verificationId) {
  return store.verifications.find((v) => v.id === verificationId) || null;
}

function listVerificationsForSubject(store, subjectType, subjectId) {
  return store.verifications
    .filter((v) => v.subjectType === subjectType && v.subjectId === subjectId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function requirePending(store, verificationId, action) {
  const verification = getVerification(store, verificationId);
  if (!verification) throw new Error(`${action}: no verification with id ${verificationId}`);
  if (verification.status !== 'pending') {
    throw new Error(`${action}: verification ${verificationId} is not pending (status: ${verification.status})`);
  }
  return verification;
}

function approveVerification(store, options = {}) {
  const {
    verificationId, reviewedBy, grade = null, now = Date.now(),
  } = options;
  const verification = requirePending(store, verificationId, 'approveVerification');
  if (!reviewedBy) throw new Error('approveVerification requires a reviewedBy');

  if (verification.claimType === 'authenticity') {
    if (!AUTHENTICITY_GRADES.includes(grade)) {
      throw new Error(`approveVerification: an "authenticity" claim requires a grade of ${AUTHENTICITY_GRADES.join(', ')}`);
    }
  } else if (grade !== null) {
    throw new Error(`approveVerification: claimType "${verification.claimType}" does not take a grade`);
  }

  verification.status = 'verified';
  verification.grade = grade;
  verification.reviewedBy = reviewedBy;
  verification.reviewedAt = now;
  return verification;
}

function rejectVerification(store, options = {}) {
  const { verificationId, reviewedBy, reason, now = Date.now() } = options;
  const verification = requirePending(store, verificationId, 'rejectVerification');
  if (!reviewedBy) throw new Error('rejectVerification requires a reviewedBy');
  if (!reason) throw new Error('rejectVerification requires a reason');

  verification.status = 'rejected';
  verification.reviewedBy = reviewedBy;
  verification.reviewNotes = reason;
  verification.reviewedAt = now;
  return verification;
}

// The real convenience query VOKEN (and anything else scoring
// authenticity) actually calls: the most recent verified
// "authenticity" claim's grade for a subject, or null if there isn't
// one -- unverified/rejected/no-claim-at-all all honestly resolve to
// the same "we don't have a verified grade" answer, not a fabricated
// default.
function getAuthenticityGrade(store, subjectType, subjectId) {
  const claims = listVerificationsForSubject(store, subjectType, subjectId)
    .filter((v) => v.claimType === 'authenticity' && v.status === 'verified');
  return claims.length > 0 ? claims[0].grade : null;
}

// The identity-claim counterpart to getAuthenticityGrade above --
// same real convenience-query shape, but identity claims don't carry
// a grade (see the design note at the top of this file), so this
// resolves to a plain boolean: is there a currently-verified identity
// claim for this subject, or not. Unverified/rejected/no-claim-at-all
// all honestly resolve to false, same "no fabricated default" posture.
function isIdentityVerified(store, subjectType, subjectId) {
  return listVerificationsForSubject(store, subjectType, subjectId)
    .some((v) => v.claimType === 'identity' && v.status === 'verified');
}

module.exports = {
  VERIFICATION_STATUSES,
  AUTHENTICITY_GRADES,
  submitVerification,
  getVerification,
  listVerificationsForSubject,
  approveVerification,
  rejectVerification,
  getAuthenticityGrade,
  isIdentityVerified,
};
