// VOKEN -- Culture Cars: real vehicle attribute-based valuation, by
// direct instruction: "most of it will be based on value, miles,
// engine, the thing... Not really from how many [times seen]." The
// failures this file exists to catch: popularity swamping the real
// attribute-based value instead of staying a small, capped bonus, or
// mileage/age not actually moving the real value in the right real
// direction.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, verifySubjectIdentity, updateCardStatistics } = require('../lib/cultureCards');
const { recordEngagementEvent } = require('../lib/cardEngagement');
const {
  VEHICLE_CONDITION_GRADES, computeVehicleBaseValue, computeVehicleCardValue,
} = require('../lib/vehicleCardValue');

function mintVehicleCard(store, ownerId = 'marcus') {
  return mintCultureCard(store, {
    subjectPersonId: ownerId, category: 'vehicles', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 1,
  });
}

function setRealAttributes(store, card, ownerId, overrides = {}) {
  verifySubjectIdentity(store, { cardId: card.id, verifierId: ownerId });
  updateCardStatistics(store, {
    cardId: card.id, updaterId: ownerId,
    statistics: {
      referenceValue: 40000, mileage: 30000, condition: 'excellent', modelYear: 2015, enginePerformanceMultiplier: 1,
      ...overrides,
    },
  });
}

test('computeVehicleBaseValue: higher mileage lowers the real value, all else equal', () => {
  const low = computeVehicleBaseValue({ referenceValue: 40000, mileage: 10000, condition: 'good', modelYear: 2015 });
  const high = computeVehicleBaseValue({ referenceValue: 40000, mileage: 150000, condition: 'good', modelYear: 2015 });
  assert.ok(high.baseValue < low.baseValue);
});

test('computeVehicleBaseValue: every real condition grade moves the value in order', () => {
  const values = VEHICLE_CONDITION_GRADES.map((condition) => computeVehicleBaseValue({
    referenceValue: 40000, mileage: 30000, condition, modelYear: 2015,
  }).baseValue);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1], `expected "${VEHICLE_CONDITION_GRADES[i]}" to value higher than "${VEHICLE_CONDITION_GRADES[i - 1]}"`);
  }
});

test('computeVehicleBaseValue: a genuinely old car gets a real historic-age premium instead of only depreciating', () => {
  const now = new Date('2026-01-01').getTime();
  const modern = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'excellent', modelYear: 2015, now });
  const classic = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'excellent', modelYear: 1965, now });
  assert.ok(classic.historicAgePremium > 0);
  assert.equal(modern.historicAgePremium, 0, 'a car under the real classic-age threshold gets no age premium');
  assert.ok(classic.baseValue > modern.baseValue, 'the real age premium must actually raise the classic car above the modern one, same reference value');
});

test('computeVehicleBaseValue: a real engine/trim multiplier moves the value', () => {
  const base = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'good', modelYear: 2015, enginePerformanceMultiplier: 1 });
  const hotRod = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'good', modelYear: 2015, enginePerformanceMultiplier: 1.8 });
  assert.ok(hotRod.baseValue > base.baseValue);
});

test('computeVehicleBaseValue validates every real input', () => {
  assert.throws(() => computeVehicleBaseValue({ referenceValue: -1, mileage: 0, condition: 'good', modelYear: 2015 }), /positive referenceValue/);
  assert.throws(() => computeVehicleBaseValue({ referenceValue: 1, mileage: -1, condition: 'good', modelYear: 2015 }), /non-negative integer mileage/);
  assert.throws(() => computeVehicleBaseValue({ referenceValue: 1, mileage: 0, condition: 'mint', modelYear: 2015 }), /invalid condition/);
  assert.throws(() => computeVehicleBaseValue({ referenceValue: 1, mileage: 0, condition: 'good', modelYear: 1800 }), /real integer modelYear/);
  assert.throws(() => computeVehicleBaseValue({ referenceValue: 1, mileage: 0, condition: 'good', modelYear: 2015, enginePerformanceMultiplier: 10 }), /enginePerformanceMultiplier between/);
});

test('computeVehicleCardValue reads real owner-set attributes from statistics and refuses a card with none set', () => {
  const store = createVokenStore();
  const card = mintVehicleCard(store, 'marcus');
  assert.throws(() => computeVehicleCardValue(store, { cardId: card.id }), /missing real vehicle attributes/);

  setRealAttributes(store, card, 'marcus');
  const result = computeVehicleCardValue(store, { cardId: card.id });
  assert.ok(result.vehicleCardValue > 0);
  assert.equal(result.popularityBonusFraction, 0, 'no real engagement yet');
});

test('computeVehicleCardValue refuses a non-vehicle card', () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.throws(() => computeVehicleCardValue(store, { cardId: card.id }), /not "vehicles"/);
});

test('popularity is a real, capped, SECONDARY bonus -- it can never approach a real attribute-driven swing', () => {
  const store = createVokenStore();
  const card = mintVehicleCard(store, 'marcus');
  setRealAttributes(store, card, 'marcus');

  // Drive real engagement to its maximum.
  for (let i = 0; i < 50; i += 1) {
    recordEngagementEvent(store, { cardId: card.id, type: 'view', viewerId: `viewer-${i}` });
    recordEngagementEvent(store, { cardId: card.id, type: 'like' });
    recordEngagementEvent(store, { cardId: card.id, type: 'share' });
  }
  const popular = computeVehicleCardValue(store, { cardId: card.id });
  assert.ok(popular.popularityBonusFraction > 0);
  assert.ok(popular.popularityBonusFraction <= 0.15, 'the real popularity bonus must never exceed its real, small, flagged cap');

  // The real condition swing alone (poor->concours, 0.5x-1.6x) must
  // dwarf even a maxed-out popularity bonus.
  const poor = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'poor', modelYear: 2015 });
  const concours = computeVehicleBaseValue({ referenceValue: 40000, mileage: 30000, condition: 'concours', modelYear: 2015 });
  const conditionSwing = concours.baseValue / poor.baseValue;
  assert.ok(conditionSwing > 1 + 0.15, 'a real attribute swing must dwarf the maximum possible popularity bonus');
});
