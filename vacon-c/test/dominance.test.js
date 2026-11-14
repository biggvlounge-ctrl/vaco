// server/dominance.js — a real, pre-existing local power (a gang, a
// business, a religious order, ...) converting its real presence into
// a real territorial claim the moment the state's own writ stops
// reaching a community. See that file's own header for the full
// reasoning.
//
// Same fixture discipline as test/roguePolice.test.js, which this file
// borrows its city/community/government scaffolding from directly: the
// real shared `engine.WorldState`, real generators, city-scoped
// governments (never civilization-scoped, to avoid cross-test
// contamination against `mainCharacters.governmentCovering`'s own
// first-match fallback).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const dominance = require('../server/dominance.js');
const authority = require('../server/authority.js');
const membership = require('../server/membership.js');
const territory = require('../server/territory.js');

const w = engine.WorldState;

let nextCityId = 940001;
let nextCommunityId = 940001;

function baseCommunity() {
  const cityId = nextCityId += 1;
  const communityId = nextCommunityId += 1;
  w.cities.push({ id: cityId, name: `City ${cityId}`, region_id: null });
  w.communities.push({ id: communityId, city_id: cityId, name: `Community ${communityId}`, population: 10 });
  const gov = engine.generateOrganization({ name: `Gov ${cityId}`, type: 'government' });
  w.governments.push({ organization_id: gov.id, scope_type: 'city', scope_id: cityId });
  return { cityId, communityId, government: gov };
}

// No rival faction holding this ground at all -- the real "nothing
// measured here" / "governed" case `roguePolice.test.js`'s own
// `formRogueForces: an honest null` test already relies on this exact
// shape for.
function plainCommunity() {
  const base = baseCommunity();
  assert.notEqual(authority.writOf(w, base.communityId).regime, 'lawless');
  return base;
}

// A moderate rival hold -- grip lands in the contested band. Same
// fixture `test/roguePolice.test.js#formRogueForces refuses a merely
// contested community` already establishes.
function contestedCommunity() {
  const base = baseCommunity();
  const rival = engine.generateFaction({
    name: `Moderate Rival ${base.communityId}`,
    type: 'gang',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 55 : 50
    ),
  });
  territory.generateTerritoryBlock(w, { factionId: rival.id, cityId: base.cityId, communityId: base.communityId });
  assert.equal(authority.writOf(w, base.communityId).regime, 'contested');
  return base;
}

// A strong rival hold, fortified -- the real `lawless` case.
function lawlessCommunity() {
  const base = baseCommunity();
  const rival = engine.generateFaction({
    name: `Rival ${base.communityId}`,
    type: 'gang',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 95 : 50
    ),
  });
  const block = territory.generateTerritoryBlock(w, { factionId: rival.id, cityId: base.cityId, communityId: base.communityId });
  block.status = 'fortified';
  assert.equal(authority.writOf(w, base.communityId).regime, 'lawless');
  return base;
}

function residentIn(communityId) {
  return engine.generateNPC({ communityId });
}

// ---------------------------------------------------------------------
// dominantOrganizationOf
// ---------------------------------------------------------------------

test('dominantOrganizationOf: the real organization with the most real local members wins', () => {
  const { communityId } = baseCommunity();
  const small = engine.generateOrganization({ name: 'Small Co', type: 'business' });
  small.influence = 10;
  const big = engine.generateOrganization({ name: 'Big Congregation', type: 'religion' });
  big.influence = 10;

  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: small.id });
  for (let i = 0; i < 3; i += 1) {
    membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: big.id });
  }

  const dominant = dominance.dominantOrganizationOf(w, communityId);
  assert.equal(dominant.organizationId, big.id);
  assert.equal(dominant.type, 'religion');
  assert.equal(dominant.members, 3);
});

test('dominantOrganizationOf: a tie in real members breaks on the organization\'s own real influence', () => {
  const { communityId } = baseCommunity();
  const weak = engine.generateOrganization({ name: 'Weak Crew', type: 'gang' });
  weak.influence = 10;
  const strong = engine.generateOrganization({ name: 'Strong Crew', type: 'gang' });
  strong.influence = 80;

  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: weak.id });
  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: strong.id });

  const dominant = dominance.dominantOrganizationOf(w, communityId);
  assert.equal(dominant.organizationId, strong.id);
});

test('dominantOrganizationOf: a government organization is never a candidate, however many local members it has', () => {
  const { communityId, government } = baseCommunity();
  for (let i = 0; i < 5; i += 1) {
    membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: government.id });
  }
  const business = engine.generateOrganization({ name: 'Lone Shop', type: 'business' });
  business.influence = 10;
  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: business.id });

  const dominant = dominance.dominantOrganizationOf(w, communityId);
  assert.equal(dominant.organizationId, business.id, 'the government out-numbers it 5 to 1 and must still lose');
});

test('dominantOrganizationOf: null where nobody real holds any presence here at all', () => {
  const { communityId } = baseCommunity();
  assert.equal(dominance.dominantOrganizationOf(w, communityId), null);
});

// ---------------------------------------------------------------------
// claimDominantGround
// ---------------------------------------------------------------------

test('claimDominantGround: an honest null at every real precondition that is not met', () => {
  // No such community.
  assert.equal(dominance.claimDominantGround(w, { communityId: -1 }), null);

  // Governed (nothing measured against it) -- even with a real
  // dominant organization present.
  const governed = plainCommunity();
  const org = engine.generateOrganization({ name: 'Governed Congregation', type: 'religion' });
  org.influence = 50;
  membership.joinOrganization(w, { entityId: residentIn(governed.communityId).id, organizationId: org.id });
  assert.equal(
    dominance.claimDominantGround(w, { communityId: governed.communityId }),
    null,
    'a governed community has no power vacuum to fill',
  );
  assert.notEqual(org.isFaction, true);

  // Contested or lawless, but nobody real dominates this community.
  const empty = lawlessCommunity();
  assert.equal(
    dominance.claimDominantGround(w, { communityId: empty.communityId }),
    null,
    'a lawless community with no real local power has nothing to convert',
  );
});

test('claimDominantGround: a real non-faction organization (a religious order) converts into a real territorial claim once the area is merely contested', () => {
  const { communityId, cityId } = contestedCommunity();
  const congregation = engine.generateOrganization({
    name: 'Riverside Congregation', type: 'religion',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 70 : 50
    ),
  });
  congregation.influence = 40;
  assert.notEqual(congregation.isFaction, true, 'a religious order starts with no territorial claim at all');
  for (let i = 0; i < 4; i += 1) {
    membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: congregation.id });
  }

  const result = dominance.claimDominantGround(w, { communityId, tick: 0 });
  assert.ok(result, 'merely contested is enough -- the dominant org does not have to wait for full lawlessness');
  assert.equal(result.organizationId, congregation.id);
  assert.equal(result.dominantType, 'religion');
  assert.equal(result.dominantMembers, 4);

  assert.equal(congregation.isFaction, true, 'the conversion is real and visible on the organization itself');
  const block = (w.territoryBlocks || []).find((b) => b.id === result.territoryBlockId);
  assert.equal(block.faction_id, congregation.id);
  assert.equal(block.community_id, communityId);
  assert.equal(block.city_id, cityId);
  assert.ok(['contested', 'controlled', 'fortified'].includes(block.status));
});

test('claimDominantGround is idempotent: a second call on the same, already-converted community claims nothing new', () => {
  const { communityId } = lawlessCommunity();
  const gang = engine.generateOrganization({ name: 'Street Crew', type: 'gang' });
  gang.influence = 30;
  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: gang.id });

  const first = dominance.claimDominantGround(w, { communityId, tick: 0 });
  assert.ok(first);
  const blocksAfterFirst = (w.territoryBlocks || []).filter((b) => b.faction_id === gang.id).length;

  const second = dominance.claimDominantGround(w, { communityId, tick: 1 });
  assert.equal(second, null, 'the dominant organization already holds real ground here');
  const blocksAfterSecond = (w.territoryBlocks || []).filter((b) => b.faction_id === gang.id).length;
  assert.equal(blocksAfterSecond, blocksAfterFirst, 'no duplicate claim was ever created');
});

test('claimDominantGround: an already-isFaction gang can still gain a real new claim in a community it was never assigned at generation', () => {
  // Confirms the conversion path is general, not special-cased to
  // "was never a faction before" -- the identical shape
  // `roguePolice.js`'s own new rogue faction takes claiming ground even
  // where another faction already holds some.
  const { communityId, cityId } = lawlessCommunity();
  const alreadyFaction = engine.generateFaction({
    name: 'Established Gang', type: 'gang',
    traitValueFor: (def) => (
      def.family === 'organization' && (def.name === 'territory' || def.name === 'power') ? 80 : 50
    ),
  });
  alreadyFaction.influence = 60;
  assert.equal(alreadyFaction.isFaction, true);
  membership.joinOrganization(w, { entityId: residentIn(communityId).id, organizationId: alreadyFaction.id });

  const result = dominance.claimDominantGround(w, { communityId, tick: 0 });
  assert.ok(result);
  assert.equal(result.organizationId, alreadyFaction.id);
  const block = (w.territoryBlocks || []).find((b) => b.id === result.territoryBlockId);
  assert.equal(block.city_id, cityId);
});

// ---------------------------------------------------------------------
// scanForPowerVacuums
// ---------------------------------------------------------------------

test('scanForPowerVacuums finds every real eligible community in one real pass, and nothing else', () => {
  const eligible = contestedCommunity();
  const dominantOrg = engine.generateOrganization({ name: 'Eligible Org', type: 'business' });
  dominantOrg.influence = 20;
  membership.joinOrganization(w, { entityId: residentIn(eligible.communityId).id, organizationId: dominantOrg.id });

  const governedButDominated = plainCommunity();
  const governedOrg = engine.generateOrganization({ name: 'Governed Org', type: 'business' });
  governedOrg.influence = 20;
  membership.joinOrganization(w, { entityId: residentIn(governedButDominated.communityId).id, organizationId: governedOrg.id });

  const lawlessButEmpty = lawlessCommunity();

  const results = dominance.scanForPowerVacuums(w, { tick: 0 });
  const communityIds = results.map((r) => r.communityId);
  assert.ok(communityIds.includes(eligible.communityId));
  assert.ok(!communityIds.includes(governedButDominated.communityId));
  assert.ok(!communityIds.includes(lawlessButEmpty.communityId));
});

// ---------------------------------------------------------------------
// Mutation-verified gates
// ---------------------------------------------------------------------
// Both of claimDominantGround's own real gates (the regime check, the
// idempotence check) were temporarily removed and re-run against this
// file -- each one caught by a real test failing, each reverted once
// confirmed. See the two tests above whose own names describe exactly
// what broke: "a governed community has no power vacuum to fill" (the
// regime gate) and "claimDominantGround is idempotent" (the
// already-held gate).
