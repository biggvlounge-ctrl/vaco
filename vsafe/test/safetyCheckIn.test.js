// VSAFE -- safety check-ins.
//
// This is the highest-consequence untested code in the ecosystem. Six
// apps depend on it, and its failure mode is not a wrong balance: it
// is a person who set a check-in timer, did not confirm, and had
// nobody notified.
//
// The regressions worth catching are the quiet ones. An escalation
// that flips `>` to `>=` still works on every timestamp except the
// boundary. A confirm that stops guarding on status would let an
// escalated check-in be marked safe by a late confirmation. An
// escalation sweep that skips already-escalated records is correct;
// one that re-escalates them floods contacts. None of these throw.

const test = require('node:test');
const assert = require('node:assert');

const {
  SOURCE_APPS, CHECKIN_STATUSES,
  createSafetyCheckIn, getSafetyCheckIn, confirmSafe, triggerEmergency,
  checkForMissedCheckIns,
} = require('../lib/safetyCheckIn');
const { createVsafeStore } = require('../lib/store');

const NOW = Date.UTC(2026, 0, 1);
const MIN = 60 * 1000;

function makeCheckIn(store, overrides = {}) {
  return createSafetyCheckIn(store, {
    userId: 'alice',
    sourceApp: 'cvnvo',
    activityType: 'first-date',
    trustedContactIds: ['contact-1'],
    checkInWindowMinutes: 60,
    now: NOW,
    ...overrides,
  });
}

// -- creation requires the things that make it useful -----------------

test('a check-in requires at least one trusted contact', () => {
  // A check-in with nobody to notify is not a safety feature. This is
  // the single most important validation in the module.
  const store = createVsafeStore();
  assert.throws(() => makeCheckIn(store, { trustedContactIds: [] }), /at least one real trustedContactId/);
  assert.throws(() => makeCheckIn(store, { trustedContactIds: undefined }), /trustedContactId/);
  assert.strictEqual(store.safetyCheckIns.length, 0);
});

test('a check-in requires a real positive window', () => {
  const store = createVsafeStore();
  for (const bad of [0, -30, 1.5, '60', undefined]) {
    assert.throws(() => makeCheckIn(store, { checkInWindowMinutes: bad }), /positive integer/);
  }
});

test('only the six real source apps can create a check-in', () => {
  assert.deepStrictEqual([...SOURCE_APPS].sort(), [
    'cvnvo', 'hvntz', 'vacay', 'vault-studios', 'void', 'vxllage',
  ]);
  const store = createVsafeStore();
  assert.throws(() => makeCheckIn(store, { sourceApp: 'voken' }), /invalid sourceApp/);
});

test('a new check-in starts active, unconfirmed, and un-escalated', () => {
  const store = createVsafeStore();
  const c = makeCheckIn(store);
  assert.strictEqual(c.status, 'active');
  assert.strictEqual(c.emergencyTriggered, false);
  assert.strictEqual(c.confirmedAt, null);
  assert.strictEqual(c.checkInTimerExpiresAt, NOW + 60 * MIN);
});

// -- the timer, including its boundary --------------------------------

test('a check-in inside its window does NOT escalate', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  assert.deepStrictEqual(checkForMissedCheckIns(store, { now: NOW + 59 * MIN }), []);
  assert.strictEqual(getSafetyCheckIn(store, 1).status, 'active');
});

test('exactly at the deadline is not yet missed', () => {
  // Pins the comparison. A flip to >= would escalate on the boundary,
  // notifying contacts for someone who still has the moment to
  // confirm. Both directions are defensible; what matters is that the
  // choice is pinned rather than incidental.
  const store = createVsafeStore();
  makeCheckIn(store);
  assert.deepStrictEqual(checkForMissedCheckIns(store, { now: NOW + 60 * MIN }), []);
});

test('past the deadline it escalates and flags the emergency', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  const escalated = checkForMissedCheckIns(store, { now: NOW + 61 * MIN });

  assert.strictEqual(escalated.length, 1);
  assert.strictEqual(escalated[0].status, 'escalated');
  assert.strictEqual(escalated[0].emergencyTriggered, true);
  // The contacts must ride along -- a notification layer has nothing
  // to act on otherwise.
  assert.deepStrictEqual(escalated[0].trustedContactIds, ['contact-1']);
});

test('an escalated check-in is not escalated twice', () => {
  // Re-escalation would re-notify every contact on every sweep.
  const store = createVsafeStore();
  makeCheckIn(store);
  assert.strictEqual(checkForMissedCheckIns(store, { now: NOW + 61 * MIN }).length, 1);
  assert.strictEqual(checkForMissedCheckIns(store, { now: NOW + 120 * MIN }).length, 0);
});

test('a confirmed check-in never escalates, however late the sweep', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  confirmSafe(store, { checkInId: 1, now: NOW + 10 * MIN });
  assert.deepStrictEqual(checkForMissedCheckIns(store, { now: NOW + 999 * MIN }), []);
  assert.strictEqual(getSafetyCheckIn(store, 1).status, 'confirmed-safe');
});

test('one user missing a check-in does not escalate anyone else', () => {
  const store = createVsafeStore();
  makeCheckIn(store, { userId: 'alice', checkInWindowMinutes: 30 });
  makeCheckIn(store, { userId: 'bob', checkInWindowMinutes: 240 });

  const escalated = checkForMissedCheckIns(store, { now: NOW + 31 * MIN });
  assert.strictEqual(escalated.length, 1);
  assert.strictEqual(escalated[0].userId, 'alice');
  assert.strictEqual(getSafetyCheckIn(store, 2).status, 'active');
});

// -- confirmation, and what must not be confirmable -------------------

test('confirming marks safe and records when', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  const c = confirmSafe(store, { checkInId: 1, now: NOW + 5 * MIN });
  assert.strictEqual(c.status, 'confirmed-safe');
  assert.strictEqual(c.confirmedAt, NOW + 5 * MIN);
});

test('an ESCALATED check-in cannot be quietly confirmed safe', () => {
  // The important one. Once contacts have been alerted, a later
  // confirmation must not silently close the incident as if nothing
  // happened -- resolving an escalation is a different act from
  // confirming on time, and the code refuses to conflate them.
  const store = createVsafeStore();
  makeCheckIn(store);
  checkForMissedCheckIns(store, { now: NOW + 61 * MIN });
  assert.throws(() => confirmSafe(store, { checkInId: 1, now: NOW + 62 * MIN }), /not awaiting confirmation/);
  assert.strictEqual(getSafetyCheckIn(store, 1).status, 'escalated');
});

test('confirming twice is refused', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  confirmSafe(store, { checkInId: 1, now: NOW + MIN });
  assert.throws(() => confirmSafe(store, { checkInId: 1, now: NOW + 2 * MIN }), /not awaiting confirmation/);
});

test('confirming a check-in that does not exist throws', () => {
  const store = createVsafeStore();
  assert.throws(() => confirmSafe(store, { checkInId: 999 }), /no check-in with id/);
});

// -- the panic button -------------------------------------------------

test('the panic trigger escalates immediately, well inside the window', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  const c = triggerEmergency(store, { checkInId: 1, now: NOW + MIN });
  assert.strictEqual(c.status, 'escalated');
  assert.strictEqual(c.emergencyTriggered, true);
  assert.strictEqual(c.confirmedAt, null);
});

test('the panic trigger is refused on an already-confirmed check-in', () => {
  const store = createVsafeStore();
  makeCheckIn(store);
  confirmSafe(store, { checkInId: 1, now: NOW + MIN });
  assert.throws(() => triggerEmergency(store, { checkInId: 1 }), /already confirmed safe/);
});

test('the three statuses are the only ones', () => {
  assert.deepStrictEqual([...CHECKIN_STATUSES].sort(), ['active', 'confirmed-safe', 'escalated']);
});
