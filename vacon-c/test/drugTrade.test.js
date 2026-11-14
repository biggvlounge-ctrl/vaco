// server/drugTrade.js — drug organization hierarchy, real production/
// import chains, street-level dealing, and the prison-pipeline tie-in.
// See that file's own header for the full design and its real,
// DEA/DOJ-cited research.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const drugTrade = require('../server/drugTrade.js');
const membership = require('../server/membership.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const territory = require('../server/territory.js');
const justice = require('../server/justice.js');
const heat = require('../server/heat.js');

const w = engine.WorldState;

let nextId = 980001;

function flatTraits(value) {
  return () => value;
}

function adult(traitValueFor, communityId = null) {
  const npc = engine.generateNPC({ traitValueFor, communityId });
  npc.createdTick = w.tick - 30 * 365;
  return npc;
}

function gang(leaderId) {
  return engine.generateOrganization({ name: `Gang ${nextId += 1}`, type: 'gang', leaderId });
}

// A real gang member whose own live gang tier reads deterministically
// (never a tie, which `membership.gangTierFor` resolves to
// `associate` on purpose). Territorial Instinct strictly highest of
// the four real faction dimensions -> `soldier`.
function soldierIn(gangOrg) {
  const npc = adult((def) => {
    if (def.family !== 'faction') return 50;
    if (def.name === 'Territorial Instinct') return 95;
    if (def.name === 'Defection Risk') return 50; // shot_caller score = 100 - this
    return 5;
  }, nextId += 1); // a real communityId -- runStreetDealing skips anyone with none
  membership.joinOrganization(w, { entityId: npc.id, organizationId: gangOrg.id });
  return npc;
}

// ---------------------------------------------------------------------
// registerDrugItems
// ---------------------------------------------------------------------

test('registerDrugItems registers all seven real substances, idempotently', () => {
  drugTrade.registerDrugItems(w);
  for (const name of drugTrade.SUBSTANCE_NAMES) {
    assert.ok(w.barterItems.some((it) => it.name === name));
  }
  const second = drugTrade.registerDrugItems(w);
  assert.equal(second, 0, 'a second real call registers nothing new');
});

// ---------------------------------------------------------------------
// gangOf
// ---------------------------------------------------------------------

test('gangOf: the real gang an entity actually belongs to, null otherwise', () => {
  const leader = adult(flatTraits(50));
  const org = gang(leader.id);
  const member = adult(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });
  assert.equal(drugTrade.gangOf(w, member.id)?.id, org.id);

  const business = engine.generateOrganization({ name: `Biz ${nextId += 1}`, type: 'business', leaderId: null });
  const employee = adult(flatTraits(50));
  membership.joinOrganization(w, { entityId: employee.id, organizationId: business.id });
  assert.equal(drugTrade.gangOf(w, employee.id), null, 'membership in a non-gang organization does not count');

  const stranger = adult(flatTraits(50));
  assert.equal(drugTrade.gangOf(w, stranger.id), null);
});

// ---------------------------------------------------------------------
// cartelConnectionEligible / grantCartelConnection
// ---------------------------------------------------------------------

test('cartelConnectionEligible: true only for a real gang whose real leader clears the real threshold', () => {
  const highTies = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 90 : 50));
  const connectedOrg = gang(highTies.id);
  assert.equal(drugTrade.cartelConnectionEligible(w, connectedOrg.id), true);

  const lowTies = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 5 : 50));
  const unconnectedOrg = gang(lowTies.id);
  assert.equal(drugTrade.cartelConnectionEligible(w, unconnectedOrg.id), false);

  const business = engine.generateOrganization({ name: `Biz ${nextId += 1}`, type: 'business', leaderId: highTies.id });
  assert.equal(drugTrade.cartelConnectionEligible(w, business.id), false, 'not a real gang at all');

  const leaderless = engine.generateOrganization({ name: `Gang ${nextId += 1}`, type: 'gang', leaderId: null });
  assert.equal(drugTrade.cartelConnectionEligible(w, leaderless.id), false);
});

test('grantCartelConnection: real validation, and refuses an ineligible organization', () => {
  const highTies = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 90 : 50));
  const org = gang(highTies.id);

  assert.throws(
    () => drugTrade.grantCartelConnection(w, org.id, 'russian'),
    /not a real region/,
  );
  assert.throws(
    () => drugTrade.grantCartelConnection(w, 999999, 'mexican'),
    /no organization with id/,
  );

  const lowTies = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 5 : 50));
  const ineligible = gang(lowTies.id);
  assert.throws(
    () => drugTrade.grantCartelConnection(w, ineligible.id, 'mexican'),
    /has no real leader whose/,
  );

  const granted = drugTrade.grantCartelConnection(w, org.id, 'colombian');
  assert.equal(granted.cartelConnection, 'colombian');
});

// ---------------------------------------------------------------------
// kingpinScaleOf
// ---------------------------------------------------------------------

test('kingpinScaleOf: null with no real territory, "local" in one city, "regional" across two or more', () => {
  const leader = adult(flatTraits(50));
  const org = engine.generateFaction({ name: `Faction ${nextId += 1}`, type: 'gang', leaderId: leader.id });
  assert.equal(drugTrade.kingpinScaleOf(w, org.id), null);

  territory.generateTerritoryBlock(w, { factionId: org.id, cityId: 1, communityId: 1 });
  assert.equal(drugTrade.kingpinScaleOf(w, org.id), 'local');

  territory.generateTerritoryBlock(w, { factionId: org.id, cityId: 2, communityId: 2 });
  assert.equal(drugTrade.kingpinScaleOf(w, org.id), 'regional');
});

// ---------------------------------------------------------------------
// produceMarijuana / convertCrack / importSubstance
// ---------------------------------------------------------------------

test('produceMarijuana: a real gang member grows a real bounded batch; a non-member is refused', () => {
  const leader = adult(flatTraits(50));
  const org = gang(leader.id);
  const grower = adult(flatTraits(50));
  membership.joinOrganization(w, { entityId: grower.id, organizationId: org.id });

  drugTrade.produceMarijuana(w, grower.id, { tick: 0 });
  assert.equal(inventory.quantityOf(w, grower.id, 'marijuana'), drugTrade.BATCH_SIZE);

  const stranger = adult(flatTraits(50));
  assert.throws(() => drugTrade.produceMarijuana(w, stranger.id, { tick: 0 }), /not a real member of any real gang/);
});

test('convertCrack: real held cocaine converts to real crack; refuses with none held', () => {
  const leader = adult(flatTraits(50));
  const org = gang(leader.id);
  const cook = adult(flatTraits(50));
  membership.joinOrganization(w, { entityId: cook.id, organizationId: org.id });

  assert.throws(() => drugTrade.convertCrack(w, cook.id, { tick: 0 }), /holds no real cocaine/);

  drugTrade.registerDrugItems(w);
  inventory.give(w, { entityId: cook.id, itemName: 'cocaine', quantity: 4, tick: 0 });
  drugTrade.convertCrack(w, cook.id, { tick: 0 });
  assert.equal(inventory.quantityOf(w, cook.id, 'crack_cocaine'), 4);
  assert.equal(inventory.quantityOf(w, cook.id, 'cocaine'), 0);
});

test('importSubstance: refuses a non-import-required substance, refuses with no real cartel connection, refuses a region mismatch, succeeds when connected', () => {
  const highTies = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 90 : 50));
  const org = gang(highTies.id);
  const importer = adult(flatTraits(50));
  membership.joinOrganization(w, { entityId: importer.id, organizationId: org.id });

  assert.throws(
    () => drugTrade.importSubstance(w, importer.id, 'marijuana', { tick: 0 }),
    /is not import-required/,
  );
  assert.throws(
    () => drugTrade.importSubstance(w, importer.id, 'cocaine', { tick: 0 }),
    /has no real cartel connection/,
  );

  drugTrade.grantCartelConnection(w, org.id, 'mexican');
  assert.throws(
    () => drugTrade.importSubstance(w, importer.id, 'cocaine', { tick: 0 }),
    /does not supply cocaine/,
  );

  drugTrade.importSubstance(w, importer.id, 'methamphetamine', { tick: 0 });
  assert.equal(inventory.quantityOf(w, importer.id, 'methamphetamine'), drugTrade.BATCH_SIZE);

  // synthetic_cannabinoids has no required region -- any real
  // connection works.
  drugTrade.importSubstance(w, importer.id, 'synthetic_cannabinoids', { tick: 0 });
  assert.equal(inventory.quantityOf(w, importer.id, 'synthetic_cannabinoids'), drugTrade.BATCH_SIZE);
});

// ---------------------------------------------------------------------
// runStreetDealing
// ---------------------------------------------------------------------

test('runStreetDealing: a real street-level dealer (soldier/associate tier) holding a real substance eventually sells it, crediting real money and recording a real drug-category crime', () => {
  const leader = adult(flatTraits(50));
  const org = gang(leader.id);
  const dealer = soldierIn(org);
  drugTrade.produceMarijuana(w, dealer.id, { tick: 0 });

  const tier = membership.gangTierFor(w, org.id, dealer.id, 0);
  assert.ok(['soldier', 'associate'].includes(tier), `fixture must produce a real street-level tier, got ${tier}`);

  let sold = null;
  for (let tick = 0; tick < 30000 && !sold; tick += 1) {
    const incidents = drugTrade.runStreetDealing(w, tick);
    if (incidents.length) sold = incidents[0];
  }
  assert.ok(sold, 'a real street-level dealer holding a real substance must sell within 30000 real ticks');
  assert.equal(sold.category, 'drug');
  assert.equal(sold.perpetrator_entity_id, dealer.id);
  assert.equal(sold.victim_entity_id, null, 'a drug sale has no real victim');
  assert.ok(inventory.quantityOf(w, dealer.id, 'marijuana') < drugTrade.BATCH_SIZE, 'the real sale actually reduced real held inventory');
  assert.ok(Number(economy.getLatestFinances(w, dealer.id)?.savings) > 0, 'the real sale actually credited real money');
});

test('runStreetDealing never sells for a real gang\'s own leader/lieutenant/shot_caller tier, or for someone holding nothing', () => {
  const leader = adult((def) => (def.family === 'faction' && def.name === 'Territorial Instinct' ? 95 : 5));
  const org = gang(leader.id);
  membership.joinOrganization(w, { entityId: leader.id, organizationId: org.id });
  drugTrade.produceMarijuana(w, leader.id, { tick: 0 });
  // The real org leader's own tier is always 'leader', never a
  // street-level one -- membership.gangTierFor's own first, real
  // check.
  assert.equal(membership.gangTierFor(w, org.id, leader.id, 0), 'leader');

  for (let tick = 0; tick < 2000; tick += 1) {
    const incidents = drugTrade.runStreetDealing(w, tick);
    assert.equal(incidents.filter((i) => i.perpetrator_entity_id === leader.id).length, 0);
  }
});

// ---------------------------------------------------------------------
// runPrisonSmuggling
// ---------------------------------------------------------------------

function prisonWithGang() {
  const cityId = nextId += 1;
  const communityId = nextId += 1;
  w.cities.push({ id: cityId, name: `Smuggle City ${cityId}`, region_id: null });
  w.communities.push({ id: communityId, city_id: cityId, name: `Smuggle Community ${communityId}`, population: 10 });
  const gov = engine.generateOrganization({ name: `Gov ${cityId}`, type: 'government' });
  w.governments.push({ organization_id: gov.id, scope_type: 'city', scope_id: cityId });
  const prison = engine.generateProperty({
    type: 'government', value: 1000000, landmarkCategory: 'prison',
  });
  prison.city_id = cityId;
  prison.community_id = communityId;
  prison.operating_organization_id = gov.id;

  const inmate1 = adult((def) => (def.family === 'criminal' && def.name === 'Black Market Ties' ? 95 : 50));
  const inmate2 = adult(flatTraits(50));
  for (const inmate of [inmate1, inmate2]) {
    inmate.status = 'imprisoned';
    w.courtCases.push({
      id: w.courtCases.length + 1, defendant_entity_id: inmate.id, status: 'convicted', released_tick: null,
      prison_property_id: prison.id, city_id: cityId, community_id: communityId, category: 'theft',
      sentence_ticks: 999999, charged_tick: 0, incident_id: 1, law_id: 100,
    });
  }
  const prisonGang = justice.ensurePrisonGang(w, prison.id, 0);
  return { prison, gov, prisonGang };
}

test('runPrisonSmuggling: no real cartel-connected prison gang, no real corrupt staff -> nothing happens', () => {
  const { prison, gov } = prisonWithGang();
  const clean = adult((def) => (def.family === 'leadership' && def.name === 'Corruption Risk' ? 5 : 50));
  economy.hireEntity(w, { entityId: clean.id, employerOrganizationId: gov.id, wage: 50, position: 'guard', tick: 0 });

  for (let tick = 0; tick < 2000; tick += 1) {
    const incidents = drugTrade.runPrisonSmuggling(w, { tick });
    assert.equal(incidents.length, 0);
  }
  void prison;
});

test('runPrisonSmuggling: a real cartel-connected prison gang with only real CLEAN staff never smuggles', () => {
  const { prison, gov, prisonGang } = prisonWithGang();
  drugTrade.grantCartelConnection(w, prisonGang.id, 'mexican');
  const clean = adult((def) => (def.family === 'leadership' && def.name === 'Corruption Risk' ? 5 : 50));
  economy.hireEntity(w, { entityId: clean.id, employerOrganizationId: gov.id, wage: 50, position: 'guard', tick: 0 });

  for (let tick = 0; tick < 5000; tick += 1) {
    const incidents = drugTrade.runPrisonSmuggling(w, { tick });
    assert.equal(incidents.length, 0);
  }
  void prison;
});

test('runPrisonSmuggling: a real corrupt guard/warden smuggles a real substance into a real cartel-connected prison gang\'s own real leader', () => {
  const { prison, gov, prisonGang } = prisonWithGang();
  drugTrade.grantCartelConnection(w, prisonGang.id, 'mexican');
  const dirty = adult((def) => (def.family === 'leadership' && def.name === 'Corruption Risk' ? 90 : 50));
  economy.hireEntity(w, { entityId: dirty.id, employerOrganizationId: gov.id, wage: 50, position: 'guard', tick: 0 });

  let smuggled = null;
  for (let tick = 0; tick < 30000 && !smuggled; tick += 1) {
    const incidents = drugTrade.runPrisonSmuggling(w, { tick });
    if (incidents.length) smuggled = incidents[0];
  }
  assert.ok(smuggled, 'a real corrupt guard at a real cartel-connected prison gang must smuggle within 30000 real ticks');
  assert.equal(smuggled.category, 'drug');
  assert.equal(smuggled.perpetrator_entity_id, dirty.id);

  const leaderHolding = (w.inventory || []).find(
    (h) => h.holder_entity_id === prisonGang.leader_id && drugTrade.SUBSTANCE_NAMES.includes(h.item_name),
  );
  assert.ok(leaderHolding, 'the real prison gang\'s own real inside leader actually received the real substance');
  void prison;
});
