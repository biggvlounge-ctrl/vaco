// Pervasive corruption across institutions + looting/B&E during
// collapse — by direct instruction. Read `server/corruption.js`'s own
// header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const corruption = require('../server/corruption.js');
const roguePolice = require('../server/roguePolice.js');
const authority = require('../server/authority.js');
const economy = require('../server/economy.js');
const salvage = require('../server/salvage.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 950000;

function world() {
  const w = {
    tick: 10,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    communities: [],
    cities: [],
    infrastructure: [],
    properties: [],
    entityTraits: [],
    individualFinances: [],
    employmentRecords: [],
    resources: [],
    marketListings: [],
    inventory: [],
    barterItems: [],
    crimeIncidents: [],
    courtCases: [],
    groupSanctions: [],
    historicalRecords: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
    relationships: [],
    beliefs: [],
    publicOpinion: [],
    governments: [],
    territoryBlocks: [],
  };
  economy.reseedIds(w);
  return w;
}

function person(w, overrides = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(id, w.tick, INDIVIDUAL_DEFINITIONS, () => 50);
  for (const row of rows) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (!def) continue;
    const key = `${def.family}.${def.name}`;
    if (key in overrides) row.current_value = overrides[key];
  }
  w.entityTraits.push(...rows);
  w.npcs.push({
    id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0,
    home_property_id: null, communityId: overrides.communityId ?? null,
  });
  economy.generateIndividualFinances(w, id, { savings: 100, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

function organization(w, { assets = 10000, leaderId = null } = {}) {
  const id = nextId++;
  const org = { id, name: `Org ${id}`, type: 'business', leader_id: leaderId, assets };
  w.organizations.push(org);
  return org;
}

// ---------------------------------------------------------------------
// runEmbezzlement
// ---------------------------------------------------------------------

test('a real, currently-employed high-Corruption-Risk employee can skim from their real employer\'s assets', () => {
  const w = world();
  const org = organization(w, { assets: 10000 });
  const corrupt = person(w, { 'leadership.Corruption Risk': 95 });
  w.employmentRecords.push({
    id: 1, entity_id: corrupt.id, employer_organization_id: org.id, wage: 10, position: 'clerk', status: 'active',
  });

  let sawEmbezzlement = false;
  for (let t = 0; t < 2000 && !sawEmbezzlement; t += 1) {
    const incidents = corruption.runEmbezzlement(w, t);
    if (incidents.length > 0) sawEmbezzlement = true;
  }
  assert.ok(sawEmbezzlement, 'a corrupt employee never once embezzled in 2000 ticks');
  assert.ok(Number(org.assets) < 10000, 'the organization\'s real assets must have actually dropped');
  const finances = economy.getLatestFinances(w, corrupt.id);
  assert.ok(Number(finances.savings) > 100, 'the embezzler\'s own real savings must have risen');
});

test('an ordinary (low Corruption Risk) employee never embezzles, however many ticks pass', () => {
  const w = world();
  const org = organization(w, { assets: 10000 });
  const honest = person(w, { 'leadership.Corruption Risk': 10 });
  w.employmentRecords.push({
    id: 1, entity_id: honest.id, employer_organization_id: org.id, wage: 10, position: 'clerk', status: 'active',
  });

  for (let t = 0; t < 2000; t += 1) {
    const incidents = corruption.runEmbezzlement(w, t);
    assert.equal(incidents.length, 0);
  }
  assert.equal(Number(org.assets), 10000);
});

test('an inactive (former) employment record is never a real embezzlement risk', () => {
  const w = world();
  const org = organization(w, { assets: 10000 });
  const former = person(w, { 'leadership.Corruption Risk': 99 });
  w.employmentRecords.push({
    id: 1, entity_id: former.id, employer_organization_id: org.id, wage: 10, position: 'clerk', status: 'ended',
  });

  for (let t = 0; t < 500; t += 1) {
    assert.equal(corruption.runEmbezzlement(w, t).length, 0);
  }
});

test('embezzlement is recorded as a real fraud incident naming the employee and the organization\'s leader', () => {
  const w = world();
  const leader = person(w);
  const org = organization(w, { assets: 10000, leaderId: leader.id });
  const corrupt = person(w, { 'leadership.Corruption Risk': 95 });
  w.employmentRecords.push({
    id: 1, entity_id: corrupt.id, employer_organization_id: org.id, wage: 10, position: 'clerk', status: 'active',
  });

  let incident = null;
  for (let t = 0; t < 2000 && !incident; t += 1) {
    const incidents = corruption.runEmbezzlement(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident);
  assert.equal(incident.category, 'fraud');
  assert.equal(incident.perpetrator_entity_id, corrupt.id);
  assert.equal(incident.victim_entity_id, leader.id);
});

test('a corrupt leader embezzling from their own organization is never recorded as their own victim', () => {
  // A real bug this round shipped once already: `justice.answerByGroup`
  // asserts `inventory.transfer`'s recipient is a different living
  // entity from its sender, and naming the perpetrator as their own
  // victim threw "an entity cannot transfer to itself" the first time
  // this engine ever actually tried to answer one of these incidents.
  const w = world();
  const corruptLeader = person(w, { 'leadership.Corruption Risk': 95 });
  const org = organization(w, { assets: 10000, leaderId: corruptLeader.id });
  w.employmentRecords.push({
    id: 1, entity_id: corruptLeader.id, employer_organization_id: org.id, wage: 10, position: 'owner', status: 'active',
  });

  let incident = null;
  for (let t = 0; t < 2000 && !incident; t += 1) {
    const incidents = corruption.runEmbezzlement(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident);
  assert.equal(incident.perpetrator_entity_id, corruptLeader.id);
  assert.equal(incident.victim_entity_id, null);
});

// ---------------------------------------------------------------------
// runCollapseLooting
// ---------------------------------------------------------------------

function lawlessCommunity(w) {
  const communityId = 600;
  w.cities.push({ id: 60 });
  w.communities.push({ id: communityId, city_id: 60 });
  // No real infrastructure, no real trust, no real approval, no real
  // faction grip -- `authority.writOf` returns `regime: null` (no
  // measured term at all) when every term is null, which is NOT the
  // same as lawless. A real lawless reading needs at least one real,
  // measured, LOW term -- a destroyed (condition 0) public_safety
  // station gives `reachTerm` a real, low, non-null value.
  w.infrastructure.push({
    id: 1, city_id: 60, type: 'public_safety', capacity: 1, condition: 0, maintenance_level: 0, age: 0,
  });
  return communityId;
}

function vacantProperty(w, communityId, condition = 100) {
  const id = nextId++;
  const property = {
    id, community_id: communityId, occupants: [], operating_organization_id: null, condition, value: 1000,
  };
  w.properties.push(property);
  return property;
}

test('a real lawless community with a real vacant property eventually produces a real break-in', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  const resident = person(w, { communityId });
  const target = vacantProperty(w, communityId);

  // `reachTerm` needs a real resident to divide capacity by -- checked
  // AFTER adding one, or it reads as "no measured term" (null) rather
  // than as a real, low, lawless one.
  const writ = authority.writOf(w, communityId);
  assert.equal(writ.regime, 'lawless', `test setup must produce a real lawless regime, got ${writ.regime}`);

  let incident = null;
  for (let t = 0; t < 3000 && !incident; t += 1) {
    const incidents = corruption.runCollapseLooting(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident, 'a real lawless area with a real vacant building never produced a break-in in 3000 ticks');
  assert.equal(incident.category, 'property');
  assert.equal(incident.perpetrator_entity_id, resident.id);
  assert.ok(Number(target.condition) < 100, 'the stripped property\'s real condition must have dropped');
});

test('a governed (not lawless) community never loots, however many ticks pass', () => {
  const w = world();
  const communityId = 601;
  w.cities.push({ id: 61 });
  w.communities.push({ id: communityId, city_id: 61 });
  w.infrastructure.push({
    id: 1, city_id: 61, type: 'public_safety', capacity: 100, condition: 100, maintenance_level: 100, age: 0,
  });
  w.governments.push({ organization_id: 70, system_type: 'council' });
  w.publicOpinion.push({ city_id: null, topic: 'government:70', approval_score: 85, tick: 1 });
  // A generous population and tick budget -- at `LOOT_RATE` per
  // resident per tick, this is comfortably enough real draws that a
  // broken (always-loot) gate would show itself reliably rather than
  // by chance.
  for (let i = 0; i < 10; i += 1) {
    const resident = person(w, { communityId });
    w.beliefs.push({
      id: resident.id, entity_id: resident.id, belief_name: 'trust in public safety',
      belief_type: 'political', strength: 90, tick: 0,
    });
  }
  const writ = authority.writOf(w, communityId);
  assert.equal(writ.regime, 'governed', `test setup must produce a real governed regime, got ${writ.regime}`);
  vacantProperty(w, communityId);

  for (let t = 0; t < 5000; t += 1) {
    assert.equal(corruption.runCollapseLooting(w, t).length, 0);
  }
});

test('an occupied home in a lawless area is never looted -- the same real refusal stripProperty already enforces', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  person(w, { communityId });
  const home = vacantProperty(w, communityId);
  home.occupants = [12345];

  for (let t = 0; t < 1500; t += 1) {
    assert.equal(corruption.runCollapseLooting(w, t).length, 0);
  }
});

test('eligiblePropertiesIn excludes operated businesses and already-stripped buildings', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  const operated = vacantProperty(w, communityId);
  operated.operating_organization_id = 999;
  const stripped = vacantProperty(w, communityId);
  stripped.condition = 0;
  const real = vacantProperty(w, communityId);

  const eligible = corruption.eligiblePropertiesIn(w, communityId);
  assert.deepEqual(eligible.map((p) => p.id), [real.id]);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: ignoring Corruption Risk entirely would make every employee a risk -- confirms the real gate', () => {
  const w = world();
  const org = organization(w, { assets: 10000 });
  const honest = person(w, { 'leadership.Corruption Risk': 1 });
  w.employmentRecords.push({
    id: 1, entity_id: honest.id, employer_organization_id: org.id, wage: 10, position: 'clerk', status: 'active',
  });
  // The real gate: this honest employee, at Corruption Risk 1, must
  // never qualify no matter how many ticks are tried.
  for (let t = 0; t < 1000; t += 1) {
    assert.equal(corruption.runEmbezzlement(w, t).length, 0);
  }
  assert.equal(
    roguePolice.corruptionRiskOf(w, honest.id) >= roguePolice.CORRUPTION_DEFECTION_THRESHOLD,
    false,
    'the real threshold check itself must be false for this fixture',
  );
});

test('mutation check: a real break-in genuinely reduces condition by salvage.STRIP_CONDITION_COST\'s own real amount', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  const looter = person(w, { communityId });
  const target = vacantProperty(w, communityId, 80);

  salvage.stripProperty(w, looter.id, target.id, { tick: 1 });
  assert.equal(target.condition, 70);
});
