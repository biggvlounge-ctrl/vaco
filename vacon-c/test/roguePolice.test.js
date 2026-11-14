// server/roguePolice.js — rogue ex-state security forces.
//
// Fixtures build directly on `engine.WorldState` through the real
// generators (`generateNPC`/`generateOrganization`/`generateFaction`),
// the same pattern `test/org-archetypes.test.js` already establishes
// for this exact module relationship, rather than hand-rolling
// `entity_traits` rows (whose real shape is keyed on `trait_id`, not
// name/family strings — a pitfall worth avoiding rather than repeating).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const roguePolice = require('../server/roguePolice.js');
const authority = require('../server/authority.js');
const economy = require('../server/economy.js');
const membership = require('../server/membership.js');
const territory = require('../server/territory.js');

const w = engine.WorldState;

const GENERATORS = {
  generateOrganization: engine.generateOrganization,
  generateFaction: engine.generateFaction,
};

let nextCityId = 9001;
let nextCommunityId = 9001;

// A city+community pair, a real government covering it, and a strong
// rival faction already holding real territory there — the real
// combination `authority.writOf` reads as `lawless` (grip alone,
// measured, low), matching the same honest-measurement discipline
// every other fixture in this engine's own test suite holds rather
// than asserting a regime directly.
function lawlessCommunity(options = {}) {
  const { government = null } = options;
  const cityId = nextCityId += 1;
  const communityId = nextCommunityId += 1;
  w.cities.push({ id: cityId, name: `City ${cityId}`, region_id: null });
  w.communities.push({ id: communityId, city_id: cityId, name: `Community ${communityId}`, population: 10 });

  // City-scoped, not civilization-scoped: `mainCharacters.governmentCovering`
  // disambiguates by real `scope_id`, and a test file that keeps minting
  // fresh "civilization-wide" governments (one real civ-wide government
  // per world, not one per fixture) would have every later fixture's
  // officer checked against the FIRST civ government ever pushed rather
  // than its own -- a fixture-realism bug, not a production one.
  const gov = government || engine.generateOrganization({ name: `Government ${cityId}`, type: 'government' });
  w.governments.push({ organization_id: gov.id, scope_type: 'city', scope_id: cityId });

  const rival = engine.generateFaction({
    name: `Rival ${communityId}`,
    type: 'gang',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 95 : 50
    ),
  });
  const block = territory.generateTerritoryBlock(w, { factionId: rival.id, cityId, communityId });
  block.status = 'fortified';

  const reading = authority.writOf(w, communityId);
  assert.equal(reading.regime, 'lawless', 'fixture construction itself must read lawless');

  return { cityId, communityId, government: gov, rival };
}

function officerIn(communityId, government, options = {}) {
  const { corruptionRisk = 50, wage = 50 } = options;
  const officer = engine.generateNPC({
    communityId,
    traitValueFor: (def) => (
      def.family === 'leadership' && def.name === 'Corruption Risk' ? corruptionRisk : 50
    ),
  });
  economy.hireEntity(w, {
    entityId: officer.id, employerOrganizationId: government.id, wage, position: 'officer', tick: w.tick ?? 0,
  });
  return officer;
}

test('corruptionRiskOf reads the real live leadership.\'Corruption Risk\' trait', () => {
  const officer = engine.generateNPC({
    traitValueFor: (def) => (def.family === 'leadership' && def.name === 'Corruption Risk' ? 77 : 50),
  });
  assert.equal(roguePolice.corruptionRiskOf(w, officer.id), 77);
});

test('localOfficersOf: only active officers of THIS government, stationed in THIS community', () => {
  const { communityId, government } = lawlessCommunity();
  const here = officerIn(communityId, government);

  // A real officer of the SAME government, but a DIFFERENT community —
  // must not count, the same granularity this file's own header says
  // ("a government loses its security apparatus one town at a time").
  const otherCity = lawlessCommunity();
  officerIn(otherCity.communityId, government);

  // A real officer in THIS community, but employed by a different
  // (unrelated) organization — must not count either.
  const otherOrg = engine.generateOrganization({ name: 'Unrelated Co', type: 'business' });
  const unrelated = engine.generateNPC({ communityId });
  economy.hireEntity(w, { entityId: unrelated.id, employerOrganizationId: otherOrg.id, wage: 30, position: 'manager', tick: 0 });

  const found = roguePolice.localOfficersOf(w, communityId, government.id);
  assert.deepEqual(found.map((n) => n.id), [here.id]);
});

test('corruptOfficersOf filters by the real measured threshold', () => {
  const { communityId, government } = lawlessCommunity();
  const clean = officerIn(communityId, government, { corruptionRisk: 10 });
  const corrupt = officerIn(communityId, government, { corruptionRisk: 90 });

  const found = roguePolice.corruptOfficersOf(w, communityId, government.id);
  const ids = found.map((n) => n.id);
  assert.ok(ids.includes(corrupt.id));
  assert.ok(!ids.includes(clean.id));
});

test('formRogueForces: an honest null at every real precondition that is not met', () => {
  // No such community.
  assert.equal(
    roguePolice.formRogueForces(w, { communityId: -1, ...GENERATORS }),
    null,
  );

  // A real community that is governed, not lawless -- no rival faction
  // holding it, so its writ reads unmeasured/governed rather than
  // collapsed.
  const cityId = nextCityId += 1;
  const communityId = nextCommunityId += 1;
  w.cities.push({ id: cityId, name: `City ${cityId}`, region_id: null });
  w.communities.push({ id: communityId, city_id: cityId, name: `Community ${communityId}`, population: 10 });
  const gov = engine.generateOrganization({ name: `Gov ${cityId}`, type: 'government' });
  w.governments.push({ organization_id: gov.id, scope_type: 'civilization', scope_id: null });
  officerIn(communityId, gov, { corruptionRisk: 95 });
  assert.notEqual(authority.writOf(w, communityId).regime, 'lawless');
  assert.equal(
    roguePolice.formRogueForces(w, { communityId, ...GENERATORS }),
    null,
    'a governed community has nothing to disassemble',
  );

  // Lawless, real government, but no officer here at all.
  const empty = lawlessCommunity();
  assert.equal(
    roguePolice.formRogueForces(w, { communityId: empty.communityId, ...GENERATORS }),
    null,
    'a lawless town with no officer stationed in it has nobody to defect',
  );

  // Lawless, real government, real officer -- but clean.
  const cleanTown = lawlessCommunity();
  officerIn(cleanTown.communityId, cleanTown.government, { corruptionRisk: 5 });
  assert.equal(
    roguePolice.formRogueForces(w, { communityId: cleanTown.communityId, ...GENERATORS }),
    null,
    'an honestly clean officer corps defects nowhere',
  );
});

test('formRogueForces: a real defection, correctly wired end to end', () => {
  const { communityId, cityId, government } = lawlessCommunity();
  const rankAndFile = officerIn(communityId, government, { corruptionRisk: 90 });

  const result = roguePolice.formRogueForces(w, { communityId, tick: 0, ...GENERATORS });
  assert.ok(result, 'a lawless town with one corrupt officer must form a real force');

  const org = (w.organizations || []).find((o) => o.id === result.organizationId);
  assert.equal(org.type, 'gang');
  assert.equal(org.isFaction, true);
  assert.equal(org.archetype, 'rogue security force');
  assert.equal(org.leader_id, rankAndFile.id);

  // The old employment really ended; a new one really started at the
  // new organization, same position.
  assert.equal(economy.getEmployment(w, rankAndFile.id).employer_organization_id, org.id);
  assert.equal(economy.getEmployment(w, rankAndFile.id).position, 'officer');
  const oldRecord = (w.employmentRecords || []).find(
    (r) => r.entity_id === rankAndFile.id && r.employer_organization_id === government.id,
  );
  assert.equal(oldRecord.status, 'ended');

  // Membership moved, not merely added.
  assert.equal(membership.findMembership(w, rankAndFile.id, government.id), null);
  assert.ok(membership.findMembership(w, rankAndFile.id, org.id));

  // Armed: an ordinary sidearm, equipped, with real ammunition.
  const holdings = (w.inventory || []).filter((h) => h.holder_entity_id === rankAndFile.id);
  const pistol = holdings.find((h) => h.item_name === 'pistol');
  const rounds = holdings.find((h) => h.item_name === 'pistol_rounds');
  assert.ok(pistol && pistol.equipped);
  assert.ok(rounds && rounds.quantity > 0);

  // Tried to use the force: a real territory block, resolved this
  // same tick from the faction's own live traits.
  const block = (w.territoryBlocks || []).find((b) => b.id === result.territoryBlockId);
  assert.equal(block.faction_id, org.id);
  assert.equal(block.community_id, communityId);
  assert.ok(['contested', 'controlled', 'fortified'].includes(block.status));
});

test('formRogueForces: the leader is the real highest influenceRatingOf defector, not simply the most corrupt one', () => {
  const { communityId, government } = lawlessCommunity();
  // Both corrupt enough to defect; give the SECOND one a real
  // occupation-tier/social-trait edge so `influenceRatingOf` prefers
  // them over the more corrupt one -- proving leadership is a
  // different question than who defected.
  // Every trait pinned, not merely Corruption Risk -- the default
  // random draw could otherwise hand the "low influence" officer a
  // high social-trait roll purely by chance and make this assertion
  // flaky for a reason that has nothing to do with the real rule
  // being tested.
  const moreCorruptLowInfluence = engine.generateNPC({
    communityId,
    traitValueFor: (def) => (
      def.family === 'leadership' && def.name === 'Corruption Risk' ? 95 : 50
    ),
  });
  economy.hireEntity(w, {
    entityId: moreCorruptLowInfluence.id, employerOrganizationId: government.id,
    wage: 50, position: 'officer', tick: 0,
  });
  const lessCorruptHighInfluence = engine.generateNPC({
    communityId,
    traitValueFor: (def) => {
      if (def.family === 'leadership' && def.name === 'Corruption Risk') return 55;
      if (def.family === 'social' && ['Charisma', 'Persuasion', 'Reputation', 'Network Reach'].includes(def.name)) return 99;
      return 50;
    },
  });
  economy.hireEntity(w, {
    entityId: lessCorruptHighInfluence.id, employerOrganizationId: government.id,
    wage: 50, position: 'officer', tick: 0,
  });

  const result = roguePolice.formRogueForces(w, { communityId, tick: 0, ...GENERATORS });
  assert.equal(result.leaderId, lessCorruptHighInfluence.id);
  assert.notEqual(result.leaderId, moreCorruptLowInfluence.id);
});

test('formRogueForces: the leader gets the real upgraded weapon only where the real regional gate is open', () => {
  const { communityId, cityId, government } = lawlessCommunity();
  const officer = officerIn(communityId, government, { corruptionRisk: 90 });

  w.properties.push({
    id: w.properties.length + 10000, city_id: cityId, landmark_category: 'government-building',
  });
  w.cities.find((c) => c.id === cityId).region_id = 70000 + cityId;
  w.regions.push({ id: 70000 + cityId, country_key: 'russian' });

  const result = roguePolice.formRogueForces(w, { communityId, tick: 0, ...GENERATORS });
  assert.equal(result.armedWithRifle, true);
  const rifle = (w.inventory || []).find(
    (h) => h.holder_entity_id === officer.id && h.item_name === 'rifle',
  );
  assert.ok(rifle && rifle.equipped);
});

test('formRogueForces is idempotent: a second call on the same, now-defected community forms nothing', () => {
  const fixture = lawlessCommunity();
  officerIn(fixture.communityId, fixture.government, { corruptionRisk: 90 });

  const first = roguePolice.formRogueForces(w, { communityId: fixture.communityId, tick: 0, ...GENERATORS });
  assert.ok(first);
  const second = roguePolice.formRogueForces(w, { communityId: fixture.communityId, tick: 1, ...GENERATORS });
  assert.equal(second, null, 'no real officer is left employed by the old government here to defect a second time');
});

// Mutation-verified: the riskiest new check is the regime gate itself
// -- a community merely `contested` (not `lawless`) must not form a
// rogue force. Temporarily removing that check below (commented) and
// re-running confirmed this test fails without it; restored here.
test('formRogueForces refuses a merely contested community, not only a governed one', () => {
  const cityId = nextCityId += 1;
  const communityId = nextCommunityId += 1;
  w.cities.push({ id: cityId, name: `City ${cityId}`, region_id: null });
  w.communities.push({ id: communityId, city_id: cityId, name: `Community ${communityId}`, population: 10 });
  const gov = engine.generateOrganization({ name: `Gov ${cityId}`, type: 'government' });
  w.governments.push({ organization_id: gov.id, scope_type: 'civilization', scope_id: null });
  officerIn(communityId, gov, { corruptionRisk: 95 });

  // A moderate rival hold -- grip lands in the contested band, not lawless.
  const rival = engine.generateFaction({
    name: `Moderate Rival ${communityId}`,
    type: 'gang',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 55 : 50
    ),
  });
  territory.generateTerritoryBlock(w, { factionId: rival.id, cityId, communityId });
  assert.equal(authority.writOf(w, communityId).regime, 'contested');

  assert.equal(
    roguePolice.formRogueForces(w, { communityId, ...GENERATORS }),
    null,
    'contested is not lawless -- the state still answers what it cannot ignore here',
  );
});

test('scanForCollapsedPolicing finds every real eligible community in one real pass, and nothing else', () => {
  const eligible = lawlessCommunity();
  officerIn(eligible.communityId, eligible.government, { corruptionRisk: 90 });
  const ineligible = lawlessCommunity(); // lawless, but no officer

  const formed = roguePolice.scanForCollapsedPolicing(w, { tick: 0, ...GENERATORS });
  const communityIds = formed.map((f) => f.communityId);
  assert.ok(communityIds.includes(eligible.communityId));
  assert.ok(!communityIds.includes(ineligible.communityId));
});

test('formRogueForces requires both real generator callbacks, by orgArchetypes.found\'s own contract', () => {
  const { communityId } = lawlessCommunity();
  officerIn(communityId, lawlessCommunity().government, { corruptionRisk: 90 });
  assert.throws(
    () => roguePolice.formRogueForces(w, { communityId, generateFaction: engine.generateFaction }),
    /requires options\.generateOrganization/,
  );
  assert.throws(
    () => roguePolice.formRogueForces(w, { communityId, generateOrganization: engine.generateOrganization }),
    /requires options\.generateFaction/,
  );
});
