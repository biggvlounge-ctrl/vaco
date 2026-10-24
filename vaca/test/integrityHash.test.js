// VACA -- a real, decided verification (approved or rejected) now
// carries a real, tamper-evident `integrityHash` through the same
// crypto-agility layer V3's vcoin.js/vash.js attach to every real
// transaction. Verifies the hash is real -- it recomputes over the
// decision's own fields, and a tampered field recomputes differently.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVacaStore } = require('../lib/store');
const { submitVerification, approveVerification, rejectVerification } = require('../lib/verifications');
const { hashPayload } = require('../lib/cryptoAgility');

test('a pending verification carries no integrityHash yet', () => {
  const store = createVacaStore();
  const verification = submitVerification(store, {
    subjectType: 'voken-card', subjectId: 1, claimType: 'authenticity', evidence: 'cert photo',
  });
  assert.equal(verification.integrityHash, null);
});

test('approveVerification attaches a real integrityHash that recomputes over the real decision', () => {
  const store = createVacaStore();
  const verification = submitVerification(store, {
    subjectType: 'voken-card', subjectId: 1, claimType: 'authenticity', evidence: 'cert photo',
  });
  const approved = approveVerification(store, { verificationId: verification.id, reviewedBy: 'reviewer-1', grade: 'A' });

  assert.ok(approved.integrityHash);
  const recomputed = hashPayload({
    id: approved.id, subjectType: approved.subjectType, subjectId: approved.subjectId,
    claimType: approved.claimType, status: approved.status, grade: approved.grade,
    reviewedBy: approved.reviewedBy, reviewedAt: approved.reviewedAt,
  }).hash;
  assert.equal(approved.integrityHash, recomputed);

  // The real point of a tamper-evident hash: a grade swapped after the
  // fact no longer recomputes to the stored value.
  const tampered = hashPayload({
    id: approved.id, subjectType: approved.subjectType, subjectId: approved.subjectId,
    claimType: approved.claimType, status: approved.status, grade: 'C',
    reviewedBy: approved.reviewedBy, reviewedAt: approved.reviewedAt,
  }).hash;
  assert.notEqual(approved.integrityHash, tampered);
});

test('rejectVerification attaches its own real integrityHash too', () => {
  const store = createVacaStore();
  const verification = submitVerification(store, {
    subjectType: 'voken-card', subjectId: 2, claimType: 'identity', evidence: 'id scan',
  });
  const rejected = rejectVerification(store, {
    verificationId: verification.id, reviewedBy: 'reviewer-2', reason: 'photo does not match',
  });

  assert.ok(rejected.integrityHash);
  const recomputed = hashPayload({
    id: rejected.id, subjectType: rejected.subjectType, subjectId: rejected.subjectId,
    claimType: rejected.claimType, status: rejected.status, reviewedBy: rejected.reviewedBy,
    reviewNotes: rejected.reviewNotes, reviewedAt: rejected.reviewedAt,
  }).hash;
  assert.equal(rejected.integrityHash, recomputed);
});
