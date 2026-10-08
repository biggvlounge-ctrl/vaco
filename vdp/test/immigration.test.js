'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createImmigrationStore, admitWithPassport, crossIllegally, arrivalFor, listArrivals,
  listIllegalArrivals, catchIllegalArrival, reportSmugglingSpot, sealSmugglingSpot,
  listOpenSmugglingSpots, foundIllegalSettlement, clearIllegalSettlement,
  listActiveIllegalSettlements,
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
