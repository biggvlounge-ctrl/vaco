'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createImmigrationStore, admitWithPassport, crossIllegally, arrivalFor, listArrivals,
  listIllegalArrivals, catchIllegalArrival, reportSmugglingSpot, sealSmugglingSpot,
  listOpenSmugglingSpots, foundIllegalSettlement, discoverSettlement, clearIllegalSettlement,
  listActiveIllegalSettlements, listKnownIllegalSettlements, applyForCitizenship,
  applyForTemporaryPassport, isPassportExpired, TEMPORARY_PASSPORT_DURATION_MS,
  generateMigrationWave, deportPerson, isDeported, ILLEGAL_CROSSING_TERRAIN,
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

test('reportSmugglingSpot always lands in the uncharted, away-from-tech terrain -- a world fact, not a per-report choice', () => {
  const store = createImmigrationStore();
  const spot = reportSmugglingSpot(store, { locationLabel: 'the northern ice shelf gap', reportedBy: 'patrol-2' });
  assert.equal(spot.terrain, ILLEGAL_CROSSING_TERRAIN);
  // A second, differently-named spot gets the same fixed terrain fact
  // -- the specific place varies, the kind of place it is does not.
  const other = reportSmugglingSpot(store, { locationLabel: 'the old quarry trail' });
  assert.equal(other.terrain, ILLEGAL_CROSSING_TERRAIN);
});

test('foundIllegalSettlement starts off the grid -- real and active, but not yet known', () => {
  const store = createImmigrationStore();
  const settlement = foundIllegalSettlement(store, { founderId: 'carol', locationLabel: 'the frontier ridge' });
  assert.equal(settlement.clearedAt, null);
  assert.equal(settlement.discovered, false);
  assert.deepEqual(listActiveIllegalSettlements(store), [settlement]);
  assert.deepEqual(listKnownIllegalSettlements(store), [], 'the government does not know about it yet');
});

test('clearIllegalSettlement refuses to clear a settlement the government has not discovered', () => {
  const store = createImmigrationStore();
  const settlement = foundIllegalSettlement(store, { founderId: 'carol', locationLabel: 'the frontier ridge' });
  assert.throws(() => clearIllegalSettlement(store, settlement.id), /has not been discovered yet/);
});

test('discoverSettlement is the real, separate act that makes the government aware, once', () => {
  const store = createImmigrationStore();
  const settlement = foundIllegalSettlement(store, { founderId: 'carol', locationLabel: 'the frontier ridge' });
  const discovered = discoverSettlement(store, settlement.id, { discoveredBy: 'patrol-1' });
  assert.equal(discovered.discovered, true);
  assert.deepEqual(listKnownIllegalSettlements(store), [discovered]);
  assert.throws(() => discoverSettlement(store, settlement.id), /already discovered/);
});

test('discoverSettlement refuses an unknown settlement', () => {
  const store = createImmigrationStore();
  assert.throws(() => discoverSettlement(store, 9999), /no illegal settlement/);
});

test('foundIllegalSettlement and clearIllegalSettlement track a real standing claim, once discovered', () => {
  const store = createImmigrationStore();
  const settlement = foundIllegalSettlement(store, { founderId: 'carol', locationLabel: 'the frontier ridge' });
  discoverSettlement(store, settlement.id, { discoveredBy: 'patrol-1' });

  const cleared = clearIllegalSettlement(store, settlement.id, { clearedBy: 'patrol-1' });
  assert.ok(cleared.clearedAt);
  assert.equal(listActiveIllegalSettlements(store).length, 0);
  assert.equal(listKnownIllegalSettlements(store).length, 0);
  assert.throws(() => clearIllegalSettlement(store, settlement.id), /already cleared/);
});

test('deportPerson marks a real arrival deported, once, and keeps the real arrival history', () => {
  const store = createImmigrationStore();
  crossIllegally(store, { personId: 'dave' });
  assert.equal(isDeported(store, 'dave'), false);
  const deported = deportPerson(store, 'dave', { deportedBy: 'patrol-1', reason: 'illegal crossing' });
  assert.equal(deported.deported, true);
  assert.equal(deported.deportedBy, 'patrol-1');
  assert.equal(isDeported(store, 'dave'), true);
  assert.equal(arrivalFor(store, 'dave').id, deported.id, 'the arrival record is marked, never deleted');
  assert.throws(() => deportPerson(store, 'dave'), /already been deported/);
});

test('deportPerson refuses an unknown person, and a legal citizen can be deported too', () => {
  const store = createImmigrationStore();
  assert.throws(() => deportPerson(store, 'ghost'), /no arrival recorded/);
  admitWithPassport(store, { personId: 'erin' });
  const deported = deportPerson(store, 'erin', { reason: 'tax evasion' });
  assert.equal(deported.deported, true);
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

test('admitWithPassport and crossIllegally both default to a non-dissident arrival', () => {
  const store = createImmigrationStore();
  assert.equal(admitWithPassport(store, { personId: 'eve' }).dissident, false);
  assert.equal(crossIllegally(store, { personId: 'frank' }).dissident, false);
});

test('a dissident can still be a fully legal citizen -- opposing the government is not the same as entering unlawfully', () => {
  const store = createImmigrationStore();
  const arrival = admitWithPassport(store, { personId: 'gail', dissident: true });
  assert.equal(arrival.legal, true);
  assert.equal(arrival.dissident, true);
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
  // Per migrant, rng() is drawn twice: the dissident check, then the
  // legal check. dissidentFraction: 0 makes the dissident draw a
  // no-op regardless of value, so [0, 0.3] then [0, 0.7] isolates the
  // legal/illegal split: 0.3 (< 0.5) is legal, 0.7 (>= 0.5) is illegal.
  const result = generateMigrationWave(store, {
    survivorPopulation: 10, waveFraction: 0.2, legalFraction: 0.5, dissidentFraction: 0,
    onNewMigrant: () => `npc-${nextId++}`,
    rng: fixedRng(0, 0.3, 0, 0.7),
  });
  assert.equal(result.waveSize, 2);
  assert.equal(result.legalCount, 1);
  assert.equal(result.illegalCount, 1);
  assert.equal(result.dissidentCount, 0);
});

test('generateMigrationWave marks a real fraction of arrivals as dissident, legal or not', () => {
  const store = createImmigrationStore();
  let nextId = 1;
  // dissidentFraction 0.5: rng()=0.3 (< 0.5) is dissident, rng()=0.7
  // (>= 0.5) is not. legalFraction: 1 keeps every arrival legal so the
  // dissident signal is isolated from the legal/illegal one.
  const result = generateMigrationWave(store, {
    survivorPopulation: 10, waveFraction: 0.2, legalFraction: 1, dissidentFraction: 0.5,
    onNewMigrant: () => `npc-${nextId++}`,
    rng: fixedRng(0.3, 0, 0.7, 0),
  });
  assert.equal(result.dissidentCount, 1);
  assert.equal(result.arrivals[0].dissident, true);
  assert.equal(result.arrivals[1].dissident, false);
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
