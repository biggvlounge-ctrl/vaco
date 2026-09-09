// VACAY AUTO -- Rentals, the real core loop.
// Real escrow-then-settle shape, the same "one source, real dual
// payout" mechanism established across this session (VOID MAGIC's
// bookings, VACAY Stays, VACAY Experiences): the renter is charged the
// full rental total at booking time; the owner is paid (owner share +
// platform commission, summing exactly to the total) only at
// `completeRental`. The real double-booking guard proven correct four
// times now in this session (VOID MAGIC, VACAY Stays, VACAY
// Experiences, and here) -- a vehicle can't be double-booked for
// overlapping dates.
//
// The one real, deliberate difference from Stays/Experiences: the
// commission split isn't a single flat rate -- it's the vehicle's own
// `hostEarnPercent`, set once by the owner's chosen protection plan at
// listing time and copied onto the rental record at booking time (not
// re-read from the vehicle at completion), so an owner changing their
// protection plan later never retroactively changes an
// already-in-progress rental's economics.

const { getVehicle } = require('./vehicles');

const VACAY_AUTO_ESCROW_ACCOUNT = 'vacay-auto-escrow';
const VACAY_AUTO_PLATFORM_ACCOUNT = 'vacay-auto-platform';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const ACTIVE_RENTAL_STATUSES = ['booked'];

function findDoubleBooking(store, vehicleId, startDate, endDate) {
  return store.rentals.find((r) => r.vehicleId === vehicleId
    && ACTIVE_RENTAL_STATUSES.includes(r.status)
    && intervalsOverlap(startDate, endDate, r.startDate, r.endDate)) || null;
}

async function bookRental(store, options = {}) {
  const {
    vehicleId, renterId, startDate, endDate, transferFn, now = Date.now(),
  } = options;

  const vehicle = getVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`bookRental: no vehicle with id ${vehicleId}`);
  if (vehicle.status !== 'active') throw new Error(`bookRental: vehicle ${vehicleId} is not active (status: ${vehicle.status})`);
  if (!renterId) throw new Error('bookRental requires a renterId');
  if (!Number.isInteger(startDate) || !Number.isInteger(endDate) || endDate <= startDate) {
    throw new Error('bookRental requires a real startDate before endDate');
  }
  if (typeof transferFn !== 'function') throw new Error('bookRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  const conflict = findDoubleBooking(store, vehicleId, startDate, endDate);
  if (conflict) {
    throw new Error(`bookRental: double booking -- vehicle ${vehicleId} already has rental ${conflict.id} in an overlapping window`);
  }

  const days = Math.ceil((endDate - startDate) / MS_PER_DAY);
  const totalPrice = round(days * vehicle.dailyRate);

  const rentalId = store.nextRentalId++;
  await transferFn(renterId, VACAY_AUTO_ESCROW_ACCOUNT, totalPrice, `vacay_auto_rental_booking:${rentalId}`);

  const rental = {
    id: rentalId,
    vehicleId,
    renterId,
    startDate,
    endDate,
    days,
    dailyRate: vehicle.dailyRate,
    totalPrice,
    hostEarnPercent: vehicle.hostEarnPercent,
    ownerPayout: null,
    platformCommission: null,
    status: 'booked',
    completedAt: null,
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.rentals.push(rental);
  return rental;
}

function getRental(store, rentalId) {
  return store.rentals.find((r) => r.id === rentalId) || null;
}

async function completeRental(store, options = {}) {
  const { rentalId, transferFn, now = Date.now() } = options;
  const rental = getRental(store, rentalId);
  if (!rental) throw new Error(`completeRental: no rental with id ${rentalId}`);
  if (rental.status !== 'booked') throw new Error(`completeRental: rental ${rentalId} is not awaiting completion (status: ${rental.status})`);
  if (typeof transferFn !== 'function') throw new Error('completeRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  const vehicle = getVehicle(store, rental.vehicleId);
  const ownerPayout = round(rental.totalPrice * rental.hostEarnPercent);
  const platformCommission = round(rental.totalPrice - ownerPayout);

  await transferFn(VACAY_AUTO_ESCROW_ACCOUNT, vehicle.ownerId, ownerPayout, `vacay_auto_owner_settlement:${rentalId}`);
  await transferFn(VACAY_AUTO_ESCROW_ACCOUNT, VACAY_AUTO_PLATFORM_ACCOUNT, platformCommission, `vacay_auto_platform_commission:${rentalId}`);

  rental.ownerPayout = ownerPayout;
  rental.platformCommission = platformCommission;
  rental.status = 'completed';
  rental.completedAt = now;
  return rental;
}

// Real cancellation + refund, the same real 24-hour-before-start
// cutoff already established for Stays/Experiences, grounded in
// Turo's own real free-cancellation window (a full refund if cancelled
// at least 24 hours before the trip starts). A late cancellation
// settles to the owner exactly like `completeRental` does -- the
// vehicle's own `hostEarnPercent` split, from the same escrowed
// source -- since the owner held the vehicle's calendar reserved
// through the cutoff and couldn't rebook it to someone else.
const CANCELLATION_CUTOFF_HOURS = 24;

async function cancelRental(store, options = {}) {
  const { rentalId, transferFn, now = Date.now() } = options;
  const rental = getRental(store, rentalId);
  if (!rental) throw new Error(`cancelRental: no rental with id ${rentalId}`);
  if (rental.status === 'cancelled') throw new Error(`cancelRental: rental ${rentalId} is already cancelled`);
  if (rental.status === 'completed') throw new Error(`cancelRental: rental ${rentalId} has already completed and can't be cancelled`);
  if (typeof transferFn !== 'function') throw new Error('cancelRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  const vehicle = getVehicle(store, rental.vehicleId);
  const hoursUntilStart = (rental.startDate - now) / 3600000;
  const refundEligible = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS;

  if (refundEligible) {
    await transferFn(VACAY_AUTO_ESCROW_ACCOUNT, rental.renterId, rental.totalPrice, `vacay_auto_cancellation_refund:${rentalId}`);
  } else {
    const ownerPayout = round(rental.totalPrice * rental.hostEarnPercent);
    const platformCommission = round(rental.totalPrice - ownerPayout);
    await transferFn(VACAY_AUTO_ESCROW_ACCOUNT, vehicle.ownerId, ownerPayout, `vacay_auto_late_cancellation_owner_settlement:${rentalId}`);
    await transferFn(VACAY_AUTO_ESCROW_ACCOUNT, VACAY_AUTO_PLATFORM_ACCOUNT, platformCommission, `vacay_auto_late_cancellation_platform_commission:${rentalId}`);
    rental.ownerPayout = ownerPayout;
    rental.platformCommission = platformCommission;
  }

  rental.status = 'cancelled';
  rental.cancelledAt = now;
  rental.refunded = refundEligible;
  return rental;
}

module.exports = {
  VACAY_AUTO_ESCROW_ACCOUNT, VACAY_AUTO_PLATFORM_ACCOUNT, CANCELLATION_CUTOFF_HOURS, bookRental, getRental, completeRental, cancelRental,
};
