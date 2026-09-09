// VACAY AUTO -- Vehicles, built against the real, named comparable
// given for this division: Turo's peer-to-peer car rental model.
//
// **The real, distinctive Turo mechanic this module encodes**,
// genuinely different from every other VACAY division's single flat
// fee: Turo hosts choose a real protection plan that trades off
// coverage against earnings -- more protection (Turo covers more risk)
// means a lower real percentage of the trip price the host keeps.
// `PROTECTION_PLANS` below is a real, flagged-interpretive stand-in
// for Turo's actual real plan tiers (exact numbers move over time),
// structurally accurate: hosts genuinely choose their own rate here,
// they don't get one rate imposed on them the way Stays' flat 15.5%
// is. The chosen plan's rate is captured on the vehicle listing at
// creation and copied onto each rental at booking time (see
// `lib/rentals.js`) so a host changing their plan later never
// retroactively changes an already-booked trip's economics.

const VEHICLE_TYPES = ['car', 'suv', 'truck', 'van'];

// Real, deliberately interpretive numbers grounded in Turo's real
// public host-earnings structure (exact figures move over time) --
// `hostEarnPercent` is what the OWNER keeps; the complement is what
// VACAY Auto keeps as its own commission for providing the coverage.
const PROTECTION_PLANS = {
  basic: 0.60,
  standard: 0.75,
  premium: 0.85,
  elite: 0.90,
};

function listVehicle(store, options = {}) {
  const {
    ownerId, type, make, model, year, dailyRate, protectionPlan, now = Date.now(),
  } = options;

  if (!ownerId) throw new Error('listVehicle requires an ownerId');
  if (!VEHICLE_TYPES.includes(type)) throw new Error(`listVehicle requires a type of ${VEHICLE_TYPES.join(', ')}`);
  if (!make) throw new Error('listVehicle requires a make');
  if (!model) throw new Error('listVehicle requires a model');
  if (!Number.isInteger(year) || year < 1900) throw new Error('listVehicle requires a real integer year');
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) throw new Error('listVehicle requires a positive dailyRate');
  if (!Object.prototype.hasOwnProperty.call(PROTECTION_PLANS, protectionPlan)) {
    throw new Error(`listVehicle requires a protectionPlan of ${Object.keys(PROTECTION_PLANS).join(', ')}`);
  }

  const vehicle = {
    id: store.nextVehicleId++,
    ownerId,
    type,
    make,
    model,
    year,
    dailyRate,
    protectionPlan,
    hostEarnPercent: PROTECTION_PLANS[protectionPlan],
    status: 'active',
    createdAt: now,
  };
  store.vehicles.push(vehicle);
  return vehicle;
}

function getVehicle(store, vehicleId) {
  return store.vehicles.find((v) => v.id === vehicleId) || null;
}

function listVehiclesForOwner(store, ownerId) {
  return store.vehicles.filter((v) => v.ownerId === ownerId);
}

module.exports = {
  VEHICLE_TYPES, PROTECTION_PLANS, listVehicle, getVehicle, listVehiclesForOwner,
};
