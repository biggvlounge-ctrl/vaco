// Stakeouts (server/heists.js) and witness intimidation
// (server/intimidation.js) — by direct instruction: "witnesses,
// stakeouts, and safe-cracking/intimidation variance." Read each
// module's own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const heists = require('../server/heists.js');
const heistTools = require('../server/heistTools.js');
const inventory = require('../server/inventory.js');
const intimidation = require('../server/intimidation.js');
const economy = require('../server/economy.js');
const worldStore = require('../server/worldStore.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 800000;

// Task #40/#167 added a real tool requirement to `attemptHeist` after
// these tests were written — every target here has no real
// cargo-handling property, so it always asks for a real vault tool.
// Equip one so these predate-the-gate tests keep exercising what they
// were written to exercise.
function equipVaultTool(worldState, entityId) {
  heistTools.registerItems(worldState);
  inventory.give(worldState, { entityId, itemName: 'angle_grinder' });
}

function world() {
  const worldState = {
    tick: 10,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    communities: [],
    cities: [],
    entityTraits: [],
    entityState: [],
    individualFinances: [],
    employmentRecords: [],
    relationships: [],
    resources: [],
    marketListings: [],
    inventory: [],
    barterItems: [],
    crimeIncidents: [],
    historicalRecords: [],
    entityKnowledge: [],
    memories: [],
  };
  economy.reseedIds(worldState);
  return worldState;
}

function person(worldState, overrides = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(id, worldState.tick, INDIVIDUAL_DEFINITIONS, () => 50);
  for (const row of rows) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (!def) continue;
    const key = `${def.family}.${def.name}`;
    if (key in overrides) row.current_value = overrides[key];
  }
  worldState.entityTraits.push(...rows);
  worldState.npcs.push({
    id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0, home_property_id: null,
  });
  economy.generateIndividualFinances(worldState, id, { savings: 1000, tick: worldState.tick });
  return worldState.npcs[worldState.npcs.length - 1];
}

function org(worldState, leaderId) {
  const id = nextId++;
  const o = {
    id, name: `Org ${id}`, type: 'gang', leader_id: leaderId, assets: 10000, security: 0,
  };
  worldState.organizations.push(o);
  return o;
}

// ---------------------------------------------------------------------
// stakeOut / hasRecentStakeout
// ---------------------------------------------------------------------

test('stakeOut records a real, retrievable intel entry against a real target', () => {
  const w = world();
  const scout = person(w);
  const target = org(w, person(w).id);

  const record = heists.stakeOut(w, scout.id, target.id, { tick: 5 });

  assert.equal(record.entityId, scout.id);
  assert.equal(record.targetOrganizationId, target.id);
  assert.equal(record.tick, 5);
  assert.equal(typeof record.defense, 'number');
  assert.equal(w.stakeouts.length, 1);
});

test('stakeOut refuses a target that does not exist', () => {
  const w = world();
  const scout = person(w);
  assert.throws(() => heists.stakeOut(w, scout.id, 999999));
});

test('hasRecentStakeout is true only for the right crew member, the right target, within the recency window', () => {
  const w = world();
  const scout = person(w);
  const stranger = person(w);
  const target = org(w, person(w).id);
  const otherTarget = org(w, person(w).id);

  heists.stakeOut(w, scout.id, target.id, { tick: 10 });

  assert.equal(heists.hasRecentStakeout(w, [scout.id], target.id, 20), true);
  assert.equal(heists.hasRecentStakeout(w, [stranger.id], target.id, 20), false);
  assert.equal(heists.hasRecentStakeout(w, [scout.id], otherTarget.id, 20), false);
  assert.equal(
    heists.hasRecentStakeout(w, [scout.id], target.id, 10 + heists.STAKEOUT_RECENCY_TICKS + 1),
    false,
  );
  assert.equal(
    heists.hasRecentStakeout(w, [scout.id], target.id, 10 + heists.STAKEOUT_RECENCY_TICKS),
    true,
  );
});

// ---------------------------------------------------------------------
// attemptHeist: stakeout reduces detection chance only, never success
// ---------------------------------------------------------------------

test('a recent stakeout lowers detectionChance by exactly STAKEOUT_DETECTION_REDUCTION, and leaves successChance untouched', () => {
  const w = world();
  const leader = person(w);
  const sponsor = org(w, leader.id);
  const target = org(w, person(w).id);
  equipVaultTool(w, leader.id);

  const unstaked = heists.attemptHeist(w, leader.id, {
    organizationId: sponsor.id, crewEntityIds: [leader.id], targetOrganizationId: target.id, tick: 1,
  });

  heists.stakeOut(w, leader.id, target.id, { tick: 1 });
  const staked = heists.attemptHeist(w, leader.id, {
    organizationId: sponsor.id, crewEntityIds: [leader.id], targetOrganizationId: target.id, tick: 2,
  });

  assert.equal(staked.staked, true);
  assert.equal(unstaked.staked, false);
  assert.equal(staked.successChance, unstaked.successChance);
  assert.equal(
    Math.round((unstaked.detectionChance - staked.detectionChance) * 1000) / 1000,
    heists.STAKEOUT_DETECTION_REDUCTION,
  );
});

test('mutation check: removing the stakeout reduction collapses detectionChance back to the unstaked value', () => {
  const w = world();
  const leader = person(w);
  const sponsor = org(w, leader.id);
  const target = org(w, person(w).id);
  equipVaultTool(w, leader.id);
  heists.stakeOut(w, leader.id, target.id, { tick: 1 });

  const broken = heists.detectionChanceFor(
    heists.robberyAptitudeOf(w, leader.id),
    heists.targetDefenseOf(w, target.id),
  ) - 0; // the mutation: subtracting nothing, as if staked were ignored
  const real = heists.attemptHeist(w, leader.id, {
    organizationId: sponsor.id, crewEntityIds: [leader.id], targetOrganizationId: target.id, tick: 2,
  });

  assert.notEqual(real.detectionChance, broken);
});

// ---------------------------------------------------------------------
// intimidationChanceFor
// ---------------------------------------------------------------------

test('intimidationChanceFor is exactly 0.5 for an ordinary intimidator against an ordinary witness', () => {
  const w = world();
  const intimidator = person(w);
  const witness = person(w);
  assert.equal(intimidation.intimidationChanceFor(w, intimidator.id, witness.id), 0.5);
});

test('a high Fear Factor/Notoriety intimidator raises the chance against an ordinary witness', () => {
  const w = world();
  const intimidator = person(w, { 'reputation.Fear Factor': 95, 'reputation.Notoriety': 95 });
  const witness = person(w);
  assert.ok(intimidation.intimidationChanceFor(w, intimidator.id, witness.id) > 0.5);
});

test('a highly resilient witness lowers the chance even against a fearsome intimidator', () => {
  const w = world();
  const intimidator = person(w, { 'reputation.Fear Factor': 95, 'reputation.Notoriety': 95 });
  const fragile = person(w, { 'emotional.Resilience': 10 });
  const resilient = person(w, { 'emotional.Resilience': 95 });
  assert.ok(
    intimidation.intimidationChanceFor(w, intimidator.id, resilient.id)
      < intimidation.intimidationChanceFor(w, intimidator.id, fragile.id),
  );
});

test('intimidationChanceFor is always bounded to [0,1]', () => {
  const w = world();
  const extreme = person(w, { 'reputation.Fear Factor': 100, 'reputation.Notoriety': 100 });
  const zero = person(w, { 'emotional.Resilience': 0 });
  const chance = intimidation.intimidationChanceFor(w, extreme.id, zero.id);
  assert.ok(chance >= 0 && chance <= 1);
});

// ---------------------------------------------------------------------
// intimidateWitness
// ---------------------------------------------------------------------

test('a successful intimidation suppresses the witness\'s existing confidence about the perpetrator, without deleting the row', () => {
  const w = world();
  const intimidator = person(w, { 'reputation.Fear Factor': 99, 'reputation.Notoriety': 99 });
  const witness = person(w, { 'emotional.Resilience': 1 });
  const perpetrator = person(w);

  worldStore.addKnowledge(w, {
    entityId: witness.id,
    subjectEntityId: perpetrator.id,
    factType: 'known',
    factContent: `entity ${perpetrator.id} committed theft`,
    confidenceLevel: 0.9,
    sourceEntityId: perpetrator.id,
    spreadRate: 0.08,
    distortionLevel: 0.1,
    tick: 5,
  });

  const result = intimidation.intimidateWitness(w, {
    intimidatorId: intimidator.id, witnessId: witness.id, aboutPerpetratorId: perpetrator.id, tick: 10,
  });

  assert.equal(result.succeeded, true);
  const row = worldStore.getKnowledge(w, witness.id, perpetrator.id)[0];
  assert.ok(row, 'the knowledge row must still exist');
  assert.ok(row.confidence_level < 0.9, 'confidence must be reduced');
  assert.ok(row.confidence_level > 0, 'confidence must not be zeroed outright');
  assert.equal(
    Math.round(row.distortion_level * 10000) / 10000,
    Math.round((1 - row.confidence_level) * 10000) / 10000,
  );
});

test('intimidateWitness applies real stress to the witness either way, and leaves a real memory', () => {
  // Deliberately ordinary traits (Resilience 50, the eighth standing
  // rule's own lesson): `behavior.applyStress`'s loadMultiplier scales
  // a resilient person's load down, so a fixture built to test that
  // stress lands at all must not also build a fixture that suppresses
  // it.
  const w = world();
  const intimidator = person(w);
  const witness = person(w);
  const perpetrator = person(w);

  const before = w.memories.length;
  intimidation.intimidateWitness(w, {
    intimidatorId: intimidator.id, witnessId: witness.id, aboutPerpetratorId: perpetrator.id, tick: 10,
  });

  const state = w.entityState.find((s) => s.entity_id === witness.id);
  assert.ok(state && state.stress_level >= intimidation.INTIMIDATION_STRESS);
  assert.equal(w.memories.length, before + 1);
  assert.equal(w.memories[w.memories.length - 1].entity_id, witness.id);
});

test('a failed intimidation leaves the witness\'s existing knowledge untouched', () => {
  const w = world();
  const intimidator = person(w, { 'reputation.Fear Factor': 1, 'reputation.Notoriety': 1 });
  const witness = person(w, { 'emotional.Resilience': 99 });
  const perpetrator = person(w);

  worldStore.addKnowledge(w, {
    entityId: witness.id,
    subjectEntityId: perpetrator.id,
    factType: 'known',
    factContent: `entity ${perpetrator.id} committed theft`,
    confidenceLevel: 0.9,
    sourceEntityId: perpetrator.id,
    spreadRate: 0.08,
    distortionLevel: 0.1,
    tick: 5,
  });

  const result = intimidation.intimidateWitness(w, {
    intimidatorId: intimidator.id, witnessId: witness.id, aboutPerpetratorId: perpetrator.id, tick: 10,
  });

  assert.equal(result.succeeded, false);
  const row = worldStore.getKnowledge(w, witness.id, perpetrator.id)[0];
  assert.equal(row.confidence_level, 0.9);
});

test('intimidateWitness refuses an entity intimidating itself', () => {
  const w = world();
  const entity = person(w);
  assert.throws(() => intimidation.intimidateWitness(w, {
    intimidatorId: entity.id, witnessId: entity.id, aboutPerpetratorId: entity.id, tick: 1,
  }));
});

test('mutation check: a suppression factor of 0 would leave confidence unchanged — confirms the real gate is live', () => {
  const w = world();
  const intimidator = person(w, { 'reputation.Fear Factor': 99, 'reputation.Notoriety': 99 });
  const witness = person(w, { 'emotional.Resilience': 1 });
  const perpetrator = person(w);

  worldStore.addKnowledge(w, {
    entityId: witness.id,
    subjectEntityId: perpetrator.id,
    factType: 'known',
    factContent: `entity ${perpetrator.id} committed theft`,
    confidenceLevel: 0.9,
    sourceEntityId: perpetrator.id,
    spreadRate: 0.08,
    distortionLevel: 0.1,
    tick: 5,
  });

  intimidation.intimidateWitness(w, {
    intimidatorId: intimidator.id, witnessId: witness.id, aboutPerpetratorId: perpetrator.id, tick: 10,
  });

  const row = worldStore.getKnowledge(w, witness.id, perpetrator.id)[0];
  const wouldHaveBeenWithZeroSuppression = 0.9;
  assert.notEqual(row.confidence_level, wouldHaveBeenWithZeroSuppression);
});
