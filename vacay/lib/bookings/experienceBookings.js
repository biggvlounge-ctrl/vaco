// VACAY EXPERIENCES -- Experience Bookings.
// Split out of VACAY itself into its own standalone app -- see
// `experiences.js`'s own header for the full split rationale. Its own
// escrow account (`vacay-experiences-escrow`) is deliberately distinct
// from Stays' `vacay-escrow` now that they're genuinely separate
// processes/ledgable entities, not a shared in-memory account.
//
// Source of truth: API map's "same host model" as stays -- reuses the
// exact real escrow-then-settle shape `../vacay/lib/bookings.js`
// (Stays) already established, and the real, literal 15.5% fee, not a
// second payment model. Genuinely different from a stay booking in
// one real way: a single `price` charged once per booking (no nights
// calculation), and a real capacity decrement on the Experience
// itself, mirroring VOID MAGIC's own `bookExperience`/
// `completeExperience` shape for the same real reason -- this is a
// scheduled, capacity-limited activity, not a date-range stay.

const { getExperience } = require('./experiences');

const VACAY_ESCROW_ACCOUNT = 'vacay-experiences-escrow';
const FEE_PERCENT = 15.5;

function round(n) {
  return Math.round(n * 100) / 100;
}

async function bookExperience(store, options = {}) {
  const { experienceId, guestId, transferFn, now = Date.now() } = options;

  const experience = getExperience(store, experienceId);
  if (!experience) throw new Error(`bookExperience: no experience with id ${experienceId}`);
  if (experience.status !== 'open') throw new Error(`bookExperience: experience ${experienceId} is not open (status: ${experience.status})`);
  if (!guestId) throw new Error('bookExperience requires a guestId');
  if (experience.remainingCapacity < 1) throw new Error(`bookExperience: experience ${experienceId} has no remaining capacity`);
  if (typeof transferFn !== 'function') throw new Error('bookExperience requires a transferFn(fromUserId, toUserId, amount, reason)');

  const bookingId = store.nextExperienceBookingId++;
  await transferFn(guestId, VACAY_ESCROW_ACCOUNT, experience.price, `vacay_experience_booking:${bookingId}`);

  experience.remainingCapacity -= 1;
  if (experience.remainingCapacity === 0) experience.status = 'full';

  const booking = {
    id: bookingId,
    experienceId,
    guestId,
    price: experience.price,
    feePercent: FEE_PERCENT,
    hostPayout: null,
    platformFee: null,
    status: 'booked',
    completedAt: null,
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.experienceBookings.push(booking);
  return booking;
}

function getExperienceBooking(store, bookingId) {
  return store.experienceBookings.find((b) => b.id === bookingId) || null;
}

async function completeExperienceBooking(store, options = {}) {
  const { bookingId, transferFn, now = Date.now() } = options;
  const booking = getExperienceBooking(store, bookingId);
  if (!booking) throw new Error(`completeExperienceBooking: no experience booking with id ${bookingId}`);
  if (booking.status !== 'booked') throw new Error(`completeExperienceBooking: booking ${bookingId} is not awaiting completion (status: ${booking.status})`);
  if (typeof transferFn !== 'function') throw new Error('completeExperienceBooking requires a transferFn(fromUserId, toUserId, amount, reason)');

  const experience = getExperience(store, booking.experienceId);
  const platformFee = round(booking.price * (FEE_PERCENT / 100));
  const hostPayout = round(booking.price - platformFee);
  await transferFn(VACAY_ESCROW_ACCOUNT, experience.hostId, hostPayout, `vacay_experience_host_settlement:${bookingId}`);
  await transferFn(VACAY_ESCROW_ACCOUNT, 'vacay-experiences-platform', platformFee, `vacay_experience_platform_fee:${bookingId}`);

  booking.hostPayout = hostPayout;
  booking.platformFee = platformFee;
  booking.status = 'completed';
  booking.completedAt = now;
  return booking;
}

// Real cancellation + refund, the same real Airbnb Experiences-derived
// 24-hour cutoff VOID MAGIC's own `cancelBooking` already established
// for this exact kind of scheduled, capacity-limited activity: a full
// refund if cancelled at least `CANCELLATION_CUTOFF_HOURS` before
// `experience.scheduledAt`, a late cancellation settling to the host
// like `completeExperienceBooking` does instead of a third split (the
// host held reserved capacity through the cutoff that couldn't be
// resold). Frees the real capacity slot back either way, since a
// cancelled guest's seat is genuinely available again regardless of
// refund eligibility.
const CANCELLATION_CUTOFF_HOURS = 24;

async function cancelExperienceBooking(store, options = {}) {
  const { bookingId, transferFn, now = Date.now() } = options;
  const booking = getExperienceBooking(store, bookingId);
  if (!booking) throw new Error(`cancelExperienceBooking: no experience booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`cancelExperienceBooking: booking ${bookingId} is already cancelled`);
  if (booking.status === 'completed') throw new Error(`cancelExperienceBooking: booking ${bookingId} has already completed and can't be cancelled`);
  if (typeof transferFn !== 'function') throw new Error('cancelExperienceBooking requires a transferFn(fromUserId, toUserId, amount, reason)');

  const experience = getExperience(store, booking.experienceId);
  const hoursUntilStart = (experience.scheduledAt - now) / 3600000;
  const refundEligible = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS;

  if (refundEligible) {
    await transferFn(VACAY_ESCROW_ACCOUNT, booking.guestId, booking.price, `vacay_experience_cancellation_refund:${bookingId}`);
  } else {
    const platformFee = round(booking.price * (FEE_PERCENT / 100));
    const hostPayout = round(booking.price - platformFee);
    await transferFn(VACAY_ESCROW_ACCOUNT, experience.hostId, hostPayout, `vacay_experience_late_cancellation_host_settlement:${bookingId}`);
    await transferFn(VACAY_ESCROW_ACCOUNT, 'vacay-experiences-platform', platformFee, `vacay_experience_late_cancellation_platform_fee:${bookingId}`);
    booking.hostPayout = hostPayout;
    booking.platformFee = platformFee;
  }

  if (experience.status === 'open' || experience.status === 'full') {
    experience.remainingCapacity += 1;
    experience.status = 'open';
  }

  booking.status = 'cancelled';
  booking.cancelledAt = now;
  booking.refunded = refundEligible;
  return booking;
}

module.exports = {
  VACAY_ESCROW_ACCOUNT, FEE_PERCENT, CANCELLATION_CUTOFF_HOURS, bookExperience, getExperienceBooking, completeExperienceBooking, cancelExperienceBooking,
};
