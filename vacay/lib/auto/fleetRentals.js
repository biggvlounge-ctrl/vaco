// VACAY AUTO -- Fleet Rentals: VACAY's own owned-vehicle rental
// business, the traditional Hertz/Enterprise-style model sitting
// alongside Turo's peer model (`vehicles.js`/`rentals.js`) in this
// same Auto section.
//
// **The real, defining structural contrast with Turo**, the reason
// this isn't just `vehicles.js` again with a different label: there
// is no peer owner here at all. VACAY itself owns every fleet
// vehicle, so when a fleet rental completes, VACAY keeps the full
// rental price -- no owner-earn split, no protection-plan tier,
// nothing to divide. The exact same real "owns it outright vs. pays a
// peer a share" contrast this session already built once for Vvltvre
// Music (artist keeps 100%) vs. Vvltvre Flix (platform acquires
// outright), now inside a single section instead of across two
// divisions.
//
// Reuses the real double-booking guard proven correct five times now
// this session (VOID MAGIC, VACAY Stays, VACAY Experiences, VACAY
// Auto/Turo, and here) against a fleet vehicle's own calendar.

const VACAY_AUTO_FLEET_ESCROW_ACCOUNT = 'vacay-auto-fleet-escrow';
const VACAY_AUTO_FLEET_REVENUE_ACCOUNT = 'vacay-auto-fleet-revenue';
const FLEET_VEHICLE_TYPES = ['car', 'suv', 'truck', 'van'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const ACTIVE_FLEET_RENTAL_STATUSES = ['booked'];

function findFleetDoubleBooking(store, vehicleId, startDate, endDate) {
  return store.fleetRentals.find((r) => r.vehicleId === vehicleId
    && ACTIVE_FLEET_RENTAL_STATUSES.includes(r.status)
    && intervalsOverlap(startDate, endDate, r.startDate, r.endDate)) || null;
}

function addFleetVehicle(store, options = {}) {
  const {
    type, make, model, year, dailyRate, location, now = Date.now(),
  } = options;

  if (!FLEET_VEHICLE_TYPES.includes(type)) throw new Error(`addFleetVehicle requires a type of ${FLEET_VEHICLE_TYPES.join(', ')}`);
  if (!make) throw new Error('addFleetVehicle requires a make');
  if (!model) throw new Error('addFleetVehicle requires a model');
  if (!Number.isInteger(year) || year < 1900) throw new Error('addFleetVehicle requires a real integer year');
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) throw new Error('addFleetVehicle requires a positive dailyRate');
  if (!location) throw new Error('addFleetVehicle requires a location');

  const vehicle = {
    id: store.nextFleetVehicleId++,
    type,
    make,
    model,
    year,
    dailyRate,
    location,
    status: 'active',
    createdAt: now,
  };
  store.fleetVehicles.push(vehicle);
  return vehicle;
}

function getFleetVehicle(store, vehicleId) {
  return store.fleetVehicles.find((v) => v.id === vehicleId) || null;
}

function searchFleetVehicles(store, options = {}) {
  const { location } = options;
  return store.fleetVehicles.filter((v) => v.status === 'active' && (!location || v.location === location));
}

async function bookFleetRental(store, options = {}) {
  const {
    vehicleId, renterId, startDate, endDate, transferFn, now = Date.now(),
  } = options;

  const vehicle = getFleetVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`bookFleetRental: no fleet vehicle with id ${vehicleId}`);
  if (vehicle.status !== 'active') throw new Error(`bookFleetRental: fleet vehicle ${vehicleId} is not active (status: ${vehicle.status})`);
  if (!renterId) throw new Error('bookFleetRental requires a renterId');
  if (!Number.isInteger(startDate) || !Number.isInteger(endDate) || endDate <= startDate) {
    throw new Error('bookFleetRental requires a real startDate before endDate');
  }
  if (typeof transferFn !== 'function') throw new Error('bookFleetRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  const conflict = findFleetDoubleBooking(store, vehicleId, startDate, endDate);
  if (conflict) {
    throw new Error(`bookFleetRental: double booking -- fleet vehicle ${vehicleId} already has rental ${conflict.id} in an overlapping window`);
  }

  const days = Math.ceil((endDate - startDate) / MS_PER_DAY);
  const totalPrice = round(days * vehicle.dailyRate);

  const rentalId = store.nextFleetRentalId++;
  await transferFn(renterId, VACAY_AUTO_FLEET_ESCROW_ACCOUNT, totalPrice, `vacay_auto_fleet_booking:${rentalId}`);

  const rental = {
    id: rentalId,
    vehicleId,
    renterId,
    startDate,
    endDate,
    days,
    dailyRate: vehicle.dailyRate,
    totalPrice,
    fleetRevenue: null,
    status: 'booked',
    completedAt: null,
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.fleetRentals.push(rental);
  return rental;
}

function getFleetRental(store, rentalId) {
  return store.fleetRentals.find((r) => r.id === rentalId) || null;
}

async function completeFleetRental(store, options = {}) {
  const { rentalId, transferFn, now = Date.now() } = options;
  const rental = getFleetRental(store, rentalId);
  if (!rental) throw new Error(`completeFleetRental: no fleet rental with id ${rentalId}`);
  if (rental.status !== 'booked') throw new Error(`completeFleetRental: fleet rental ${rentalId} is not awaiting completion (status: ${rental.status})`);
  if (typeof transferFn !== 'function') throw new Error('completeFleetRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  // The real, defining difference from Turo's own completeRental: one
  // payout, the FULL price, no owner split -- VACAY owns the vehicle
  // outright.
  await transferFn(VACAY_AUTO_FLEET_ESCROW_ACCOUNT, VACAY_AUTO_FLEET_REVENUE_ACCOUNT, rental.totalPrice, `vacay_auto_fleet_revenue:${rentalId}`);

  rental.fleetRevenue = rental.totalPrice;
  rental.status = 'completed';
  rental.completedAt = now;
  return rental;
}

// Real cancellation + refund, the same real 24-hour-before-start
// cutoff established across every other section. A late cancellation
// settles the same way `completeFleetRental` does -- the full price to
// VACAY's own fleet revenue account, no owner split, since VACAY owns
// this vehicle outright and held it reserved through the cutoff.
const CANCELLATION_CUTOFF_HOURS = 24;

async function cancelFleetRental(store, options = {}) {
  const { rentalId, transferFn, now = Date.now() } = options;
  const rental = getFleetRental(store, rentalId);
  if (!rental) throw new Error(`cancelFleetRental: no fleet rental with id ${rentalId}`);
  if (rental.status === 'cancelled') throw new Error(`cancelFleetRental: rental ${rentalId} is already cancelled`);
  if (rental.status === 'completed') throw new Error(`cancelFleetRental: rental ${rentalId} has already completed and can't be cancelled`);
  if (typeof transferFn !== 'function') throw new Error('cancelFleetRental requires a transferFn(fromUserId, toUserId, amount, reason)');

  const hoursUntilStart = (rental.startDate - now) / 3600000;
  const refundEligible = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS;

  if (refundEligible) {
    await transferFn(VACAY_AUTO_FLEET_ESCROW_ACCOUNT, rental.renterId, rental.totalPrice, `vacay_auto_fleet_cancellation_refund:${rentalId}`);
  } else {
    await transferFn(VACAY_AUTO_FLEET_ESCROW_ACCOUNT, VACAY_AUTO_FLEET_REVENUE_ACCOUNT, rental.totalPrice, `vacay_auto_fleet_late_cancellation_revenue:${rentalId}`);
    rental.fleetRevenue = rental.totalPrice;
  }

  rental.status = 'cancelled';
  rental.cancelledAt = now;
  rental.refunded = refundEligible;
  return rental;
}

module.exports = {
  FLEET_VEHICLE_TYPES,
  VACAY_AUTO_FLEET_ESCROW_ACCOUNT,
  VACAY_AUTO_FLEET_REVENUE_ACCOUNT,
  CANCELLATION_CUTOFF_HOURS,
  addFleetVehicle,
  getFleetVehicle,
  searchFleetVehicles,
  bookFleetRental,
  getFleetRental,
  completeFleetRental,
  cancelFleetRental,
};
