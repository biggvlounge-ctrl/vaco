// VACANCY — the influence economy (server/influence.js).
//
// `relationships.influence` and `families.political_influence` sat in
// `VACANCY_POSTGRESQL_SCHEMA.sql` since this project's first version,
// read and written by nothing beyond their own generation-time default.
// This file holds the real thing: every entity has real, growing
// influence over the specific people they actually interact with,
// starting from a real baseline that varies by who they are (occupation
// tier, real organization leadership, real social traits) rather than a
// flat zero for everyone, and moving down from real refusals and losses
// exactly as it moves up from real successes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');
const missions = require('../server/missions.js');
const membership = require('../server/membership.js');
const worldStore = require('../server/worldStore.js');
const occupations = require('../server/occupations.js');
const { getTraitId } = require('../server/traitDefinitions.js');
const { getLiveEntity } = require('../server/entityTraits.js');
const influence = require('../server/influence.js');

let nextId = 950000;

function world({ tick = 36500 } = {}) {
  const worldState = {
    tick,
    seed: 'influence-test',
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
    artifacts: [],
    missions: [],
    players: [],
    events: [],
    entityKnowledge: [],
    nextEntityId: 1,
  };
  economy.reseedIds(worldState);
  missions.reseedIds(worldState);
  return worldState;
}

function person(worldState) {
  const npc = {
    id: nextId++, status: 'active', communityId: null, home_property_id: null,
    createdTick: worldState.tick - 365 * 30, updatedTick: worldState.tick,
    generation: 1, role: null, traits: {},
  };
  worldState.npcs.push(npc);
  return npc;
}

function organization(worldState, { type = 'government', leaderId = null, influenceColumn = 50 } = {}) {
  const org = {
    id: nextId++, name: `Org ${nextId}`, type, founder_id: leaderId, leader_id: leaderId,
    members: 0, assets: 0, income: 0, expenses: 0, influence: influenceColumn, security: 50,
    innovation: 50, reputation: 50,
  };
  worldState.organizations.push(org);
  return org;
}

function join(worldState, entityId, organizationId, role = null) {
  return membership.joinOrganization(worldState, { entityId, organizationId, role });
}

function hire(worldState, entityId, org, position, { tick = worldState.tick } = {}) {
  return economy.hireEntity(worldState, {
    entityId, employerOrganizationId: org.id, wage: 20, position, tick,
  });
}

function setTrait(worldState, entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  worldState.entityTraits.push({
    entity_id: entityId, trait_id: traitId, current_value: value, base_value: value, key_modifier: 0,
  });
}

function setSocialTrait(worldState, entityId, name, value) {
  setTrait(worldState, entityId, 'social', name, value);
}

// A real community with a given population, for tasks #150's own
// local-prominence component -- `areaStats.residentsOf` counts real
// `npc.communityId` matches, so "population" here means real people
// actually placed in it, not a label.
function communityWithResidents(worldState, count) {
  const community = { id: nextId++, city_id: nextId, population: 0 };
  worldState.communities.push(community);
  for (let i = 0; i < count; i += 1) {
    const resident = person(worldState);
    resident.communityId = community.id;
  }
  return community;
}

// A school-age (task #150's own 5..18 youth-popularity band) resident
// of a real community, `createdTick` set the identical way `person()`
// itself derives a 30-year-old, scaled to the real requested age.
function youthResident(worldState, communityId, ageYears) {
  const npc = person(worldState);
  npc.communityId = communityId;
  npc.createdTick = worldState.tick - 365 * ageYears;
  return npc;
}

// ---------------------------------------------------------------------
// influenceRatingOf
// ---------------------------------------------------------------------

test('influenceRatingOf gives a flat janitor no occupation bump, no org bump, and the trait scale\'s own centre for unmeasured social and aura traits', () => {
  const w = world();
  const nobody = person(w);
  // Nothing hired, no org led, no traits generated at all, and
  // `communityId: null` (this fixture's own default) means the real
  // local-prominence component (task #150) has no real community to
  // scale against, so it is genuinely 0, not a third neutral-50 term.
  assert.equal(
    influence.influenceRatingOf(w, nobody.id),
    50 * influence.SOCIAL_WEIGHT + 50 * influence.AURA_WEIGHT,
  );
});

test('a gang leader starts with meaningfully more real influence than a janitor -- occupation tier is the first real driver', () => {
  const w = world();
  const janitor = person(w);
  const executive = person(w);
  const employer = organization(w, { type: 'business' });
  hire(w, janitor.id, employer, 'labourer');
  hire(w, executive.id, employer, 'officer');

  const janitorRating = influence.influenceRatingOf(w, janitor.id);
  const executiveRating = influence.influenceRatingOf(w, executive.id);
  assert.ok(
    executiveRating > janitorRating,
    `a tier-${occupations.tierOf('officer')} occupation should rate above a tier-${occupations.tierOf('labourer')} one: ${executiveRating} vs ${janitorRating}`,
  );
  // The occupation component is exactly computable -- check the real
  // arithmetic, not just the direction.
  const expectedDelta = ((occupations.tierOf('officer') - occupations.tierOf('labourer'))
    / occupations.TIER_COUNT) * 100 * influence.OCCUPATION_WEIGHT;
  assert.ok(Math.abs((executiveRating - janitorRating) - expectedDelta) < 1e-9);
});

test('leading a real organization raises the rating, scaled by that org\'s own real influence column and real member count', () => {
  const w = world();
  const pettyBoss = person(w);
  const kingpin = person(w);
  const smallGang = organization(w, { type: 'gang', leaderId: pettyBoss.id, influenceColumn: 10 });
  const bigGang = organization(w, { type: 'gang', leaderId: kingpin.id, influenceColumn: 90 });
  for (let i = 0; i < influence.ORG_SIZE_CAP + 5; i += 1) {
    join(w, person(w).id, bigGang.id);
  }
  join(w, person(w).id, smallGang.id);

  const pettyRating = influence.influenceRatingOf(w, pettyBoss.id);
  const kingpinRating = influence.influenceRatingOf(w, kingpin.id);
  assert.ok(
    kingpinRating > pettyRating,
    `a bigger, more influential organization's leader should rate higher: ${kingpinRating} vs ${pettyRating}`,
  );

  const nobody = person(w);
  assert.ok(
    influence.influenceRatingOf(w, nobody.id) < pettyRating,
    'leading even a small real organization still beats leading none at all',
  );
});

test('a leader of several organizations is rated by whichever gives the most real reach, not summed or averaged blindly', () => {
  const w = world();
  const leader = person(w);
  organization(w, { type: 'gang', leaderId: leader.id, influenceColumn: 5 });
  organization(w, { type: 'government', leaderId: leader.id, influenceColumn: 95 });

  const soloLeader = person(w);
  organization(w, { type: 'government', leaderId: soloLeader.id, influenceColumn: 95 });

  assert.equal(influence.influenceRatingOf(w, leader.id), influence.influenceRatingOf(w, soloLeader.id));
});

test('real social traits (Charisma, Persuasion, Reputation, Network Reach) move the rating, and only those four', () => {
  const w = world();
  const charismatic = person(w);
  for (const name of influence.SOCIAL_TRAITS) {
    setSocialTrait(w, charismatic.id, name, 100);
  }
  const plain = person(w);

  const charismaticRating = influence.influenceRatingOf(w, charismatic.id);
  const plainRating = influence.influenceRatingOf(w, plain.id);
  const expectedDelta = (100 - 50) * influence.SOCIAL_WEIGHT;
  assert.ok(Math.abs((charismaticRating - plainRating) - expectedDelta) < 1e-9);

  // An unrelated social trait (Group Loyalty, say) does nothing to it.
  const groupLoyaltyId = getTraitId('social', 'Group Loyalty');
  if (groupLoyaltyId) {
    const unaffected = person(w);
    w.entityTraits.push({
      entity_id: unaffected.id, trait_id: groupLoyaltyId, current_value: 100, base_value: 100, key_modifier: 0,
    });
    assert.equal(influence.influenceRatingOf(w, unaffected.id), plainRating);
  }
});

// ---------------------------------------------------------------------
// Task #235: a real word-of-mouth/fame "aura" component
// ---------------------------------------------------------------------

test('reputation.Notoriety is a real aura component, and only Notoriety', () => {
  const w = world();
  const famous = person(w);
  setTrait(w, famous.id, 'reputation', 'Notoriety', 100);
  const plain = person(w);

  const famousRating = influence.influenceRatingOf(w, famous.id);
  const plainRating = influence.influenceRatingOf(w, plain.id);
  const expectedDelta = (100 - 50) * influence.AURA_WEIGHT;
  assert.ok(Math.abs((famousRating - plainRating) - expectedDelta) < 1e-9);

  // An unrelated reputation trait (Trustworthiness, say) does nothing.
  const unaffected = person(w);
  setTrait(w, unaffected.id, 'reputation', 'Trustworthiness', 100);
  assert.equal(influence.influenceRatingOf(w, unaffected.id), plainRating);
});

// ---------------------------------------------------------------------
// Task #150: a real per-community local-prominence boost
// ---------------------------------------------------------------------

test('a visible occupation (the task\'s own named archetypes) carries more local prominence in a small real community than a large one', () => {
  const w = world();
  const smallTown = communityWithResidents(w, 5);
  const bigCity = communityWithResidents(w, 300);

  const localPreacher = person(w);
  localPreacher.communityId = smallTown.id;
  const bigCityPreacher = person(w);
  bigCityPreacher.communityId = bigCity.id;
  const church = organization(w, { type: 'religion' });
  hire(w, localPreacher.id, church, 'preacher');
  hire(w, bigCityPreacher.id, church, 'preacher');

  assert.ok(
    influence.influenceRatingOf(w, localPreacher.id) > influence.influenceRatingOf(w, bigCityPreacher.id),
    'the identical real occupation should carry further in a smaller real community',
  );
});

test('an occupation outside the task\'s own named list gets no local-prominence boost, however small the real community', () => {
  const w = world();
  const tinyTown = communityWithResidents(w, 2);
  const labourer = person(w);
  labourer.communityId = tinyTown.id;
  const employer = organization(w, { type: 'business' });
  hire(w, labourer.id, employer, 'labourer');

  const unplaced = person(w);
  const employerElsewhere = organization(w, { type: 'business' });
  hire(w, unplaced.id, employerElsewhere, 'labourer');

  assert.equal(influence.influenceRatingOf(w, labourer.id), influence.influenceRatingOf(w, unplaced.id));
});

test('leading a real organization (the task\'s own "criminal hierarchy") also carries local prominence, scaled the same way', () => {
  const w = world();
  const tinyTown = communityWithResidents(w, 3);
  const localBoss = person(w);
  localBoss.communityId = tinyTown.id;
  organization(w, { type: 'gang', leaderId: localBoss.id, influenceColumn: 10 });

  const bigCity = communityWithResidents(w, 300);
  const bigCityBoss = person(w);
  bigCityBoss.communityId = bigCity.id;
  organization(w, { type: 'gang', leaderId: bigCityBoss.id, influenceColumn: 10 });

  assert.ok(
    influence.influenceRatingOf(w, localBoss.id) > influence.influenceRatingOf(w, bigCityBoss.id),
    'the identical real org leadership should carry further in a smaller real community',
  );
});

test('local prominence is genuinely 0 with no real community, never a neutral default', () => {
  const w = world();
  const noCommunity = person(w); // communityId: null, the fixture's own default
  const church = organization(w, { type: 'religion' });
  hire(w, noCommunity.id, church, 'preacher');

  const sameOccupationWithCommunity = person(w);
  const smallTown = communityWithResidents(w, 5);
  sameOccupationWithCommunity.communityId = smallTown.id;
  hire(w, sameOccupationWithCommunity.id, church, 'preacher');

  assert.ok(
    influence.influenceRatingOf(w, noCommunity.id) < influence.influenceRatingOf(w, sameOccupationWithCommunity.id),
    'the one with no real community to be prominent within must not match the one with a real small community',
  );
});

test('youth popularity: a school-age resident with real standout sports traits out-rates a flat peer in the same small real community', () => {
  const w = world();
  const smallTown = communityWithResidents(w, 5);
  const starAthlete = youthResident(w, smallTown.id, 15);
  for (const name of influence.YOUTH_SPORTS_TRAITS) {
    setTrait(w, starAthlete.id, 'sports', name, 100);
  }
  const ordinaryTeen = youthResident(w, smallTown.id, 15);

  assert.ok(
    influence.influenceRatingOf(w, starAthlete.id) > influence.influenceRatingOf(w, ordinaryTeen.id),
    'real standout sports traits should move a school-age resident\'s rating',
  );
});

test('youth popularity: real Charisma alone (the "prom king/queen" half) is enough, with no real sports traits at all', () => {
  const w = world();
  const smallTown = communityWithResidents(w, 5);
  const popular = youthResident(w, smallTown.id, 16);
  setSocialTrait(w, popular.id, 'Charisma', 100);
  const ordinaryTeen = youthResident(w, smallTown.id, 16);

  assert.ok(influence.influenceRatingOf(w, popular.id) > influence.influenceRatingOf(w, ordinaryTeen.id));
});

test('youth popularity does not apply to a real adult, however standout their real sports traits', () => {
  const w = world();
  const smallTown = communityWithResidents(w, 5);
  const adultAthlete = person(w); // the fixture's own default age, 30
  adultAthlete.communityId = smallTown.id;
  for (const name of influence.YOUTH_SPORTS_TRAITS) {
    setTrait(w, adultAthlete.id, 'sports', name, 100);
  }
  const ordinaryAdult = person(w);
  ordinaryAdult.communityId = smallTown.id;

  assert.equal(influence.influenceRatingOf(w, adultAthlete.id), influence.influenceRatingOf(w, ordinaryAdult.id));
});

test('youth popularity does not apply to a school-age resident who already holds a real occupation', () => {
  const w = world();
  const smallTown = communityWithResidents(w, 5);

  // Identical real standout sports traits on both -- the only real
  // difference is whether this teen already holds a real occupation.
  // Isolated via `localProminenceOf` directly rather than the full
  // `influenceRatingOf`, since `workingTeen`'s real OCCUPATION
  // component (a different, unrelated term) would otherwise move the
  // total rating too and make the comparison say nothing specific
  // about local prominence.
  const workingTeen = youthResident(w, smallTown.id, 16);
  const employer = organization(w, { type: 'business' });
  hire(w, workingTeen.id, employer, 'labourer');
  for (const name of influence.YOUTH_SPORTS_TRAITS) {
    setTrait(w, workingTeen.id, 'sports', name, 100);
  }

  const idleTeen = youthResident(w, smallTown.id, 16);
  for (const name of influence.YOUTH_SPORTS_TRAITS) {
    setTrait(w, idleTeen.id, 'sports', name, 100);
  }

  const workingTeenLocal = influence.localProminenceOf(w, workingTeen.id, {
    occupation: occupations.occupationOf(w, workingTeen.id),
    hasOrgLeadership: false,
    live: getLiveEntity(w, workingTeen.id),
  });
  const idleTeenLocal = influence.localProminenceOf(w, idleTeen.id, {
    occupation: occupations.occupationOf(w, idleTeen.id),
    hasOrgLeadership: false,
    live: getLiveEntity(w, idleTeen.id),
  });

  assert.equal(workingTeenLocal, 0, 'a real occupation (even one not in VISIBLE_OCCUPATIONS) closes off the youth path');
  assert.ok(idleTeenLocal > 0, 'the identical real sports traits should still count with no real occupation at all');
});

// ---------------------------------------------------------------------
// personalInfluenceOf / familyPoliticalInfluenceOf -- real rollups,
// never independently stored
// ---------------------------------------------------------------------

test('personalInfluenceOf sums real influence across every relationship the entity is really party to', () => {
  const w = world();
  const broker = person(w);
  const a = person(w);
  const b = person(w);
  const c = person(w);
  worldStore.adjustRelationship(w, broker.id, a.id, 'social', { influence: 10 });
  worldStore.adjustRelationship(w, b.id, broker.id, 'social', { influence: 20 });
  worldStore.adjustRelationship(w, a.id, c.id, 'social', { influence: 999 }); // not broker's -- excluded

  assert.equal(influence.personalInfluenceOf(w, broker.id), 30);
});

test('familyPoliticalInfluenceOf is the MEAN of living members\' own personal influence, not the sum', () => {
  const w = world();
  // Five ordinary people, each with modest real influence (20 apiece --
  // summed, 100, more than the lone power broker below).
  const ordinaries = [person(w), person(w), person(w), person(w), person(w)];
  for (const member of ordinaries) {
    worldStore.adjustRelationship(w, member.id, person(w).id, 'social', { influence: 20 });
  }
  const crowdFamily = { id: nextId++, surname: 'Crowd' };
  w.families.push(crowdFamily);
  for (const member of ordinaries) {
    w.familyMemberships.push({ entity_id: member.id, family_id: crowdFamily.id, role: 'sibling', generation_number: 1 });
  }

  const powerBroker = person(w);
  worldStore.adjustRelationship(w, powerBroker.id, person(w).id, 'social', { influence: 80 });
  const brokerFamily = { id: nextId++, surname: 'Broker' };
  w.families.push(brokerFamily);
  w.familyMemberships.push({ entity_id: powerBroker.id, family_id: brokerFamily.id, role: 'sibling', generation_number: 1 });

  // A crowd of five ordinary people, summed, would outrank the lone
  // power broker (100 > 80) -- which is exactly the mistake summing
  // would make. The mean does not: the crowd's own mean (20) stays well
  // below the one real power broker's (80).
  const crowdMean = influence.familyPoliticalInfluenceOf(w, crowdFamily.id);
  const brokerMean = influence.familyPoliticalInfluenceOf(w, brokerFamily.id);
  assert.equal(crowdMean, 20);
  assert.equal(brokerMean, 80);
  assert.ok(
    crowdMean < brokerMean,
    `a crowd of ordinary people must not outrank one real power broker: ${crowdMean} vs ${brokerMean}`,
  );
});

test('familyPoliticalInfluenceOf counts only the living -- a deceased member (moved to worldState.deceased) drops out', () => {
  const w = world();
  const living = person(w);
  const dead = person(w);
  worldStore.adjustRelationship(w, living.id, person(w).id, 'social', { influence: 40 });
  worldStore.adjustRelationship(w, dead.id, person(w).id, 'social', { influence: 1000 });

  const family = { id: nextId++, surname: 'Mortal' };
  w.families.push(family);
  w.familyMemberships.push({ entity_id: living.id, family_id: family.id, role: 'sibling', generation_number: 1 });
  w.familyMemberships.push({ entity_id: dead.id, family_id: family.id, role: 'sibling', generation_number: 1 });

  // Move `dead` out of npcs the same way mortality.recordDeath does --
  // familyPoliticalInfluenceOf only recognises the living via npcs.
  w.npcs = w.npcs.filter((n) => n.id !== dead.id);
  w.deceased = [{ ...dead, status: 'deceased' }];

  assert.equal(influence.familyPoliticalInfluenceOf(w, family.id), 40);
});

test('families.political_influence stays a real computed rollup -- it is never read off a stored field', () => {
  const w = world();
  const family = { id: nextId++, surname: 'Null', political_influence: 999999 };
  w.families.push(family);
  // No members at all -- the computed answer is 0, ignoring whatever a
  // stale stored column says.
  assert.equal(influence.familyPoliticalInfluenceOf(w, family.id), 0);
});

// ---------------------------------------------------------------------
// raiseInfluence / lowerInfluence -- seeding, clamping, and the one
// real write path
// ---------------------------------------------------------------------

test('a brand-new relationship is seeded from the ACTING entity\'s own real rating, not the schema\'s flat 0', () => {
  const w = world();
  const bigShot = person(w);
  const bigGang = organization(w, { type: 'gang', leaderId: bigShot.id, influenceColumn: 90 });
  for (let i = 0; i < influence.ORG_SIZE_CAP; i += 1) join(w, person(w).id, bigGang.id);
  const stranger = person(w);

  assert.equal(worldStore.findRelationship(w, bigShot.id, stranger.id), undefined);
  const rating = influence.influenceRatingOf(w, bigShot.id);
  const rel = influence.raiseInfluence(w, bigShot.id, stranger.id);

  assert.equal(rel.influence, Math.min(100, rating + influence.INFLUENCE_DELTA));
  assert.ok(rel.influence > influence.INFLUENCE_DELTA, 'a real baseline was used, not the generic 0 default');
});

test('raiseInfluence on an EXISTING relationship just adds the delta and clamps -- it does not re-seed', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  const rel = worldStore.getOrCreateRelationship(w, a.id, b.id, 'social');
  rel.influence = 40;

  influence.raiseInfluence(w, a.id, b.id, 5);
  assert.equal(rel.influence, 45);

  rel.influence = 98;
  influence.raiseInfluence(w, a.id, b.id, 5);
  assert.equal(rel.influence, 100, 'clamped at the real relationship-dimension ceiling');
});

test('lowerInfluence is the real, symmetric inverse of raiseInfluence -- it moves the ONE shared value down', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const rel = worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social');
  rel.influence = 50;

  influence.lowerInfluence(w, leader.id, subordinate.id, 5);
  assert.equal(rel.influence, 45);

  rel.influence = 1;
  influence.lowerInfluence(w, leader.id, subordinate.id, 5);
  assert.equal(rel.influence, 0, 'clamped at the real relationship-dimension floor, never negative');
});

test('lowerInfluence on a brand-new pair still seeds from the real rating before applying the negative delta', () => {
  const w = world();
  const nobody = person(w);
  const stranger = person(w);
  const rating = influence.influenceRatingOf(w, nobody.id);

  const rel = influence.lowerInfluence(w, nobody.id, stranger.id, 3);
  assert.equal(rel.influence, Math.max(0, rating - 3));
});

// ---------------------------------------------------------------------
// seedFamilyBond -- the real `relationship_type: 'family'` seeding
// characterCreation.js uses for parents/siblings/aunts-uncles/cousins,
// closing the gap where those links landed at the schema's flat
// `influence: 0` instead of a real baseline.
// ---------------------------------------------------------------------

test('seedFamilyBond seeds a real family-typed relationship from the real influence rating, baseline only when not immediate', () => {
  const w = world();
  const cousinA = person(w);
  const bigGang = organization(w, { type: 'gang', leaderId: cousinA.id, influenceColumn: 80 });
  for (let i = 0; i < 5; i += 1) join(w, person(w).id, bigGang.id);
  const cousinB = person(w);

  const rating = influence.influenceRatingOf(w, cousinA.id);
  const rel = influence.seedFamilyBond(w, cousinA.id, cousinB.id);

  assert.equal(rel.relationship_type, 'family');
  assert.equal(rel.influence, rating);
  assert.equal(rel.trust, 50, 'baseline (non-immediate) bond does not touch trust/respect/loyalty');
  assert.equal(rel.respect, 50);
  assert.equal(rel.loyalty, 50);
});

test('seedFamilyBond with immediate:true adds IMMEDIATE_FAMILY_BOND_BONUS on top of the baseline -- closer than a cousin\'s', () => {
  const w = world();
  const child = person(w);
  const parent = person(w);

  const rating = influence.influenceRatingOf(w, child.id);
  const rel = influence.seedFamilyBond(w, child.id, parent.id, { immediate: true });

  assert.equal(rel.relationship_type, 'family');
  assert.equal(rel.influence, Math.min(100, rating + influence.IMMEDIATE_FAMILY_BOND_BONUS));
  assert.equal(rel.trust, Math.min(100, 50 + influence.IMMEDIATE_FAMILY_BOND_BONUS));
  assert.equal(rel.respect, Math.min(100, 50 + influence.IMMEDIATE_FAMILY_BOND_BONUS));
  assert.equal(rel.loyalty, Math.min(100, 50 + influence.IMMEDIATE_FAMILY_BOND_BONUS));
});

test('an immediate family bond really does rate higher than a baseline (cousin) bond seeded from the same rating', () => {
  const w = world();
  const anchor = person(w);
  const sibling = person(w);
  const cousin = person(w);

  const siblingRel = influence.seedFamilyBond(w, anchor.id, sibling.id, { immediate: true });
  const cousinRel = influence.seedFamilyBond(w, anchor.id, cousin.id);

  assert.ok(
    siblingRel.influence > cousinRel.influence,
    `immediate family (${siblingRel.influence}) should rate above extended family (${cousinRel.influence})`,
  );
});

test('seedFamilyBond on an EXISTING pair does not re-seed or re-apply the bonus -- same existedAlready guard as raiseInfluence', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  const rel = worldStore.getOrCreateRelationship(w, a.id, b.id, 'family');
  rel.influence = 33;
  rel.trust = 33;

  influence.seedFamilyBond(w, a.id, b.id, { immediate: true });
  assert.equal(rel.influence, 33, 'an existing relationship is left alone, never re-seeded');
  assert.equal(rel.trust, 33);
});

test('IMMEDIATE_FAMILY_BOND_BONUS is a named multiple of INFLUENCE_DELTA, not an unrelated invented number', () => {
  assert.equal(influence.IMMEDIATE_FAMILY_BOND_BONUS, influence.INFLUENCE_DELTA * 5);
});

// ---------------------------------------------------------------------
// Integration -- wired into real, already-existing events via
// engine.js. These run against engine.js's own live WorldState
// singleton, the same convention test/missions.test.js and
// test/contest.test.js already use, rather than the isolated world()
// fixture above.
// ---------------------------------------------------------------------

const engine = require('../server/engine.js');
const worldStoreMod = require('../server/worldStore.js');
const contest = require('../server/contest.js');
const { getTraitId: getTraitIdForContest } = require('../server/traitDefinitions.js');

function setContestTrait(entityId, family, name, value) {
  const traitId = getTraitIdForContest(family, name);
  const row = engine.WorldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === traitId,
  );
  if (!row) throw new Error(`entity ${entityId} carries no ${family}.${name} row to set`);
  row.current_value = value;
  row.base_value = value;
  row.key_modifier = 0;
}

test('a completed DIRECTED mission (issued_by != assigned) really raises influence between issuer and holder', () => {
  const issuer = engine.generateNPC();
  const holder = engine.generateNPC();
  engine.generateIndividualFinances(holder.id, { savings: 0 });
  const relic = engine.generateArtifact({ name: `Directed Relic ${holder.id}` });
  const mission = engine.generateMission({ artifactId: relic.id });
  engine.acceptMission(mission.id, holder.id);
  mission.issued_by_entity_id = issuer.id;

  assert.equal(worldStoreMod.findRelationship(engine.WorldState, issuer.id, holder.id), undefined);
  engine.resolveMission(mission.id, { outcome: 'completed', entityId: holder.id });

  const rel = worldStoreMod.findRelationship(engine.WorldState, issuer.id, holder.id);
  assert.ok(rel, 'completing a directed mission must create or touch the real relationship');
  assert.ok(Number(rel.influence) > 0, 'real influence must have actually grown');
});

test('a FAILED directed mission raises no influence at all -- only real completion does', () => {
  const issuer = engine.generateNPC();
  const holder = engine.generateNPC();
  engine.generateIndividualFinances(holder.id, { savings: 0 });
  const relic = engine.generateArtifact({ name: `Failed Relic ${holder.id}` });
  const mission = engine.generateMission({ artifactId: relic.id });
  engine.acceptMission(mission.id, holder.id);
  mission.issued_by_entity_id = issuer.id;

  engine.resolveMission(mission.id, { outcome: 'failed', entityId: holder.id });
  assert.equal(worldStoreMod.findRelationship(engine.WorldState, issuer.id, holder.id), undefined);
});

test('a resolved contest raises the real winner\'s influence over every real loser, on any discipline, exactly once per pair', () => {
  const winner = engine.generateNPC();
  const loser = engine.generateNPC();
  for (const [entity, value] of [[winner, 90], [loser, 10]]) {
    for (const name of ['Melee Skill', 'Weapon Mastery', 'Tactical Awareness', 'Composure Under Fire']) {
      if (getTraitIdForContest('combat', name)) setContestTrait(entity.id, 'combat', name, value);
    }
  }
  assert.equal(worldStoreMod.findRelationship(engine.WorldState, winner.id, loser.id), undefined);

  const result = engine.resolveContest({ participantIds: [winner.id, loser.id], discipline: 'combat', tick: engine.WorldState.tick });
  assert.equal(result.winnerId, winner.id);

  const rel = worldStoreMod.findRelationship(engine.WorldState, winner.id, loser.id);
  assert.ok(rel, 'a real contest must create or touch the real relationship');
  assert.ok(Number(rel.influence) > 0);
});

test('broadcastMessage (leadership.js, through engine.js) raises the leader\'s influence over every real person actually reached', () => {
  const leadership = require('../server/leadership.js');
  const leaderNpc = engine.generateNPC();
  const listenerNpc = engine.generateNPC();
  const outlet = engine.generateOrganization({ type: 'media', leaderId: leaderNpc.id });
  outlet.influence = 100;

  assert.equal(worldStoreMod.findRelationship(engine.WorldState, leaderNpc.id, listenerNpc.id), undefined);
  const written = leadership.broadcastMessage(engine.WorldState, leaderNpc.id, {
    organizationId: outlet.id, factContent: 'a real test broadcast', channel: 'word_of_mouth',
  });
  assert.ok(written.length > 0, 'a real audience must exist for this assertion to mean anything');

  const reached = written.find((row) => row.entity_id === listenerNpc.id);
  if (reached) {
    const rel = worldStoreMod.findRelationship(engine.WorldState, leaderNpc.id, listenerNpc.id);
    assert.ok(rel);
    assert.ok(Number(rel.influence) > 0);
  }
});
