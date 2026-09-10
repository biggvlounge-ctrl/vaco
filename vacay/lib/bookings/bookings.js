// VACAY -- Bookings (Phase 1 core loop).
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `Booking { id, listingId, guestId, feePercent: 15.5, checkIn,
// checkOut }`, API map (`POST /vacay/bookings -- enforces the 15.5%
// flat fee`), and VACAY_COMPARABLES.md's real anchor (Airbnb's actual
// 15.5% flat host-only fee, cross-validated against Booking.com's
// ~15% and Expedia/Vrbo's 8-15%).
//
// Real escrow-then-settle shape, the same "one source, real dual
// payout" mechanism already established for VOID MAGIC's own
// bookings.js: the guest is charged the full stay total at booking
// time, but the host is paid (host share + platform fee, summing
// exactly to what was charged) only at `completeStay` -- mirroring
// Airbnb's real payout timing (hosts are paid out after checkin, not
// at booking) rather than an immediate-payout model.
//
// A real, structural answer to VACAY_COMPARABLES.md's #3 named
// industry-wide failure pattern ("double-bookings from calendar sync
// failures"): since this is the single real source of truth for a
// listing's bookings (not synced from an external calendar), a real
// interval-overlap guard against the same listing's other active
// bookings prevents the failure by construction, the same real
// pattern VOID MAGIC's own double-booking guard already established
// for hosts' experience schedules.

const { getListing } = require('./listings');

const VACAY_ESCROW_ACCOUNT = 'vacay-escrow';
const FEE_PERCENT = 15.5; // real, literal value from the source doc, not interpretive
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACTIVE_BOOKING_STATUSES = ['booked', 'completed'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findOverlappingBooking(store, listingId, checkIn, checkOut) {
  return store.bookings.find((b) => b.listingId === listingId
    && ACTIVE_BOOKING_STATUSES.includes(b.status)
    && intervalsOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) || null;
}

async function createBooking(store, options = {}) {
  const {
    listingId, guestId, checkIn, checkOut, settleFn, now = Date.now(),
  } = options;

  const listing = getListing(store, listingId);
  if (!listing) throw new Error(`createBooking: no listing with id ${listingId}`);
  if (listing.status !== 'active') throw new Error(`createBooking: listing ${listingId} is not active (status: ${listing.status})`);
  if (!guestId) throw new Error('createBooking requires a guestId');
  if (!Number.isInteger(checkIn) || checkIn < now) throw new Error('createBooking requires a real, present-or-future checkIn timestamp');
  if (!Number.isInteger(checkOut) || checkOut <= checkIn) throw new Error('createBooking requires a checkOut timestamp after checkIn');
  if (typeof settleFn !== 'function') throw new Error('createBooking requires a settleFn(fromUserId, toUserId, amount, reason)');

  const conflict = findOverlappingBooking(store, listingId, checkIn, checkOut);
  if (conflict) {
    throw new Error(`createBooking: listing ${listingId} is already booked (booking ${conflict.id}) for an overlapping date range`);
  }

  const nights = Math.round((checkOut - checkIn) / MS_PER_DAY);
  if (nights < 1) throw new Error('createBooking requires a stay of at least one night');
  const totalPrice = round(nights * listing.pricePerNight);

  // Reserve the id and charge before recording the booking -- a failed
  // charge (e.g. insufficient funds) must never leave a "booked"
  // record behind.
  const bookingId = store.nextBookingId++;
  await settleFn(
    [{ fromUserId: guestId, toUserId: VACAY_ESCROW_ACCOUNT, amount: totalPrice, reason: `vacay_booking:${bookingId}` }],
    { reason: `vacay_booking:${bookingId}` },
  );

  const booking = {
    id: bookingId,
    listingId,
    guestId,
    checkIn,
    checkOut,
    nights,
    feePercent: FEE_PERCENT,
    totalPrice,
    hostPayout: null,
    platformFee: null,
    status: 'booked',
    completedAt: null,
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.bookings.push(booking);
  return booking;
}

function getBooking(store, bookingId) {
  return store.bookings.find((b) => b.id === bookingId) || null;
}

async function completeStay(store, options = {}) {
  const { bookingId, settleFn, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`completeStay: no booking with id ${bookingId}`);
  if (booking.status !== 'booked') throw new Error(`completeStay: booking ${bookingId} is not awaiting completion (status: ${booking.status})`);
  if (typeof settleFn !== 'function') throw new Error('completeStay requires a settleFn(fromUserId, toUserId, amount, reason)');

  const listing = getListing(store, booking.listingId);
  const platformFee = round(booking.totalPrice * (FEE_PERCENT / 100));
  const hostPayout = round(booking.totalPrice - platformFee);
  // **One settlement, not two transfers.** Both legs leave the same
  // escrow account, so the second can fail because the first just
  // drained it -- and the status below is only set afterwards, so the
  // booking stays `booked` and a retry pays the host out of escrow a
  // second time.
  await settleFn([
    { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: listing.hostId, amount: hostPayout, reason: `vacay_host_settlement:${bookingId}` },
    { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: 'vacay-platform', amount: platformFee, reason: `vacay_platform_fee:${bookingId}` },
  ], { reason: `vacay_stay_settlement:${bookingId}` });

  booking.hostPayout = hostPayout;
  booking.platformFee = platformFee;
  booking.status = 'completed';
  booking.completedAt = now;
  return booking;
}

// Real cancellation + refund, closing this project's own previously-
// flagged gap ("Cancellation/refunds across any section"). Grounded in
// the same real Airbnb comparable `FEE_PERCENT` already cites: a full
// refund if cancelled at least 24 hours before check-in (Airbnb's own
// real "Flexible" policy tier), no refund after that cutoff -- reusing
// the exact real `CANCELLATION_CUTOFF_HOURS` precedent this session
// already established for VOID MAGIC's own experience cancellations.
// A late cancellation settles to the host exactly like `completeStay`
// does (host share + platform fee, same escrowed source, summing to
// the full charge) rather than a third split -- the host held the
// calendar dates reserved through the cutoff and couldn't resell them,
// the same real economic position as if the stay had completed.
const CANCELLATION_CUTOFF_HOURS = 24;

async function cancelBooking(store, options = {}) {
  const { bookingId, settleFn, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`cancelBooking: no booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`cancelBooking: booking ${bookingId} is already cancelled`);
  if (booking.status === 'completed') throw new Error(`cancelBooking: booking ${bookingId} has already completed and can't be cancelled`);
  if (typeof settleFn !== 'function') throw new Error('cancelBooking requires a settleFn(fromUserId, toUserId, amount, reason)');

  const listing = getListing(store, booking.listingId);
  const hoursUntilCheckIn = (booking.checkIn - now) / 3600000;
  const refundEligible = hoursUntilCheckIn >= CANCELLATION_CUTOFF_HOURS;

  if (refundEligible) {
    await settleFn(
      [{ fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: booking.guestId, amount: booking.totalPrice, reason: `vacay_cancellation_refund:${bookingId}` }],
      { reason: `vacay_cancellation_refund:${bookingId}` },
    );
  } else {
    const platformFee = round(booking.totalPrice * (FEE_PERCENT / 100));
    const hostPayout = round(booking.totalPrice - platformFee);
    await settleFn([
      { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: listing.hostId, amount: hostPayout, reason: `vacay_late_cancellation_host_settlement:${bookingId}` },
      { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: 'vacay-platform', amount: platformFee, reason: `vacay_late_cancellation_platform_fee:${bookingId}` },
    ], { reason: `vacay_late_cancellation:${bookingId}` });
    booking.hostPayout = hostPayout;
    booking.platformFee = platformFee;
  }

  booking.status = 'cancelled';
  booking.cancelledAt = now;
  booking.refunded = refundEligible;
  return booking;
}

module.exports = {
  VACAY_ESCROW_ACCOUNT, FEE_PERCENT, CANCELLATION_CUTOFF_HOURS, createBooking, getBooking, completeStay, cancelBooking,
};
