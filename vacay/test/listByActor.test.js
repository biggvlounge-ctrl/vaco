// VACAY — the real gap the UI audit found: every section but Flights
// had no way for the actor who booked something to find it again.
// `reservations.js#listBookingsForPassenger` was the one real
// precedent; this file proves the same shape now exists for Stays,
// Experiences, Turo rentals, and VACAY's own fleet rentals, and that
// each one is actually scoped to the right actor (never returns
// another guest's/renter's rows).

const test = require('node:test');
const assert = require('node:assert');

const { createVacayStore } = require('../lib/store');
const bookings = require('../lib/bookings/bookings');
const listings = require('../lib/bookings/listings');
const experiences = require('../lib/bookings/experiences');
const experienceBookings = require('../lib/bookings/experienceBookings');
const vehicles = require('../lib/auto/vehicles');
const rentals = require('../lib/auto/rentals');
const fleetRentals = require('../lib/auto/fleetRentals');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 1);

function ledger(initial = {}) {
  const balances = { ...initial };
  return async (legs) => {
    for (const { fromUserId: from, toUserId: to, amount } of legs) {
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
    }
  };
}

test('listBookingsForGuest returns only the named guest\'s own stays', async () => {
  const store = createVacayStore();
  const listing = listings.createListing(store.bookings, {
    hostId: 'ines', title: 'Loft', city: 'St. Louis', pricePerNight: 100,
    hostType: 'individual', listingType: 'entire-place',
  });
  const settleFn = ledger({ sam: 1000, ren: 1000 });

  const samBooking = await bookings.createBooking(store.bookings, {
    listingId: listing.id, guestId: 'sam', checkIn: NOW + 10 * DAY, checkOut: NOW + 12 * DAY, settleFn, now: NOW,
  });
  await bookings.createBooking(store.bookings, {
    listingId: listing.id, guestId: 'ren', checkIn: NOW + 20 * DAY, checkOut: NOW + 22 * DAY, settleFn, now: NOW,
  });

  const samBookings = bookings.listBookingsForGuest(store.bookings, 'sam');
  assert.strictEqual(samBookings.length, 1);
  assert.strictEqual(samBookings[0].id, samBooking.id);
  assert.strictEqual(bookings.listBookingsForGuest(store.bookings, 'nobody').length, 0);
});

test('listExperienceBookingsForGuest returns only the named guest\'s own bookings', async () => {
  const store = createVacayStore();
  const experience = experiences.createExperience(store.bookings, {
    hostId: 'theo', description: 'Kayak tour', durationHours: 2, price: 90, capacity: 6, scheduledAt: NOW + 10 * DAY, now: NOW,
  });
  const settleFn = ledger({ sam: 1000, ren: 1000 });

  const samBooking = await experienceBookings.bookExperience(store.bookings, {
    experienceId: experience.id, guestId: 'sam', settleFn, now: NOW,
  });
  await experienceBookings.bookExperience(store.bookings, {
    experienceId: experience.id, guestId: 'ren', settleFn, now: NOW,
  });

  const samBookings = experienceBookings.listExperienceBookingsForGuest(store.bookings, 'sam');
  assert.strictEqual(samBookings.length, 1);
  assert.strictEqual(samBookings[0].id, samBooking.id);
  assert.strictEqual(experienceBookings.listExperienceBookingsForGuest(store.bookings, 'nobody').length, 0);
});

test('listRentalsForRenter returns only the named renter\'s own Turo-style rentals', async () => {
  const store = createVacayStore();
  const vehicle = vehicles.listVehicle(store.auto, {
    ownerId: 'kai', type: 'truck', make: 'Toyota', model: 'Tacoma', year: 2021, dailyRate: 80, protectionPlan: 'standard',
  });
  const settleFn = ledger({ dana: 1000, remy: 1000 });

  const danaRental = await rentals.bookRental(store.auto, {
    vehicleId: vehicle.id, renterId: 'dana', startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY, settleFn, now: NOW,
  });

  const danaRentals = rentals.listRentalsForRenter(store.auto, 'dana');
  assert.strictEqual(danaRentals.length, 1);
  assert.strictEqual(danaRentals[0].id, danaRental.id);
  assert.strictEqual(rentals.listRentalsForRenter(store.auto, 'remy').length, 0);
});

test('listFleetRentalsForRenter returns only the named renter\'s own fleet rentals, never a peer-owned Turo rental', async () => {
  const store = createVacayStore();
  const turoVehicle = vehicles.listVehicle(store.auto, {
    ownerId: 'kai', type: 'truck', make: 'Toyota', model: 'Tacoma', year: 2021, dailyRate: 80, protectionPlan: 'standard',
  });
  const fleetVehicle = fleetRentals.addFleetVehicle(store.auto, {
    type: 'car', make: 'Nissan', model: 'Altima', year: 2022, dailyRate: 60, location: 'STL',
  });
  const settleFn = ledger({ dana: 1000 });

  await rentals.bookRental(store.auto, {
    vehicleId: turoVehicle.id, renterId: 'dana', startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY, settleFn, now: NOW,
  });
  const fleetRental = await fleetRentals.bookFleetRental(store.auto, {
    vehicleId: fleetVehicle.id, renterId: 'dana', startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY, settleFn, now: NOW,
  });

  // The real thing worth proving: the two lists don't bleed into each
  // other even though the same renter holds one of each kind at once --
  // this is exactly the Turo-vs-fleet confusion the bundle's own
  // mutation test already guards at the dispatch layer, checked here
  // at the query layer instead.
  const danaFleetRentals = fleetRentals.listFleetRentalsForRenter(store.auto, 'dana');
  assert.strictEqual(danaFleetRentals.length, 1);
  assert.strictEqual(danaFleetRentals[0].id, fleetRental.id);
  assert.strictEqual(rentals.listRentalsForRenter(store.auto, 'dana').length, 1,
    'the Turo rental must still be findable via the Turo list, untouched by the fleet one existing');
});
