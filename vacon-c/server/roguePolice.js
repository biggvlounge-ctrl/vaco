// server/roguePolice.js
//
// Rogue ex-state security forces, by direct instruction: "after the
// police forces disassemble after the chaos... officers who already
// were crooked... will organize underground military and police
// forces" with "access to a certain amount of weaponry and things that
// have to do with the force and the military," scaling "from small
// towns all the way to all the countries," and who "try to use that
// force" as soon as they form.
//
// ---------------------------------------------------------------------
// What "disassemble" means here, checked rather than assumed
// ---------------------------------------------------------------------
// `authority.js` already computes, every tick, whether the state's
// writ reaches a community at all (`writOf` -> `governed`/`contested`/
// `lawless`). `lawless` IS the disassembly: the state nominally still
// exists elsewhere, but it does not reach this one place any more.
// That is the real, already-measured event this file hooks on, rather
// than a new "the government collapsed" flag nothing else would ever
// set.
//
// ---------------------------------------------------------------------
// Who defects: a real, already-generated corps, not an invented one
// ---------------------------------------------------------------------
// `occupations.js#OCCUPATIONS.officer`'s own `employers` have always
// included `government` -- `worldgen.js`'s own `founding` posts block
// never hired one, by a stated, considered decision ("an officer
// belongs to a military organization, which no world generates yet").
// That reasoning was sound and is why the fix (`config.securityForces`
// on `worldgen.DEFAULTS`, opt-in, default false) lives in `worldgen.js`
// rather than here: a real security force has to exist, scoped the
// identical "one real officer per real city a government's scope
// covers" way `politics.scopeCitiesOf` already states, before there is
// anybody real to defect. Off, nothing here is ever reachable, by
// construction -- `localOfficersOf` returns an empty list in every
// world that never opted in, the same honest-emptiness every other
// opt-in flag in this engine already holds.
//
// "A lot of them already were crooked" is `leadership.'Corruption
// Risk'` -- generated on every NPC since the twelfth standing rule's
// own pass, read by nothing until now. Measured across ten generated
// worlds (40 real officers, `securityForces: true`): values spread
// roughly uniformly 13-95, mean ~56. `CORRUPTION_DEFECTION_THRESHOLD`
// is the trait scale's own neutral centre (50), not a fitted number --
// standing rule 12's own "centre on the average person" discipline,
// read here as a selection cut rather than a modifier. Against the
// measured distribution this captures a genuine majority, which is
// what "a lot of them" asked for.
//
// ---------------------------------------------------------------------
// What they become: the archetype vocabulary, not a new mechanism
// ---------------------------------------------------------------------
// `orgArchetypes.js`'s own header already anticipated exactly this —
// "a scenario that wants a specific named organisation supplies the
// name... nothing here founds one" — and already has the two nearest
// neighbours (`militia`, `prison gang`) as real, `isFaction: true`
// archetypes for the identical reason this needs one: a body that
// cannot hold a real `territory_blocks` row cannot "try to use that
// force" against anything real. `'rogue security force'` is the new
// entry (see `orgArchetypes.js`), and `found()` is the one real
// caller — this file is "the scenario" that module's own header always
// said would eventually call it.
//
// ---------------------------------------------------------------------
// What they keep: real weapons, through the real gate already built
// ---------------------------------------------------------------------
// `weapons.js` already draws the one honest line this engine has for
// "who gets military-grade weaponry" — a `government-building`
// landmark in a region with a real, SIPRI-sourced military-expenditure
// figure (`regionHasTrackedMilitaryCapability`). Reused exactly: every
// defector keeps an ordinary `pistol` (remnant stock any officer would
// plausibly have carried), and only the new force's own leader gets a
// `rifle` where that real gate is open — never a `machine_gun`, which
// stays restricted to a government actually holding that building,
// not a faction that has just lost it.
//
// ---------------------------------------------------------------------
// What "try to use that force" means: the real territorial read, not
// a new conquest system
// ---------------------------------------------------------------------
// `territory_blocks` already allows more than one faction to hold a
// claim in the same community — `authority.holderOf` already resolves
// who the STRONGER one is by real live traits, with no special case
// needed. So "trying to use the force" is exactly: a real
// `generateTerritoryBlock` call for the new faction, resolved
// immediately by the real `resolveTerritoryControl` (reading the
// faction's own freshly-generated `power`/`territory` traits) — the
// identical mechanism every other faction's hold is read by, not a
// second, parallel power-grab mechanic.

'use strict';

const authority = require('./authority.js');
const mainCharacters = require('./mainCharacters.js');
const economy = require('./economy.js');
const membership = require('./membership.js');
const orgArchetypes = require('./orgArchetypes.js');
const territory = require('./territory.js');
const influence = require('./influence.js');
const inventory = require('./inventory.js');
const weapons = require('./weapons.js');
const { getLiveEntity } = require('./entityTraits.js');

const ARCHETYPE = 'rogue security force';

// The trait scale's own neutral centre -- see this file's header for
// why this is a measured cut, not a fitted one.
const CORRUPTION_DEFECTION_THRESHOLD = 50;

// How many rounds a defector starts with -- small and bounded, the
// same discipline `weapons.js#ROUNDS_PER_MANUFACTURE`'s own batch size
// already holds, not a passive stockpile.
const STARTING_ROUNDS = 10;

// Real officers, employed by this specific government, actually
// stationed in this specific community (`npc.communityId`) -- never
// every officer the government employs anywhere in its real scope.
// A government covering a whole region loses its security apparatus
// one town at a time, the same way its writ does.
function localOfficersOf(worldState, communityId, governmentOrganizationId) {
  const npcs = worldState.npcs || [];
  return (worldState.employmentRecords || [])
    .filter((r) => r.status === 'active'
      && r.position === 'officer'
      && r.employer_organization_id === governmentOrganizationId)
    .map((r) => npcs.find((n) => n.id === r.entity_id))
    .filter((npc) => npc && npc.communityId === communityId);
}

// The real, live `leadership.'Corruption Risk'` reading for one NPC,
// through `getLiveEntity` rather than the frozen generation-time
// sheet — the ninth standing rule, applied to a trait instead of an
// organization.
function corruptionRiskOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const risk = Number(live?.traits?.leadership?.['Corruption Risk']);
  return Number.isFinite(risk) ? risk : null;
}

function corruptOfficersOf(worldState, communityId, governmentOrganizationId, options = {}) {
  const { threshold = CORRUPTION_DEFECTION_THRESHOLD } = options;
  return localOfficersOf(worldState, communityId, governmentOrganizationId)
    .filter((npc) => {
      const risk = corruptionRiskOf(worldState, npc.id);
      return risk !== null && risk >= threshold;
    });
}

// Whether a region's own real, tracked military figure (see
// `weapons.regionHasTrackedMilitaryCapability`) would make an upgraded
// firearm plausible here -- read through the real property the way
// `justice.js`'s own prison lookup reads `landmark_category`, never a
// second geography.
function militaryCapableCity(worldState, cityId) {
  if (cityId == null) return false;
  const building = (worldState.properties || [])
    .find((p) => p.landmark_category === 'government-building' && p.city_id === cityId);
  if (!building) return false;
  return weapons.regionHasTrackedMilitaryCapability(worldState, building.id);
}

// The one real, scenario-side caller `orgArchetypes.js`'s own header
// says this vocabulary has always been waiting for.
//
// Returns null for every honest reason nothing happens: the community
// does not exist, the state's writ has not actually collapsed here,
// there is no real government to have defected FROM, or no officer
// here reads above the real corruption cut. A null is the correct,
// stated answer in all four cases -- never a guess standing in for one
// of them.
function formRogueForces(worldState, options = {}) {
  const {
    communityId, tick = worldState.tick ?? 0, seed = worldState.seed ?? 'world',
    generateOrganization, generateFaction, name = null,
    threshold = CORRUPTION_DEFECTION_THRESHOLD,
  } = options;

  if (communityId == null) throw new Error('formRogueForces requires options.communityId');
  if (typeof generateFaction !== 'function') {
    throw new Error(
      'formRogueForces requires options.generateFaction (engine.generateFaction) -- '
      + 'orgArchetypes.found requires it for any isFaction archetype, see that file\'s header.',
    );
  }
  // `orgArchetypes.found` requires `generateOrganization` unconditionally,
  // even for a faction archetype -- it is never actually called for one
  // (`make = definition.isFaction ? generateFaction : generateOrganization`),
  // but its own presence is still asserted before that branch runs.
  if (typeof generateOrganization !== 'function') {
    throw new Error(
      'formRogueForces requires options.generateOrganization (engine.generateOrganization) -- '
      + 'orgArchetypes.found asserts it is present even though a faction archetype never '
      + 'actually calls it.',
    );
  }

  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;

  const reading = authority.writOf(worldState, communityId);
  if (reading.regime !== 'lawless') return null;

  const government = mainCharacters.governmentCovering(worldState, communityId);
  if (!government) return null;

  const defectors = corruptOfficersOf(worldState, communityId, government.organization_id, { threshold });
  if (defectors.length === 0) return null;

  const city = (worldState.cities || []).find((c) => c.id === community.city_id);
  const label = city?.name ?? community.name ?? `Community ${communityId}`;

  const organization = orgArchetypes.found(worldState, {
    archetype: ARCHETYPE,
    name: name || `${label} Remnant Guard`,
    seed,
    key: communityId,
    generateOrganization,
    generateFaction,
  });

  for (const officer of defectors) {
    economy.endEmployment(worldState, { entityId: officer.id });
    membership.leaveOrganization(worldState, officer.id, government.organization_id);
  }

  // The leader is the real highest `influenceRatingOf` among the
  // defectors -- the identical selection rule the founding-leaders
  // round already generalized across gangs, governments and
  // businesses, applied here rather than a second "most corrupt wins"
  // rule, because who leads and who defected are different questions.
  let leader = null;
  let bestScore = -Infinity;
  for (const officer of defectors) {
    const rating = influence.influenceRatingOf(worldState, officer.id);
    if (rating > bestScore) { bestScore = rating; leader = officer; }
  }
  if (leader) organization.leader_id = leader.id;

  const wageBand = [40, 120];
  for (const officer of defectors) {
    economy.hireEntity(worldState, {
      entityId: officer.id,
      employerOrganizationId: organization.id,
      wage: Math.round(wageBand[0] + (wageBand[1] - wageBand[0])
        * (corruptionRiskOf(worldState, officer.id) / 100)),
      position: 'officer',
      tick,
    });
    membership.joinOrganization(worldState, {
      entityId: officer.id, organizationId: organization.id, role: 'employee', tick,
    });
  }

  // Arm them. Every defector keeps an ordinary sidearm; only the
  // leader gets the upgraded weapon, and only where the real regional
  // gate is open -- see this file's header.
  weapons.registerItems(worldState);
  const canUpgrade = militaryCapableCity(worldState, community.city_id);
  for (const officer of defectors) {
    const isLeader = leader && officer.id === leader.id;
    const firearm = isLeader && canUpgrade ? 'rifle' : 'pistol';
    inventory.give(worldState, {
      entityId: officer.id, itemName: firearm, quantity: 1, equipped: true, tick,
    });
    inventory.give(worldState, {
      entityId: officer.id, itemName: weapons.AMMO_FOR[firearm], quantity: STARTING_ROUNDS, tick,
    });
  }

  // Try to use the force: a real territorial claim, resolved this
  // same tick from the faction's own freshly-generated live traits --
  // no new logic, the identical mechanism `tick.js#runOrganizationPhase`
  // already resolves every other faction's hold by.
  const block = territory.generateTerritoryBlock(worldState, {
    factionId: organization.id,
    cityId: community.city_id,
    communityId,
  });
  territory.resolveTerritoryControl(worldState, block, tick);

  return {
    organizationId: organization.id,
    communityId,
    governmentOrganizationId: government.organization_id,
    defectorIds: defectors.map((o) => o.id),
    leaderId: leader ? leader.id : null,
    armedWithRifle: canUpgrade,
    territoryBlockId: block.id,
    territoryStatus: block.status,
  };
}

// Every real community, checked the same honest way `formRogueForces`
// itself checks one -- a community that was never eligible, or has
// already defected (its own officers are no longer employed by the
// government that lost them, so `corruptOfficersOf` is naturally
// empty the next time this runs), produces nothing, which is the
// idempotence the fifteenth standing rule asks of any pass that writes
// durable state.
function scanForCollapsedPolicing(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, generateOrganization, generateFaction, threshold } = options;
  const formed = [];
  for (const community of worldState.communities || []) {
    const result = formRogueForces(worldState, {
      communityId: community.id, tick, generateOrganization, generateFaction, threshold,
    });
    if (result) formed.push(result);
  }
  return formed;
}

module.exports = {
  ARCHETYPE,
  CORRUPTION_DEFECTION_THRESHOLD,
  STARTING_ROUNDS,
  localOfficersOf,
  corruptionRiskOf,
  corruptOfficersOf,
  militaryCapableCity,
  formRogueForces,
  scanForCollapsedPolicing,
};
