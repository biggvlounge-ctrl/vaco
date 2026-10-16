// VOID DROP -- mobile space rental & deployment. Covers the asset
// lifecycle (a unit outlives any one booking, same shape
// businessLockers.js already proved), the booking lifecycle (reuses
// the real shared marketplace loop rather than forking it), and the
// two places this module refuses rather than guesses: eligibility
// (never auto-approves) and double-booking (no overlapping dates for
// the same physical unit).

const test = require('node:test');
const assert = require('node:assert');

const { createVoidStore } = require('../lib/store');
const { getDropCategory, listDropCategories } = require('../lib/voidDropCategories');
const {
  registerDropAsset, getDropAsset, isBookable, setAssetStatus, moveAsset,
  logMaintenanceEvent, resolveMaintenanceEvent, hasOpenMaintenanceIssue,
} = require('../lib/voidDropAssets');
const {
  assessEligibility, computeDropPrice, listAvailableDropAssetsNear, isAssetAvailable,
  createDropBooking, getDropBooking,
  approveDropBooking, rejectDropBooking, scheduleDelivery, dispatchDelivery, markArrivedAndDeploying,
  startRental, scheduleRetrieval, dispatchRetrieval, markReturnedForInspection, recordInspectionResult,
  completeCleaningAndClose, cancelDropBooking,
} = require('../lib/voidDropBooking');
const { getJob } = require('../lib/marketplace');
const { registerStation } = require('../lib/stations');
const { registerProvider, addSkill, verifySkill } = require('../lib/providerProfiles');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20);

function fakeSettle() {
  const legs = [];
  const fn = async (jobLegs) => { legs.push(...jobLegs); };
  fn.legs = legs;
  return fn;
}

function spa(store, overrides = {}) {
  return registerDropAsset(store, {
    category: 'dropSpa', sizeDescription: '8x20ft trailer', weightKg: 3200, amenities: ['massage table', 'sink'],
    dailyRate: 150, ownerId: 'void-fleet', homeLat: 38.6270, homeLng: -90.1994, ...overrides,
  });
}

function eligibleBookingArgs(store, asset, overrides = {}) {
  return {
    customerId: 'cust-1', assetId: asset.id, category: asset.category, rentalModel: 'weekend',
    startDate: NOW + 2 * DAY, endDate: NOW + 4 * DAY,
    locationType: 'residential-yard', deliveryLat: 38.63, deliveryLng: -90.2,
    roadAccessConfirmed: true, intendedUse: 'birthday party', now: NOW,
    ...overrides,
  };
}

// An "approved" VOID driver per the founder's own wording -- a
// verified (not merely claimed) voidDrop skill.
function approvedDriver(store, id = 'driver-approved') {
  registerProvider(store, { providerId: id, displayName: id, homeBaseLat: 38.6, homeBaseLng: -90.2 });
  addSkill(store, { providerId: id, verticalId: 'voidDrop' });
  verifySkill(store, { providerId: id, verticalId: 'voidDrop' });
  return id;
}

function unapprovedDriver(store, id = 'driver-unverified') {
  registerProvider(store, { providerId: id, displayName: id, homeBaseLat: 38.6, homeBaseLng: -90.2 });
  addSkill(store, { providerId: id, verticalId: 'voidDrop' });
  return id;
}

// -- categories ----------------------------------------------------------

test('all 15 named products are registered categories', () => {
  const ids = listDropCategories().map((c) => c.id);
  assert.equal(ids.length, 15);
  for (const id of ['dropShop', 'dropFood', 'dropSpa', 'dropHot', 'dropPool', 'dropSauna', 'dropIce',
    'dropOffice', 'dropStudio', 'dropEvent', 'dropGame', 'dropRoom', 'dropHome', 'dropStorage', 'dropBath']) {
    assert.ok(ids.includes(id), `missing category ${id}`);
  }
});

test('DROP SHOP is branded DROP POP SHOP', () => {
  assert.equal(getDropCategory('dropShop').label, 'DROP POP SHOP');
});

test('dropHome is flagged zoning-sensitive; most categories are not', () => {
  assert.equal(getDropCategory('dropHome').zoningSensitive, true);
  assert.equal(getDropCategory('dropStorage').zoningSensitive, undefined);
});

// -- asset lifecycle -------------------------------------------------------

test('registerDropAsset validates its required real fields', () => {
  const store = createVoidStore();
  assert.throws(() => registerDropAsset(store, { category: 'not-real', sizeDescription: 'x', weightKg: 1, dailyRate: 1, ownerId: 'o' }), /unknown category/);
  assert.throws(() => registerDropAsset(store, { category: 'dropSpa', weightKg: 1, dailyRate: 1, ownerId: 'o' }), /sizeDescription/);
  assert.throws(() => registerDropAsset(store, { category: 'dropSpa', sizeDescription: 'x', weightKg: -1, dailyRate: 1, ownerId: 'o' }), /positive weightKg/);
  assert.throws(() => registerDropAsset(store, { category: 'dropSpa', sizeDescription: 'x', weightKg: 1, dailyRate: 1, ownerId: 'o', ownerType: 'landlord' }), /invalid ownerType/);
});

test('a newly registered asset starts available and bookable', () => {
  const store = createVoidStore();
  const asset = spa(store);
  assert.equal(asset.status, 'available');
  assert.ok(asset.id.startsWith('VOID-DROP-'));
  assert.equal(isBookable(store, asset.id), true);
});

test('status transitions follow the real lifecycle, not an arbitrary jump', () => {
  const store = createVoidStore();
  const asset = spa(store);
  setAssetStatus(store, { assetId: asset.id, status: 'reserved' });
  assert.throws(() => setAssetStatus(store, { assetId: asset.id, status: 'active-rental' }),
    /cannot move from "reserved" to "active-rental"/);
  setAssetStatus(store, { assetId: asset.id, status: 'in-transit' });
  setAssetStatus(store, { assetId: asset.id, status: 'deploying' });
  setAssetStatus(store, { assetId: asset.id, status: 'active-rental' });
});

test('an open maintenance issue blocks bookability even while status reads available', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const event = logMaintenanceEvent(store, { assetId: asset.id, type: 'repair', notes: 'leaking seal' });
  assert.equal(isBookable(store, asset.id), false);
  assert.equal(hasOpenMaintenanceIssue(store, asset.id), true);

  resolveMaintenanceEvent(store, { eventId: event.id });
  assert.equal(isBookable(store, asset.id), true);
});

test('moveAsset requires real numeric coordinates', () => {
  const store = createVoidStore();
  const asset = spa(store);
  assert.throws(() => moveAsset(store, { assetId: asset.id, lat: 'north', lng: -90 }), /numeric lat\/lng/);
  moveAsset(store, { assetId: asset.id, lat: 38.7, lng: -90.3 });
  assert.equal(getDropAsset(store, asset.id).lat, 38.7);
});

// -- hub-based homing ------------------------------------------------------

test('registerDropAsset derives its home location from a real station', () => {
  const store = createVoidStore();
  const hub = registerStation(store, { regionId: 'stl', stationType: 'hub-and-port', lat: 38.65, lng: -90.25 });
  const asset = registerDropAsset(store, {
    category: 'dropSpa', sizeDescription: '8x20ft trailer', weightKg: 3200, dailyRate: 150,
    ownerId: 'void-fleet', homeStationId: hub.id,
  });
  assert.equal(asset.homeStationId, hub.id);
  assert.equal(asset.homeLat, 38.65);
  assert.equal(asset.homeLng, -90.25);
});

test('registerDropAsset refuses an unknown homeStationId', () => {
  const store = createVoidStore();
  assert.throws(
    () => registerDropAsset(store, {
      category: 'dropSpa', sizeDescription: 'x', weightKg: 1, dailyRate: 1, ownerId: 'o', homeStationId: 999,
    }),
    /no station with id 999/,
  );
});

test('explicit homeLat/homeLng win over a station\'s own coordinates', () => {
  const store = createVoidStore();
  const hub = registerStation(store, { regionId: 'stl', stationType: 'hub-and-port', lat: 38.65, lng: -90.25 });
  const asset = registerDropAsset(store, {
    category: 'dropSpa', sizeDescription: 'x', weightKg: 1, dailyRate: 1, ownerId: 'o',
    homeStationId: hub.id, homeLat: 39.0, homeLng: -91.0,
  });
  assert.equal(asset.homeLat, 39.0);
  assert.equal(asset.homeLng, -91.0);
});

// -- eligibility: never auto-approves -------------------------------------

test('assessEligibility rejects real road-access and weight-limit failures', () => {
  const store = createVoidStore();
  const asset = spa(store);

  const noAccess = assessEligibility(store, {
    assetId: asset.id, locationType: 'residential-yard', roadAccessConfirmed: false, durationDays: 2, intendedUse: 'party',
  });
  assert.equal(noAccess.status, 'rejected');
  assert.match(noAccess.reasons[0], /road access/);

  const tooHeavy = assessEligibility(store, {
    assetId: asset.id, locationType: 'residential-yard', roadAccessConfirmed: true,
    siteMaxWeightKg: 1000, durationDays: 2, intendedUse: 'party',
  });
  assert.equal(tooHeavy.status, 'rejected');
  assert.match(tooHeavy.reasons[0], /weight limit/);
});

test('a real, passing check still comes back pending-review, never auto-approved', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const result = assessEligibility(store, {
    assetId: asset.id, locationType: 'residential-yard', roadAccessConfirmed: true, durationDays: 2, intendedUse: 'party',
  });
  assert.equal(result.status, 'pending-review');
});

test('a zoning-sensitive category carries a note a human reviewer must see', () => {
  const store = createVoidStore();
  const home = registerDropAsset(store, {
    category: 'dropHome', sizeDescription: '20ft modular unit', weightKg: 8000, dailyRate: 300, ownerId: 'void-fleet',
  });
  const result = assessEligibility(store, {
    assetId: home.id, locationType: 'vacant-lot', roadAccessConfirmed: true, durationDays: 30, intendedUse: 'guest house',
  });
  assert.equal(result.status, 'pending-review');
  assert.match(result.notes[0], /zoning-sensitive/);
});

// -- pricing ---------------------------------------------------------------

test('computeDropPrice charges for both real delivery legs, not just the outbound one', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const quote = computeDropPrice(store, { assetId: asset.id, durationDays: 2, deliveryLat: 38.63, deliveryLng: -90.2 });
  assert.equal(quote.rentalPrice, 300);
  assert.ok(quote.distanceKm > 0);
  const perLeg = Math.round(quote.distanceKm * 3 * 100) / 100;
  assert.equal(quote.outboundDeliveryFee, perLeg);
  assert.equal(quote.retrievalFee, perLeg, 'the return trip is a real leg too and must be priced');
  const expectedTotal = Math.round((quote.rentalPrice + quote.outboundDeliveryFee + quote.retrievalFee + 50) * 100) / 100;
  assert.equal(quote.totalPrice, expectedTotal);
});

test('computeDropPrice never fabricates a distance it does not have', () => {
  const store = createVoidStore();
  const asset = spa(store, { homeLat: null, homeLng: null });
  const quote = computeDropPrice(store, { assetId: asset.id, durationDays: 1 });
  assert.equal(quote.distanceKm, null);
  assert.equal(quote.outboundDeliveryFee, 0);
  assert.equal(quote.retrievalFee, 0);
});

// -- availability: no double-booking --------------------------------------

test('isAssetAvailable refuses an overlapping date range for the same asset', () => {
  const store = createVoidStore();
  const asset = spa(store);
  createDropBooking(store, eligibleBookingArgs(store, asset));

  assert.equal(isAssetAvailable(store, { assetId: asset.id, startDate: NOW + 3 * DAY, endDate: NOW + 5 * DAY }), false);
  assert.equal(isAssetAvailable(store, { assetId: asset.id, startDate: NOW + 10 * DAY, endDate: NOW + 12 * DAY }), true);
});

test('createDropBooking refuses a second overlapping booking for the same asset', () => {
  const store = createVoidStore();
  const asset = spa(store);
  createDropBooking(store, eligibleBookingArgs(store, asset));

  assert.throws(
    () => createDropBooking(store, eligibleBookingArgs(store, asset, { customerId: 'cust-2' })),
    /already booked for an overlapping date range/,
  );
});

test('createDropBooking refuses an unsupported rental model for the category', () => {
  const store = createVoidStore();
  const hot = registerDropAsset(store, { category: 'dropHot', sizeDescription: '6ft tub', weightKg: 400, dailyRate: 80, ownerId: 'void-fleet' });
  assert.throws(
    () => createDropBooking(store, eligibleBookingArgs(store, hot, { category: 'dropHot', rentalModel: 'rent-to-own' })),
    /not a supported rental model/,
  );
});

test('createDropBooking refuses outright on a real eligibility rejection', () => {
  const store = createVoidStore();
  const asset = spa(store);
  assert.throws(
    () => createDropBooking(store, eligibleBookingArgs(store, asset, { roadAccessConfirmed: false })),
    /location is not eligible/,
  );
});

// -- the full real lifecycle, happy path -----------------------------------

test('the full select -> book -> deliver -> deploy -> use -> retrieve -> redeploy cycle, with real drivers and a DREAMS screen', async () => {
  const store = createVoidStore();
  const asset = spa(store, { hasDreamsScreen: true });
  const deliveryDriver = approvedDriver(store, 'driver-out');
  const retrievalDriver = approvedDriver(store, 'driver-back');
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset, { siteAddress: '123 Main St, driveway on the left' }));
  assert.equal(booking.status, 'pending-approval');
  assert.equal(booking.eligibilityStatus, 'pending-review');

  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  assert.equal(getDropBooking(store, booking.id).status, 'booked');
  assert.equal(getDropAsset(store, asset.id).status, 'reserved');
  assert.ok(getDropBooking(store, booking.id).jobId);

  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW + DAY, deliveryWindowEnd: NOW + DAY + 2 * 3600000 });
  dispatchDelivery(store, { bookingId: booking.id, driverId: deliveryDriver, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'in-transit');
  assert.equal(getDropBooking(store, booking.id).deliveryDriverId, deliveryDriver);

  let registeredScreen = null;
  const registerDreamsScreenFn = async (payload) => {
    registeredScreen = payload;
    return { screenId: 777 };
  };
  await markArrivedAndDeploying(store, { bookingId: booking.id, registerDreamsScreenFn, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'deploying');
  assert.equal(getDropAsset(store, asset.id).lat, 38.63);
  assert.equal(getDropAsset(store, asset.id).dreamsScreenId, 777, 'a real screen must be registered for a unit that carries one');
  assert.equal(registeredScreen.screenOwnerId, asset.ownerId);
  assert.equal(registeredScreen.locationAddress, '123 Main St, driveway on the left');

  startRental(store, { bookingId: booking.id, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'active-rental');
  assert.ok(getDropBooking(store, booking.id).rentalStartedAt);

  scheduleRetrieval(store, { bookingId: booking.id, retrievalWindowStart: NOW + 4 * DAY, retrievalWindowEnd: NOW + 4 * DAY + 3600000 });
  let deactivatedScreenId = null;
  const deactivateDreamsScreenFn = async ({ screenId }) => { deactivatedScreenId = screenId; };
  await dispatchRetrieval(store, { bookingId: booking.id, driverId: retrievalDriver, deactivateDreamsScreenFn, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'in-transit');
  assert.equal(getDropBooking(store, booking.id).retrievalDriverId, retrievalDriver);
  assert.equal(deactivatedScreenId, 777, 'the real screen must be deactivated once the unit leaves the site');
  assert.equal(getDropAsset(store, asset.id).dreamsScreenId, null);

  markReturnedForInspection(store, { bookingId: booking.id, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'inspection');

  recordInspectionResult(store, { bookingId: booking.id, passed: true, now: NOW });
  assert.equal(getDropAsset(store, asset.id).status, 'cleaning');

  const settleFn = fakeSettle();
  const finished = await completeCleaningAndClose(store, { bookingId: booking.id, settleFn });
  assert.equal(finished.status, 'completed');
  assert.equal(getDropAsset(store, asset.id).status, 'available', 'the unit must return to the fleet for the next customer');
  assert.equal(isBookable(store, asset.id), true);

  const job = getJob(store, finished.jobId);
  assert.equal(job.status, 'completed');
  assert.ok(
    settleFn.legs.some((l) => l.toUserId === deliveryDriver && l.amount === finished.pricing.outboundDeliveryFee),
    'the delivery driver must be paid their real leg fee',
  );
  assert.ok(
    settleFn.legs.some((l) => l.toUserId === retrievalDriver && l.amount === finished.pricing.retrievalFee),
    'the retrieval driver must be paid their real leg fee',
  );
  assert.ok(
    settleFn.legs.every((l) => l.toUserId !== deliveryDriver || l.fromUserId === asset.operatorId),
    'the driver fee comes out of the operator\'s own proceeds, not a second charge to the customer',
  );

  // Spec §9: the same physical unit can now serve a second customer.
  assert.equal(
    isAssetAvailable(store, { assetId: asset.id, startDate: NOW + 10 * DAY, endDate: NOW + 12 * DAY }),
    true,
  );
});

test('dispatchDelivery refuses a driver who has only claimed, not been verified for, voidDrop', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  const driver = unapprovedDriver(store);
  assert.throws(
    () => dispatchDelivery(store, { bookingId: booking.id, driverId: driver, now: NOW }),
    /has only claimed the voidDrop skill, not been verified/,
  );
});

test('dispatchDelivery refuses a driver with no voidDrop skill at all', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  assert.throws(
    () => dispatchDelivery(store, { bookingId: booking.id, driverId: 'nobody', now: NOW }),
    /no provider registered/,
  );
});

test('a DREAMS outage never blocks deployment -- fails soft', async () => {
  const store = createVoidStore();
  const asset = spa(store, { hasDreamsScreen: true });
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: booking.id, now: NOW });

  const failingDreamsFn = async () => { throw new Error('DREAMS is down'); };
  const deployed = await markArrivedAndDeploying(store, { bookingId: booking.id, registerDreamsScreenFn: failingDreamsFn, now: NOW });
  assert.equal(deployed.status, 'deployed', 'deployment must succeed even when DREAMS cannot be reached');
  assert.equal(getDropAsset(store, asset.id).dreamsScreenId, null);
});

test('a unit with no DREAMS screen never calls the registration function', async () => {
  const store = createVoidStore();
  const asset = spa(store, { hasDreamsScreen: false });
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: booking.id, now: NOW });

  const registerDreamsScreenFn = async () => { throw new Error('must not be called'); };
  await markArrivedAndDeploying(store, { bookingId: booking.id, registerDreamsScreenFn, now: NOW });
});

// -- nearby search: VACAY's "Drop Hotel" surface calls this ---------------

test('listAvailableDropAssetsNear returns only bookable, available, in-radius assets, nearest first', () => {
  const store = createVoidStore();
  const near = spa(store, { homeLat: 38.63, homeLng: -90.2 });
  const far = spa(store, { homeLat: 40.7, homeLng: -74.0 }); // NYC -- far outside any reasonable radius from St. Louis
  registerDropAsset(store, {
    category: 'dropHot', sizeDescription: 'tub', weightKg: 400, dailyRate: 80, ownerId: 'o', homeLat: 38.64, homeLng: -90.21,
  });

  const results = listAvailableDropAssetsNear(store, {
    category: 'dropSpa', lat: 38.63, lng: -90.2, startDate: NOW + DAY, endDate: NOW + 3 * DAY,
  });

  assert.equal(results.length, 1, 'the far asset and the wrong-category asset must both be excluded');
  assert.equal(results[0].asset.id, near.id);
  assert.equal(results[0].distanceKm, 0);
  assert.ok(results[0].pricing.totalPrice > 0);
  assert.ok(!results.some((r) => r.asset.id === far.id));
});

test('listAvailableDropAssetsNear excludes an asset already booked for an overlapping range', () => {
  const store = createVoidStore();
  const asset = spa(store);
  createDropBooking(store, eligibleBookingArgs(store, asset));

  const overlapping = listAvailableDropAssetsNear(store, {
    category: 'dropSpa', lat: 38.63, lng: -90.2, startDate: NOW + 3 * DAY, endDate: NOW + 5 * DAY,
  });
  assert.equal(overlapping.length, 0);

  const clear = listAvailableDropAssetsNear(store, {
    category: 'dropSpa', lat: 38.63, lng: -90.2, startDate: NOW + 10 * DAY, endDate: NOW + 12 * DAY,
  });
  assert.equal(clear.length, 1);
});

test('a failed inspection takes the asset out of rotation rather than quietly rebooking it', async () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  scheduleDelivery(store, { bookingId: booking.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: booking.id, now: NOW });
  await markArrivedAndDeploying(store, { bookingId: booking.id, now: NOW });
  startRental(store, { bookingId: booking.id, now: NOW });
  scheduleRetrieval(store, { bookingId: booking.id, retrievalWindowStart: NOW, retrievalWindowEnd: NOW + 3600000 });
  await dispatchRetrieval(store, { bookingId: booking.id, now: NOW });
  markReturnedForInspection(store, { bookingId: booking.id, now: NOW });

  const finished = recordInspectionResult(store, { bookingId: booking.id, passed: false, notes: 'cracked panel', now: NOW });
  assert.equal(finished.status, 'completed');
  assert.equal(getDropAsset(store, asset.id).status, 'damaged');
  assert.equal(isBookable(store, asset.id), false, 'a damaged unit with an open issue must not be rebookable');
});

// -- approval/rejection and cancellation ------------------------------------

test('rejectDropBooking never touches the asset or the job system', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  const rejected = rejectDropBooking(store, { bookingId: booking.id, reason: 'property does not meet fire code', now: NOW });
  assert.equal(rejected.status, 'rejected');
  assert.equal(getDropAsset(store, asset.id).status, 'available');
  assert.equal(rejected.jobId, null);
});

test('rejectDropBooking requires a reason', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  assert.throws(() => rejectDropBooking(store, { bookingId: booking.id }), /requires a reason/);
});

test('a booking can be cancelled before dispatch but not after the unit is moving', () => {
  const store = createVoidStore();
  const asset = spa(store);
  const booking = createDropBooking(store, eligibleBookingArgs(store, asset));
  approveDropBooking(store, { bookingId: booking.id, now: NOW });
  const cancelled = cancelDropBooking(store, { bookingId: booking.id, now: NOW });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(getDropAsset(store, asset.id).status, 'available', 'cancelling before dispatch must free the asset back up');

  const second = createDropBooking(store, eligibleBookingArgs(store, asset, { customerId: 'cust-3' }));
  approveDropBooking(store, { bookingId: second.id, now: NOW });
  scheduleDelivery(store, { bookingId: second.id, deliveryWindowStart: NOW, deliveryWindowEnd: NOW + 3600000 });
  dispatchDelivery(store, { bookingId: second.id, now: NOW });
  assert.throws(() => cancelDropBooking(store, { bookingId: second.id }), /already been dispatched/);
});
