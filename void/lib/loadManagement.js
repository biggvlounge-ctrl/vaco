// VOID — Passenger, Cargo & Load Management.
// Source of truth: VOID_MASTER_FREEZE.md's "PASSENGER, CARGO & LOAD
// MANAGEMENT" section, plus its own "Flags raised during review" --
// real, explicit decisions made here rather than left silent:
//
// (1) Car seats: the doc flags this as unaddressed, needing "an
// explicit decision, not silence." Real Uber/Lyft precedent (which
// the doc itself cites as a real source of complaints) is "parents
// supply their own seat" -- VOID follows that same real precedent by
// default; `carSeatsNeeded` lets a rider flag the need so matching can
// prefer a car-seat-capable driver, without building a full in-vehicle
// car-seat inventory/compliance system.
//
// (2) Service animals: the doc explicitly says these should not be
// framed as an optional declaration alongside golf clubs and coolers,
// since ADA (and equivalent laws) generally bar refusing a rider with
// one. `hasServiceAnimal` is a separate boolean, never counted toward
// cargo volume, oversized-item fees, or capacity-fit rejection.
//
// (3) Booking friction: the doc recommends smart defaults (1
// passenger, 1 included bag) over forcing active declaration on every
// request -- `passengerCount` defaults to 1 and `bagsIncluded` is
// computed automatically, not separately declared.

const DEFAULT_BAGS_PER_PASSENGER = 1;

function round(n) {
  return Math.round(n * 100) / 100;
}

function declareTrip(store, options = {}) {
  const {
    tripId, vehicleId,
    passengerCount = 1, adultCount, childCount,
    accessibilityNeeds = [], hasServiceAnimal = false, carSeatsNeeded = 0,
    oversizedItems = [], packages = [],
  } = options;

  if (!tripId) throw new Error('declareTrip requires a tripId');
  if (!vehicleId) throw new Error('declareTrip requires a vehicleId');
  if (!Number.isInteger(passengerCount) || passengerCount <= 0) {
    throw new Error('declareTrip requires a positive integer passengerCount');
  }
  const resolvedAdultCount = adultCount ?? passengerCount;
  const resolvedChildCount = childCount ?? 0;
  if (resolvedAdultCount + resolvedChildCount !== passengerCount) {
    throw new Error('declareTrip: adultCount + childCount must equal passengerCount');
  }
  if (typeof hasServiceAnimal !== 'boolean') {
    throw new Error('declareTrip requires a boolean hasServiceAnimal');
  }
  if (!Number.isInteger(carSeatsNeeded) || carSeatsNeeded < 0) {
    throw new Error('declareTrip requires a non-negative integer carSeatsNeeded');
  }
  for (const item of oversizedItems) {
    if (!item.type) throw new Error('every oversizedItem requires a type');
    if (typeof item.sizeCubicFt !== 'number' || item.sizeCubicFt <= 0) {
      throw new Error(`oversizedItem "${item.type}" requires a positive sizeCubicFt`);
    }
  }
  for (const pkg of packages) {
    if (!pkg.category) throw new Error('every package requires a category');
    if (typeof pkg.sizeCubicFt !== 'number' || pkg.sizeCubicFt <= 0) {
      throw new Error(`package "${pkg.category}" requires a positive sizeCubicFt`);
    }
    if (typeof pkg.weightLbs !== 'number' || pkg.weightLbs <= 0) {
      throw new Error(`package "${pkg.category}" requires a positive weightLbs`);
    }
  }

  const declaration = {
    tripId,
    vehicleId,
    passengerCount,
    adultCount: resolvedAdultCount,
    childCount: resolvedChildCount,
    accessibilityNeeds,
    hasServiceAnimal,
    carSeatsNeeded,
    bagsIncluded: passengerCount * DEFAULT_BAGS_PER_PASSENGER,
    oversizedItems,
    packages,
    createdAt: Date.now(),
  };
  store.tripDeclarations.push(declaration);
  return declaration;
}

function getTripDeclaration(store, tripId) {
  return store.tripDeclarations.find((d) => d.tripId === tripId) || null;
}

function registerVehicleCapacityProfile(store, options = {}) {
  const {
    vehicleId, seatingCapacity, cargoCapacityCubicFt, maxPackageSizeCubicFt,
    foldDownSeats = false, hasRoofRackOrHitch = false,
  } = options;
  if (!vehicleId) throw new Error('registerVehicleCapacityProfile requires a vehicleId');
  if (!Number.isInteger(seatingCapacity) || seatingCapacity <= 0) {
    throw new Error('registerVehicleCapacityProfile requires a positive integer seatingCapacity');
  }
  if (!Number.isFinite(cargoCapacityCubicFt) || cargoCapacityCubicFt <= 0) {
    throw new Error('registerVehicleCapacityProfile requires a positive cargoCapacityCubicFt');
  }
  if (!Number.isFinite(maxPackageSizeCubicFt) || maxPackageSizeCubicFt <= 0) {
    throw new Error('registerVehicleCapacityProfile requires a positive maxPackageSizeCubicFt');
  }

  const profile = { vehicleId, seatingCapacity, cargoCapacityCubicFt, maxPackageSizeCubicFt, foldDownSeats, hasRoofRackOrHitch };
  const existing = store.vehicleProfiles.find((v) => v.vehicleId === vehicleId);
  if (existing) {
    Object.assign(existing, profile);
    return existing;
  }
  store.vehicleProfiles.push(profile);
  return profile;
}

function getVehicleCapacityProfile(store, vehicleId) {
  return store.vehicleProfiles.find((v) => v.vehicleId === vehicleId) || null;
}

// The actual mechanic: real capacity checking against a real vehicle
// profile, preventing over-capacity assignment. Service animals never
// count toward cargo volume or fees -- a firm rule, not a preference.
function checkCapacityFit(store, tripId) {
  const declaration = getTripDeclaration(store, tripId);
  if (!declaration) {
    throw new Error(`checkCapacityFit: no trip declaration for ${tripId}`);
  }
  const profile = getVehicleCapacityProfile(store, declaration.vehicleId);
  if (!profile) {
    throw new Error(`checkCapacityFit: no vehicle capacity profile for ${declaration.vehicleId}`);
  }

  const reasons = [];
  if (declaration.passengerCount > profile.seatingCapacity) {
    reasons.push(`passengerCount ${declaration.passengerCount} exceeds seatingCapacity ${profile.seatingCapacity}`);
  }

  const cargoItems = [...declaration.oversizedItems, ...declaration.packages];
  const totalCargoVolume = round(cargoItems.reduce((sum, i) => sum + i.sizeCubicFt, 0));
  if (totalCargoVolume > profile.cargoCapacityCubicFt) {
    reasons.push(`total cargo volume ${totalCargoVolume}ft³ exceeds cargoCapacityCubicFt ${profile.cargoCapacityCubicFt}ft³`);
  }

  const oversizedSingleItem = cargoItems.find((i) => i.sizeCubicFt > profile.maxPackageSizeCubicFt);
  if (oversizedSingleItem) {
    reasons.push(`a single item exceeds maxPackageSizeCubicFt ${profile.maxPackageSizeCubicFt}ft³ -- recommend a larger vehicle`);
  }

  return { tripId, vehicleId: declaration.vehicleId, fits: reasons.length === 0, reasons, totalCargoVolume };
}

module.exports = {
  DEFAULT_BAGS_PER_PASSENGER,
  declareTrip,
  getTripDeclaration,
  registerVehicleCapacityProfile,
  getVehicleCapacityProfile,
  checkCapacityFit,
};
