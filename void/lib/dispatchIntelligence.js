// VOID — the deterministic rules underneath Gibson's and Kyle's
// stated dispatch behavior. Neither Gibson nor Kyle exists as an
// actual AI agent anywhere in this session (matching HVNTZ's DREA/
// HVNTER precedent) -- this is the real, testable logic underneath
// what the source docs say those agents do, not a fake AI call
// standing in for either of them.

function round(n) {
  return Math.round(n * 100) / 100;
}

// Gibson's air-vs-ground decision rule.
// Source of truth: VOID_MASTER_FREEZE.md: "if existing ground capacity
// is already heading in the destination's direction... and using it
// still meets a 1-2 day acceptable window, Gibson should suggest that
// route instead of dispatching a dedicated drone flight... Air is
// reserved for when speed genuinely requires it, or no suitable ground
// option exists." Implemented literally: ground is chosen only when
// real capacity already exists heading that way AND it fits the real
// acceptable window; otherwise air.
const DEFAULT_ACCEPTABLE_WINDOW_HOURS = 48; // "1-2 days," doc's own real range -- upper bound used as the default

function decideAirVsGround(options = {}) {
  const {
    hasGroundCapacityHeadingToDestination,
    estimatedGroundDeliveryHours,
    acceptableWindowHours = DEFAULT_ACCEPTABLE_WINDOW_HOURS,
  } = options;

  if (typeof hasGroundCapacityHeadingToDestination !== 'boolean') {
    throw new Error('decideAirVsGround requires a boolean hasGroundCapacityHeadingToDestination');
  }
  if (!Number.isFinite(estimatedGroundDeliveryHours) || estimatedGroundDeliveryHours <= 0) {
    throw new Error('decideAirVsGround requires a positive estimatedGroundDeliveryHours');
  }
  if (!Number.isFinite(acceptableWindowHours) || acceptableWindowHours <= 0) {
    throw new Error('decideAirVsGround requires a positive acceptableWindowHours');
  }

  const groundFitsWindow = estimatedGroundDeliveryHours <= acceptableWindowHours;
  const mode = hasGroundCapacityHeadingToDestination && groundFitsWindow ? 'ground' : 'air';
  const reason = mode === 'ground'
    ? 'existing ground capacity is already heading toward the destination and meets the acceptable time window'
    : hasGroundCapacityHeadingToDestination
      ? 'ground capacity exists but would not meet the acceptable time window -- speed requires air'
      : 'no suitable ground option exists heading toward the destination';

  return { mode, reason };
}

// Gibson Load Intelligence.
// Source of truth: "continuously evaluates passenger count, cargo
// volume, vehicle capacity, route efficiency, delivery sequencing, and
// available space for additional work, to maximize utilization
// without compromising safety." No exact scoring formula is given
// anywhere -- a real, flagged, deterministic utilization score below,
// plus the real leftover-capacity numbers Gibson would actually use to
// decide whether more work can be safely added.
function computeLoadIntelligenceScore(options = {}) {
  const { passengerCount, seatingCapacity, cargoVolumeUsed, cargoCapacity } = options;

  if (!Number.isInteger(passengerCount) || passengerCount < 0) {
    throw new Error('computeLoadIntelligenceScore requires a non-negative integer passengerCount');
  }
  if (!Number.isInteger(seatingCapacity) || seatingCapacity <= 0) {
    throw new Error('computeLoadIntelligenceScore requires a positive integer seatingCapacity');
  }
  if (!Number.isFinite(cargoVolumeUsed) || cargoVolumeUsed < 0) {
    throw new Error('computeLoadIntelligenceScore requires a non-negative cargoVolumeUsed');
  }
  if (!Number.isFinite(cargoCapacity) || cargoCapacity <= 0) {
    throw new Error('computeLoadIntelligenceScore requires a positive cargoCapacity');
  }
  if (passengerCount > seatingCapacity) {
    throw new Error('computeLoadIntelligenceScore: passengerCount cannot exceed seatingCapacity -- safety constraint');
  }
  if (cargoVolumeUsed > cargoCapacity) {
    throw new Error('computeLoadIntelligenceScore: cargoVolumeUsed cannot exceed cargoCapacity -- safety constraint');
  }

  const seatUtilization = passengerCount / seatingCapacity;
  const cargoUtilization = cargoVolumeUsed / cargoCapacity;
  const utilizationScore = round(((seatUtilization + cargoUtilization) / 2) * 100);

  const availableSeats = seatingCapacity - passengerCount;
  const availableCargoVolume = round(cargoCapacity - cargoVolumeUsed);
  const hasCapacityForMoreWork = availableSeats > 0 || availableCargoVolume > 0;

  return { utilizationScore, availableSeats, availableCargoVolume, hasCapacityForMoreWork };
}

// Kyle's dead-time suggestion mechanic, made concrete.
// Source of truth: "using (1) the driver's certified verticals..., (2)
// V4/Gibson's demand forecasting..., and (3) the actual length of a
// dead-time window between jobs, Kyle surfaces the best-fit
// opportunity for that specific gap." Real demand forecasting is V4's
// job (an AI agent not built here) -- this implements the real,
// deterministic part: filtering to what the driver is actually
// certified for and what actually fits the real time window, then
// picking the best real payout among what's left.
function recommendDeadTimeOpportunity(options = {}) {
  const { certifiedVerticals, deadTimeMinutes, availableOpportunities = [] } = options;

  if (!Array.isArray(certifiedVerticals)) {
    throw new Error('recommendDeadTimeOpportunity requires a certifiedVerticals array');
  }
  if (!Number.isFinite(deadTimeMinutes) || deadTimeMinutes <= 0) {
    throw new Error('recommendDeadTimeOpportunity requires a positive deadTimeMinutes');
  }

  const fitting = availableOpportunities.filter(
    (o) => certifiedVerticals.includes(o.verticalId) && o.estimatedDurationMinutes <= deadTimeMinutes
  );
  if (fitting.length === 0) {
    return null;
  }

  fitting.sort((a, b) => b.payout - a.payout);
  return fitting[0];
}

// Food-specific delivery priority (Phase 9).
// Source of truth: VOID_FOOD_CAPABLE_STATIONS.md: "food orders route
// with less delay tolerance than standard deliveries, reflecting the
// real difference between 'needs to arrive hot' and 'can wait in a
// locker.'" No exact minute figure is given -- 15 minutes is a real,
// flagged default sourced directly from VOID_MEITUAN_MODEL_INTEGRATION.md's
// own cited real spec ("delivers within a 3 km radius in 15 minutes"),
// not invented from nothing. General packages fall back to the same
// DEFAULT_ACCEPTABLE_WINDOW_HOURS used elsewhere.
const ORDER_TYPES = ['food', 'general-package'];
const FOOD_MAX_ACCEPTABLE_DELAY_MINUTES = 15;

function getDeliveryPriority(orderType) {
  if (!ORDER_TYPES.includes(orderType)) {
    throw new Error(`getDeliveryPriority: invalid orderType "${orderType}" (expected one of ${ORDER_TYPES.join(', ')})`);
  }
  const maxAcceptableDelayMinutes = orderType === 'food'
    ? FOOD_MAX_ACCEPTABLE_DELAY_MINUTES
    : DEFAULT_ACCEPTABLE_WINDOW_HOURS * 60;
  return { orderType, maxAcceptableDelayMinutes };
}

// Meituan-style demand smoothing (Phase 9).
// Source of truth: VOID_MEITUAN_MODEL_INTEGRATION.md: "'demand
// smoothing' (staggering order acceptance during peak times to keep
// delivery times reasonable across the entire system)." No exact
// staggering formula is given -- a real, flagged, proportional scheme:
// once a region is at or over its real concurrent-job capacity, each
// additional order beyond that gets staggered by a further real
// interval, rather than every order being accepted (and promised) at
// once. Order *batching* (grouping nearby orders) already exists as
// real code in droneRouting.js's groupOrdersIntoRoutes -- this is the
// separate, system-wide acceptance-timing half Meituan's real model
// adds on top.
const STAGGER_INTERVAL_MINUTES = 5; // flagged, interpretive -- no doc-given number

function computeAcceptanceDelay(options = {}) {
  const { currentActiveJobCount, maxConcurrentJobsPerRegion } = options;
  if (!Number.isInteger(currentActiveJobCount) || currentActiveJobCount < 0) {
    throw new Error('computeAcceptanceDelay requires a non-negative integer currentActiveJobCount');
  }
  if (!Number.isInteger(maxConcurrentJobsPerRegion) || maxConcurrentJobsPerRegion <= 0) {
    throw new Error('computeAcceptanceDelay requires a positive integer maxConcurrentJobsPerRegion');
  }

  const overCapacityBy = currentActiveJobCount - maxConcurrentJobsPerRegion + 1;
  const delayMinutes = overCapacityBy > 0 ? overCapacityBy * STAGGER_INTERVAL_MINUTES : 0;
  return { delayMinutes, isSmoothed: delayMinutes > 0 };
}

module.exports = {
  DEFAULT_ACCEPTABLE_WINDOW_HOURS,
  decideAirVsGround,
  computeLoadIntelligenceScore,
  recommendDeadTimeOpportunity,
  ORDER_TYPES,
  FOOD_MAX_ACCEPTABLE_DELAY_MINUTES,
  getDeliveryPriority,
  STAGGER_INTERVAL_MINUTES,
  computeAcceptanceDelay,
};
