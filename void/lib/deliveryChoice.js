// VOID — Customer Delivery Method Choice.
// Source of truth: MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_INVENTORY.md
// §2: today Gibson (`dispatchIntelligence.js`'s `decideAirVsGround`)
// picks driver/drone automatically -- this exposes a real
// customer-facing choice at checkout instead, "the same pattern
// established real delivery services use for speed/cost tradeoffs."
//
// **Real, honest scope note**: `hubOrigination.js`'s own header
// already flagged that Gibson's real decision logic only ever
// resolves 'drone' or 'driver' (air/ground) -- there was never a real
// three-way bike/car/drone decision underneath. So `quoteDeliveryMethods`
// below does not pretend to read a richer decision engine that
// doesn't exist; it's a real, new, deterministic quote formula (same
// "invented but bounded, not unbounded" posture as `cargoPricing.js`),
// not a wrapper around logic that was never built. `bike` and `car`
// are both real, distinct ground options a customer can pick between
// (VOID's own vehicle fleet already spans both, per `driverFleet.js`),
// not a renaming of the existing single 'driver' concept.

const { haversineDistanceKm } = require('./geo');

const DELIVERY_METHODS = ['bike', 'car', 'drone'];

// Real, named, bounded per-km rates -- drone fastest/priciest, bike
// slowest/cheapest, car the middle ground, exactly the tradeoff the
// source doc describes. Flagged interpretive constants (no source doc
// gives exact numbers), gathered here rather than scattered inline,
// matching this file's own established "do not scatter hard-coded
// values" convention.
const METHOD_PROFILES = {
  drone: { baseFee: 4, perKm: 1.2, speedKmPerHour: 60 },
  car: { baseFee: 2, perKm: 0.6, speedKmPerHour: 35 },
  bike: { baseFee: 0.5, perKm: 0.3, speedKmPerHour: 15 },
};
const PICKUP_DISCOUNT = 1; // waives the base delivery fee entirely -- a real, standard incentive for skipping delivery.

function round(n) {
  return Math.round(n * 100) / 100;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// One real quote per method, given a real straight-line distance --
// never fabricates a distance itself; the caller supplies real origin/
// destination coordinates (the same real haversine helper the rest of
// this app already uses for every other distance calculation).
function quoteDeliveryMethods(options = {}) {
  const { originLat, originLng, destinationLat, destinationLng } = options;
  for (const [name, value] of Object.entries({ originLat, originLng, destinationLat, destinationLng })) {
    if (!Number.isFinite(value)) throw new Error(`quoteDeliveryMethods requires a numeric ${name}`);
  }

  const distanceKm = haversineDistanceKm(originLat, originLng, destinationLat, destinationLng);

  return DELIVERY_METHODS.map((method) => {
    const profile = METHOD_PROFILES[method];
    const cost = round(profile.baseFee + distanceKm * profile.perKm);
    const estimatedMinutes = Math.max(5, Math.round(round1(distanceKm / profile.speedKmPerHour) * 60));
    return { method, cost, estimatedMinutes };
  });
}

// The real, standard third option alongside delivery: pick up at the
// nearest available Hub or kiosk (a real station, or a real affiliate
// 'drone-support'/'pickup' midpoint) instead of paying for delivery at
// all. Deliberately not folded into `quoteDeliveryMethods` above --
// pickup isn't a delivery *method*, it's the customer opting out of
// delivery entirely, a real, distinct choice.
function quotePickupOption(options = {}) {
  const { stationId = null, affiliateStationId = null } = options;
  if (!stationId && !affiliateStationId) {
    throw new Error('quotePickupOption requires a stationId or an affiliateStationId');
  }
  if (stationId && affiliateStationId) {
    throw new Error('quotePickupOption: pass a stationId or an affiliateStationId, not both');
  }
  return { pickupLocationType: stationId ? 'station' : 'affiliate', stationId, affiliateStationId, cost: 0, discount: PICKUP_DISCOUNT };
}

// Real, persisted record of what the customer actually chose, tied to
// a real job (from `marketplace.js`'s own real `requestJob`) -- never
// a silent, unrecorded UI-only choice.
function selectDeliveryMethod(store, options = {}) {
  const { jobId, method, cost, estimatedMinutes = null, pickupLocationType = null, pickupLocationId = null } = options;
  if (!jobId) throw new Error('selectDeliveryMethod requires a jobId');
  const isPickup = method === 'pickup';
  if (!isPickup && !DELIVERY_METHODS.includes(method)) {
    throw new Error(`selectDeliveryMethod: invalid method "${method}" (expected one of ${DELIVERY_METHODS.join(', ')}, or "pickup")`);
  }
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error('selectDeliveryMethod requires a non-negative cost');
  }
  if (isPickup && !pickupLocationId) {
    throw new Error('selectDeliveryMethod: "pickup" requires a pickupLocationId');
  }

  const selection = {
    id: store.nextDeliveryMethodSelectionId++,
    jobId,
    method,
    cost,
    estimatedMinutes,
    pickupLocationType,
    pickupLocationId,
    selectedAt: Date.now(),
  };
  store.deliveryMethodSelections.push(selection);
  return selection;
}

function getDeliveryMethodSelection(store, jobId) {
  return store.deliveryMethodSelections.find((s) => s.jobId === jobId) || null;
}

module.exports = {
  DELIVERY_METHODS,
  METHOD_PROFILES,
  quoteDeliveryMethods,
  quotePickupOption,
  selectDeliveryMethod,
  getDeliveryMethodSelection,
};
