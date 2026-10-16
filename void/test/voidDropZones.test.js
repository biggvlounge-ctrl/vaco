// VOID DROP ZONES -- several real units, co-located into a real
// "small village"/"shopping center" (spec §18, founder's own
// follow-up). Covers real zone capacity (refuses before accepting,
// same posture isAssetAvailable already holds), the fact that a
// booking into a zone treats the zone's own site as already proven
// (no separate road-access question), and the real "what's on site
// right now" occupancy view.

const test = require('node:test');
const assert = require('node:assert');

const { createVoidStore } = require('../lib/store');
const {
  registerDropZone, getDropZone, listDropZones, setZoneStatus, isZoneAvailable, getZoneOccupancy,
} = require('../lib/voidDropZones');
const { registerDropAsset } = require('../lib/voidDropAssets');
const {
  createDropBooking, approveDropBooking, scheduleDelivery, dispatchDelivery, markArrivedAndDeploying,
} = require('../lib/voidDropBooking');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20);

function zone(store, overrides = {}) {
  return registerDropZone(store, {
    name: 'Cherokee St Shopping Center Lot', locationType: 'vacant-lot',
    lat: 38.6, lng: -90.2, maxUnits: 2, ownerId: 'property-owner-1', ...overrides,
  });
}

function asset(store, category, overrides = {}) {
  return registerDropAsset(store, {
    category, sizeDescription: 'x', weightKg: 1000, dailyRate: 100, ownerId: 'void-fleet', ...overrides,
  });
}

test('registerDropZone validates its required real fields', () => {
  const store = createVoidStore();
  assert.throws(() => registerDropZone(store, { locationType: 'vacant-lot', lat: 1, lng: 1, maxUnits: 2, ownerId: 'o' }), /requires a name/);
  assert.throws(() => registerDropZone(store, { name: 'x', lat: 1, lng: 1, maxUnits: 2, ownerId: 'o' }), /requires a locationType/);
  assert.throws(() => registerDropZone(store, { name: 'x', locationType: 'vacant-lot', lat: 1, lng: 1, maxUnits: 0, ownerId: 'o' }), /positive integer maxUnits/);
  assert.throws(() => registerDropZone(store, { name: 'x', locationType: 'vacant-lot', lat: 1, lng: 1, maxUnits: 2 }), /requires an ownerId/);
});

test('a new zone is active, retrievable by its real id, and reports its own real capacity', () => {
  const store = createVoidStore();
  const z = zone(store, { maxUnits: 3 });
  assert.equal(z.status, 'active');
  assert.ok(z.id.startsWith('VOID-ZONE-'));
  assert.deepEqual(getDropZone(store, z.id), z);
  assert.equal(isZoneAvailable(store, { zoneId: z.id, startDate: NOW, endDate: NOW + DAY }), true);
});

test('a zone refuses a booking once its real capacity is full', () => {
  const store = createVoidStore();
  const z = zone(store, { maxUnits: 2 });
  const foodTruck = asset(store, 'dropFood');
  const shop = asset(store, 'dropShop');
  const bar = asset(store, 'dropBar');

  createDropBooking(store, {
    customerId: 'c1', assetId: foodTruck.id, category: 'dropFood', rentalModel: 'weekend',
    startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'festival',
  });
  createDropBooking(store, {
    customerId: 'c2', assetId: shop.id, category: 'dropShop', rentalModel: 'weekend',
    startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'pop-up retail',
  });

  assert.equal(isZoneAvailable(store, { zoneId: z.id, startDate: NOW, endDate: NOW + 2 * DAY }), false);
  assert.throws(
    () => createDropBooking(store, {
      customerId: 'c3', assetId: bar.id, category: 'dropBar', rentalModel: 'weekend',
      startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'festival bar',
    }),
    /no open slot/,
  );
});

test('a booking into a full zone for a non-overlapping date range still succeeds', () => {
  const store = createVoidStore();
  const z = zone(store, { maxUnits: 1 });
  const a1 = asset(store, 'dropFood');
  const a2 = asset(store, 'dropShop');

  createDropBooking(store, {
    customerId: 'c1', assetId: a1.id, category: 'dropFood', rentalModel: 'weekend',
    startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'festival',
  });

  const later = createDropBooking(store, {
    customerId: 'c2', assetId: a2.id, category: 'dropShop', rentalModel: 'weekend',
    startDate: NOW + 10 * DAY, endDate: NOW + 12 * DAY, zoneId: z.id, intendedUse: 'pop-up retail',
  });
  assert.equal(later.zoneId, z.id);
});

test('a booking into a zone inherits the zone\'s own location and treats road access as already proven', () => {
  const store = createVoidStore();
  const z = zone(store, { lat: 38.61, lng: -90.21, siteAddress: '100 Cherokee St lot' });
  const a = asset(store, 'dropFood');

  const booking = createDropBooking(store, {
    customerId: 'c1', assetId: a.id, category: 'dropFood', rentalModel: 'weekend',
    startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'festival',
    // Deliberately NOT passing locationType/deliveryLat/deliveryLng/
    // roadAccessConfirmed -- the zone supplies all of it.
  });

  assert.equal(booking.deliveryLat, 38.61);
  assert.equal(booking.deliveryLng, -90.21);
  assert.equal(booking.locationType, 'vacant-lot');
  assert.equal(booking.siteAddress, '100 Cherokee St lot');
  assert.equal(booking.eligibilityStatus, 'pending-review', 'still a real human sign-off, even at a proven zone');
});

test('createDropBooking refuses an unknown or inactive zone', () => {
  const store = createVoidStore();
  const a = asset(store, 'dropFood');
  assert.throws(
    () => createDropBooking(store, {
      customerId: 'c1', assetId: a.id, category: 'dropFood', rentalModel: 'weekend',
      startDate: NOW, endDate: NOW + 2 * DAY, zoneId: 'VOID-ZONE-9999', intendedUse: 'festival',
    }),
    /no zone with id/,
  );

  const z = zone(store);
  setZoneStatus(store, { zoneId: z.id, status: 'inactive' });
  assert.throws(
    () => createDropBooking(store, {
      customerId: 'c1', assetId: a.id, category: 'dropFood', rentalModel: 'weekend',
      startDate: NOW, endDate: NOW + 2 * DAY, zoneId: z.id, intendedUse: 'festival',
    }),
    /is "inactive", not "active"/,
  );
});

test('getZoneOccupancy shows the real small village of units actually on site right now', async () => {
  const store = createVoidStore();
  const z = zone(store, { maxUnits: 3 });
  const foodTruck = asset(store, 'dropFood');
  const shop = asset(store, 'dropShop');
  const stillBooked = asset(store, 'dropBar');

  // Deployed and on site.
  const b1 = createDropBooking(store, {
    customerId: 'c1', assetId: foodTruck.id, category: 'dropFood', rentalModel: 'weekend',
    startDate: NOW - DAY, endDate: NOW + 5 * DAY, zoneId: z.id, intendedUse: 'festival',
  });
  approveDropBooking(store, { bookingId: b1.id, now: NOW });
  scheduleDelivery(store, { bookingId: b1.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: b1.id, now: NOW });
  await markArrivedAndDeploying(store, { bookingId: b1.id, now: NOW });

  // Also deployed and on site.
  const b2 = createDropBooking(store, {
    customerId: 'c2', assetId: shop.id, category: 'dropShop', rentalModel: 'weekend',
    startDate: NOW - DAY, endDate: NOW + 5 * DAY, zoneId: z.id, intendedUse: 'pop-up retail',
  });
  approveDropBooking(store, { bookingId: b2.id, now: NOW });
  scheduleDelivery(store, { bookingId: b2.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: b2.id, now: NOW });
  await markArrivedAndDeploying(store, { bookingId: b2.id, now: NOW });

  // Booked for the zone but not yet dispatched -- not physically there.
  createDropBooking(store, {
    customerId: 'c3', assetId: stillBooked.id, category: 'dropBar', rentalModel: 'weekend',
    startDate: NOW + 20 * DAY, endDate: NOW + 22 * DAY, zoneId: z.id, intendedUse: 'festival bar',
  });

  const occupancy = getZoneOccupancy(store, z.id, { now: NOW });
  assert.equal(occupancy.occupiedCount, 2, 'only the two real units physically on site count, not the merely-booked one');
  assert.equal(occupancy.capacity, 3);
  assert.deepEqual(occupancy.units.map((u) => u.category).sort(), ['dropFood', 'dropShop']);
  assert.ok(occupancy.units.every((u) => u.status === 'deployed'));
});

test('listDropZones filters by status', () => {
  const store = createVoidStore();
  const a = zone(store);
  const b = zone(store);
  setZoneStatus(store, { zoneId: b.id, status: 'inactive' });

  assert.equal(listDropZones(store).length, 2);
  assert.equal(listDropZones(store, { status: 'active' }).length, 1);
  assert.equal(listDropZones(store, { status: 'active' })[0].id, a.id);
});

test('setZoneStatus validates its status value', () => {
  const store = createVoidStore();
  const z = zone(store);
  assert.throws(() => setZoneStatus(store, { zoneId: z.id, status: 'archived' }), /invalid status/);
  assert.throws(() => setZoneStatus(store, { zoneId: 'VOID-ZONE-9999', status: 'inactive' }), /no zone with id/);
});
