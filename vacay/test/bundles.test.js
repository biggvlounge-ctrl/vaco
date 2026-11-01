// VACAY -- Flights+Stay+Car (+ VOID Ride Pack) bundles.
// Same `ledger()` real-balance convention as money.test.js, and the
// same real fixture shape as its own "a full session across three
// sub-products conserves value exactly" test -- this file is that
// same scenario, but through `bookBundle` itself (lib/flights/
// routes.js), the one real orchestration point `/api/flights/bundles`
// calls, rather than calling each sub-product's own function
// separately the way that earlier test does.

const test = require('node:test');
const assert = require('node:assert');

const { createVacayStore } = require('../lib/store');
const { bookBundle } = require('../lib/flights/routes');
const listings = require('../lib/bookings/listings');
const vehicles = require('../lib/auto/vehicles');
const fleetRentals = require('../lib/auto/fleetRentals');
const flightCatalog = require('../lib/flights/flights');
const reservations = require('../lib/flights/reservations');
const bookings = require('../lib/bookings/bookings');
const { createBooking } = bookings;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 1);

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Same real-balance ledger as money.test.js (not duplicated verbatim
// since there is no shared test-helpers module here, but identical in
// behavior, which is the part every assertion below depends on).
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const calls = [];
  const fn = async (legs, meta = {}) => {
    if (!Array.isArray(legs) || legs.length === 0) {
      throw new Error(`ledger: refusing a settlement with no legs (${meta.reason})`);
    }
    for (const { fromUserId: from, toUserId: to, amount, reason } of legs) {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error(`ledger: refusing a non-numeric transfer of ${amount} (${reason})`);
      }
      if (amount < 0) throw new Error(`ledger: refusing a negative transfer (${reason})`);
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
      moves.push({ from, to, amount, reason });
    }
    calls.push({ legs, meta });
    return { ok: true };
  };
  const openingTotal = Object.values(balances).reduce((a, b) => a + b, 0);
  fn.balances = balances;
  fn.moves = moves;
  fn.calls = calls;
  fn.of = (account) => balances[account] || 0;
  fn.drift = () => round2(Object.values(balances).reduce((a, b) => a + b, 0) - openingTotal);
  return fn;
}

function fixture() {
  const store = createVacayStore();
  const stay = listings.createListing(store.bookings, {
    hostId: 'ines', title: 'Loft', city: 'St. Louis', pricePerNight: 120,
    hostType: 'individual', listingType: 'entire-place',
  });
  const car = vehicles.listVehicle(store.auto, {
    ownerId: 'kai', type: 'truck', make: 'Toyota', model: 'Tacoma',
    year: 2021, dailyRate: 80, protectionPlan: 'standard',
  });
  const flight = flightCatalog.listFlight(store.flights, {
    airline: 'Delta', flightNumber: 'DL404', origin: 'STL', destination: 'LAX',
    departureAt: NOW + 20 * DAY, arrivalAt: NOW + 20 * DAY + 4 * 3600000,
    cabinClass: 'economy', capacity: 4, netRate: 180, retailPrice: 240, now: NOW,
  });
  return { store, stay, car, flight };
}

function stubRidePack({ fail = false } = {}) {
  const calls = [];
  const fn = async (args, authHeader) => {
    calls.push({ args, authHeader });
    if (fail) throw Object.assign(new Error('VOID refused the ride pack purchase'), { status: 502 });
    return { id: 1, customerId: args.customerId, planId: args.planId, status: 'active' };
  };
  fn.calls = calls;
  return fn;
}

test('bookBundle with just flight+stay books both through the same settleFn, no car or ride pack', async () => {
  const { store, stay, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });

  const result = await bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
  });

  assert.ok(result.stayBooking);
  assert.ok(result.flightBooking);
  assert.strictEqual(result.carBooking, null);
  assert.strictEqual(result.ridePack, null);
  assert.strictEqual(result.bundleDiscountApplied, 0.10);
  assert.strictEqual(settleFn.calls.length, 2, 'the stay and the flight are the only two real charges');
});

test('bookBundle with a peer (Turo-style) car adds a real third leg through the same settleFn', async () => {
  const { store, stay, car, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });

  const result = await bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    car: { kind: 'vehicle', vehicleId: car.id, renterId: 'sam', startDate: NOW + 20 * DAY, endDate: NOW + 23 * DAY },
  });

  assert.ok(result.carBooking, 'the peer rental leg must come back on the response');
  assert.strictEqual(result.carBooking.vehicleId, car.id);
  assert.strictEqual(settleFn.calls.length, 3, 'stay, flight, and the car rental -- three real charges');
  assert.ok(settleFn.of(require('../lib/auto/rentals').VACAY_AUTO_ESCROW_ACCOUNT) > 0,
    'the car leg really charged the real Auto escrow account, not a bundle-only side account');
});

test('bookBundle with a VACAY fleet car books through bookFleetRental, not the peer path', async () => {
  const { store, stay, flight } = fixture();
  const fleetVehicle = fleetRentals.addFleetVehicle(store.auto, {
    type: 'suv', make: 'Jeep', model: 'Grand Cherokee', year: 2024, dailyRate: 95, location: 'LAX',
  });
  const settleFn = ledger({ sam: 5000 });

  const result = await bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    car: { kind: 'fleet', vehicleId: fleetVehicle.id, renterId: 'sam', startDate: NOW + 20 * DAY, endDate: NOW + 23 * DAY },
  });

  assert.ok(result.carBooking);
  assert.strictEqual(result.carBooking.vehicleId, fleetVehicle.id);
  assert.ok(settleFn.of(fleetRentals.VACAY_AUTO_FLEET_ESCROW_ACCOUNT) > 0,
    'a "fleet" car leg must charge the FLEET escrow, never the peer rentals.js one');
});

test('bookBundle refuses an unknown car.kind before charging anyone', async () => {
  const { store, stay, car, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });

  await assert.rejects(() => bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    car: { kind: 'limo', vehicleId: car.id, renterId: 'sam', startDate: NOW + 20 * DAY, endDate: NOW + 23 * DAY },
  }), /requires a kind of/);

  assert.strictEqual(settleFn.calls.length, 0, 'a bad car.kind must be caught before the stay or flight are charged');
});

test('bookBundle with a ridePack forwards the real Authorization header into VOID and returns the purchase', async () => {
  const { store, stay, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });
  const purchaseVoidRidePackFn = stubRidePack();

  const result = await bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking, purchaseVoidRidePackFn,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    ridePack: { planId: 'pack-5' },
  }, 'Bearer sams-real-token');

  assert.ok(result.ridePack);
  assert.strictEqual(purchaseVoidRidePackFn.calls.length, 1);
  assert.strictEqual(purchaseVoidRidePackFn.calls[0].args.customerId, 'sam');
  assert.strictEqual(purchaseVoidRidePackFn.calls[0].args.planId, 'pack-5');
  assert.strictEqual(purchaseVoidRidePackFn.calls[0].authHeader, 'Bearer sams-real-token',
    'the traveller\'s own real session must reach VOID\'s requireActor guard, not go unauthenticated');
});

test('bookBundle refuses a ridePack request when no purchaseVoidRidePackFn is configured', async () => {
  const { store, stay, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });

  await assert.rejects(() => bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    ridePack: { planId: 'pack-5' },
  }), /not available/);
  assert.strictEqual(settleFn.calls.length, 0, 'an unconfigured ridePack must be caught before any real charge');
});

test('a failed ridePack purchase leaves the already-booked flight and stay in place -- the flagged, non-atomic gap', async () => {
  const { store, stay, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });
  const purchaseVoidRidePackFn = stubRidePack({ fail: true });

  await assert.rejects(() => bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking, purchaseVoidRidePackFn,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    ridePack: { planId: 'pack-5' },
  }), /refused the ride pack/);

  assert.strictEqual(settleFn.calls.length, 2, 'the stay and flight both really charged before the ride pack failed');
  assert.strictEqual(reservations.listBookingsForPassenger(store.flights, 'sam').length, 1,
    'the already-booked flight is not rolled back -- same honestly-flagged non-atomic gap as before');
});

test('a full flight+stay+car+ridePack bundle conserves value exactly across every real leg', async () => {
  const { store, stay, car, flight } = fixture();
  const settleFn = ledger({ sam: 5000 });
  const purchaseVoidRidePackFn = stubRidePack();

  const result = await bookBundle({
    bookingsStore: store.bookings, store: store.flights, autoStore: store.auto, settleVCoin: settleFn, createBooking, purchaseVoidRidePackFn,
  }, {
    flight: { flightId: flight.id, passengerId: 'sam' },
    stay: { listingId: stay.id, guestId: 'sam', checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY },
    car: { kind: 'vehicle', vehicleId: car.id, renterId: 'sam', startDate: NOW + 20 * DAY, endDate: NOW + 23 * DAY },
    ridePack: { planId: 'pack-5' },
  }, 'Bearer sams-real-token');

  assert.ok(result.stayBooking && result.flightBooking && result.carBooking && result.ridePack);
  // Three real on-ledger charges (ridePack's own purchase happens on
  // VOID's own, separate ledger through the stub -- this file asserts
  // only on VACAY's own three real settleFn calls).
  assert.strictEqual(settleFn.calls.length, 3);
  assert.strictEqual(5000 - settleFn.of('sam'),
    result.stayBooking.totalPrice + result.flightBooking.retailPriceCharged + result.carBooking.totalPrice,
    'the traveller was charged exactly the sum of the three real legs, nothing more or less');
});
