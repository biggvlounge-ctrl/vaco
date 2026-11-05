// HVNTZ — Hunt time limits/scheduling. Closes this project's own
// flagged gap ("no hunt time limits or scheduling -- hunts are
// budget-bounded, not clock-bounded"). See lib/hunts.js's own header
// on createHunt for why this is additive (a hunt with no
// timeLimitMinutes stays exactly as budget-bounded as before).

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createHvntzStore, registerBusiness, registerLocation,
} = require('../lib/revenueStack');
const {
  createHunt, addCheckpoint, checkInAtCheckpoint, getHuntTimeStatus,
} = require('../lib/hunts');

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { ok: true }; };
  fn.legs = legs;
  return fn;
}

function checkpointFixture(store, hunt) {
  const business = registerBusiness(store, { name: 'Business 1', ownerId: 'owner-1' });
  const location = registerLocation(store, {
    businessId: business.id, locationType: 'hub', address: '1 Rooftop Way, St. Louis, MO', lat: 38.62, lng: -90.19,
  });
  return addCheckpoint(store, {
    huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 10, hostFee: 4, clue: 'Clue text',
  });
}

test('a hunt with no timeLimitMinutes has endsAt: null and can never expire', () => {
  const store = createHvntzStore();
  const hunt = createHunt(store, { title: 'Open-ended Hunt', sponsorId: 'sponsor-1', totalBudget: 500 });
  assert.strictEqual(hunt.endsAt, null);
  assert.strictEqual(hunt.timeLimitMinutes, null);
  assert.deepStrictEqual(getHuntTimeStatus(hunt, Date.now() + 1000 * 365 * 24 * 3600000), {
    started: true, expired: false, startsAt: hunt.startsAt, endsAt: null,
  });
});

test('createHunt rejects a non-positive timeLimitMinutes', () => {
  const store = createHvntzStore();
  assert.throws(
    () => createHunt(store, { title: 'Bad Hunt', sponsorId: 'sponsor-1', totalBudget: 500, timeLimitMinutes: 0 }),
    /timeLimitMinutes must be a positive number/,
  );
});

test('getHuntTimeStatus computes a real endsAt from startsAt + timeLimitMinutes', () => {
  const store = createHvntzStore();
  const startsAt = 1000000;
  const hunt = createHunt(store, {
    title: 'Timed Hunt', sponsorId: 'sponsor-1', totalBudget: 500, startsAt, timeLimitMinutes: 60,
  });
  assert.strictEqual(hunt.endsAt, startsAt + 60 * 60000);

  assert.strictEqual(getHuntTimeStatus(hunt, startsAt + 30 * 60000).expired, false);
  assert.strictEqual(getHuntTimeStatus(hunt, startsAt + 60 * 60000 + 1).expired, true);
});

test('checkInAtCheckpoint refuses before a scheduled hunt has started', async () => {
  const store = createHvntzStore();
  const startsAt = Date.now() + 3600000;
  const hunt = createHunt(store, { title: 'Future Hunt', sponsorId: 'sponsor-1', totalBudget: 500, startsAt });
  const checkpoint = checkpointFixture(store, hunt);
  const settleFn = recorder();

  await assert.rejects(
    checkInAtCheckpoint(store, { huntId: hunt.id, checkpointId: checkpoint.id, userId: 'sam', settleFn, now: Date.now() }),
    /has not started yet/,
  );
  assert.strictEqual(settleFn.legs.length, 0);
});

test('checkInAtCheckpoint refuses once a time-limited hunt has expired', async () => {
  const store = createHvntzStore();
  const startsAt = Date.now() - 3600000;
  const hunt = createHunt(store, {
    title: 'Expired Hunt', sponsorId: 'sponsor-1', totalBudget: 500, startsAt, timeLimitMinutes: 30,
  });
  const checkpoint = checkpointFixture(store, hunt);
  const settleFn = recorder();

  await assert.rejects(
    checkInAtCheckpoint(store, { huntId: hunt.id, checkpointId: checkpoint.id, userId: 'sam', settleFn, now: Date.now() }),
    /has expired/,
  );
  assert.strictEqual(settleFn.legs.length, 0);
});

test('checkInAtCheckpoint succeeds inside a real, open time window', async () => {
  const store = createHvntzStore();
  const startsAt = Date.now() - 600000;
  const hunt = createHunt(store, {
    title: 'Live Hunt', sponsorId: 'sponsor-1', totalBudget: 500, startsAt, timeLimitMinutes: 60,
  });
  const checkpoint = checkpointFixture(store, hunt);
  const settleFn = recorder();

  const result = await checkInAtCheckpoint(store, {
    huntId: hunt.id, checkpointId: checkpoint.id, userId: 'sam', settleFn, now: Date.now(),
  });
  assert.strictEqual(result.bountyPaid, 10);
  assert.ok(settleFn.legs.length > 0);
});
