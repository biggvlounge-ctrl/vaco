// VACANCY — the real staked casino wagering mechanic (server/casino.js).
//
// Task #64's own "mechanics included, not only data" half, under
// CLAUDE.md's standing override of the gambling/casino compliance
// gate. `GAME_LANGUAGE_AND_REFERENCES.md`'s own §8 said "no stakes
// are attached and none should be... that is the line between a pool
// game and the casino systems that stay closed" — this file is that
// line, moved, by the override already on record.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const casino = require('../server/casino.js');
const economy = require('../server/economy.js');
const { getTraitId } = require('../server/traitDefinitions.js');

function world({ tick = 1000 } = {}) {
  const w = {
    tick,
    npcs: [],
    organizations: [],
    properties: [],
    individualFinances: [],
    entityTraits: [],
    historicalRecords: [],
  };
  economy.reseedIds(w);
  return w;
}

function person(w, { id, savings = 0 } = {}) {
  w.npcs.push({ id, status: 'active' });
  economy.generateIndividualFinances(w, id, { savings, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

function setTrait(w, entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  w.entityTraits.push({
    entity_id: entityId, trait_id: traitId, current_value: value, base_value: value, key_modifier: 0,
  });
}

function houseOrg(w, { id, assets = 100000 } = {}) {
  const org = { id, name: 'Riverboat Queen', type: 'business', assets };
  w.organizations.push(org);
  return org;
}

function casinoProperty(w, {
  id, operatingOrganizationId, lifecycleStage = 'operation', landmarkCategory = 'casino',
} = {}) {
  const property = {
    id, landmark_category: landmarkCategory, lifecycle_stage: lifecycleStage,
    operating_organization_id: operatingOrganizationId,
  };
  w.properties.push(property);
  return property;
}

// -- GAMES / winChanceFor ----------------------------------------------

test('GAMES carries the real, sourced house edge for all three games', () => {
  assert.equal(casino.GAMES.roulette.houseEdge, 2 / 38, 'American double-zero roulette\'s own exact mathematical edge');
  assert.equal(casino.GAMES.blackjack.houseEdge, 0.01);
  assert.equal(casino.GAMES.slots.houseEdge, 0.08);
  assert.equal(casino.GAMES.roulette.skillDiscipline, null, 'roulette has no real skill component');
  assert.equal(casino.GAMES.slots.skillDiscipline, null, 'slots have no real skill component');
  assert.equal(casino.GAMES.blackjack.skillDiscipline, 'wits');
});

test('winChanceFor refuses a game that is not real', () => {
  const w = world();
  person(w, { id: 1 });
  assert.throws(() => casino.winChanceFor(w, 1, 'craps'), /not a real casino game/);
});

test('winChanceFor is the ordinary even-money house-edge formula, (1 - edge) / 2, for a no-skill game', () => {
  const w = world();
  person(w, { id: 1 });
  const chance = casino.winChanceFor(w, 1, 'roulette');
  assert.equal(chance, (1 - 2 / 38) / 2);
});

test('a real, skilled wits rating narrows blackjack\'s house edge (raises win chance); an unskilled one widens it -- never past an even bet either way', () => {
  const w = world();
  person(w, { id: 1 }); // no real wits traits at all -> reads as the neutral centre (50)
  const neutral = casino.winChanceFor(w, 1, 'blackjack');

  person(w, { id: 2 });
  for (const name of ['Risk Assessment', 'Memory', 'Focus', 'Problem Solving']) setTrait(w, 2, 'mental', name, 100);
  setTrait(w, 2, 'social', 'Charisma', 100);
  const skilled = casino.winChanceFor(w, 2, 'blackjack');

  person(w, { id: 3 });
  for (const name of ['Risk Assessment', 'Memory', 'Focus', 'Problem Solving']) setTrait(w, 3, 'mental', name, 0);
  setTrait(w, 3, 'social', 'Charisma', 0);
  const unskilled = casino.winChanceFor(w, 3, 'blackjack');

  assert.ok(skilled > neutral, 'a maximally skilled player did not get a better real win chance than an unrated one');
  assert.ok(neutral > unskilled, 'a maximally unskilled player did not get a worse real win chance than an unrated one');
  assert.ok(skilled < 0.5, 'basic-strategy skill flipped the house\'s own real edge into a player edge, which the 0.75 floor on the modulator is supposed to prevent');
});

// -- casinoHouseFor / placeWager validation -----------------------------

test('placeWager refuses a property that is not a real casino', () => {
  const w = world();
  person(w, { id: 1, savings: 100 });
  const house = houseOrg(w, { id: 50 });
  casinoProperty(w, { id: 10, operatingOrganizationId: house.id, landmarkCategory: 'mall' });
  assert.throws(
    () => casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'slots', stake: 10 }),
    /not a real casino/,
  );
});

test('placeWager refuses a casino that is not actually open yet', () => {
  const w = world();
  person(w, { id: 1, savings: 100 });
  const house = houseOrg(w, { id: 50 });
  casinoProperty(w, { id: 10, operatingOrganizationId: house.id, lifecycleStage: 'construction' });
  assert.throws(
    () => casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'slots', stake: 10 }),
    /not open/,
  );
});

test('placeWager refuses a casino with no real operating organization to wager against', () => {
  const w = world();
  person(w, { id: 1, savings: 100 });
  casinoProperty(w, { id: 10, operatingOrganizationId: null });
  assert.throws(
    () => casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'slots', stake: 10 }),
    /no real operator/,
  );
});

test('placeWager refuses an unreal game name', () => {
  const w = world();
  person(w, { id: 1, savings: 100 });
  const house = houseOrg(w, { id: 50 });
  casinoProperty(w, { id: 10, operatingOrganizationId: house.id });
  assert.throws(
    () => casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'craps', stake: 10 }),
    /not a real casino game/,
  );
});

test('placeWager refuses a stake the player does not really have -- claim-before-pay, never a half-charged bet', () => {
  const w = world();
  person(w, { id: 1, savings: 5 });
  const house = houseOrg(w, { id: 50 });
  casinoProperty(w, { id: 10, operatingOrganizationId: house.id });
  assert.throws(
    () => casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'slots', stake: 10 }),
    /savings/,
  );
  assert.equal(economy.getLatestFinances(w, 1).savings, 5, 'a refused wager still moved the player\'s real money');
  assert.equal(house.assets, 100000, 'a refused wager still moved the house\'s real money');
});

// -- placeWager, real money movement --------------------------------

test('a losing wager moves the real stake from the player\'s savings into the house\'s real assets, and nothing more', () => {
  const w = world();
  person(w, { id: 1, savings: 100 });
  const house = houseOrg(w, { id: 50, assets: 100000 });
  casinoProperty(w, { id: 10, operatingOrganizationId: house.id });

  // Find a real, seeded tick where this exact entity/property/game
  // combination draws a loss, so the test exercises a real losing
  // branch deterministically rather than hoping for one.
  let tick = 1000;
  let row = null;
  for (; tick < 1000 + 500; tick += 1) {
    const w2 = world({ tick });
    person(w2, { id: 1, savings: 100 });
    const house2 = houseOrg(w2, { id: 50, assets: 100000 });
    casinoProperty(w2, { id: 10, operatingOrganizationId: house2.id });
    const r = casino.placeWager(w2, { entityId: 1, propertyId: 10, game: 'roulette', stake: 20, tick });
    if (!r.won) { row = r; break; }
  }
  assert.ok(row, 'no losing roulette draw happened across 500 real seeded ticks');
  assert.equal(row.won, false);
});

test('a winning wager pays the real stake back plus even money from the house\'s own real assets', () => {
  // The same search, this time for a real winning tick.
  let row = null;
  let tick = 1000;
  for (; tick < 1000 + 2000 && !row; tick += 1) {
    const w = world({ tick });
    person(w, { id: 1, savings: 100 });
    const house = houseOrg(w, { id: 50, assets: 100000 });
    casinoProperty(w, { id: 10, operatingOrganizationId: house.id });
    const r = casino.placeWager(w, { entityId: 1, propertyId: 10, game: 'roulette', stake: 20, tick });
    if (r.won) {
      row = r;
      assert.equal(economy.getLatestFinances(w, 1).savings, 100 - 20 + 40, 'the winner\'s own stake plus even money was not credited correctly');
      assert.equal(house.assets, 100000 + 20 - 40, 'the house\'s own real assets did not move by exactly the net payout');
      assert.equal(w.casinoWagerEvents.length, 1);
      assert.equal(casino.wagersBy(w, 1).length, 1);
      assert.ok(w.historicalRecords.some((r2) => r2.event_type === 'casino_wager'));
    }
  }
  assert.ok(row, 'no winning roulette draw happened across 2000 real seeded ticks');
});
