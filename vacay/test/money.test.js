// VACAY — the money paths across all four sub-products.
//
// **Why this file exists.** VACAY had 62 routes, four sub-products that
// each move real VCoin, and zero tests. The completion audit named it
// the highest-value untested surface in the ecosystem for exactly that
// reason: money-moving code that nothing asserts on.
//
// **What these tests are about.** Not "does a booking get created" —
// that fails loudly. They target the failures that pass silently:
//
//   - money entering escrow and never coming out, or coming out twice
//   - a charge that succeeds while the record it paid for is never
//     written, or a record written for a charge that failed
//   - a refund that returns the wrong amount, or to the wrong party
//   - two guests holding the same listing on the same nights
//   - a seat sold twice because the inventory decrement raced the sale
//
// Every assertion below is on a transfer, a balance, or a conservation
// identity — never on a status alone. A status is what the old, absent
// tests would have checked, and a status is exactly what stays correct
// while the money goes wrong.

const test = require('node:test');
const assert = require('node:assert');

const { createVacayStore } = require('../lib/store');
const bookings = require('../lib/bookings/bookings');
const listings = require('../lib/bookings/listings');
const rentals = require('../lib/auto/rentals');
const vehicles = require('../lib/auto/vehicles');
const flightCatalog = require('../lib/flights/flights');
const reservations = require('../lib/flights/reservations');
const leads = require('../lib/home/leads');
const propertyListings = require('../lib/home/listings');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 1);

function round2(n) {
  return Math.round(n * 100) / 100;
}

// A ledger that actually tracks balances, rather than a spy that only
// records calls. The difference matters: a spy proves a transfer was
// attempted, a ledger proves the money ended up somewhere sane. Every
// conservation check below reads this.
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];

  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error(`ledger: refusing a non-numeric transfer of ${amount} (${reason})`);
    }
    if (amount < 0) throw new Error(`ledger: refusing a negative transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };

  // Seeded balances are money that existed before any transfer, so the
  // invariant is not "the sum is zero" — it is "the sum never changes".
  // That distinction is the whole value of this helper: a split that
  // invents or destroys value moves this number, and shows up nowhere
  // else in the system.
  const openingTotal = Object.values(balances).reduce((a, b) => a + b, 0);

  fn.balances = balances;
  fn.moves = moves;
  fn.of = (account) => balances[account] || 0;
  fn.drift = () => round2(Object.values(balances).reduce((a, b) => a + b, 0) - openingTotal);

  // Escrow "empty" is asserted to the cent, not to the bit.
  //
  // A split like 360 into a 55.80 fee and a 304.20 payout is exactly
  // right in decimal and leaves ~1.4e-14 behind in IEEE-754 — the two
  // rounded halves do not re-add to the original in binary floating
  // point. Asserting a bit-exact zero would be asserting that money is
  // not stored in floats, which it is, here and in V3.
  //
  // So the real invariant is that no *cent* is stranded. If this ever
  // exceeds a cent, something structural is wrong rather than
  // representational — which is the failure worth catching.
  fn.isDrained = (account) => Math.abs(fn.of(account)) < 0.01;
  return fn;
}

// -- Stays --------------------------------------------------------------

function stayFixture() {
  const store = createVacayStore();
  const listing = listings.createListing(store.bookings, {
    hostId: 'ines', title: 'Loft on Cherokee', city: 'St. Louis',
    pricePerNight: 120, hostType: 'individual', listingType: 'entire-place',
  });
  return { store: store.bookings, listing };
}

test('a stay charges the guest into ESCROW, not the host directly', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });

  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY,
    transferFn, now: NOW,
  });

  assert.strictEqual(booking.nights, 3);
  assert.strictEqual(booking.totalPrice, 360);

  // The whole point of escrow: the host has not been paid yet. Paying
  // the host at booking time is the failure this asserts against —
  // it would make every cancellation a clawback.
  assert.strictEqual(transferFn.of('ines'), 0, 'the host must not be paid at booking time');
  assert.strictEqual(transferFn.of(bookings.VACAY_ESCROW_ACCOUNT), 360);
  assert.strictEqual(transferFn.of('sam'), 640);
  assert.strictEqual(booking.hostPayout, null);
});

test('completing a stay drains escrow exactly — host plus fee equals the charge', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });

  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY,
    transferFn, now: NOW,
  });
  const done = await bookings.completeStay(store, { bookingId: booking.id, transferFn, now: NOW + 14 * DAY });

  assert.strictEqual(round2(done.hostPayout + done.platformFee), booking.totalPrice,
    'the two shares must add back up to exactly what the guest paid');
  assert.strictEqual(done.platformFee, round2(360 * (bookings.FEE_PERCENT / 100)));

  // Escrow must be empty. Money left behind in escrow is money nobody
  // owns, and it is invisible from every other view.
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT),
    'escrow must be fully drained on settlement');
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'no value may be created or destroyed');
});

test('cancelling before the cutoff refunds the guest in full, and empties escrow', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });

  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY,
    transferFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn, now: NOW + 1 * DAY,
  });

  assert.strictEqual(cancelled.refunded, true);
  assert.strictEqual(transferFn.of('sam'), 1000, 'a full refund means whole, not nearly whole');
  assert.strictEqual(transferFn.of('ines'), 0);
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
});

test('cancelling inside the cutoff pays the host as if the stay happened', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });

  const checkIn = NOW + 10 * DAY;
  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam', checkIn, checkOut: NOW + 13 * DAY,
    transferFn, now: NOW,
  });

  // Two hours before check-in — well inside the 24-hour cutoff.
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn, now: checkIn - 2 * 3600000,
  });

  assert.strictEqual(cancelled.refunded, false);
  assert.strictEqual(transferFn.of('sam'), 640, 'a late cancellation is not refunded');
  // The host held the dates and could not resell them, so they are made
  // whole exactly as if the stay completed — not a third, softer split.
  assert.strictEqual(round2(cancelled.hostPayout + cancelled.platformFee), booking.totalPrice);
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
});

test('the cutoff boundary itself refunds — a guest exactly on the line is not penalised', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });
  const checkIn = NOW + 10 * DAY;

  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam', checkIn, checkOut: NOW + 13 * DAY,
    transferFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn,
    now: checkIn - bookings.CANCELLATION_CUTOFF_HOURS * 3600000,
  });

  assert.strictEqual(cancelled.refunded, true,
    'at exactly the cutoff the policy is still "at least N hours before", so it refunds');
});

test('two guests cannot hold the same listing on overlapping nights', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000, ada: 1000 });

  await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 14 * DAY, transferFn, now: NOW,
  });

  // Overlaps by two nights.
  await assert.rejects(() => bookings.createBooking(store, {
    listingId: listing.id, guestId: 'ada',
    checkIn: NOW + 12 * DAY, checkOut: NOW + 16 * DAY, transferFn, now: NOW,
  }), /already booked/);

  // And crucially: the refused guest was not charged on the way to
  // being refused.
  assert.strictEqual(transferFn.of('ada'), 1000, 'a refused booking must not charge anyone');
});

test('adjacent bookings are allowed — checkout day is not a booked night', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000, ada: 1000 });

  await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY, transferFn, now: NOW,
  });
  // Starts the day the first guest leaves. Refusing this would cost the
  // host a night on every single turnover.
  const second = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'ada',
    checkIn: NOW + 13 * DAY, checkOut: NOW + 15 * DAY, transferFn, now: NOW,
  });
  assert.strictEqual(second.nights, 2);
});

test('a cancelled booking frees its dates for someone else', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000, ada: 1000 });

  const first = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 14 * DAY, transferFn, now: NOW,
  });
  await bookings.cancelBooking(store, { bookingId: first.id, transferFn, now: NOW + DAY });

  const second = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'ada',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 14 * DAY, transferFn, now: NOW,
  });
  assert.strictEqual(second.status, 'booked');
});

test('a failed charge leaves no booking behind', async () => {
  const { store, listing } = stayFixture();
  const declining = async () => { throw new Error('insufficient funds'); };

  await assert.rejects(() => bookings.createBooking(store, {
    listingId: listing.id, guestId: 'broke',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY,
    transferFn: declining, now: NOW,
  }), /insufficient funds/);

  // The dangerous outcome is a 'booked' record for money that never
  // moved — the listing would show as unavailable and nobody paid.
  assert.strictEqual(store.bookings.length, 0);
});

test('a stay cannot be settled twice, and a completed stay cannot be cancelled', async () => {
  const { store, listing } = stayFixture();
  const transferFn = ledger({ sam: 1000 });

  const booking = await bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY, transferFn, now: NOW,
  });
  await bookings.completeStay(store, { bookingId: booking.id, transferFn, now: NOW + 14 * DAY });

  // Double settlement would pay the host twice out of an empty escrow.
  await assert.rejects(
    () => bookings.completeStay(store, { bookingId: booking.id, transferFn }),
    /not awaiting completion/);
  await assert.rejects(
    () => bookings.cancelBooking(store, { bookingId: booking.id, transferFn }),
    /already completed/);
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
});

test('a booking without a transferFn is refused rather than recorded unpaid', async () => {
  const { store, listing } = stayFixture();
  await assert.rejects(() => bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW + 10 * DAY, checkOut: NOW + 13 * DAY, now: NOW,
  }), /requires a transferFn/);
  assert.strictEqual(store.bookings.length, 0);
});

test('a stay in the past is refused', async () => {
  const { store, listing } = stayFixture();
  await assert.rejects(() => bookings.createBooking(store, {
    listingId: listing.id, guestId: 'sam',
    checkIn: NOW - 5 * DAY, checkOut: NOW - 2 * DAY,
    transferFn: ledger({ sam: 1000 }), now: NOW,
  }), /present-or-future/);
});

// -- Auto ---------------------------------------------------------------

function autoFixture() {
  const store = createVacayStore();
  const vehicle = vehicles.listVehicle(store.auto, {
    ownerId: 'kai', type: 'truck', make: 'Toyota', model: 'Tacoma',
    year: 2021, dailyRate: 80, protectionPlan: 'standard',
  });
  return { store: store.auto, vehicle };
}

test('a rental escrows the renter’s money and settles it whole to the owner', async () => {
  const { store, vehicle } = autoFixture();
  const transferFn = ledger({ dana: 1000 });

  const rental = await rentals.bookRental(store, {
    vehicleId: vehicle.id, renterId: 'dana',
    startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY,
    transferFn, now: NOW,
  });

  assert.strictEqual(transferFn.of('kai'), 0, 'the owner is not paid at booking');
  assert.strictEqual(transferFn.of(rentals.VACAY_AUTO_ESCROW_ACCOUNT), rental.totalPrice);

  const done = await rentals.completeRental(store, {
    rentalId: rental.id, transferFn, now: NOW + 9 * DAY,
  });
  assert.strictEqual(round2(done.ownerPayout + done.platformCommission), rental.totalPrice);
  assert.ok(transferFn.isDrained(rentals.VACAY_AUTO_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'no value may be created or destroyed');
});

test('the same vehicle cannot be rented to two people at once', async () => {
  const { store, vehicle } = autoFixture();
  const transferFn = ledger({ dana: 1000, rio: 1000 });

  await rentals.bookRental(store, {
    vehicleId: vehicle.id, renterId: 'dana',
    startDate: NOW + 5 * DAY, endDate: NOW + 8 * DAY, transferFn, now: NOW,
  });
  await assert.rejects(() => rentals.bookRental(store, {
    vehicleId: vehicle.id, renterId: 'rio',
    startDate: NOW + 6 * DAY, endDate: NOW + 9 * DAY, transferFn, now: NOW,
  }), /.*/);
  assert.strictEqual(transferFn.of('rio'), 1000, 'the refused renter must not be charged');
});

// -- Flights ------------------------------------------------------------

function flightFixture(seats = 2) {
  const store = createVacayStore();
  const flight = flightCatalog.listFlight(store.flights, {
    airline: 'Delta', flightNumber: 'DL404', origin: 'STL', destination: 'LAX',
    departureAt: NOW + 20 * DAY, arrivalAt: NOW + 20 * DAY + 4 * 3600000,
    cabinClass: 'economy', capacity: seats,
    netRate: 180, retailPrice: 240, now: NOW,
  });
  return { store: store.flights, flight };
}

test('VACAY is the merchant of record: it keeps the margin, the airline gets its net rate', async () => {
  const { store, flight } = flightFixture();
  const transferFn = ledger({ sam: 1000 });

  const booking = await reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'sam', transferFn, now: NOW,
  });

  // The passenger pays retail; the airline is owed only its net rate;
  // the difference is VACAY's, which is what "merchant of record"
  // actually means in money rather than in marketing.
  assert.strictEqual(transferFn.of('sam'), 1000 - booking.retailPriceCharged);
  assert.strictEqual(
    round2(transferFn.of(reservations.VACAY_FLIGHTS_PLATFORM_ACCOUNT)),
    round2(booking.retailPriceCharged - flight.netRate),
    'the margin is retail minus the net rate, and it belongs to VACAY');
  assert.ok(transferFn.isDrained(reservations.VACAY_FLIGHTS_ESCROW_ACCOUNT),
    'a flight settles immediately — nothing should be left sitting in escrow');
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'no value may be created or destroyed');
});

test('seats are real inventory — the last seat sells once and the flight sells out', async () => {
  const { store, flight } = flightFixture(1);
  const transferFn = ledger({ sam: 1000, ada: 1000 });

  await reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'sam', transferFn, now: NOW,
  });
  assert.strictEqual(flight.seatsAvailable, 0);
  assert.strictEqual(flight.status, 'sold-out');

  // Selling the last seat flips the flight to 'sold-out', so a second
  // buyer is stopped by the STATUS guard rather than the seat-count
  // guard. Both are real; asserting the seat-count message here would
  // be asserting a path the normal flow never reaches.
  await assert.rejects(() => reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'ada', transferFn, now: NOW,
  }), /sold-out/);
  assert.strictEqual(transferFn.of('ada'), 1000,
    'selling a seat that does not exist would charge someone for nothing');
});

test('cancelling a flight returns the seat to inventory', async () => {
  const { store, flight } = flightFixture(1);
  const transferFn = ledger({ sam: 1000 });

  const booking = await reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'sam', transferFn, now: NOW,
  });
  await reservations.cancelFlightBooking(store, {
    bookingId: booking.id, transferFn, now: NOW + DAY,
  });

  // A seat that is not returned is inventory quietly destroyed — the
  // flight flies emptier than it was sold.
  assert.strictEqual(flight.seatsAvailable, 1);
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'no value may be created or destroyed');
});

// -- Homes --------------------------------------------------------------

test('a lead is charged to the agent once, at the documented flat fee', async () => {
  const store = createVacayStore();
  const listing = propertyListings.createPropertyListing(store.home, {
    agentId: 'nora', address: '4200 Shaw Blvd', purpose: 'for-sale',
    price: 385000, bedrooms: 3, bathrooms: 2, sqft: 1800,
  });
  const transferFn = ledger({ nora: 1000 });

  const lead = leads.requestTour(store.home, {
    listingId: listing.id, requesterId: 'sam', contactInfo: 'sam@example.com',
  });
  await leads.purchaseLead(store.home, { leadId: lead.id, agentId: 'nora', transferFn });

  assert.strictEqual(transferFn.of('nora'), 1000 - leads.LEAD_FEE);
  assert.strictEqual(transferFn.moves.length, 1);

  // Buying the same lead twice is the classic double-charge in a
  // pay-per-lead model, and the one an agent notices on their statement.
  await assert.rejects(
    () => leads.purchaseLead(store.home, { leadId: lead.id, agentId: 'nora', transferFn }),
    /.*/);
  assert.strictEqual(transferFn.of('nora'), 1000 - leads.LEAD_FEE,
    'a lead must never be billed twice');
});

// -- Cross-cutting ------------------------------------------------------

test('the four sub-products keep separate escrow accounts', async () => {
  // They are separate businesses with separate economics. One shared
  // escrow account would make a stay refund reachable from flight money,
  // and would make either one impossible to reconcile alone.
  const accounts = new Set([
    bookings.VACAY_ESCROW_ACCOUNT,
    rentals.VACAY_AUTO_ESCROW_ACCOUNT,
    reservations.VACAY_FLIGHTS_ESCROW_ACCOUNT,
  ]);
  assert.strictEqual(accounts.size, 3, 'escrow accounts must not be shared between sub-products');
});

test('a full session across three sub-products conserves value exactly', async () => {
  const store = createVacayStore();
  const transferFn = ledger({ sam: 5000 });

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

  const b = await bookings.createBooking(store.bookings, {
    listingId: stay.id, guestId: 'sam',
    checkIn: NOW + 20 * DAY, checkOut: NOW + 23 * DAY, transferFn, now: NOW,
  });
  const r = await rentals.bookRental(store.auto, {
    vehicleId: car.id, renterId: 'sam',
    startDate: NOW + 20 * DAY, endDate: NOW + 23 * DAY, transferFn, now: NOW,
  });
  await reservations.bookFlight(store.flights, {
    flightId: flight.id, passengerId: 'sam', transferFn, now: NOW,
  });

  await bookings.completeStay(store.bookings, { bookingId: b.id, transferFn, now: NOW + 24 * DAY });
  await rentals.completeRental(store.auto, { rentalId: r.id, transferFn, now: NOW + 24 * DAY });

  // One trip, three sub-products, and afterwards every escrow account is
  // empty and nothing was created or destroyed.
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
  assert.ok(transferFn.isDrained(rentals.VACAY_AUTO_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
  assert.ok(transferFn.isDrained(reservations.VACAY_FLIGHTS_ESCROW_ACCOUNT), 'escrow must be drained to the cent');
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'no value may be created or destroyed');
});

// -- Rounding at scale --------------------------------------------------

test('escrow dust does not accumulate across many settlements', async () => {
  // The question the cent-level assertion above raises: if each stay
  // strands ~1e-14 in escrow, does a busy month strand a real amount?
  //
  // It does not, and this measures rather than assumes it. The residue
  // is representational, not a systematic bias — it is as often
  // negative as positive, so it cancels rather than compounds. If
  // someone later changes the split to floor() instead of round(), the
  // bias becomes one-directional and this test is what catches it,
  // because the per-booking assertion would still pass.
  const store = createVacayStore();
  const transferFn = ledger({ sam: 1000000 });

  // Awkward prices on purpose — round numbers hide rounding bugs.
  const prices = [99.99, 133.33, 87.77, 1.01, 249.95];
  const listingIds = prices.map((price, i) => listings.createListing(store.bookings, {
    hostId: `host-${i}`, title: `Unit ${i}`, city: 'St. Louis',
    pricePerNight: price, hostType: 'individual', listingType: 'entire-place',
  }).id);

  for (let i = 0; i < 100; i += 1) {
    const listingId = listingIds[i % listingIds.length];
    const checkIn = NOW + (10 + i * 4) * DAY;
    const booking = await bookings.createBooking(store.bookings, {
      listingId, guestId: 'sam',
      checkIn, checkOut: checkIn + ((i % 3) + 1) * DAY,
      transferFn, now: NOW,
    });
    await bookings.completeStay(store.bookings, {
      bookingId: booking.id, transferFn, now: checkIn + 5 * DAY,
    });
  }

  assert.strictEqual(store.bookings.bookings.length, 100);
  assert.ok(transferFn.isDrained(bookings.VACAY_ESCROW_ACCOUNT),
    `escrow held ${transferFn.of(bookings.VACAY_ESCROW_ACCOUNT)} after 100 settlements`);
  assert.ok(Math.abs(transferFn.drift()) < 0.01,
    'a hundred settlements must not create or destroy a cent');
});

test('the seat-count guard is unreachable through the normal flow, and kept anyway', async () => {
  const { store, flight } = flightFixture(1);
  const transferFn = ledger({ sam: 1000 });

  await reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'sam', transferFn, now: NOW,
  });

  // Selling out flips the status, so the status guard always fires
  // first. The seat-count check behind it is only reachable if a flight
  // is 'scheduled' with zero seats — a state the normal flow cannot
  // produce, but which a future change to the status transition could.
  // Same posture as VOID's laundry weigh-in guard: kept as the last
  // thing standing between a refactor and selling a seat twice.
  flight.status = 'scheduled';
  await assert.rejects(() => reservations.bookFlight(store, {
    flightId: flight.id, passengerId: 'ada', transferFn, now: NOW,
  }), /no seats remaining/);
});
