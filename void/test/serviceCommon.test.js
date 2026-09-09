// VOID -- vetting, cancellation, and recurrence.
//
// **The gap these close was live.** Before `serviceCommon.js`,
// `canWorkVertical` required verification only for the two
// licensing-gated verticals. Everything else accepted a claim — which
// meant a stranger could register, claim `childcare`, and be eligible
// to watch a child with the system reporting `allowed: true`. That was
// verified against the running code, not assumed.
//
// Vetting fails open when it breaks, which is the worst direction for
// this particular control. A check that stops running does not error;
// it just starts letting everyone through.

const test = require('node:test');
const assert = require('node:assert');

const {
  VETTING_LEVELS, VERTICAL_VETTING_REQUIREMENTS,
  requiredVettingFor, recordVetting, revokeVetting,
  currentVettingLevel, meetsVettingRequirement,
  assessCancellation, generateOccurrences, MAX_OCCURRENCES,
} = require('../lib/serviceCommon');
const { registerProvider, addSkill, canWorkVertical } = require('../lib/providerProfiles');
const { createVoidStore } = require('../lib/store');

const NOW = Date.UTC(2026, 8, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const H = 60 * 60 * 1000;

function bareProvider(store, id = 'stranger') {
  return registerProvider(store, {
    providerId: id, displayName: id, homeBaseLat: 40.7, homeBaseLng: -74,
  });
}

// -- the gap this closed ----------------------------------------------

test('an UNVETTED provider cannot work childcare', () => {
  // This is the regression that matters most in the whole module.
  const store = createVoidStore();
  bareProvider(store);
  addSkill(store, { providerId: 'stranger', verticalId: 'childcare' });

  const result = canWorkVertical(store, 'stranger', 'childcare', NOW);
  assert.strictEqual(result.allowed, false);
  assert.match(result.reason, /background-checked/);
});

test('care verticals all require a background check', () => {
  for (const v of ['childcare', 'seniorCare', 'tutoring']) {
    assert.strictEqual(requiredVettingFor(v), 'background-checked', `${v} must require a background check`);
  }
});

test('a background check opens the gate', () => {
  const store = createVoidStore();
  bareProvider(store);
  addSkill(store, { providerId: 'stranger', verticalId: 'childcare' });
  recordVetting(store, {
    providerId: 'stranger', level: 'background-checked', verifiedBy: 'trust-ops',
    referenceId: 'BGC-1', expiresAt: NOW + 365 * DAY_MS, now: NOW,
  });

  assert.strictEqual(canWorkVertical(store, 'stranger', 'childcare', NOW).allowed, true);
});

test('a vertical needing no vetting is unaffected', () => {
  // The counterweight. A gate that blocked everything would pass every
  // check above while breaking the marketplace.
  const store = createVoidStore();
  bareProvider(store);
  addSkill(store, { providerId: 'stranger', verticalId: 'courier' });
  assert.strictEqual(canWorkVertical(store, 'stranger', 'courier', NOW).allowed, true);
});

// -- expiry, which is the point of storing a date -----------------------

test('an EXPIRED background check no longer counts', () => {
  // A check from four years ago is not a current check. Treating it as
  // one is the failure every care marketplace gets criticised for.
  const store = createVoidStore();
  bareProvider(store);
  addSkill(store, { providerId: 'stranger', verticalId: 'childcare' });
  recordVetting(store, {
    providerId: 'stranger', level: 'background-checked', verifiedBy: 'trust-ops',
    referenceId: 'BGC-1', expiresAt: NOW + 30 * DAY_MS, now: NOW,
  });

  assert.strictEqual(canWorkVertical(store, 'stranger', 'childcare', NOW + 29 * DAY_MS).allowed, true);
  assert.strictEqual(canWorkVertical(store, 'stranger', 'childcare', NOW + 31 * DAY_MS).allowed, false);
});

test('anything above identity MUST carry an expiry', () => {
  const store = createVoidStore();
  bareProvider(store);
  assert.throws(() => recordVetting(store, {
    providerId: 'stranger', level: 'background-checked',
    verifiedBy: 'trust-ops', referenceId: 'BGC-1', now: NOW,
  }), /requires an expiresAt/);
});

test('an already-expired result is refused at recording time', () => {
  const store = createVoidStore();
  bareProvider(store);
  assert.throws(() => recordVetting(store, {
    providerId: 'stranger', level: 'background-checked', verifiedBy: 'ops',
    referenceId: 'BGC-1', expiresAt: NOW - DAY_MS, now: NOW,
  }), /must be in the future/);
});

test('a revoked check stops counting immediately', () => {
  const store = createVoidStore();
  bareProvider(store);
  addSkill(store, { providerId: 'stranger', verticalId: 'childcare' });
  recordVetting(store, {
    providerId: 'stranger', level: 'background-checked', verifiedBy: 'ops',
    referenceId: 'BGC-1', expiresAt: NOW + 365 * DAY_MS, now: NOW,
  });
  revokeVetting(store, { providerId: 'stranger', referenceId: 'BGC-1', reason: 'new conviction', now: NOW });

  assert.strictEqual(canWorkVertical(store, 'stranger', 'childcare', NOW).allowed, false);
});

// -- evidence, not assertions ------------------------------------------

test('a vetting result must be traceable to who did it', () => {
  const store = createVoidStore();
  bareProvider(store);
  assert.throws(() => recordVetting(store, {
    providerId: 'stranger', level: 'identity-verified', referenceId: 'X', now: NOW,
  }), /verifiedBy/);
  assert.throws(() => recordVetting(store, {
    providerId: 'stranger', level: 'identity-verified', verifiedBy: 'ops', now: NOW,
  }), /referenceId/);
});

test('"none" cannot be recorded as a result', () => {
  // It is the absence of vetting, not an outcome.
  const store = createVoidStore();
  bareProvider(store);
  assert.throws(() => recordVetting(store, {
    providerId: 'stranger', level: 'none', verifiedBy: 'ops', referenceId: 'X', now: NOW,
  }), /absence of vetting/);
});

// -- levels are ordered -------------------------------------------------

test('a higher level satisfies a lower requirement', () => {
  // Someone background-checked does not need separate identity
  // verification.
  const store = createVoidStore();
  bareProvider(store);
  recordVetting(store, {
    providerId: 'stranger', level: 'background-checked', verifiedBy: 'ops',
    referenceId: 'BGC-1', expiresAt: NOW + 365 * DAY_MS, now: NOW,
  });
  assert.strictEqual(meetsVettingRequirement(store, 'stranger', 'petCare', NOW).meets, true);
});

test('a lower level does NOT satisfy a higher requirement', () => {
  const store = createVoidStore();
  bareProvider(store);
  recordVetting(store, {
    providerId: 'stranger', level: 'identity-verified',
    verifiedBy: 'ops', referenceId: 'IDV-1', now: NOW,
  });
  assert.strictEqual(meetsVettingRequirement(store, 'stranger', 'childcare', NOW).meets, false);
});

test('an unvetted provider reports "none" rather than undefined', () => {
  const store = createVoidStore();
  bareProvider(store);
  assert.strictEqual(currentVettingLevel(store, 'stranger', NOW), 'none');
});

test('the four levels are ordered least to most', () => {
  assert.deepStrictEqual(VETTING_LEVELS, [
    'none', 'identity-verified', 'background-checked', 'credential-verified',
  ]);
});

test('every vetting requirement names a real vertical', () => {
  // A typo here would silently mean a vertical is ungated.
  for (const verticalId of Object.keys(VERTICAL_VETTING_REQUIREMENTS)) {
    assert.doesNotThrow(() => requiredVettingFor(verticalId), `${verticalId} must be a real vertical`);
  }
});

// -- cancellation -------------------------------------------------------

test('cancelling with plenty of notice costs nothing', () => {
  const result = assessCancellation({
    scheduledFor: NOW + 48 * H, cancelledAt: NOW, jobTotal: 100,
  });
  assert.strictEqual(result.isLate, false);
  assert.strictEqual(result.customerFee, 0);
});

test('a late CUSTOMER cancellation charges them and pays the provider', () => {
  // The provider lost a slot they can no longer fill.
  const result = assessCancellation({
    scheduledFor: NOW + 2 * H, cancelledAt: NOW, jobTotal: 100, cancelledBy: 'customer',
  });
  assert.strictEqual(result.isLate, true);
  assert.strictEqual(result.customerFee, 50);
  assert.strictEqual(result.providerCompensation, 50);
});

test('a late PROVIDER cancellation charges the customer nothing', () => {
  // Reliability is a signal, not a fine. Charging the customer for the
  // provider's cancellation is how a marketplace loses customers.
  const result = assessCancellation({
    scheduledFor: NOW + 2 * H, cancelledAt: NOW, jobTotal: 100, cancelledBy: 'provider',
  });
  assert.strictEqual(result.customerFee, 0);
  assert.strictEqual(result.providerPenalty, 1);
});

test('the free-cancellation boundary is pinned', () => {
  const at23 = assessCancellation({ scheduledFor: NOW + 23 * H, cancelledAt: NOW, jobTotal: 100 });
  const at25 = assessCancellation({ scheduledFor: NOW + 25 * H, cancelledAt: NOW, jobTotal: 100 });
  assert.strictEqual(at23.isLate, true);
  assert.strictEqual(at25.isLate, false);
});

// -- recurrence ---------------------------------------------------------

test('occurrences are evenly spaced from the first', () => {
  const out = generateOccurrences({ firstAt: NOW, intervalDays: 7, occurrences: 4 });
  assert.strictEqual(out.length, 4);
  assert.strictEqual(out[1] - out[0], 7 * DAY_MS);
  assert.strictEqual(out[3], NOW + 21 * DAY_MS);
});

test('a runaway series is refused rather than generating thousands', () => {
  assert.throws(() => generateOccurrences({
    firstAt: NOW, intervalDays: 1, occurrences: MAX_OCCURRENCES + 1,
  }), /may not exceed/);
});

test('a series of one is not a series', () => {
  assert.throws(() => generateOccurrences({ firstAt: NOW, intervalDays: 7, occurrences: 1 }), /at least 2/);
});
