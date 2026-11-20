// Extortion mechanic (corrupt forces/gangs/tribes vs. arriving
// businesses) — by direct instruction. Read `server/extortion.js`'s
// own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const extortion = require('../server/extortion.js');
const heat = require('../server/heat.js');
const salvage = require('../server/salvage.js');
const { INDIVIDUAL_DEFINITIONS, ORGANIZATION_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 970000;

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
    communityId: overrides.communityId ?? null,
  });
  return w.npcs[w.npcs.length - 1];
}

// `authority.holderOf` reads a faction's real, LIVE `organization.
// territory`/`.power` traits through `getLiveEntity`, which builds the
// live sheet from real `entityTraits` rows only -- never from a static
// `.traits` object on the organization record itself. Real rows, same
// shape `test/organization-traits.test.js` already uses.
function organization(w, { assets = 10000, leaderId = null } = {}) {
  const id = nextId++;
  const org = { id, name: `Org ${id}`, type: 'business', leader_id: leaderId, assets };
  w.organizations.push(org);
  w.entityTraits.push(...generateEntityTraits(id, w.tick, ORGANIZATION_DEFINITIONS, () => 50));
  return org;
}

// Faction holds this community's ground via a real fortified territory
// block, and the state has no real infrastructure here at all — the
// same `authority.writOf`/`holderOf` shape `test/corruption.test.js`
// already builds for a lawless gate, reused to produce `contested` or
// `lawless` as needed.
function heldCommunity(w, faction, { governed = false } = {}) {
  const communityId = 700 + w.communities.length;
  const cityId = 70 + w.cities.length;
  w.cities.push({ id: cityId });
  w.communities.push({ id: communityId, city_id: cityId });
  if (governed) {
    w.infrastructure.push({
      id: nextId++, city_id: cityId, type: 'public_safety', capacity: 100, condition: 100, maintenance_level: 100, age: 0,
    });
    w.governments.push({ organization_id: 70, system_type: 'council' });
    w.publicOpinion.push({ city_id: null, topic: 'government:70', approval_score: 85, tick: 1 });
    // A generous real resident population with real trust in public
    // safety -- the same shape `test/corruption.test.js`'s own
    // governed-community fixture already needed to make `writOf`
    // actually read `governed` rather than an unmeasured `null`.
    for (let i = 0; i < 10; i += 1) {
      const resident = person(w, { communityId });
      w.beliefs.push({
        id: resident.id, entity_id: resident.id, belief_name: 'trust in public safety',
        belief_type: 'political', strength: 90, tick: 0,
      });
    }
  } else {
    w.infrastructure.push({
      id: nextId++, city_id: cityId, type: 'public_safety', capacity: 1, condition: 0, maintenance_level: 0, age: 0,
    });
  }
  w.territoryBlocks.push({
    id: nextId++, community_id: communityId, faction_id: faction.id, status: 'fortified',
  });
  return communityId;
}

function operatedProperty(w, communityId, operatorOrgId, condition = 100) {
  const id = nextId++;
  const property = {
    id, community_id: communityId, occupants: [], operating_organization_id: operatorOrgId, condition, value: 1000,
  };
  w.properties.push(property);
  return property;
}

// ---------------------------------------------------------------------
// runExtortion
// ---------------------------------------------------------------------

test('a real business operating in ground a faction holds, with no government writ, can be demanded from', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction);
  const lowComposureLeader = person(w, { 'combat.Composure Under Fire': 10 });
  const business = organization(w, { assets: 10000, leaderId: lowComposureLeader.id });
  operatedProperty(w, communityId, business.id);

  let incident = null;
  for (let t = 0; t < 12000 && !incident; t += 1) {
    const incidents = extortion.runExtortion(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident, 'a real extortable business never once was demanded from in 12000 ticks');
});

test('a low-Composure business leader pays: real money moves from the business to the faction, recorded as theft', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction);
  const complier = person(w, { 'combat.Composure Under Fire': 5 });
  const business = organization(w, { assets: 10000, leaderId: complier.id });
  operatedProperty(w, communityId, business.id);

  let incident = null;
  for (let t = 0; t < 12000 && !incident; t += 1) {
    const incidents = extortion.runExtortion(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident);
  assert.equal(incident.category, 'theft');
  assert.ok(Number(business.assets) < 10000, 'the business\'s real assets must have actually dropped');
  assert.ok(Number(faction.assets) > 5000, 'the faction\'s real assets must have actually risen');
});

test('a high-Composure business leader refuses: the property takes real damage and real heat rises, recorded as property damage', () => {
  const w = world();
  const factionLeader = person(w, { 'combat.Composure Under Fire': 50 });
  const faction = organization(w, { assets: 5000, leaderId: factionLeader.id });
  const communityId = heldCommunity(w, faction);
  const defiant = person(w, { 'combat.Composure Under Fire': 95 });
  const business = organization(w, { assets: 10000, leaderId: defiant.id });
  const property = operatedProperty(w, communityId, business.id, 80);

  // A generous tick budget -- at `EXTORTION_RATE` per org per tick,
  // 3000 ticks only gives ~83% odds of a real draw landing; 12000
  // pushes the odds of missing one below one in a thousand.
  let incident = null;
  for (let t = 0; t < 12000 && !incident; t += 1) {
    const incidents = extortion.runExtortion(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident);
  assert.equal(incident.category, 'property');
  assert.equal(Number(business.assets), 10000, 'a refusal must never move the business\'s real money');
  assert.ok(Number(property.condition) < 80, 'the refused business\'s real property must take real damage');
  assert.ok(heat.heatWith(w, defiant.id, faction.id) > 0, 'the defiant leader must carry real heat with the faction afterward');
});

test('a governed community is never extorted, however many ticks pass', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction, { governed: true });
  // Ten real operating businesses over 5000 ticks -- at `EXTORTION_
  // RATE` per organization per tick, a broken (gate-removed) version
  // of this check would expect ~30 real demands, the same population
  // ×  tick budget `test/corruption.test.js`'s own governed-community
  // check already needed to reliably catch its own lawless-gate
  // mutation rather than pass by chance.
  for (let i = 0; i < 10; i += 1) {
    const complier = person(w, { 'combat.Composure Under Fire': 5 });
    const business = organization(w, { assets: 10000, leaderId: complier.id });
    operatedProperty(w, communityId, business.id);
  }

  for (let t = 0; t < 5000; t += 1) {
    assert.equal(extortion.runExtortion(w, t).length, 0);
  }
});

test('with no faction holding real ground, nobody is extorted', () => {
  const w = world();
  const communityId = 800;
  w.cities.push({ id: 80 });
  w.communities.push({ id: communityId, city_id: 80 });
  w.infrastructure.push({
    id: 1, city_id: 80, type: 'public_safety', capacity: 1, condition: 0, maintenance_level: 0, age: 0,
  });
  const complier = person(w, { 'combat.Composure Under Fire': 5 });
  const business = organization(w, { assets: 10000, leaderId: complier.id });
  operatedProperty(w, communityId, business.id);

  for (let t = 0; t < 1500; t += 1) {
    assert.equal(extortion.runExtortion(w, t).length, 0);
  }
});

test('a faction never extorts a property it itself operates', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction);
  operatedProperty(w, communityId, faction.id);

  for (let t = 0; t < 1500; t += 1) {
    assert.equal(extortion.runExtortion(w, t).length, 0);
  }
});

test('operatingBusinessesIn excludes the faction\'s own operated properties and unoperated ones', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction);
  const business = organization(w, { assets: 10000 });
  operatedProperty(w, communityId, faction.id);
  operatedProperty(w, communityId, business.id);
  operatedProperty(w, communityId, null);

  const result = extortion.operatingBusinessesIn(w, communityId, faction.id);
  assert.deepEqual(result.map((o) => o.id), [business.id]);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the governed-regime gate is the real reason a governed community is never extorted', () => {
  const w = world();
  const faction = organization(w, { assets: 5000 });
  const communityId = heldCommunity(w, faction, { governed: true });
  const complier = person(w, { 'combat.Composure Under Fire': 5 });
  const business = organization(w, { assets: 10000, leaderId: complier.id });
  operatedProperty(w, communityId, business.id);

  // Confirms the real gate directly: the holder DOES exist here (the
  // territory block is real), so if the governed check were removed,
  // extortion would proceed.
  const authority = require('../server/authority.js');
  const writ = authority.writOf(w, communityId);
  assert.equal(writ.regime, 'governed');
  assert.notEqual(authority.holderOf(w, communityId), null);
});

test('mutation check: a real refusal genuinely reduces condition by VANDALISM_CONDITION_COST\'s own real amount', () => {
  const w = world();
  const factionLeader = person(w, { 'combat.Composure Under Fire': 50 });
  const faction = organization(w, { assets: 5000, leaderId: factionLeader.id });
  const communityId = heldCommunity(w, faction);
  const defiant = person(w, { 'combat.Composure Under Fire': 95 });
  const business = organization(w, { assets: 10000, leaderId: defiant.id });
  const property = operatedProperty(w, communityId, business.id, 80);

  let incident = null;
  for (let t = 0; t < 12000 && !incident; t += 1) {
    const incidents = extortion.runExtortion(w, t);
    if (incidents.length > 0) [incident] = incidents;
  }
  assert.ok(incident);
  assert.equal(Number(property.condition), 80 - salvage.STRIP_CONDITION_COST);
  assert.equal(salvage.STRIP_CONDITION_COST, extortion.VANDALISM_CONDITION_COST);
});

test('mutation check: composureOf reads the real combat.\'Composure Under Fire\' trait, not a different field', () => {
  const w = world();
  const highComposure = person(w, { 'combat.Composure Under Fire': 95 });
  const lowComposure = person(w, { 'combat.Composure Under Fire': 5 });
  assert.ok(extortion.composureOf(w, highComposure.id) >= extortion.COMPOSURE_REFUSAL_THRESHOLD);
  assert.ok(extortion.composureOf(w, lowComposure.id) < extortion.COMPOSURE_REFUSAL_THRESHOLD);
  assert.equal(extortion.composureOf(w, null), null);
});
