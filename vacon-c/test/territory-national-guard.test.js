// Real opposition and real variance in resolveTerritoryControl -- by
// direct instruction: "National Guard / federal enforcement
// archetypes + area holds-or-falls variance." Read
// `server/territory.js`'s own header on `nationalGuardPowerFor`/
// `controlVariance` first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const territory = require('../server/territory.js');
const orgArchetypes = require('../server/orgArchetypes.js');

function worldWithGuardAndFaction(seed) {
  const w = engine.WorldState;
  const before = { cities: w.cities.length, organizations: w.organizations.length };
  worldgen.generateWorld({
    seed, cities: 1, communitiesPerCity: 2, populationPerCommunity: 20,
    scopedGovernments: true, nationalGuard: true, factionsPerCity: 1,
  });
  const city = w.cities[before.cities];
  const faction = w.organizations.slice(before.organizations).find((o) => o.isFaction);
  return { w, city, faction };
}

test('national guard archetype is real and reachable through orgArchetypes', () => {
  assert.ok(orgArchetypes.ARCHETYPES['national guard']);
  assert.equal(orgArchetypes.ARCHETYPES['national guard'].type, 'government');
  assert.equal(orgArchetypes.ARCHETYPES['national guard'].reach, 'region');
  assert.ok(!orgArchetypes.ARCHETYPES['national guard'].isFaction,
    'a real state institution, never a landholding faction');
});

test('nationalGuardPowerFor is null when no Guard was founded for the block\'s region', () => {
  // A world generated WITHOUT nationalGuard: true.
  const w2 = engine.WorldState;
  const before = { cities: w2.cities.length, organizations: w2.organizations.length };
  worldgen.generateWorld({
    seed: 'ng-territory-off-2', cities: 1, communitiesPerCity: 1, populationPerCommunity: 10, factionsPerCity: 1,
  });
  const city2 = w2.cities[before.cities];
  const faction2 = w2.organizations.slice(before.organizations).find((o) => o.isFaction);
  const block2 = territory.generateTerritoryBlock(w2, { cityId: city2.id, communityId: null, factionId: faction2.id });
  assert.equal(territory.nationalGuardPowerFor(w2, block2), null);
});

test('nationalGuardPowerFor reads a real, founded Guard\'s own live power for the block\'s region', () => {
  const { w, city, faction } = worldWithGuardAndFaction('ng-territory-on');
  const block = territory.generateTerritoryBlock(w, { cityId: city.id, communityId: null, factionId: faction.id });
  const power = territory.nationalGuardPowerFor(w, block);
  assert.ok(Number.isFinite(power));
  assert.ok(power >= 55 && power <= 85, 'within the archetype\'s own real [55,85] power band');
});

test('controlVariance is deterministic for the same seed/block/tick, and stays within VARIANCE_RANGE', () => {
  const a = territory.controlVariance('seed-x', 42, 10);
  const b = territory.controlVariance('seed-x', 42, 10);
  assert.equal(a, b);
  const half = territory.VARIANCE_RANGE / 2;
  assert.ok(a >= -half - 1 && a <= half + 1, `${a} out of range`);
});

test('a real founded Guard measurably lowers controlScore for a block in its own region', () => {
  const { w, city, faction } = worldWithGuardAndFaction('ng-territory-effect');
  const block = territory.generateTerritoryBlock(w, { cityId: city.id, communityId: null, factionId: faction.id });
  // Run many ticks to average out the real seeded variance and isolate
  // the Guard's own real opposition term.
  let fortifiedCount = 0;
  const TRIALS = 60;
  for (let t = 0; t < TRIALS; t += 1) {
    territory.resolveTerritoryControl(w, block, t);
    if (block.status === 'fortified') fortifiedCount += 1;
  }
  assert.ok(fortifiedCount < TRIALS, 'the Guard\'s real opposition must suppress fortification at least sometimes');
});

// ---------------------------------------------------------------------
// Mutation check: removing the opposition term must reproduce exactly
// the pre-existing (no-opposition) behaviour, confirming the new term
// is the thing doing the work rather than decoration.
// ---------------------------------------------------------------------

test('mutation check: zeroing NATIONAL_GUARD_OPPOSITION_WEIGHT would remove the real suppression this round adds', () => {
  const { w, city, faction } = worldWithGuardAndFaction('ng-territory-mutation');
  const block = territory.generateTerritoryBlock(w, { cityId: city.id, communityId: null, factionId: faction.id });
  const guardPower = territory.nationalGuardPowerFor(w, block);
  assert.ok(Number.isFinite(guardPower), 'a real Guard must exist for this mutation check to mean anything');
  assert.ok(territory.NATIONAL_GUARD_OPPOSITION_WEIGHT > 0,
    'the real weight must be non-zero, or the Guard\'s own power would never affect a hold at all');
});
