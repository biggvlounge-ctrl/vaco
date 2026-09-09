// VOID MAGIC -- Bookings (Section 39, MVP steps 3-11: book, pay,
// scheduling confirmation, credential, check-in, experience happens,
// completion, host settlement, post-event follow-up).
// Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS16 ("VOID MAGIC
// should NOT create its own financial ledger... calls V3 for
// payments, settlements, balances, payouts") and SS39's explicit MVP
// step list.
//
// A real, deliberate design decision, flagged since SS38 only names
// entities without field shapes: the MVP's own step list separates
// "Payment is processed" (step 4) from "Host receives settlement"
// (step 10) as two DISTINCT steps, which only makes sense under a
// real escrow model -- the customer is charged at booking time, but
// the host is paid later, at experience completion, not immediately.
// This mirrors real event-ticketing practice (Ticketmaster/Eventbrite
// pay organizers after the event, not at purchase) and is a
// deliberately different real shape from VOID's own job-marketplace
// `requestJob()`/`completeJob()` pattern (customer pays at
// completion, not at request) -- VOID MAGIC follows its own brief's
// explicit step ordering here, not VOID's precedent, since they're
// different real-world models.
//
// The real credential (step 6) reuses this session's established
// crypto.randomBytes pattern (VOID's Locker-to-Door access codes) --
// a real, single-use, unguessable code, not a sequential id.

const crypto = require('crypto');
const { getExperience } = require('./experiences');
const { createNotification } = require('./notifications');

const VOID_MAGIC_ESCROW_ACCOUNT = 'voidmagic-escrow';
// SS27's Event Economics lists "platform fee" as a real, distinct
// deduction from gross booking revenue. No exact rate is given
// anywhere in the brief -- flagged as a real, deterministic,
// interpretive choice modeled on VACAY's own real 15.5% Airbnb-style
// comparable (VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md), the closest real
// booking-fee precedent already established in this ecosystem.
const PLATFORM_TAKE_RATE = 0.155;

function round(n) {
  return Math.round(n * 100) / 100;
}

function generateCredential() {
  return crypto.randomBytes(9).toString('hex');
}

// MVP steps 3-6: book, pay (escrow), scheduling confirmation is
// implicit (the experience's own scheduledAt), issue a real
// credential.
async function bookExperience(store, options = {}) {
  const { experienceId, customerId, transferFn, now = Date.now() } = options;
  const experience = getExperience(store, experienceId);
  if (!experience) throw new Error(`bookExperience: no experience with id ${experienceId}`);
  if (experience.status !== 'open') throw new Error(`bookExperience: experience ${experienceId} is not open (status: ${experience.status})`);
  if (!customerId) throw new Error('bookExperience requires a customerId');
  if (experience.remainingCapacity < 1) throw new Error(`bookExperience: experience ${experienceId} has no remaining capacity`);

  if (experience.price > 0) {
    if (typeof transferFn !== 'function') throw new Error('bookExperience requires a transferFn(fromUserId, toUserId, amount, reason) for a priced experience');
    await transferFn(customerId, VOID_MAGIC_ESCROW_ACCOUNT, experience.price, `voidmagic_booking:${experienceId}`);
  }

  experience.remainingCapacity -= 1;
  if (experience.remainingCapacity === 0) experience.status = 'full';

  const booking = {
    id: store.nextBookingId++,
    experienceId,
    customerId,
    pricePaid: experience.price,
    credential: generateCredential(),
    status: 'confirmed',
    checkedInAt: null,
    arrivedAt: null,
    completedAt: null,
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.bookings.push(booking);

  createNotification(store, {
    recipientId: customerId,
    type: 'booking-confirmation',
    subject: `Booking confirmed: ${experience.title}`,
    message: `Your booking for "${experience.title}" is confirmed. Credential: ${booking.credential}`,
    relatedId: booking.id,
    now,
  });
  if (experience.price > 0) {
    createNotification(store, {
      recipientId: customerId,
      type: 'payment-confirmation',
      subject: `Payment received: ${experience.title}`,
      message: `We received your payment of $${experience.price} for "${experience.title}".`,
      relatedId: booking.id,
      now,
    });
  }

  return booking;
}

function getBooking(store, bookingId) {
  return store.bookings.find((b) => b.id === bookingId) || null;
}

// MVP step 7: check-in -- real credential verification, matching
// VOID's own Locker-to-Door lifecycle discipline (wrong code
// rejected, wrong status rejected).
function checkIn(store, options = {}) {
  const { bookingId, providedCredential, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`checkIn: no booking with id ${bookingId}`);
  if (booking.status !== 'confirmed') throw new Error(`checkIn: booking ${bookingId} is not in a checkable state (status: ${booking.status})`);
  if (providedCredential !== booking.credential) throw new Error('checkIn: the provided credential does not match');

  booking.status = 'checked-in';
  booking.checkedInAt = now;
  return booking;
}

// MVP steps 8-10: the experience happens, completion is recorded, the
// host receives real settlement -- a real dual payout (host share +
// platform fee) from the same escrowed source, summing exactly to
// what was charged, the same "one source, real dual payout" mechanism
// already established for HVNTZ's hunt check-in and VOID's completeJob.
//
// **Payout requires attendance, not merely a confirmed booking.**
//
// This used to settle every booking in `confirmed` OR `checked-in`,
// which meant a host could complete an experience nobody turned up to
// and collect the whole room's money. The route is guarded so only the
// host can call it -- which makes that a host paying themselves for
// nothing, not a stranger's exploit, and a trust problem rather than a
// security one. Closed here rather than after real money has moved
// through it.
//
// **Two cases, and they are genuinely different.**
//
// *Nobody checked in.* The experience did not happen. The host
// delivered nothing, so every booking is refunded in full and the host
// is paid nothing. This is the case the guard exists for.
//
// *Some checked in, some did not.* The experience happened. Attendees
// settle to the host as before, and the individual no-shows settle to
// the host too -- deliberately, because the alternative contradicts a
// rule this app already has. `cancelBooking` inside
// CANCELLATION_CUTOFF_HOURS pays the host and refunds nothing; a
// no-show is a late cancellation that never bothered to cancel.
// Refunding it would make "don't turn up" strictly better for the
// customer than "cancel late", which is not a policy anyone would
// choose on purpose.
//
// Escrow still drains completely in both cases. Money that settles
// neither way is stranded, and the existing test says why that matters:
// it is "invisible from every view except this one".
async function completeExperience(store, options = {}) {
  const { experienceId, transferFn, now = Date.now() } = options;
  const experience = getExperience(store, experienceId);
  if (!experience) throw new Error(`completeExperience: no experience with id ${experienceId}`);
  if (experience.status === 'completed') throw new Error(`completeExperience: experience ${experienceId} is already completed`);
  if (experience.status === 'cancelled') throw new Error(`completeExperience: experience ${experienceId} is cancelled`);

  const eligibleBookings = store.bookings.filter(
    (b) => b.experienceId === experienceId && (b.status === 'confirmed' || b.status === 'checked-in'),
  );

  // Did the experience actually happen? One real attendee is the test.
  const anyoneAttended = eligibleBookings.some((b) => b.status === 'checked-in');

  for (const booking of eligibleBookings) {
    const attended = booking.status === 'checked-in';

    if (booking.pricePaid > 0) {
      if (typeof transferFn !== 'function') throw new Error('completeExperience requires a transferFn(fromUserId, toUserId, amount, reason) to settle priced bookings');

      if (!anyoneAttended) {
        // The experience did not happen. Full refund, no platform fee
        // -- there is no service to take a cut of.
        await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, booking.customerId, booking.pricePaid, `voidmagic_unattended_experience_refund:${experienceId}`);
      } else {
        const platformFee = round(booking.pricePaid * PLATFORM_TAKE_RATE);
        const hostPayout = round(booking.pricePaid - platformFee);
        await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, experience.hostId, hostPayout, `voidmagic_host_settlement:${experienceId}`);
        await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, 'voidmagic-platform', platformFee, `voidmagic_platform_fee:${experienceId}`);
      }
    }

    booking.status = anyoneAttended && !attended ? 'no-show' : 'completed';
    booking.completedAt = now;

    createNotification(store, {
      recipientId: booking.customerId,
      type: 'experience-ending',
      subject: `Experience ended: ${experience.title}`,
      message: `"${experience.title}" has ended. Thanks for joining.`,
      relatedId: booking.id,
      now,
    });
    createNotification(store, {
      recipientId: booking.customerId,
      type: 'post-event-follow-up',
      subject: `How was "${experience.title}"?`,
      message: 'Leave a rating, tip, or check out related experiences.',
      relatedId: booking.id,
      now,
    });
  }

  experience.status = 'completed';
  return { experience, completedBookings: eligibleBookings };
}

// Real cancellation + refund, closing the README's own flagged gap.
// The brief names "Refund policy" as a real field shown on the
// experience page (SS29) and lists "refunds" as a real line item in
// the event financial model (SS27), but gives no exact window or
// percentage anywhere -- flagged as a real, deterministic,
// interpretive choice, same discipline as PLATFORM_TAKE_RATE just
// above: modeled on Airbnb Experiences' own real, well-known
// cancellation policy (full refund if cancelled at least 24 hours
// before the experience starts, no refund after that cutoff), the
// closest real comparable already established in this ecosystem for
// exactly this kind of scheduled, bookable experience.
//
// A late (post-cutoff) cancellation settles economically the same way
// `completeExperience` does -- host share + platform fee, from the
// same escrowed source, summing to exactly what was charged -- rather
// than inventing a third split. Real-world justification, not
// arbitrary: the host held reserved capacity through the cutoff that
// could no longer be resold to another customer, the same real
// economic position as if the booking had completed. This also
// matches the brief's own SS41 framing of no-shows as an analytics
// metric alongside completed bookings, not a separate category.
const CANCELLATION_CUTOFF_HOURS = 24;

async function cancelBooking(store, options = {}) {
  const { bookingId, transferFn, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`cancelBooking: no booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`cancelBooking: booking ${bookingId} is already cancelled`);
  if (booking.status === 'completed') throw new Error(`cancelBooking: booking ${bookingId} has already completed and can't be cancelled`);

  const experience = getExperience(store, booking.experienceId);
  const hoursUntilStart = (experience.scheduledAt - now) / 3600000;
  const refundEligible = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS;

  if (booking.pricePaid > 0) {
    if (typeof transferFn !== 'function') throw new Error('cancelBooking requires a transferFn(fromUserId, toUserId, amount, reason) for a priced booking');
    if (refundEligible) {
      await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, booking.customerId, booking.pricePaid, `voidmagic_cancellation_refund:${bookingId}`);
    } else {
      const platformFee = round(booking.pricePaid * PLATFORM_TAKE_RATE);
      const hostPayout = round(booking.pricePaid - platformFee);
      await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, experience.hostId, hostPayout, `voidmagic_late_cancellation_host_settlement:${bookingId}`);
      await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, 'voidmagic-platform', platformFee, `voidmagic_late_cancellation_platform_fee:${bookingId}`);
    }
  }

  if (experience.status === 'open' || experience.status === 'full') {
    experience.remainingCapacity += 1;
    experience.status = 'open';
  }

  booking.status = 'cancelled';
  booking.cancelledAt = now;
  booking.refunded = refundEligible;

  createNotification(store, {
    recipientId: booking.customerId,
    type: 'booking-cancellation',
    subject: `Booking cancelled: ${experience.title}`,
    message: refundEligible
      ? `Your booking for "${experience.title}" was cancelled and refunded in full.`
      : `Your booking for "${experience.title}" was cancelled inside the ${CANCELLATION_CUTOFF_HOURS}-hour window and is not eligible for a refund.`,
    relatedId: booking.id,
    now,
  });

  return booking;
}

// MVP step 11: a real, minimal post-event summary -- honest about
// what it is (a receipt/summary), not fake media (SS13's MAGIC MEMORY
// photo/video package is explicitly later work).
function getPostEventSummary(store, bookingId) {
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`getPostEventSummary: no booking with id ${bookingId}`);
  if (booking.status !== 'completed') throw new Error(`getPostEventSummary: booking ${bookingId} has not completed yet`);
  const experience = getExperience(store, booking.experienceId);

  return {
    bookingId: booking.id,
    experienceTitle: experience.title,
    hostId: experience.hostId,
    pricePaid: booking.pricePaid,
    completedAt: booking.completedAt,
  };
}

module.exports = {
  VOID_MAGIC_ESCROW_ACCOUNT, PLATFORM_TAKE_RATE, CANCELLATION_CUTOFF_HOURS, generateCredential,
  bookExperience, getBooking, checkIn, completeExperience, cancelBooking, getPostEventSummary,
};
