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
const media = require('../lib/media');

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 5, 1);

// Tracks balances, not just calls. A spy proves a transfer was
// attempted; a ledger proves the money landed somewhere sane.
function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);

  // **Takes a settlement, applies its legs.** Legs are flattened into
  // `moves` exactly as separate transfers used to appear, so every
  // existing balance and conservation assertion in this file is
  // unchanged. `calls` is the new question -- how many times the ledger
  // was asked -- and it is the only thing that distinguishes an atomic
  // settlement from the consecutive transfers it replaced.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    if (!Array.isArray(legs) || legs.length === 0) {
      throw new Error(`ledger: refusing a settlement with no legs (${meta.reason})`);
    }
    for (const { fromUserId: from, toUserId: to, amount, reason } of legs) {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
      }
      if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
      moves.push({ from, to, amount, reason });
    }
    calls.push({ legs, meta });
    return { ok: true };
  };
  fn.calls = calls;

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
async function attend(store, experienceId, customerId, settleFn) {
  const booking = await bookings.bookExperience(store, {
    experienceId, customerId, settleFn, now: NOW,
  });
  bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: booking.credential, now: NOW + 10 * DAY,
  });
  return booking;
}

// -- Booking and settlement ---------------------------------------------

test('booking escrows the money — the host is not paid until it happens', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });

  assert.strictEqual(booking.pricePaid, 100);
  assert.strictEqual(settleFn.of('nova'), 0, 'the host must not be paid at booking time');
  assert.strictEqual(settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 100);
  assert.strictEqual(experience.remainingCapacity, 1, 'a booking consumes a real spot');
});

test('completing settles escrow whole — host plus fee equals what was charged', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  await attend(store, experience.id, 'sam', settleFn);
  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  const fee = settleFn.of('voidmagic-platform');
  const payout = settleFn.of('nova');
  assert.ok(Math.abs(fee + payout - 100) < 0.01,
    'the two shares must add back up to exactly what the customer paid');
  assert.ok(Math.abs(fee - 100 * bookings.PLATFORM_TAKE_RATE) < 0.01);
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    'escrow must be drained on settlement');

  // **The assertion the arithmetic above cannot make.** Host payout and
  // platform fee must leave escrow in ONE settlement. Split into
  // consecutive transfers, every line above still passes — the shares,
  // the take rate, the drained escrow — and yet the fee leg can fail
  // because the host leg just drained escrow, leaving the booking
  // uncompleted and a retry paying the host twice.
  const settlements = settleFn.calls.filter((c) => c.meta.reason?.startsWith('voidmagic_experience_settlement'));
  assert.strictEqual(settlements.length, 1, 'the payout must be a single atomic settlement');
  assert.strictEqual(settlements[0].legs.length, 2, 'host payout and platform fee stay separately auditable');
});

test('each booking in a completed experience settles atomically, one settlement per booking', async () => {
  // **A deliberate granularity decision, recorded because it is not
  // obvious.** `completeExperience` loops over every eligible booking
  // and settles each one. These are NOT batched into a single
  // settlement across all attendees, for two reasons: one attendee's
  // escrow shortfall would refuse everybody's payout, and the loop is
  // already safely resumable — each booking's status moves off
  // `confirmed`/`checked-in` as it settles, so the `eligibleBookings`
  // filter is itself the retry guard and a partial run resumes cleanly.
  //
  // What must hold is that each *booking's* two legs move together.
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500, ada: 500 });

  await attend(store, experience.id, 'sam', settleFn);
  await attend(store, experience.id, 'ada', settleFn);
  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  const settlements = settleFn.calls.filter((c) => c.meta.reason?.startsWith('voidmagic_experience_settlement'));
  assert.strictEqual(settlements.length, 2, 'one settlement per booking');
  for (const s2 of settlements) {
    assert.strictEqual(s2.legs.length, 2, 'each booking settles host and platform together');
  }
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 'escrow must be drained');
});

test('completing settles EVERY eligible booking, not just the first', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500, ada: 500 });

  await attend(store, experience.id, 'sam', settleFn);
  await attend(store, experience.id, 'ada', settleFn);
  assert.strictEqual(settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 200);

  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  // Settling only one attendee's money would leave the other's stranded
  // in escrow forever — invisible from every view except this one.
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)} — an attendee was not settled`);
  assert.ok(Math.abs(settleFn.of('nova') + settleFn.of('voidmagic-platform') - 200) < 0.01);
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
  const settleFn = ledger({ sam: 500, ada: 500 });

  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', settleFn, now: NOW });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', settleFn, now: NOW });
  assert.strictEqual(settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 200);

  // Nobody checks in. The host completes it anyway.
  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  assert.strictEqual(settleFn.of('nova'), 0,
    'the host was paid for an experience that did not happen');
  assert.strictEqual(settleFn.of('voidmagic-platform'), 0,
    'there is no service to take a platform cut of');
  assert.strictEqual(settleFn.of('sam'), 500, 'sam must be made whole');
  assert.strictEqual(settleFn.of('ada'), 500, 'ada must be made whole');
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)} — a refund was stranded`);
  assert.ok(Math.abs(settleFn.drift()) < 0.01, 'the ledger must not have created or destroyed money');
});

test('one real attendee means the experience happened — the host is paid', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500, ada: 500 });

  const samBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', settleFn, now: NOW });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', settleFn, now: NOW });

  bookings.checkIn(store, {
    bookingId: samBooking.id, providedCredential: samBooking.credential, now: NOW + 10 * DAY,
  });

  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  // Ada did not turn up. She is NOT refunded, and that is deliberate:
  // `cancelBooking` inside the cutoff pays the host and refunds
  // nothing, so refunding a no-show would make "don't turn up" strictly
  // better for the customer than "cancel late".
  assert.strictEqual(settleFn.of('ada'), 400, 'a no-show is a late cancellation that never cancelled');
  assert.ok(Math.abs(settleFn.of('nova') + settleFn.of('voidmagic-platform') - 200) < 0.01,
    'the host and the platform split both bookings');
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
  assert.ok(Math.abs(settleFn.drift()) < 0.01);
});

test('the no-show is recorded as one, not silently marked completed', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500, ada: 500 });

  const samBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', settleFn, now: NOW });
  const adaBooking = await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'ada', settleFn, now: NOW });
  bookings.checkIn(store, { bookingId: samBooking.id, providedCredential: samBooking.credential, now: NOW + 10 * DAY });

  await bookings.completeExperience(store, { experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR });

  // A dispute six months later needs to be able to tell these apart.
  assert.strictEqual(bookings.getBooking(store, samBooking.id).status, 'completed');
  assert.strictEqual(bookings.getBooking(store, adaBooking.id).status, 'no-show');
});

test('a free unattended experience still completes cleanly', async () => {
  // The refund branch is guarded by `pricePaid > 0`; a zero-price
  // booking must not try to transfer nothing and must not need a
  // settleFn at all.
  const { store, experience } = fixture({ price: 0 });
  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', now: NOW });

  const result = await bookings.completeExperience(store, {
    experienceId: experience.id, now: NOW + 10 * DAY + HOUR,
  });
  assert.strictEqual(result.experience.status, 'completed');
});

test('an experience cannot be completed twice', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  await attend(store, experience.id, 'sam', settleFn);
  await bookings.completeExperience(store, { experienceId: experience.id, settleFn, now: NOW + 10 * DAY });

  // A second settlement would pay the host again out of empty escrow.
  await assert.rejects(
    () => bookings.completeExperience(store, { experienceId: experience.id, settleFn }),
    /already completed/);
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

// -- Capacity -----------------------------------------------------------

test('capacity is real — the last spot sells once', async () => {
  const { store, experience } = fixture({ capacity: 1 });
  const settleFn = ledger({ sam: 500, ada: 500 });

  await bookings.bookExperience(store, { experienceId: experience.id, customerId: 'sam', settleFn, now: NOW });
  assert.strictEqual(experience.status, 'full');

  await assert.rejects(() => bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', settleFn, now: NOW,
  }), /.*/);
  assert.strictEqual(settleFn.of('ada'), 500,
    'a customer refused for capacity must not be charged');
});

test('cancelling returns the spot and reopens a full experience', async () => {
  const { store, experience } = fixture({ capacity: 1 });
  const settleFn = ledger({ sam: 500, ada: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  assert.strictEqual(experience.status, 'full');

  await bookings.cancelBooking(store, { bookingId: booking.id, settleFn, now: NOW + DAY });

  // A spot not returned is inventory quietly destroyed: the host sells
  // fewer seats every time anyone cancels, and nothing reports it.
  assert.strictEqual(experience.remainingCapacity, 1);
  assert.strictEqual(experience.status, 'open');

  const second = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', settleFn, now: NOW,
  });
  assert.strictEqual(second.status, 'confirmed');
});

// -- Refunds ------------------------------------------------------------

test('cancelling before the cutoff refunds in full and empties escrow', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, settleFn, now: NOW + DAY,
  });

  assert.strictEqual(cancelled.refunded, true);
  assert.strictEqual(settleFn.of('sam'), 500, 'a full refund means whole');
  assert.strictEqual(settleFn.of('nova'), 0);
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

test('cancelling inside the cutoff pays the host instead of refunding', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, settleFn, now: experience.scheduledAt - 2 * HOUR,
  });

  assert.strictEqual(cancelled.refunded, false);
  assert.strictEqual(settleFn.of('sam'), 400, 'a late cancellation is not refunded');
  // The host held reserved capacity through the cutoff, so they are made
  // whole exactly as if it happened — the money must not sit in escrow.
  assert.ok(Math.abs(settleFn.of('nova') + settleFn.of('voidmagic-platform') - 100) < 0.01);
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT));
});

test('the cutoff boundary refunds — exactly on the line is not a late cancellation', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  const cancelled = await bookings.cancelBooking(store, {
    bookingId: booking.id, settleFn,
    now: experience.scheduledAt - bookings.CANCELLATION_CUTOFF_HOURS * HOUR,
  });
  assert.strictEqual(cancelled.refunded, true);
});

test('a booking cannot be cancelled twice, or cancelled after completing', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  await bookings.cancelBooking(store, { bookingId: booking.id, settleFn, now: NOW + DAY });

  // A second cancellation would refund from an escrow that no longer
  // holds this booking's money — paying out of someone else's.
  await assert.rejects(
    () => bookings.cancelBooking(store, { bookingId: booking.id, settleFn, now: NOW + DAY }),
    /already cancelled/);
  assert.strictEqual(settleFn.of('sam'), 500, 'a double cancellation must not double-refund');
});

// -- Free experiences ---------------------------------------------------

test('a free experience books and completes without any settleFn at all', async () => {
  const { store, experience } = fixture({ price: 0 });

  // No settleFn passed anywhere. A free experience that demanded one
  // would make every no-cost meet & greet impossible to run.
  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', now: NOW,
  });
  assert.strictEqual(booking.pricePaid, 0);

  await bookings.completeExperience(store, { experienceId: experience.id, now: NOW + 10 * DAY });
  assert.strictEqual(bookings.getBooking(store, booking.id).status, 'completed');
});

test('a priced experience refuses to book without a settleFn', async () => {
  const { store, experience } = fixture();
  await assert.rejects(() => bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', now: NOW,
  }), /requires a settleFn/);
  // And the spot was not consumed on the way to being refused.
  assert.strictEqual(experience.remainingCapacity, 2);
  assert.strictEqual(store.bookings.length, 0);
});

// -- The door -----------------------------------------------------------

test('the credential is what gets you in — a wrong one is refused', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
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
  const settleFn = ledger({ sam: 500, ada: 500 });

  const first = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  const second = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'ada', settleFn, now: NOW,
  });

  assert.notStrictEqual(first.credential, second.credential);
  assert.throws(() => bookings.checkIn(store, {
    bookingId: second.id, providedCredential: first.credential, now: NOW + 10 * DAY,
  }), /does not match/);
});

test('a cancelled booking cannot be checked in', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await bookings.bookExperience(store, {
    experienceId: experience.id, customerId: 'sam', settleFn, now: NOW,
  });
  await bookings.cancelBooking(store, { bookingId: booking.id, settleFn, now: NOW + DAY });

  // Someone who was refunded still holds their credential. It must stop
  // working, or a refund is a free ticket.
  assert.throws(() => bookings.checkIn(store, {
    bookingId: booking.id, providedCredential: booking.credential, now: NOW + 10 * DAY,
  }), /not in a checkable state/);
});

// -- Conservation -------------------------------------------------------

test('a full house that completes conserves value and empties escrow', async () => {
  const { store, experience } = fixture({ capacity: 3, price: 33.33 });
  const settleFn = ledger({ sam: 200, ada: 200, rio: 200 });

  for (const customerId of ['sam', 'ada', 'rio']) {
    await attend(store, experience.id, customerId, settleFn);
  }
  assert.strictEqual(experience.status, 'full');

  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY,
  });

  // An awkward price on purpose: round numbers hide rounding bugs.
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT),
    `escrow held ${settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT)}`);
  assert.ok(Math.abs(settleFn.drift()) < 0.01,
    'no value may be created or destroyed');

  // Drain and drift alone were satisfied by the no-show bug — the money
  // left escrow perfectly, straight into the host's pocket for a room
  // nobody entered. Assert the destination, not just the departure.
  assert.ok(Math.abs(settleFn.of('nova') + settleFn.of('voidmagic-platform') - 99.99) < 0.01,
    'the host and the platform must be where the money went');
});


// -- Media orders --------------------------------------------------------
//
// **This whole path had no money test.** `deliverMedia` charges a
// customer into escrow at order time and pays the host and the platform
// out of it on delivery, and nothing in this file exercised it — so the
// two consecutive transfers it used to make were not merely untested
// for atomicity, they were untested for anything.

test('a delivered media order settles host and platform in ONE call', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });

  const booking = await attend(store, experience.id, 'sam', settleFn);
  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });

  const order = await media.orderMedia(store, {
    bookingId: booking.id, type: 'magic-memory', price: 40, settleFn, now: NOW + 11 * DAY,
  });
  const escrowedAfterOrder = settleFn.of(bookings.VOID_MAGIC_ESCROW_ACCOUNT);
  assert.ok(Math.abs(escrowedAfterOrder - 40) < 0.01,
    'the media price must sit in escrow until delivery, not go straight to the host');

  await media.deliverMedia(store, {
    mediaOrderId: order.id, assetUrl: 'https://example.test/a.mp4', settleFn, now: NOW + 12 * DAY,
  });

  const settlements = settleFn.calls.filter((c) => c.meta.reason?.startsWith('voidmagic_media_settlement'));
  assert.strictEqual(settlements.length, 1, 'the payout must be a single atomic settlement');
  assert.strictEqual(settlements[0].legs.length, 2, 'host payout and platform fee stay separately auditable');

  const legTotal = settlements[0].legs.reduce((n, l) => n + l.amount, 0);
  assert.ok(Math.abs(legTotal - 40) < 0.01, 'the two shares must add back up to the media price');
  assert.ok(settleFn.isDrained(bookings.VOID_MAGIC_ESCROW_ACCOUNT), 'escrow must be drained by delivery');
  assert.ok(Math.abs(settleFn.drift()) < 0.01, 'no value may be created or destroyed');
});

test('a media order cannot be delivered without a settleFn', async () => {
  const { store, experience } = fixture();
  const settleFn = ledger({ sam: 500 });
  const booking = await attend(store, experience.id, 'sam', settleFn);
  await bookings.completeExperience(store, {
    experienceId: experience.id, settleFn, now: NOW + 10 * DAY + HOUR,
  });
  const order = await media.orderMedia(store, {
    bookingId: booking.id, type: 'magic-photo', price: 20, settleFn, now: NOW + 11 * DAY,
  });

  await assert.rejects(
    () => media.deliverMedia(store, { mediaOrderId: order.id, assetUrl: 'https://example.test/a.jpg' }),
    /requires a settleFn/,
  );
  assert.strictEqual(media.getMediaOrder(store, order.id).status, 'ordered',
    'a media order that could not settle must not be marked delivered');
});
