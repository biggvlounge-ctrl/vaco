// VACA — the gate other apps trust.
//
// **Why this file exists.** `dev-docs/COMPLETION_AUDIT.md` §3.2 names
// VACA, VEX and YAP as the next tier to test, and gives the reason: *a
// gate that silently stops gating is worse than one that was never
// built, because the callers believe it.*
//
// VACA is the sharpest case of that in the ecosystem, and its own
// module header says why. Before VACA existed, VOKEN's
// `POST /api/card/:id/value-score` **trusted whatever
// `authenticityGrade` the caller put in the request body.** VACA is
// the authority that closed that hole. So every consumer downstream now
// believes that a grade coming out of `getAuthenticityGrade()` was
// actually reviewed by somebody.
//
// The failures targeted are therefore all one shape — **a grade or a
// verified status appearing where nothing was ever approved**:
//
//   - a pending or rejected claim resolving to a grade anyway
//   - a grade defaulting to something rather than to null
//   - an authenticity approval landing without a real reviewer decision
//   - a grade leaking between subjects
//   - a decided claim being re-decided
//
// Every assertion is on the refusal or on the absence of a grade, never
// on a status field. A status is exactly what stays correct while the
// grade goes wrong.

const test = require('node:test');
const assert = require('node:assert');

const { createVacaStore } = require('../lib/store');
const v = require('../lib/verifications');

const NOW = Date.UTC(2026, 5, 1);
const HOUR = 3600000;

function submit(store, overrides = {}) {
  return v.submitVerification(store, {
    subjectType: 'card',
    subjectId: 'card-1',
    claimType: 'authenticity',
    evidence: 'photographs of the certificate of authenticity',
    now: NOW,
    ...overrides,
  });
}

// -- The grade only exists if somebody granted it ------------------------

test('an unverified subject has no grade — not a default, not a guess', () => {
  const store = createVacaStore();

  // Nothing submitted at all. The honest answer is "we do not have a
  // verified grade", and the caller must be able to tell that apart
  // from a real 'C'.
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null);

  // Submitted but not yet reviewed. This is the dangerous one: a
  // pending claim looks like activity, and a gate that reads activity
  // as approval grades everything anyone bothers to submit.
  submit(store);
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null,
    'a pending claim is not a verified claim');
});

test('a rejected claim confers no grade', () => {
  const store = createVacaStore();
  const claim = submit(store);
  v.rejectVerification(store, {
    verificationId: claim.id, reviewedBy: 'reviewer-1', reason: 'the certificate is a photocopy', now: NOW,
  });

  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null,
    'rejection must resolve to no grade, exactly like never having asked');
});

test('an approved authenticity claim grades, and the grade is the reviewer’s', () => {
  const store = createVacaStore();
  const claim = submit(store);
  const approved = v.approveVerification(store, {
    verificationId: claim.id, reviewedBy: 'reviewer-1', grade: 'B', now: NOW,
  });

  assert.strictEqual(approved.grade, 'B');
  assert.strictEqual(approved.reviewedBy, 'reviewer-1');
  assert.strictEqual(approved.reviewedAt, NOW);
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), 'B');
});

test('an authenticity claim cannot be approved without a grade', () => {
  const store = createVacaStore();
  const claim = submit(store);

  // Approving with no grade would produce a *verified* claim whose
  // grade is null — and a downstream consumer reading only the status
  // would treat that as authenticated.
  assert.throws(() => v.approveVerification(store, {
    verificationId: claim.id, reviewedBy: 'reviewer-1', now: NOW,
  }), /requires a grade of A, B, C/);

  assert.strictEqual(v.getVerification(store, claim.id).status, 'pending',
    'a refused approval must leave the claim pending, not half-approved');
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null);
});

test('a grade outside the scale is refused rather than stored', () => {
  const store = createVacaStore();
  for (const grade of ['A+', 'D', 'a', '', 1, true]) {
    const claim = submit(store);
    assert.throws(() => v.approveVerification(store, {
      verificationId: claim.id, reviewedBy: 'reviewer-1', grade, now: NOW,
    }), /requires a grade of A, B, C/, `grade ${JSON.stringify(grade)} must be refused`);
  }
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null);
});

test('an approval requires a named reviewer — attestation is somebody’s decision', () => {
  const store = createVacaStore();
  const claim = submit(store);

  assert.throws(() => v.approveVerification(store, {
    verificationId: claim.id, grade: 'A', now: NOW,
  }), /requires a reviewedBy/);
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), null);
});

test('a rejection requires a reason — a refusal nobody can explain is not reviewable', () => {
  const store = createVacaStore();
  const claim = submit(store);

  assert.throws(() => v.rejectVerification(store, {
    verificationId: claim.id, reviewedBy: 'reviewer-1', now: NOW,
  }), /requires a reason/);
  assert.strictEqual(v.getVerification(store, claim.id).status, 'pending');
});

// -- Grades belong to one claim type ------------------------------------

test('a non-authenticity claim cannot carry a grade', () => {
  const store = createVacaStore();
  const claim = submit(store, { claimType: 'identity', subjectType: 'user', subjectId: 'ada' });

  // A letter grade means nothing for "is this person who they say they
  // are", and allowing one would let a caller invent an authenticity
  // signal under a different claim type.
  assert.throws(() => v.approveVerification(store, {
    verificationId: claim.id, reviewedBy: 'reviewer-1', grade: 'A', now: NOW,
  }), /does not take a grade/);
});

test('an identity claim does not produce an authenticity grade', () => {
  const store = createVacaStore();
  const claim = submit(store, { claimType: 'identity', subjectType: 'user', subjectId: 'ada' });
  v.approveVerification(store, { verificationId: claim.id, reviewedBy: 'reviewer-1', now: NOW });

  assert.ok(v.isIdentityVerified(store, 'user', 'ada'));
  assert.strictEqual(v.getAuthenticityGrade(store, 'user', 'ada'), null,
    'verifying who someone is says nothing about whether an object is genuine');
});

test('isIdentityVerified is false for pending, rejected, and absent alike', () => {
  const store = createVacaStore();
  assert.strictEqual(v.isIdentityVerified(store, 'user', 'ada'), false, 'no claim');

  const pending = submit(store, { claimType: 'identity', subjectType: 'user', subjectId: 'ada' });
  assert.strictEqual(v.isIdentityVerified(store, 'user', 'ada'), false, 'pending');

  v.rejectVerification(store, {
    verificationId: pending.id, reviewedBy: 'reviewer-1', reason: 'document expired', now: NOW,
  });
  assert.strictEqual(v.isIdentityVerified(store, 'user', 'ada'), false, 'rejected');
});

// -- A decision is made once --------------------------------------------

test('a decided claim cannot be decided again, in either direction', () => {
  const store = createVacaStore();

  const approved = submit(store);
  v.approveVerification(store, { verificationId: approved.id, reviewedBy: 'reviewer-1', grade: 'A', now: NOW });
  assert.throws(() => v.approveVerification(store, {
    verificationId: approved.id, reviewedBy: 'reviewer-2', grade: 'C', now: NOW + HOUR,
  }), /is not pending/);
  assert.throws(() => v.rejectVerification(store, {
    verificationId: approved.id, reviewedBy: 'reviewer-2', reason: 'changed my mind', now: NOW + HOUR,
  }), /is not pending/);
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), 'A',
    'the original decision stands — a correction is a new claim, not an edit');

  const rejected = submit(store, { subjectId: 'card-2' });
  v.rejectVerification(store, { verificationId: rejected.id, reviewedBy: 'reviewer-1', reason: 'forged', now: NOW });
  assert.throws(() => v.approveVerification(store, {
    verificationId: rejected.id, reviewedBy: 'reviewer-2', grade: 'A', now: NOW + HOUR,
  }), /is not pending/);
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-2'), null);
});

test('a re-submission after rejection is a fresh claim and can be graded', () => {
  const store = createVacaStore();
  const first = submit(store);
  v.rejectVerification(store, { verificationId: first.id, reviewedBy: 'reviewer-1', reason: 'blurry', now: NOW });

  // The correct path for "I have better evidence now": submit again.
  const second = submit(store, { evidence: 'the original certificate, in person', now: NOW + HOUR });
  v.approveVerification(store, { verificationId: second.id, reviewedBy: 'reviewer-1', grade: 'A', now: NOW + HOUR });

  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), 'A');
});

test('the most recent verified claim is the one that counts', () => {
  const store = createVacaStore();

  const older = submit(store, { now: NOW });
  v.approveVerification(store, { verificationId: older.id, reviewedBy: 'reviewer-1', grade: 'A', now: NOW });
  const newer = submit(store, { now: NOW + HOUR, evidence: 're-examined under magnification' });
  v.approveVerification(store, { verificationId: newer.id, reviewedBy: 'reviewer-2', grade: 'C', now: NOW + HOUR });

  // A downgrade must actually take effect. Reading the oldest verified
  // claim instead would make a grade impossible to revise downward,
  // which is the direction that matters.
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), 'C');
});

// -- Subjects do not bleed into each other -------------------------------

test('a grade does not leak to another subject or another subject type', () => {
  const store = createVacaStore();
  const claim = submit(store, { subjectType: 'card', subjectId: 'card-1' });
  v.approveVerification(store, { verificationId: claim.id, reviewedBy: 'reviewer-1', grade: 'A', now: NOW });

  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-2'), null, 'different id');
  assert.strictEqual(v.getAuthenticityGrade(store, 'user', 'card-1'), null,
    'a matching id under a different subjectType is a different subject');
  assert.strictEqual(v.getAuthenticityGrade(store, 'card', 'card-1'), 'A');
});

test('listing a subject returns only that subject’s claims, newest first', () => {
  const store = createVacaStore();
  submit(store, { subjectId: 'card-1', now: NOW });
  submit(store, { subjectId: 'card-2', now: NOW });
  submit(store, { subjectId: 'card-1', now: NOW + HOUR });

  const claims = v.listVerificationsForSubject(store, 'card', 'card-1');
  assert.strictEqual(claims.length, 2);
  assert.ok(claims[0].createdAt > claims[1].createdAt, 'newest first, which is what the grade lookup depends on');
  assert.ok(claims.every((c) => c.subjectId === 'card-1'));
});

// -- A claim needs enough to review --------------------------------------

test('a claim missing any required field is refused, and nothing is stored', () => {
  const store = createVacaStore();
  const required = ['subjectType', 'subjectId', 'claimType', 'evidence'];

  for (const field of required) {
    const options = {
      subjectType: 'card', subjectId: 'card-1', claimType: 'authenticity', evidence: 'photos', now: NOW,
    };
    delete options[field];
    // `requires a subjectType` but `requires evidence` — the article
    // is not part of the contract, only the refusal is.
    assert.throws(() => v.submitVerification(store, options),
      new RegExp(`requires (a )?${field}`), `missing ${field} must be refused`);
  }

  // Evidence in particular: a claim with nothing to examine cannot be
  // reviewed, so accepting it would create a queue item that can only
  // ever be rubber-stamped.
  assert.strictEqual(store.verifications.length, 0);
  assert.strictEqual(store.nextVerificationId, 1, 'a refused claim must not burn an id');
});

test('an unknown verification id is refused rather than silently ignored', () => {
  const store = createVacaStore();
  assert.strictEqual(v.getVerification(store, 999), null);
  assert.throws(() => v.approveVerification(store, {
    verificationId: 999, reviewedBy: 'reviewer-1', grade: 'A', now: NOW,
  }), /no verification with id 999/);
});
