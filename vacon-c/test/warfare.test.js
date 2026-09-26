// Armed conflict between two organizations — added 26 Sep 2026 alongside
// server/warfare.js. See that file's own header for what this reuses:
// contest.js's combat resolver (built, never called until now) and
// mortality.killEntity (exported, never called until now).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const warfare = require('../server/warfare.js');
const membership = require('../server/membership.js');
const { getTraitId } = require('../server/traitDefinitions.js');

const YEAR = 365;

// Full canonical shape (matching `engine.js`'s `WorldState`), not a
// hand-picked subset — `killEntity` reaches into `succession.settleEstate`,
// which reaches into inventory, finances and heir-finding, and a
// fixture built from memory of what the code under test needs is
// exactly the sixth standing rule's failure mode.
function world({ tick = 0 } = {}) {
  const w = {
    tick,
    seed: 'warfare-test',
    npcs: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    resources: [],
    marketListings: [],
    individualFinances: [],
    employmentRecords: [],
    deceased: [],
    crimeIncidents: [],
    entityOrganizationMemberships: [],
    infrastructure: [],
    inventory: [],
    entityTraits: [],
    memories: [],
    relationships: [],
    entityKnowledge: [],
    activeConditions: [],
    events: [],
    historicalRecords: [],
    properties: [],
    ownershipRecords: [],
    cultures: [],
    cultureMemberships: [],
    wars: [],
  };
  warfare.reseedIds(w);
  return w;
}

let nextId = 1;
let nextOrgId = 1;

function fighter(w, organizationId, { meleeSkill = 50, tick = 0 } = {}) {
  const npc = {
    id: nextId++, status: 'active', createdTick: tick - 30 * YEAR,
  };
  w.npcs.push(npc);
  w.entityTraits.push({
    entity_id: npc.id,
    trait_id: getTraitId('combat', 'Melee Skill'),
    base_value: meleeSkill,
    temporary_modifier: 0,
    permanent_modifier: 0,
    experience_modifier: 0,
    environmental_modifier: 0,
    relationship_modifier: 0,
    key_modifier: 0,
    current_value: meleeSkill,
  });
  membership.joinOrganization(w, { entityId: npc.id, organizationId, tick });
  return npc;
}

function org(w) {
  const organization = { id: nextOrgId++, type: 'gang' };
  w.organizations.push(organization);
  return organization;
}

function armySide(w, count, options = {}) {
  const side = org(w);
  for (let i = 0; i < count; i += 1) fighter(w, side.id, options);
  return side;
}

// ---------------------------------------------------------------------
// declareWar
// ---------------------------------------------------------------------

test('an organization cannot war itself', () => {
  const w = world();
  const a = org(w);
  assert.throws(() => warfare.declareWar(w, { aOrgId: a.id, bOrgId: a.id }),
    /cannot war itself/);
});

test('declaring a war against an organization that does not exist is refused', () => {
  const w = world();
  const a = org(w);
  assert.throws(() => warfare.declareWar(w, { aOrgId: a.id, bOrgId: 9999 }),
    /does not exist/);
});

test('declaring the same war twice returns the one war, not two', () => {
  const w = world();
  const a = org(w);
  const b = org(w);
  const first = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  const second = warfare.declareWar(w, { aOrgId: b.id, bOrgId: a.id });
  assert.equal(first.id, second.id);
  assert.equal(warfare.activeWars(w).length, 1);
});

// ---------------------------------------------------------------------
// combatants
// ---------------------------------------------------------------------

test('an imprisoned member is not a combatant', () => {
  const w = world();
  const a = armySide(w, 1);
  w.npcs[0].status = 'imprisoned';
  assert.equal(warfare.combatantsOf(w, a.id, 0).length, 0);
});

test('a child member is not a combatant', () => {
  const w = world();
  const a = org(w);
  const child = fighter(w, a.id, { tick: 0 });
  child.createdTick = 0 - 5 * YEAR; // 5 years old
  assert.equal(warfare.combatantsOf(w, a.id, 0).length, 0);
});

// ---------------------------------------------------------------------
// battles
// ---------------------------------------------------------------------

test('a battle needs a living fighter on both sides', () => {
  const w = world();
  const a = armySide(w, 1);
  const b = org(w); // no members at all
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  assert.equal(warfare.runBattle(w, war, 0), null);
});

test('a battle names a winner and a loser from the two sides, and tallies a casualty', () => {
  const w = world();
  const a = armySide(w, 3);
  const b = armySide(w, 3);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });

  const battle = warfare.runBattle(w, war, 1);
  assert.ok(battle);
  assert.notEqual(battle.winnerId, battle.loserId);
  assert.ok([war.aOrgId, war.bOrgId].includes(battle.loserOrgId));
  assert.equal(war.casualties[battle.loserOrgId], 1);
  assert.equal(war.battles.length, 1);
});

test('over enough battles, losing sometimes actually kills the loser', () => {
  const w = world();
  const a = armySide(w, 30);
  const b = armySide(w, 30);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });

  let deaths = 0;
  for (let t = 1; t <= 500; t += 1) {
    const battle = warfare.runBattle(w, war, t);
    if (battle?.died) deaths += 1;
  }
  assert.ok(deaths > 0, 'nobody ever died in 500 battles at a 30% death chance');
  assert.equal(w.deceased.length, deaths);
});

// ---------------------------------------------------------------------
// ending a war
// ---------------------------------------------------------------------

test('a side with nobody left loses, and the other side is named the winner', () => {
  const w = world();
  const a = armySide(w, 1);
  const b = armySide(w, 1);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  // Remove all of side A, leaving B as the only side with anybody left.
  const aIds = new Set(membership.membersOf(w, a.id).map((n) => n.id));
  w.npcs = w.npcs.filter((n) => !aIds.has(n.id));

  assert.equal(warfare.checkForEnd(w, war, 10), true);
  assert.equal(war.winnerOrgId, b.id);
  assert.equal(war.endedTick, 10);
});

test('enough casualties end a war without wiping either side out', () => {
  const w = world();
  const a = armySide(w, 50);
  const b = armySide(w, 50);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  war.casualties[a.id] = warfare.CASUALTIES_TO_END;

  assert.equal(warfare.checkForEnd(w, war, 20), true);
  assert.equal(war.winnerOrgId, b.id, 'the side that took the casualties should not be the winner');
});

test('a war neither side has finished stays open', () => {
  const w = world();
  const a = armySide(w, 10);
  const b = armySide(w, 10);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  assert.equal(warfare.checkForEnd(w, war, 5), false);
  assert.equal(war.endedTick, null);
});

// ---------------------------------------------------------------------
// runWarfare — the whole cross-cutting call
// ---------------------------------------------------------------------

test('a declared war runs on its own once ticks pass, with no further calls telling it to', () => {
  const w = world();
  const a = armySide(w, 8);
  const b = armySide(w, 8);
  warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });

  for (let t = 1; t <= 2000; t += 1) warfare.runWarfare(w, { tick: t });

  const report = warfare.describeWarfare(w);
  assert.ok(report.totalBattles > 0, 'a declared war produced no battles across 2000 ticks');
});

test('describeWarfare distinguishes active wars from ended ones', () => {
  const w = world();
  const a = armySide(w, 1);
  const b = armySide(w, 1);
  const war = warfare.declareWar(w, { aOrgId: a.id, bOrgId: b.id });
  assert.equal(warfare.describeWarfare(w).active, 1);
  war.endedTick = 5;
  war.winnerOrgId = a.id;
  assert.equal(warfare.describeWarfare(w).active, 0);
  assert.equal(warfare.describeWarfare(w).ended, 1);
});
