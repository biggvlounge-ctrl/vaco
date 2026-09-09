// VOID MAGIC — bookings, settlement, refunds, and the door.
//
// **Why this file exists.** 33 routes, real VCoin moving through
// escrow, and no tests. The completion audit ranked it second only to
// VACAY among untested money surfaces.
//
// The failures targeted here are the ones that leave a correct-looking
// status behind:
//
//   - escrow that is charged but never settled, or settled twice
//   - capacity decremented and never restored, so an experience
//     silently shrinks every time someone cancels
//   - a free experience that demands payment, or a priced one that
//     does not
//   - a wrong credential admitted at the door
//
// A meet & greet fails in one specific way — the wrong person walks up
// — so the credential check gets the same weight here as the money.

const test = require('node:test');
const assert = require('node:assert');

const { createVoidMagicStore } = require('../lib/store');
const bookings = require('../lib/bookings');
const experiences = require('../lib/experiences');

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 5, 1);

// Tracks balances, not just calls. A spy proves a transfer was
// attempted; a ledger proves the money landed somewhere sane.
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);

  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
    }
    if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };

  fn.moves = moves;
  fn.of = (account) => balances[account] || 0;
  // Sub-cent, not bit-exact: a rounded fee and a rounded payout do not
  // re-add to the original in IEEE-754, and money here is stored in
  // floats. A stranded *cent* is structural; 1e-14 is representational.
  fn.isDrained = (account) => Math.abs(fn.of(account)) < 0.01;
  fn.drift = () => Object.values(balances).reduce((a, b) => a + b, 0) - opening;
  return fn;
}

function fixture(overrides = {}) {
  const store = createVoidMagicStore();
  const experience = experiences.createExperience(store, {
    hostId: 'nova', title: 'Backstage meet & greet',
    type: 'meet-greet', format: 'physical',
    capacity: 2, durationMinutes: 45, price: 100,
    scheduledAt: NOW + 10 * DAY, location: 'The Pageant, St. Louis',
    now: NOW,
    ...overrides,
  });
  return { store, experience };
}

// Book and walk through the door. Three settlement tests need this now
// that payout requires attendance — and needing it is the point: each
// of them used to assert "the host got paid" against a room nobody
// entered, and passed.
async function attend(store, experienceId, customerId, transferFn) {
  const booking = await bookings.bookExperience(store, {
    experienceId, customerId, transferFn, now: NOW,
  });
  bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: booking.credential, now: NOW + 10 * DAY,
  });
  return booking;
}

// -- Booking and settlement ---------------------------------------------

test('booking escrows the money — the host is not paid until it happens', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });

  assert.strictEqual(booking.pricePaid, 100);
  assert.strictEqual(transferFn.of('nova'), 0, 'the host must not be paid at booking time');
  assert.strictEqual(transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 100);
  assert.strictEqual(experience.remainingCapacity, 1, 'a booking consumes a real spot');
});

test('completing settles escrow whole — host plus fee equals what was charged', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  await attend(store, experience.id, 'sam', transferFn);
  await bookings.completeExperience(store, {
    experienceId: experience.id, transferFn, now: NOW + 10 * DAY + HOUR,
  });

  const fee = transferFn.of('voidmagic-platform');
  const payout = transferFn.of('nova');
  assert.ok(Math.abs(fee + payout - 100) < 0.01,
    'the two shares must add back up to exactly what the customer paid');
  assert.ok(Math.abs(fee - 100 * bookings.PLATFORM_TAKE_RATE) < 0.01);
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    'escrow must be drained on settlement');
});

test('completing settles EVERY eligible booking, not just the first', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500, ada: 500 });

  await attend(store, experience.id, 'sam', transferFn);
  await attend(store, experience.id, 'ada', transferFn);
  assert.strictEqual(transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 200);

  await bookings.completeExperience(store, {
    experienceId: experience.id, transferFn, now: NOW + 10 * DAY + HOUR,
  });

  // Settling only one attendee's money would leave the other's stranded
  // in escrow forever — invisible from every view except this one.
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)} — an attendee was not settled`);
  assert.ok(Math.abs(transferFn.of('nova') + transferFn.of('voidmagic-platform') - 200) < 0.01);
});

// -- Payout requires attendance ------------------------------------------
//
// `completeExperience` used to settle every booking in `confirmed` OR
// `checked-in`, so a host could complete an experience nobody turned up
// to and take the whole room's money. Every test above passed while
// that was true — they all book, complete, and check the escrow
// drained, and it drained perfectly into the host's pocket.
//
// That is the shape worth remembering: the invariant these tests were
// built to protect (escrow always drains) was satisfied by the bug.
// "The money went somewhere" is not the same claim as "the money went
// to the right party", and only the second one is worth asserting.

test('a host cannot collect for an experience nobody attended', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500, ada: 500 });

  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', transferFn, now: NOW });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', transferFn, now: NOW });
  assert.strictEqual(transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 200);

  // Nobody checks in. The host completes it anyway.
  await bookings.completeExperience(store, {
    experienceId: experience.id, transferFn, now: NOW + 10 * DAY + HOUR,
  });

  assert.strictEqual(transferFn.of('nova'), 0,
    'the host was paid for an experience that did not happen');
  assert.strictEqual(transferFn.of('voidmagic-platform'), 0,
    'there is no service to take a platform cut of');
  assert.strictEqual(transferFn.of('sam'), 500, 'sam must be made whole');
  assert.strictEqual(transferFn.of('ada'), 500, 'ada must be made whole');
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)} — a refund was stranded`);
  assert.ok(Math.abs(transferFn.drift()) < 0.01, 'the ledger must not have created or destroyed money');
});

test('one real attendee means the experience happened — the host is paid', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500, ada: 500 });

  const samBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', transferFn, now: NOW });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', transferFn, now: NOW });

  bookings.checkIn(store, {
    bookingId: samBooking.id, providedCredential: samBooking.credential, now: NOW + 10 * DAY,
  });

  await bookings.completeExperience(store, {
    experienceId: experience.id, transferFn, now: NOW + 10 * DAY + HOUR,
  });

  // Ada did not turn up. She is NOT refunded, and that is deliberate:
  // `cancelBooking` inside the cutoff pays the host and refunds
  // nothing, so refunding a no-show would make "don't turn up" strictly
  // better for the customer than "cancel late".
  assert.strictEqual(transferFn.of('ada'), 400, 'a no-show is a late cancellation that never cancelled');
  assert.ok(Math.abs(transferFn.of('nova') + transferFn.of('voidmagic-platform') - 200) < 0.01,
    'the host and the platform split both bookings');
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
  assert.ok(Math.abs(transferFn.drift()) < 0.01);
});

test('the no-show is recorded as one, not silently marked completed', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500, ada: 500 });

  const samBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', transferFn, now: NOW });
  const adaBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', transferFn, now: NOW });
  bookings.checkIn(store, { bookingId: samBooking.id, providedCredential: samBooking.credential, now: NOW + 10 * DAY });

  await bookings.completeExperience(store, { experienceId: experience.id, transferFn, now: NOW + 10 * DAY + HOUR });

  // A dispute six months later needs to be able to tell these apart.
  assert.strictEqual(bookings.getBooking(store, samBooking.id).status, 'completed');
  assert.strictEqual(bookings.getBooking(store, adaBooking.id).status, 'no-show');
});

test('a free unattended experience still completes cleanly', async () => {
  // The refund branch is guarded by `pricePaid > 0`; a zero-price
  // booking must not try to transfer nothing and must not need a
  // transferFn at all.
  const { store, experience } = fixture({ price: 0 });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', now: NOW });

  const result = await bookings.completeExperience(store, {
    experienceId: experience.id, now: NOW + 10 * DAY + HOUR,
  });
  assert.strictEqual(result.experience.status, 'completed');
});

test('an experience cannot be completed twice', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  await attend(store, experience.id, 'sam', transferFn);
  await bookings.completeExperience(store, { experienceId: experience.id, transferFn, now: NOW + 10 * DAY });

  // A second settlement would pay the host again out of empty escrow.
  await assert.rejects(
    () => bookings.completeExperience(store, { experienceId: experience.id, transferFn }),
    /already completed/);
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

// -- Capacity -----------------------------------------------------------

test('capacity is real — the last spot sells once', async () => {
  const { store, experience } = fixture({ capacity: 1 });
  const transferFn = ledger({ sam: 500, ada: 500 });

  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', transferFn, now: NOW });
  assert.strictEqual(experience.status, 'full');

  await assert.rejects(() => bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', transferFn, now: NOW,
  }), /.*/);
  assert.strictEqual(transferFn.of('ada'), 500,
    'a customer refused for capacity must not be charged');
});

test('cancelling returns the spot and reopens a full experience', async () => {
  const { store, experience } = fixture({ capacity: 1 });
  const transferFn = ledger({ sam: 500, ada: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  assert.strictEqual(experience.status, 'full');

  await bookings.cancelBooking(store, { bookingId: booking.id, transferFn, now: NOW + DAY });

  // A spot not returned is inventory quietly destroyed: the host sells
  // fewer seats every time anyone cancels, and nothing reports it.
  assert.strictEqual(experience.remainingCapacity, 1);
  assert.strictEqual(experience.status, 'open');

  const second = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', transferFn, now: NOW,
  });
  assert.strictEqual(second.status, 'confirmed');
});

// -- Refunds ------------------------------------------------------------

test('cancelling before the cutoff refunds in full and empties escrow', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn, now: NOW + DAY,
  });

  assert.strictEqual(cancelled.refunded, true);
  assert.strictEqual(transferFn.of('sam'), 500, 'a full refund means whole');
  assert.strictEqual(transferFn.of('nova'), 0);
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

test('cancelling inside the cutoff pays the host instead of refunding', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn, now: experience.scheduledAt - 2 * HOUR,
  });

  assert.strictEqual(cancelled.refunded, false);
  assert.strictEqual(transferFn.of('sam'), 400, 'a late cancellation is not refunded');
  // The host held reserved capacity through the cutoff, so they are made
  // whole exactly as if it happened — the money must not sit in escrow.
  assert.ok(Math.abs(transferFn.of('nova') + transferFn.of('voidmagic-platform') - 100) < 0.01);
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

test('the cutoff boundary refunds — exactly on the line is not a late cancellation', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, transferFn,
    now: experience.scheduledAt - bookings.CANCELLATION_CUTOFF_HOURS * HOUR,
  });
  assert.strictEqual(cancelled.refunded, true);
});

test('a booking cannot be cancelled twice, or cancelled after completing', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  await bookings.cancelBooking(store, { bookingId: booking.id, transferFn, now: NOW + DAY });

  // A second cancellation would refund from an escrow that no longer
  // holds this booking's money — paying out of someone else's.
  await assert.rejects(
    () => bookings.cancelBooking(store, { bookingId: booking.id, transferFn, now: NOW + DAY }),
    /already cancelled/);
  assert.strictEqual(transferFn.of('sam'), 500, 'a double cancellation must not double-refund');
});

// -- Free experiences ---------------------------------------------------

test('a free experience books and completes without any transferFn at all', async () => {
  const { store, experience } = fixture({ price: 0 });

  // No transferFn passed anywhere. A free experience that demanded one
  // would make every no-cost meet & greet impossible to run.
  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', now: NOW,
  });
  assert.strictEqual(booking.pricePaid, 0);

  await bookings.completeExperience(store, { experienceId: experience.id, now: NOW + 10 * DAY });
  assert.strictEqual(bookings.getBooking(store, booking.id).status, 'completed');
});

test('a priced experience refuses to book without a transferFn', async () => {
  const { store, experience } = fixture();
  await assert.rejects(() => bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', now: NOW,
  }), /requires a transferFn/);
  // And the spot was not consumed on the way to being refused.
  assert.strictEqual(experience.remainingCapacity, 2);
  assert.strictEqual(store.bookings.length, 0);
});

// -- The door -----------------------------------------------------------

test('the credential is what gets you in — a wrong one is refused', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });

  // The specific failure a meet & greet has: the wrong person walks up.
  assert.throws(() => bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: 'not-the-code', now: NOW + 10 * DAY,
  }), /does not match/);
  assert.strictEqual(bookings.getBooking(store, booking.id).status, 'confirmed',
    'a failed check-in must not admit anyone');

  const checked = bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: booking.credential, now: NOW + 10 * DAY,
  });
  assert.strictEqual(checked.status, 'checked-in');
});

test('credentials are unique per booking — one ticket does not open another', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500, ada: 500 });

  const first = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  const second = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', transferFn, now: NOW,
  });

  assert.notStrictEqual(first.credential, second.credential);
  assert.throws(() => bookings.checkIn(store, {
    bookingId: second.id, providedCredential: first.credential, now: NOW + 10 * DAY,
  }), /does not match/);
});

test('a cancelled booking cannot be checked in', async () => {
  const { store, experience } = fixture();
  const transferFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', transferFn, now: NOW,
  });
  await bookings.cancelBooking(store, { bookingId: booking.id, transferFn, now: NOW + DAY });

  // Someone who was refunded still holds their credential. It must stop
  // working, or a refund is a free ticket.
  assert.throws(() => bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: booking.credential, now: NOW + 10 * DAY,
  }), /not in a checkable state/);
});

// -- Conservation -------------------------------------------------------

test('a full house that completes conserves value and empties escrow', async () => {
  const { store, experience } = fixture({ capacity: 3, price: 33.33 });
  const transferFn = ledger({ sam: 200, ada: 200, rio: 200 });

  for (const customerId of ['sam', 'ada', 'rio']) {
    await attend(store, experience.id, customerId, transferFn);
  }
  assert.strictEqual(experience.status, 'full');

  await bookings.completeExperience(store, {
    experienceId: experience.id, transferFn, now: NOW + 10 * DAY,
  });

  // An awkward price on purpose: round numbers hide rounding bugs.
  assert.ok(transferFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${transferFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)}`);
  assert.ok(Math.abs(transferFn.drift()) < 0.01,
    'no value may be created or destroyed');

  // Drain and drift alone were satisfied by the no-show bug — the money
  // left escrow perfectly, straight into the host's pocket for a room
  // nobody entered. Assert the destination, not just the departure.
  assert.ok(Math.abs(transferFn.of('nova') + transferFn.of('voidmagic-platform') - 99.99) < 0.01,
    'the host and the platform must be where the money went');
});
