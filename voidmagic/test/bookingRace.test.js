// VOID MAGIC — a seat is sold once, and a cancellation refunds once.
//
// **Two defects, both measured.** `bookExperience` checked
// `remainingCapacity < 1`, awaited the payment, then decremented. Five
// concurrent bookings on a one-seat experience all passed the check,
// all paid, and all got a booking: **5 bookings for 1 seat,
// remainingCapacity at -4, 100 VCoin taken**. Four of those five turn
// up to a meet-and-greet with no room for them.
//
// `cancelBooking` settled, restored the seat, then wrote
// `status: 'cancelled'`. Five concurrent cancellations of one booking
// all passed the already-cancelled guard, and both money paths ran five
// times:
//
//   200h out (refundable)  100 VCoin refunded on a 20 booking
//     1h out (late)        100 VCoin paid to host and platform
//
// And the seat came back five times either way — **remainingCapacity
// went 4 -> 9 on a capacity of 5**, so one cancellation handed the host
// four seats their venue does not have.
//
// Both paths are asserted because the refund branch depends on the
// 24-hour cutoff, and an earlier probe that only tested one of them
// looked in the wrong place for the money and reported "refunded once"
// against a path that had refunded nothing.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const experiences = require('../lib/experiences');
const bookings = require('../lib/bookings');
const { createVoidMagicStore } = require('../lib/store');

const HOUR = 3600000;

function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.total = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

function experience(store, { capacity = 1, hoursOut = 200, price = 20 } = {}) {
  return experiences.createExperience(store, {
    hostId: 'host1',
    title: 'Meet & Greet',
    type: experiences.EXPERIENCE_TYPES[0],
    format: experiences.EXPERIENCE_FORMATS[0],
    capacity,
    durationMinutes: 30,
    price,
    scheduledAt: Date.now() + hoursOut * HOUR,
    location: 'L',
  });
}

test('a one-seat experience cannot be booked twice at once', async () => {
  const store = createVoidMagicStore();
  const exp = experience(store, { capacity: 1 });
  const fn = ledger();

  await Promise.allSettled(Array.from({ length: 5 }, (_, i) => bookings.bookExperience(store,
    { experienceId: exp.id, customerId: `cust${i}`, settleFn: fn })));

  const after = store.experiences.find((e) => e.id === exp.id);
  assert.equal(store.bookings.length, 1,
    `${store.bookings.length} bookings taken for ${exp.capacity} seat, and ${fn.total()} VCoin charged`);
  assert.ok(after.remainingCapacity >= 0,
    `remainingCapacity went to ${after.remainingCapacity} — a negative seat count is an overbooking already sold`);
  assert.equal(after.status, 'full');
});

test('a multi-seat experience still fills seat by seat', async () => {
  const store = createVoidMagicStore();
  const exp = experience(store, { capacity: 3 });
  const fn = ledger({ delayMs: 0 });

  for (let i = 0; i < 3; i += 1) {
    await bookings.bookExperience(store, { experienceId: exp.id, customerId: `c${i}`, settleFn: fn });
  }
  const after = store.experiences.find((e) => e.id === exp.id);
  assert.equal(store.bookings.length, 3, 'a three-seat experience did not take three bookings');
  assert.equal(after.remainingCapacity, 0);
  assert.equal(after.status, 'full');
});

// Both cutoff sides, because they are different money paths.
for (const [label, hoursOut, expectedLegs] of [['refundable', 200, 1], ['late', 1, 2]]) {
  test(`a ${label} cancellation settles once, however many callers ask`, async () => {
    const store = createVoidMagicStore();
    const exp = experience(store, { capacity: 5, hoursOut });
    const booking = await bookings.bookExperience(store,
      { experienceId: exp.id, customerId: 'c1', settleFn: async () => {} });

    const fn = ledger();
    const results = await Promise.allSettled(Array.from({ length: 5 },
      () => bookings.cancelBooking(store, { bookingId: booking.id, settleFn: fn })));

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1,
      'more than one caller was told it had cancelled the booking');
    assert.equal(fn.legs.length, expectedLegs,
      `a ${label} cancellation moved ${fn.legs.length} legs totalling ${fn.total()} on a 20.00 booking`);
    assert.equal(fn.total(), 20,
      `${fn.total()} VCoin moved for one cancelled 20.00 booking`);

    const after = store.experiences.find((e) => e.id === exp.id);
    assert.ok(after.remainingCapacity <= after.capacity,
      `remainingCapacity is ${after.remainingCapacity} on a capacity of ${after.capacity} — `
      + 'a cancellation invented seats the venue does not have');
  });
}

test('a failed cancellation leaves the booking cancellable', async () => {
  const store = createVoidMagicStore();
  const exp = experience(store, { capacity: 5 });
  const booking = await bookings.bookExperience(store,
    { experienceId: exp.id, customerId: 'c1', settleFn: async () => {} });

  const fn = ledger({ failFirstCall: true, delayMs: 0 });
  await assert.rejects(() => bookings.cancelBooking(store,
    { bookingId: booking.id, settleFn: fn }), /V3 unreachable/);

  assert.notEqual(bookings.getBooking(store, booking.id).status, 'cancelled',
    'a failed refund cancelled the booking anyway — the customer lost the seat and the money');

  const retried = await bookings.cancelBooking(store, { bookingId: booking.id, settleFn: fn });
  assert.equal(retried.status, 'cancelled');
  assert.equal(fn.total(), 20, 'the retry refunded twice');
});
