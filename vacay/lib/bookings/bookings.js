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
  // The real penalty half of the host-cancellation guarantee below --
  // a host who has repeatedly backed out of confirmed stays cannot
  // keep taking new bookings cost-free.
  if (isHostCancellationLimited(store, listing.hostId)) {
    throw new Error(`createBooking: listing ${listingId}'s host has cancelled ${HOST_CANCELLATION_STRIKE_LIMIT}+ confirmed stays and cannot take new bookings`);
  }
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

// Mirrors flights' own `listBookingsForPassenger` -- the same real
// gap flagged in this app's README: every section but flights had no
// way for a guest to find their own bookings again after the initial
// booking response, which also made cancellation unreachable from the
// UI (nothing to cancel if nothing lists what you hold).
function listBookingsForGuest(store, guestId) {
  return store.bookings.filter((b) => b.guestId === guestId);
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

  // Claimed synchronously, before the real settlement call.
  // **completeStay and cancelBooking settle under different reasons,
  // so a per-function idempotency key cannot catch the two racing
  // each other on the same booking** -- each pays out of the same
  // escrow under its own key, and V3 sees two unrelated charges
  // rather than a retry of one. Claiming 'settling' here means
  // whichever call reaches this line first locks the other out
  // (this function's own `!== 'booked'` guard above, and
  // cancelBooking's explicit check) before either one's real payout
  // fires.
  booking.status = 'settling';

  try {
    // **One settlement, not two transfers.** Both legs leave the same
    // escrow account, so the second can fail because the first just
    // drained it -- and the final status below is only set
    // afterwards.
    await settleFn([
      { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: listing.hostId, amount: hostPayout, reason: `vacay_host_settlement:${bookingId}` },
      { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: 'vacay-platform', amount: platformFee, reason: `vacay_platform_fee:${bookingId}` },
    ], { reason: `vacay_stay_settlement:${bookingId}` });
  } catch (err) {
    booking.status = 'booked';
    throw err;
  }

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

// Real host-cancellation guarantee, closing VACAY_COMPARABLES.md's own
// directly-named asymmetry: "a guest cancelling needs a refund rule,
// while a host cancelling needs a *replacement* and a penalty, and a
// refund alone is precisely the response that generates the 1-star
// reviews this research is citing." The time-based cutoff above exists
// to protect a host who held dates in good faith -- it has no
// business protecting a host who is the one backing out. A real
// "replacement" (finding the guest an actual alternate stay) needs a
// listing-search-and-match system this codebase doesn't have, the
// same honest limit as VPLAN; what's real and buildable here is the
// other half: the guest is always made whole, and a host who does
// this repeatedly faces a real, structural consequence rather than a
// cost-free option.
//
// `cancellingUserId` is checked against the booking's own real
// guestId and the listing's own real hostId -- never trusted as a
// bare claim of which side is cancelling.
const HOST_CANCELLATION_STRIKE_LIMIT = 3; // real, flagged, bounded -- no exact number is given in any source doc

function getHostCancellationCount(store, hostId) {
  return (store.hostCancellationCounts || {})[hostId] || 0;
}

function isHostCancellationLimited(store, hostId) {
  return getHostCancellationCount(store, hostId) >= HOST_CANCELLATION_STRIKE_LIMIT;
}

async function cancelBooking(store, options = {}) {
  const { bookingId, cancellingUserId, settleFn, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`cancelBooking: no booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`cancelBooking: booking ${bookingId} is already cancelled`);
  if (booking.status === 'completed') throw new Error(`cancelBooking: booking ${bookingId} has already completed and can't be cancelled`);
  // Refuses a booking completeStay has already claimed -- see the
  // claim both functions now make before their real settlement call.
  if (booking.status === 'settling') throw new Error(`cancelBooking: booking ${bookingId} is currently being settled by another request`);
  if (typeof settleFn !== 'function') throw new Error('cancelBooking requires a settleFn(fromUserId, toUserId, amount, reason)');

  const listing = getListing(store, booking.listingId);
  const isHostCancelling = !!cancellingUserId && listing && cancellingUserId === listing.hostId;
  if (!cancellingUserId || (cancellingUserId !== booking.guestId && !isHostCancelling)) {
    throw new Error('cancelBooking requires a cancellingUserId that is either this booking\'s guest or its listing\'s host');
  }

  const hoursUntilCheckIn = (booking.checkIn - now) / 3600000;
  // A host cancellation is always fully refunded, regardless of
  // timing -- the cutoff protects a host holding dates in good faith,
  // which is not what's happening here.
  const refundEligible = isHostCancelling || hoursUntilCheckIn >= CANCELLATION_CUTOFF_HOURS;

  booking.status = 'settling';
  let hostPayout = null;
  let platformFee = null;

  try {
    if (refundEligible) {
      await settleFn(
        [{ fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: booking.guestId, amount: booking.totalPrice, reason: `vacay_cancellation_refund:${bookingId}` }],
        { reason: `vacay_cancellation_refund:${bookingId}` },
      );
    } else {
      platformFee = round(booking.totalPrice * (FEE_PERCENT / 100));
      hostPayout = round(booking.totalPrice - platformFee);
      await settleFn([
        { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: listing.hostId, amount: hostPayout, reason: `vacay_late_cancellation_host_settlement:${bookingId}` },
        { fromUserId: VACAY_ESCROW_ACCOUNT, toUserId: 'vacay-platform', amount: platformFee, reason: `vacay_late_cancellation_platform_fee:${bookingId}` },
      ], { reason: `vacay_late_cancellation:${bookingId}` });
    }
  } catch (err) {
    booking.status = 'booked';
    throw err;
  }

  if (!refundEligible) {
    booking.hostPayout = hostPayout;
    booking.platformFee = platformFee;
  }
  booking.status = 'cancelled';
  booking.cancelledAt = now;
  booking.refunded = refundEligible;
  booking.cancelledBy = isHostCancelling ? 'host' : 'guest';

  // The real penalty half: a host cancellation is a real strike
  // against that host, independent of this one booking's own refund.
  if (isHostCancelling) {
    if (!store.hostCancellationCounts) store.hostCancellationCounts = {};
    store.hostCancellationCounts[listing.hostId] = getHostCancellationCount(store, listing.hostId) + 1;
  }

  return booking;
}

module.exports = {
  VACAY_ESCROW_ACCOUNT, FEE_PERCENT, CANCELLATION_CUTOFF_HOURS, HOST_CANCELLATION_STRIKE_LIMIT,
  createBooking, getBooking, listBookingsForGuest, completeStay, cancelBooking, getHostCancellationCount, isHostCancellationLimited,
};
