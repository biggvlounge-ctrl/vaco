'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createImmigrationStore, admitWithPassport, crossIllegally, arrivalFor, listArrivals,
  listIllegalArrivals, catchIllegalArrival, reportSmugglingSpot, sealSmugglingSpot,
  listOpenSmugglingSpots, foundIllegalSettlement, clearIllegalSettlement,
  listActiveIllegalSettlements, applyForCitizenship, applyForTemporaryPassport,
  isPassportExpired, TEMPORARY_PASSPORT_DURATION_MS, generateMigrationWave,
} from '../src/lib/immigration.js';

test('admitWithPassport records a real, legal arrival with the old-world background given', () => {
  const store = createImmigrationStore();
  const arrival = admitWithPassport(store, {
    personId: 'alice', originRegion: 'old-world-east', religion: 'unspecified',
    oldWorldSkills: { Business: 40 },
  });
  assert.equal(arrival.legal, true);
  assert.equal(arrival.method, 'passport');
  assert.deepEqual(arrival.smuggledGoods, []);
  assert.deepEqual(arrival.oldWorldSkills, { Business: 40 });
  assert.equal(arrivalFor(store, 'alice').id, arrival.id);
  assert.equal(listArrivals(store).length, 1);
});

test('admitWithPassport refuses a second arrival for the same person', () => {
  const store = createImmigrationStore();
  admitWithPassport(store, { personId: 'alice' });
  assert.throws(() => admitWithPassport(store, { personId: 'alice' }), /already been recorded arriving/);
});

test('crossIllegally records a real arrival flagged illegal, carrying whatever was smuggled', () => {
  const store = createImmigrationStore();
  const arrival = crossIllegally(store, {
    personId: 'bob', smuggledGoods: ['guns'], originRegion: 'old-world-west',
  });
  assert.equal(arrival.legal, false);
  assert.equal(arrival.method, 'illegal_crossing');
  assert.deepEqual(arrival.smuggledGoods, ['guns']);
  assert.equal(arrival.caught, false);
  assert.deepEqual(listIllegalArrivals(store), [arrival]);
});

test('an illegal arrival and a legal one share the same arrivals list', () => {
  const store = createImmigrationStore();
  admitWithPassport(store, { personId: 'alice' });
  crossIllegally(store, { personId: 'bob' });
  assert.equal(listArrivals(store).length, 2);
  assert.equal(listIllegalArrivals(store).length, 1);
  assert.equal(listIllegalArrivals(store)[0].personId, 'bob');
});

test('catchIllegalArrival marks a real illegal arrival caught, once', () => {
  const store = createImmigrationStore();
  crossIllegally(store, { personId: 'bob' });
  const caught = catchIllegalArrival(store, 'bob', { caughtBy: 'patrol-1' });
  assert.equal(caught.caught, true);
  assert.equal(caught.caughtBy, 'patrol-1');
  assert.throws(() => catchIllegalArrival(store, 'bob'), /already recorded caught/);
});

test('catchIllegalArrival refuses a legal arrival and an unknown person', () => {
  const store = createImmigrationStore();
  admitWithPassport(store, { personId: 'alice' });
  assert.throws(() => catchIllegalArrival(store, 'alice'), /is legal/);
  assert.throws(() => catchIllegalArrival(store, 'ghost'), /no arrival recorded/);
});

test('reportSmugglingSpot and sealSmugglingSpot are two real, separate events', () => {
  const store = createImmigrationStore();
  const spot = reportSmugglingSpot(store, { locationLabel: 'the eastern crevasse', reportedBy: 'patrol-1' });
  assert.equal(spot.sealed, false);
  assert.deepEqual(listOpenSmugglingSpots(store), [spot]);

  const sealed = sealSmugglingSpot(store, spot.id, { sealedBy: 'patrol-1' });
  assert.equal(sealed.sealed, true);
  assert.equal(listOpenSmugglingSpots(store).length, 0);
  assert.throws(() => sealSmugglingSpot(store, spot.id), /already sealed/);
});

test('sealSmugglingSpot refuses an unknown spot', () => {
  const store = createImmigrationStore();
  assert.throws(() => sealSmugglingSpot(store, 999), /no smuggling spot/);
});

test('foundIllegalSettlement and clearIllegalSettlement track a real standing claim', () => {
  const store = createImmigrationStore();
  const settlement = foundIllegalSettlement(store, { founderId: 'carol', locationLabel: 'the frontier ridge' });
  assert.equal(settlement.clearedAt, null);
  assert.deepEqual(listActiveIllegalSettlements(store), [settlement]);

  const cleared = clearIllegalSettlement(store, settlement.id, { clearedBy: 'patrol-1' });
  assert.ok(cleared.clearedAt);
  assert.equal(listActiveIllegalSettlements(store).length, 0);
  assert.throws(() => clearIllegalSettlement(store, settlement.id), /already cleared/);
});

test('applyForCitizenship grants a real, permanent passport -- no expiry', () => {
  const store = createImmigrationStore();
  const arrival = applyForCitizenship(store, { personId: 'alice' });
  assert.equal(arrival.citizenshipType, 'citizenship');
  assert.equal(arrival.expiresAt, null);
  assert.equal(isPassportExpired(store, 'alice', Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000), false);
});

test('applyForTemporaryPassport grants a real passport that only lasts so long', () => {
  const store = createImmigrationStore();
  const now = 1_000_000;
  const arrival = applyForTemporaryPassport(store, { personId: 'bob', now });
  assert.equal(arrival.citizenshipType, 'temporary');
  assert.equal(arrival.expiresAt, now + TEMPORARY_PASSPORT_DURATION_MS);
  assert.equal(isPassportExpired(store, 'bob', now), false);
  assert.equal(isPassportExpired(store, 'bob', now + TEMPORARY_PASSPORT_DURATION_MS), true);
  assert.equal(isPassportExpired(store, 'bob', now + TEMPORARY_PASSPORT_DURATION_MS - 1), false);
});

test('admitWithPassport defaults to citizenship, same as every caller before the field existed', () => {
  const store = createImmigrationStore();
  const arrival = admitWithPassport(store, { personId: 'carol' });
  assert.equal(arrival.citizenshipType, 'citizenship');
  assert.equal(arrival.expiresAt, null);
});

test('an illegal crossing applies for no citizenship type at all', () => {
  const store = createImmigrationStore();
  const arrival = crossIllegally(store, { personId: 'dave' });
  assert.equal(arrival.citizenshipType, null);
  assert.equal(arrival.expiresAt, null);
});

test('isPassportExpired refuses an unknown person', () => {
  const store = createImmigrationStore();
  assert.throws(() => isPassportExpired(store, 'ghost'), /no arrival recorded/);
});

test('admitWithPassport refuses an unknown citizenship type', () => {
  const store = createImmigrationStore();
  assert.throws(
    () => admitWithPassport(store, { personId: 'erin', citizenshipType: 'honorary' }),
    /not a known citizenship type/,
  );
});

function fixedRng(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('generateMigrationWave sizes a real wave off a real survivor count, and creates one real migrant per onNewMigrant call', () => {
  const store = createImmigrationStore();
  let nextId = 1;
  const result = generateMigrationWave(store, {
    survivorPopulation: 100, waveFraction: 0.1, legalFraction: 1, // every migrant legal, so the count is deterministic
    originRegions: ['east'], religions: ['none'],
    onNewMigrant: () => `npc-${nextId++}`,
    rng: fixedRng(0.5),
  });
  assert.equal(result.waveSize, 10);
  assert.equal(result.arrivals.length, 10);
  assert.equal(result.legalCount, 10);
  assert.equal(result.illegalCount, 0);
  assert.equal(listArrivals(store).length, 10);
  assert.equal(result.arrivals[0].originRegion, 'east');
  assert.equal(result.arrivals[0].religion, 'none');
});

test('generateMigrationWave splits legal and illegal by the real fraction given', () => {
  const store = createImmigrationStore();
  let nextId = 1;
  // legalFraction 0.5: rng()=0.3 (< 0.5) is legal, rng()=0.7 (>= 0.5) is illegal.
  const result = generateMigrationWave(store, {
    survivorPopulation: 10, waveFraction: 0.2, legalFraction: 0.5,
    onNewMigrant: () => `npc-${nextId++}`,
    rng: fixedRng(0.3, 0.7),
  });
  assert.equal(result.waveSize, 2);
  assert.equal(result.legalCount, 1);
  assert.equal(result.illegalCount, 1);
});

test('generateMigrationWave requires a real survivor count and a real onNewMigrant callback', () => {
  const store = createImmigrationStore();
  assert.throws(
    () => generateMigrationWave(store, { survivorPopulation: -1, onNewMigrant: () => 'x' }),
    /non-negative integer survivorPopulation/,
  );
  assert.throws(
    () => generateMigrationWave(store, { survivorPopulation: 10 }),
    /onNewMigrant/,
  );
});
