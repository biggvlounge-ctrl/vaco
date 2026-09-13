// What a death sets in motion.
//
// **Nothing, before this.** Measured, a death left five things
// dangling: an employment contract `active` forever, a corpse as the
// current owner of every property they held, their inventory in dead
// hands, `organizations.leader_id` pointing at somebody who is not
// there, and `families.generation` stuck at 1 because only a birth
// could ever advance it and a birth sets the CHILD's generation.
//
// `mortality.js` declined to decide any of it, and said so: ending a
// contract because somebody died "is a decision about inheritance and
// succession, and inventing it here would put a second, quieter answer
// next to whatever gets built for that".

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const mortality = require('../server/mortality.js');
const property = require('../server/property.js');
const succession = require('../server/succession.js');
const territory = require('../server/territory.js');

let nextId = 700000;

function world({ tick = 36500 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    communities: [],
    cities: [],
    entityTraits: [],
    entityState: [],
    habits: [],
    scheduleEvents: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    individualFinances: [],
    employmentRecords: [],
    crimeIncidents: [],
    inventory: [],
    properties: [],
    ownershipRecords: [],
    resources: [],
    marketListings: [],
    nextEntityId: 1,
  };
  economy.reseedIds(worldState);
  territory.reseedIds(worldState);
  property.reseedIds(worldState);
  inventory.reseedIds(worldState);
  return worldState;
}

function person(worldState, { age = 40, savings = 0 } = {}) {
  const npc = {
    id: nextId++, status: 'active', communityId: null, home_property_id: null,
    createdTick: worldState.tick - Math.round(age * mortality.TICKS_PER_YEAR),
    updatedTick: worldState.tick, generation: 1, traits: {},
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings, tick: worldState.tick });
  return npc;
}

function family(worldState, members) {
  const id = nextId++;
  worldState.families.push({
    id, surname: 'Vance', generation: 1, total_members: members.length,
    head_npc_id: members[0].npc.id, updatedTick: worldState.tick,
  });
  for (const m of members) {
    worldState.familyMemberships.push({
      entity_id: m.npc.id, family_id: id, role: m.role, generation_number: 1,
    });
  }
  return worldState.families[worldState.families.length - 1];
}

// -- who inherits -------------------------------------------------------

test('the estate passes by the schema\'s own role order', () => {
  // `family_memberships.role` enumerates heir, child, partner,
  // sibling, grandparent, parent, guardian — all real values of that
  // column. `heir` goes first because the schema has a role that says
  // exactly that.
  const w = world();
  const dead = person(w, { age: 70 });
  const sibling = person(w, { age: 65 });
  const child = person(w, { age: 40 });
  const namedHeir = person(w, { age: 20 });
  family(w, [
    { npc: dead, role: 'parent' },
    { npc: sibling, role: 'sibling' },
    { npc: child, role: 'child' },
    { npc: namedHeir, role: 'heir' },
  ]);

  assert.equal(succession.heirFor(w, dead.id).id, namedHeir.id);
});

test('within a role, the eldest living candidate takes it', () => {
  const w = world();
  const dead = person(w, { age: 70 });
  const younger = person(w, { age: 20 });
  const elder = person(w, { age: 45 });
  family(w, [
    { npc: dead, role: 'parent' },
    { npc: younger, role: 'child' },
    { npc: elder, role: 'child' },
  ]);
  assert.equal(succession.heirFor(w, dead.id).id, elder.id);
});

test('an heir has to be alive, and somebody with no family has none', () => {
  // Passing an estate to another corpse would move the problem rather
  // than solve it.
  const w = world();
  const dead = person(w);
  const alone = person(w);
  assert.equal(succession.heirFor(w, alone.id), null, 'somebody with no family has an heir');

  const onlyChild = person(w);
  family(w, [{ npc: dead, role: 'parent' }, { npc: onlyChild, role: 'child' }]);
  assert.equal(succession.heirFor(w, dead.id).id, onlyChild.id);

  mortality.recordDeath(w, { entityId: onlyChild.id, cause: 'disease' });
  assert.equal(succession.heirFor(w, dead.id), null, 'a dead child inherited');
});

test('a relation with an unlisted role still beats nobody', () => {
  // `family_memberships.role` is nullable and `worldgen` assigns a
  // generic 'member', so a strict role list would leave most families
  // with no heir at all.
  const w = world();
  const dead = person(w, { age: 70 });
  const relation = person(w, { age: 30 });
  family(w, [{ npc: dead, role: 'member' }, { npc: relation, role: 'member' }]);
  assert.equal(succession.heirFor(w, dead.id).id, relation.id);
});

// -- what passes --------------------------------------------------------

test('property passes as a new ownership record, not an edited one', () => {
  // `ownership_records` is append-only history. The dead person really
  // did own it until they died, and rewriting that would erase the
  // fact. `acquired_method: 'inherited'` is one of the schema's own
  // eight values — it was there from the start, waiting for this.
  const w = world();
  const dead = person(w, { age: 80 });
  const heir = person(w, { age: 50 });
  family(w, [{ npc: dead, role: 'parent' }, { npc: heir, role: 'child' }]);

  const house = property.generateProperty(w, { type: 'residential', value: 5000 });
  property.recordOwnership(w, {
    entityId: house.id, ownerEntityId: dead.id, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: w.tick,
  });
  const historyBefore = w.ownershipRecords.length;

  mortality.recordDeath(w, { entityId: dead.id, cause: 'age' });

  assert.equal(w.ownershipRecords.length, historyBefore + 1, 'the estate edited history');
  const owner = property.getCurrentOwner(w, house.id);
  assert.equal(owner.owner_entity_id, heir.id);
  assert.equal(owner.acquired_method, 'inherited');
  assert.equal(property.getHoldings(w, heir.id).count, 1);
});

test('an estate with no heir is unclaimed, which is its own fact', () => {
  // `owner_type: 'none'` is a real schema value and this is what it is
  // for. A building whose owner died with nobody to leave it to is
  // different from one that was never owned, and different again from
  // one still recorded as owned by a corpse.
  const w = world();
  const alone = person(w, { age: 90 });
  const house = property.generateProperty(w, { type: 'residential', value: 5000 });
  property.recordOwnership(w, {
    entityId: house.id, ownerEntityId: alone.id, ownerType: 'individual',
    acquiredMethod: 'built', tick: w.tick,
  });

  const death = mortality.recordDeath(w, { entityId: alone.id, cause: 'age' });
  assert.equal(death.estate.heirId, null);
  assert.equal(death.estate.propertiesUnclaimed, 1);
  assert.equal(property.getCurrentOwner(w, house.id).owner_type, 'none');
});

test('goods and savings pass together, and are lost together', () => {
  const w = world();
  const dead = person(w, { age: 80, savings: 900 });
  const heir = person(w, { age: 50, savings: 100 });
  family(w, [{ npc: dead, role: 'parent' }, { npc: heir, role: 'child' }]);
  inventory.give(w, { entityId: dead.id, itemName: 'Hammer', quantity: 2 });

  const death = mortality.recordDeath(w, { entityId: dead.id, cause: 'age' });
  assert.equal(death.estate.itemsTransferred, 2);
  assert.equal(inventory.quantityOf(w, heir.id, 'Hammer'), 2);
  assert.equal(inventory.holdingsOf(w, dead.id).length, 0, 'goods stayed in dead hands');
  assert.equal(economy.getLatestFinances(w, heir.id).savings, 1000);
  assert.equal(economy.getLatestFinances(w, dead.id).savings, 0);
});

test('goods with nobody to take them leave the world', () => {
  // Sitting in a corpse's hands forever would make every
  // `valueOfHoldings` over a population quietly wrong.
  const w = world();
  const alone = person(w, { age: 90 });
  inventory.give(w, { entityId: alone.id, itemName: 'Saw', quantity: 3 });

  const death = mortality.recordDeath(w, { entityId: alone.id, cause: 'age' });
  assert.equal(death.estate.itemsLost, 3);
  assert.equal(w.inventory.length, 0);
});

// -- what is vacated rather than passed ---------------------------------

test('a job is vacated, not inherited', () => {
  // A post is a relationship with an employer rather than an asset.
  // Handing one down would invent a rule about hereditary employment
  // that no document describes.
  const w = world();
  const dead = person(w, { age: 60 });
  const heir = person(w, { age: 30 });
  family(w, [{ npc: dead, role: 'parent' }, { npc: heir, role: 'child' }]);
  w.organizations.push({ id: 90001, type: 'business', assets: 10000, expenses: 0, income: 0 });
  economy.hireEntity(w, { entityId: dead.id, employerOrganizationId: 90001, wage: 40 });

  const death = mortality.recordDeath(w, { entityId: dead.id, cause: 'age' });
  assert.equal(death.estate.employmentEnded, 1);
  assert.equal(economy.listEmployment(w, { status: 'active' }).length, 0);
  assert.equal(economy.listEmployment(w).length, 1, 'the record should survive as history');
  assert.equal(economy.getEmployment(w, heir.id), null, 'the heir inherited a job');
});

test('leadership is vacated and never quietly filled', () => {
  // Choosing a successor is a political act — `politics.js` has
  // elections, factions have morale and loyalty — and promoting the
  // longest-serving member here would put an invented rule where a
  // real mechanism belongs.
  const w = world();
  const leader = person(w, { age: 70 });
  const heir = person(w, { age: 40 });
  family(w, [{ npc: leader, role: 'parent' }, { npc: heir, role: 'child' }]);

  const org = { id: nextId++, type: 'business', leader_id: leader.id, assets: 0, expenses: 0 };
  w.organizations.push(org);
  const city = territory.generateCity(w, { name: 'Riverton', mayorNpcId: leader.id });
  const block = territory.generateCommunity(w, { cityId: city.id, leadershipNpcId: leader.id });

  const death = mortality.recordDeath(w, { entityId: leader.id, cause: 'age' });
  assert.equal(org.leader_id, null);
  assert.equal(city.mayor_npc_id, null);
  assert.equal(block.leadership_npc_id, null);
  assert.equal(death.estate.postsVacated.length, 3);
  assert.notEqual(org.leader_id, heir.id, 'a successor was quietly appointed');
});

// -- the line -----------------------------------------------------------

test('a family advances a generation when its head dies', () => {
  // **This is what makes `families.generation` mean something.** It
  // was 1 for every family in every world: only a birth could have
  // advanced it, and a birth sets the CHILD's generation, not the
  // family's.
  const w = world();
  const head = person(w, { age: 80 });
  const heir = person(w, { age: 50 });
  const line = family(w, [{ npc: head, role: 'parent' }, { npc: heir, role: 'child' }]);
  assert.equal(line.generation, 1);

  mortality.recordDeath(w, { entityId: head.id, cause: 'age' });
  assert.equal(line.head_npc_id, heir.id);
  assert.equal(line.generation, 2);
});

test('a family with nobody left has no head and does not advance', () => {
  const w = world();
  const head = person(w, { age: 90 });
  const line = family(w, [{ npc: head, role: 'parent' }]);

  const death = mortality.recordDeath(w, { entityId: head.id, cause: 'age' });
  assert.equal(line.head_npc_id, null);
  assert.equal(line.generation, 1, 'a family with no members advanced a generation');
  assert.ok(death.estate.postsVacated.some((p) => p.kind === 'family'));
});

// -- it runs from the one choke point -----------------------------------

test('every route to a death settles the estate', () => {
  // `runMortality`, `killEntity` and a scenario calling `recordDeath`
  // all go through the same function, which is why the cleanup lives
  // there rather than in the tick — a tick-level cleanup would catch
  // one of the three.
  const w = world();
  const victim = person(w, { age: 30, savings: 500 });
  const heir = person(w, { age: 28 });
  const killer = person(w, { age: 35 });
  family(w, [{ npc: victim, role: 'partner' }, { npc: heir, role: 'partner' }]);
  inventory.give(w, { entityId: victim.id, itemName: 'Diamond' });

  const death = mortality.killEntity(w, { entityId: victim.id, killerId: killer.id });
  assert.equal(death.estate.heirId, heir.id);
  assert.equal(inventory.quantityOf(w, heir.id, 'Diamond'), 1,
    'a killing did not settle the estate');
  assert.equal(economy.getLatestFinances(w, heir.id).savings, 500);
});
