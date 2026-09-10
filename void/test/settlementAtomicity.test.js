// VOID — a settlement is one call, or the retry pays twice.
//
// **The defect these exist for, end to end.** Every settling path in
// VOID used to pay its parties with consecutive awaits:
//
//     await transferFn(customer, provider, payout, ...);
//     await transferFn(customer, 'void-platform', fee, ...);
//     job.status = 'completed';
//
// The second call can fail on its own — the first just debited the
// same customer. When it did:
//
//   1. the provider had been paid,
//   2. the throw meant `job.status` was never advanced, and
//   3. the retry guard (`'accepted'` in marketplace, `'confirmed'` in
//      pet care) therefore still passed.
//
// **So the retry paid the provider a second time.** Nothing logged it.
// The ledger simply held two payouts and one fee, and every
// balance-arithmetic assertion in the suite passed the whole way
// through — because the totals of a split settlement are identical to
// the totals of an atomic one. That is why the tests below count calls
// and replay failures instead of adding up money.
//
// The fix is `settleFn(legs, meta)` reaching V3's `POST
// /api/vcoin/settle`, which validates every leg against running
// balances and writes nothing unless all of them pass.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const marketplace = require('../lib/marketplace');
const petCare = require('../lib/petCare');
const engine = require('../lib/serviceEngine');
const { createVoidStore } = require('../lib/store');
const { registerProvider, addSkill } = require('../lib/providerProfiles');
const { recordVetting, requiredVettingFor } = require('../lib/serviceCommon');

const NOW = Date.UTC(2026, 8, 1);
const H = 60 * 60 * 1000;

// A settle function that records, and can be told to refuse. `fails`
// is what a real V3 does when the payer cannot cover every leg.
function ledger({ failFirstCall = false } = {}) {
  const calls = [];
  let refuseNext = failFirstCall;
  const fn = async (legs, meta = {}) => {
    if (refuseNext) {
      refuseNext = false;
      // V3's real message when the whole settlement is refused.
      throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    calls.push({ legs, meta });
    return { settlementId: calls.length };
  };
  fn.calls = calls;
  fn.paid = (userId) => calls
    .flatMap((c) => c.legs)
    .filter((l) => l.toUserId === userId)
    .reduce((n, l) => n + l.amount, 0);
  return fn;
}

// Vetting is a real gate; satisfying it lets these tests be about
// settlement rather than about the gate.
function vet(store, providerId, verticalId) {
  const needed = requiredVettingFor(verticalId);
  if (needed === 'none') return;
  recordVetting(store, {
    providerId, level: needed, verifiedBy: 'ops', referenceId: `R-${providerId}`,
    expiresAt: needed === 'identity-verified' ? null : NOW + 365 * 24 * H, now: NOW,
  });
}

// -- marketplace: the one loop every vertical runs through --------------

function acceptedJob(store) {
  const job = marketplace.requestJob(store, {
    verticalId: 'courier', customerId: 'sam', quantity: 1, unitPrice: 100,
  });
  marketplace.matchProvider(store, { jobId: job.id, providerId: 'pro' });
  marketplace.acceptJob(store, job.id);
  return job;
}

test('marketplace settles both legs in ONE call', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const job = acceptedJob(store);

  await marketplace.completeJob(store, { jobId: job.id, settleFn });

  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.equal(settleFn.calls[0].legs.length, 2, 'payout and fee stay separately auditable');
  assert.equal(job.providerPayout + job.platformFee, 100);
});

test('a refused settlement leaves the job retryable AND unpaid', async () => {
  // **The regression.** Refuse the first settlement, then retry. If the
  // legs went out separately, the provider was already paid once and
  // this retry pays them again — total 2x the payout for one job.
  const store = createVoidStore();
  const settleFn = ledger({ failFirstCall: true });
  const job = acceptedJob(store);

  await assert.rejects(
    () => marketplace.completeJob(store, { jobId: job.id, settleFn }),
    /Nothing in this settlement was applied/,
  );

  assert.equal(job.status, 'accepted', 'the job must stay retryable, not be marked complete');
  assert.equal(settleFn.calls.length, 0, 'a refused settlement recorded a movement');

  // The retry, which the status deliberately still permits.
  await marketplace.completeJob(store, { jobId: job.id, settleFn });

  assert.equal(job.status, 'completed');
  assert.equal(settleFn.paid('pro'), job.providerPayout,
    'the provider was paid more than once for a single job');
});

test('marketplace refuses to complete without a settleFn', async () => {
  // Silently unpaid is the worst outcome; a job that cannot settle must
  // not advance.
  const store = createVoidStore();
  const job = acceptedJob(store);
  await assert.rejects(
    () => marketplace.completeJob(store, { jobId: job.id }),
    /requires a settleFn/,
  );
  assert.equal(job.status, 'accepted');
});

// -- pet care, through the shared settlement.js -------------------------

function confirmedBooking(store) {
  registerProvider(store, { providerId: 'walker', displayName: 'walker', homeBaseLat: 40.7, homeBaseLng: -74 });
  addSkill(store, { providerId: 'walker', verticalId: 'petCare', now: NOW });
  vet(store, 'walker', 'petCare');
  const pet = petCare.registerPet(store, {
    ownerId: 'sam', name: 'Biscuit', species: 'dog', breed: 'beagle', weightKg: 12,
  });
  const mg = petCare.createBooking(store, {
    petId: pet.id, providerId: 'walker', service: 'drop-in',
    scheduledFor: NOW, isMeetAndGreet: true, now: NOW,
  });
  petCare.confirmBooking(store, { bookingId: mg.id });
  return { pet, mg };
}

test('a refused pet care settlement does not double-pay on retry', async () => {
  const store = createVoidStore();
  const settleFn = ledger({ failFirstCall: true });
  const { pet, mg } = confirmedBooking(store);
  await petCare.completeBooking(store, { bookingId: mg.id, settleFn, now: NOW });

  const b = petCare.createBooking(store, {
    petId: pet.id, providerId: 'walker', service: 'walk', price: 40,
    scheduledFor: NOW + 9 * H, now: NOW,
  });
  petCare.confirmBooking(store, { bookingId: b.id });

  await assert.rejects(
    () => petCare.completeBooking(store, { bookingId: b.id, settleFn, now: NOW + 10 * H }),
    /Nothing in this settlement was applied/,
  );
  assert.equal(b.status, 'confirmed', 'the booking must stay retryable');
  // `settledAt` starts as null on a fresh booking, so the property is
  // "still unset", not "undefined" — asserting the latter would pass
  // for the wrong reason on a record shape change.
  assert.ok(!b.settledAt, 'a refused settlement stamped the booking as settled');
  assert.ok(!b.settledTotal, 'a refused settlement recorded a settled total');

  await petCare.completeBooking(store, { bookingId: b.id, settleFn, now: NOW + 10 * H });

  assert.equal(b.status, 'completed');
  assert.equal(settleFn.paid('walker'), b.providerPayout,
    'the walker was paid twice for one booking');
});

// -- the service engine, which is 23 of the 25 verticals ----------------

test('the service engine settles through settlement.js, in one call', async () => {
  // `settlement.js`'s header said "the block moved here and all three
  // call it". The engine did not — it kept a byte-for-byte copy, so
  // every fix applied to `settleJob` missed the overwhelming majority
  // of VOID's money. This is the assertion that makes that claim real
  // rather than aspirational: a duplicated block would settle in two
  // calls, not one.
  const store = createVoidStore();
  const settleFn = ledger();

  registerProvider(store, { providerId: 'pro', displayName: 'pro', homeBaseLat: 40.7, homeBaseLng: -74 });
  addSkill(store, { providerId: 'pro', verticalId: 'beauty', now: NOW });
  vet(store, 'pro', 'beauty');
  const b = engine.createServiceBooking(store, {
    verticalId: 'beauty', customerId: 'sam', providerId: 'pro',
    service: engine.describeService(store, 'beauty').services[0],
    scheduledFor: NOW + 48 * H, quotedTotal: 200, now: NOW,
  });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'confirmed', settleFn, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'in-progress', settleFn, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'completed', settleFn, now: NOW });

  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.equal(settleFn.calls[0].legs.length, 2);
  assert.equal(b.settledTotal, 200);
  assert.equal(b.providerPayout + b.platformFee, 200);
});
