// VOKEN — Culture Cars: real vehicle attribute-based valuation, by
// direct instruction: "we also have culture cars where we have [come]
// up with a culture car algorithm as well... just the value of the
// car. We can look up values of the car. We can look up the
// attributes of whatever the car has. And then the car will get a
// value from that. Not really from how many [times seen]... most of
// it will be based on value, miles, engine, the thing."
//
// Deliberately a SEPARATE real algorithm from `valueAlgorithm.js`,
// not the generic person-card formula routed through a vehicle --
// a car's real value is driven by real automotive facts (a real
// reference value, mileage, condition, engine/trim, model year), the
// same real inputs an actual appraisal or auction-comp valuation
// uses, not social influence or historical-significance scoring.
//
// **No new "owner can insert data" mechanic needed.** The owner
// inserting real attributes ("they could insert that information to
// change how the value of the car") is exactly `updateCardStatistics()`
// in `cultureCards.js`, already built and already gated to a vehicle
// card's real verified owner -- this module only reads
// `card.statistics`, it never writes to it.
//
// **Popularity is real, but deliberately secondary** ("not really
// from how many [times seen]... most of it will be based on value,
// miles, engine"): rather than trusting a self-reported "times seen"
// number, this reuses the real, already-built, non-gameable view
// count (`cardEngagement.js`'s deduped views) and
// `valueAlgorithm.js`'s own `computeDigitalEngagementScore()` --
// genuine code reuse, not a second popularity formula -- folded in as
// a small, capped bonus on top of the real attribute-based base
// value, never allowed to dominate it.
//
// Every constant below is a real, deterministic, flagged interpretive
// choice (no source doc gives exact figures), the same discipline
// every other formula in this session follows. `MILEAGE_FULL_DEPRECIATION_MILES`
// (200,000) and the condition grades (`poor`/`fair`/`good`/`excellent`/
// `concours`) are real, standard terms the collector-car and
// used-car-appraisal world actually uses; `CLASSIC_AGE_THRESHOLD_YEARS`
// (25) is the real age many insurers and vehicle registries use to
// classify a "classic" or "antique" car, the real reason "historic
// cars, new cars" can both be priced by the same one formula: a car
// old enough crosses from depreciating with age to appreciating with
// it.

const { getCultureCard } = require('./cultureCards');
const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore } = require('./valueAlgorithm');

const VEHICLE_CONDITION_GRADES = ['poor', 'fair', 'good', 'excellent', 'concours'];
const VEHICLE_CONDITION_MULTIPLIERS = { poor: 0.5, fair: 0.75, good: 1.0, excellent: 1.25, concours: 1.6 };

const MILEAGE_FULL_DEPRECIATION_MILES = 200000;
const MIN_MILEAGE_FACTOR = 0.3;

const CLASSIC_AGE_THRESHOLD_YEARS = 25;
const HISTORIC_AGE_PREMIUM_YEARS_TO_MAX = 75;
const MAX_HISTORIC_AGE_PREMIUM = 0.5;

const MIN_ENGINE_PERFORMANCE_MULTIPLIER = 0.5;
const MAX_ENGINE_PERFORMANCE_MULTIPLIER = 2.5;

// A real, capped popularity bonus -- secondary by direct instruction,
// never large enough to approach, let alone exceed, a real
// attribute-driven swing (condition alone spans 0.5x-1.6x).
const MAX_POPULARITY_BONUS_FRACTION = 0.15;

function round2(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// The real, pure attribute-based formula -- no store, no engagement,
// just the car's own real facts. Separated from
// `computeVehicleCardValue()` below so the base valuation is directly
// testable without needing a minted card or any engagement history.
function computeVehicleBaseValue(options = {}) {
  const {
    referenceValue, mileage, condition, modelYear,
    enginePerformanceMultiplier = 1, now = Date.now(),
  } = options;

  if (!Number.isFinite(referenceValue) || referenceValue <= 0) {
    throw new Error('computeVehicleBaseValue requires a positive referenceValue');
  }
  if (!Number.isInteger(mileage) || mileage < 0) {
    throw new Error('computeVehicleBaseValue requires a non-negative integer mileage');
  }
  if (!VEHICLE_CONDITION_GRADES.includes(condition)) {
    throw new Error(`computeVehicleBaseValue: invalid condition "${condition}" (expected one of ${VEHICLE_CONDITION_GRADES.join(', ')})`);
  }
  if (!Number.isInteger(modelYear) || modelYear < 1886 || modelYear > new Date(now).getFullYear() + 1) {
    throw new Error('computeVehicleBaseValue requires a real integer modelYear (1886 or later, not more than a year in the future)');
  }
  if (!Number.isFinite(enginePerformanceMultiplier) || enginePerformanceMultiplier < MIN_ENGINE_PERFORMANCE_MULTIPLIER || enginePerformanceMultiplier > MAX_ENGINE_PERFORMANCE_MULTIPLIER) {
    throw new Error(`computeVehicleBaseValue requires enginePerformanceMultiplier between ${MIN_ENGINE_PERFORMANCE_MULTIPLIER} and ${MAX_ENGINE_PERFORMANCE_MULTIPLIER}`);
  }

  const mileageFactor = clamp(1 - mileage / MILEAGE_FULL_DEPRECIATION_MILES, MIN_MILEAGE_FACTOR, 1);
  const conditionMultiplier = VEHICLE_CONDITION_MULTIPLIERS[condition];

  const age = new Date(now).getFullYear() - modelYear;
  const ageBeyondClassicThreshold = clamp(age - CLASSIC_AGE_THRESHOLD_YEARS, 0, HISTORIC_AGE_PREMIUM_YEARS_TO_MAX);
  const historicAgePremium = (ageBeyondClassicThreshold / HISTORIC_AGE_PREMIUM_YEARS_TO_MAX) * MAX_HISTORIC_AGE_PREMIUM;

  const baseValue = round2(
    referenceValue * mileageFactor * conditionMultiplier * enginePerformanceMultiplier * (1 + historicAgePremium),
  );

  return {
    mileageFactor: round2(mileageFactor),
    conditionMultiplier,
    enginePerformanceMultiplier,
    historicAgePremium: round2(historicAgePremium),
    baseValue,
  };
}

// The full real assembly for a minted vehicle card: real attributes
// from `card.statistics` (set by the real verified owner via
// `updateCardStatistics()`), plus the real, capped, secondary
// popularity bonus from this card's own real, deduped engagement.
function computeVehicleCardValue(store, options = {}) {
  const { cardId, now = Date.now() } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`computeVehicleCardValue: no card with id ${cardId}`);
  if (card.category !== 'vehicles') {
    throw new Error(`computeVehicleCardValue: card ${cardId} is category "${card.category}", not "vehicles"`);
  }

  const { referenceValue, mileage, condition, modelYear, enginePerformanceMultiplier } = card.statistics;
  if (referenceValue === undefined || mileage === undefined || condition === undefined || modelYear === undefined) {
    throw new Error(`computeVehicleCardValue: card ${cardId} is missing real vehicle attributes in its statistics (requires referenceValue, mileage, condition, modelYear -- set via updateCardStatistics)`);
  }

  const base = computeVehicleBaseValue({
    referenceValue, mileage, condition, modelYear, enginePerformanceMultiplier, now,
  });

  const engagementStats = computeEngagementStats(store, { cardId, now });
  const { digitalEngagementScore } = computeDigitalEngagementScore({
    views: engagementStats.views, clicks: engagementStats.clicks, comments: engagementStats.comments,
    likes: engagementStats.likes, shares: engagementStats.shares, engagementVelocity: engagementStats.engagementVelocity,
  });
  const popularityBonusFraction = round2((digitalEngagementScore / 100) * MAX_POPULARITY_BONUS_FRACTION);

  const vehicleCardValue = round2(base.baseValue * (1 + popularityBonusFraction));

  return {
    cardId, ...base, digitalEngagementScore, popularityBonusFraction, vehicleCardValue,
  };
}

module.exports = {
  VEHICLE_CONDITION_GRADES,
  VEHICLE_CONDITION_MULTIPLIERS,
  MILEAGE_FULL_DEPRECIATION_MILES,
  CLASSIC_AGE_THRESHOLD_YEARS,
  MAX_POPULARITY_BONUS_FRACTION,
  computeVehicleBaseValue,
  computeVehicleCardValue,
};
