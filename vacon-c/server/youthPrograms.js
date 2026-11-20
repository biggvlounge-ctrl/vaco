// server/youthPrograms.js
//
// By direct instruction: "when the youth start to get out of control,
// this is where they start to try to, the community leaders,
// organizations, tribe gangs will try to open up gyms and get back
// open and take over high schools so they can give something for the
// youth to do."
//
// ---------------------------------------------------------------------
// "Tribe gangs" names one real actor this engine already has, not two
// ---------------------------------------------------------------------
// `control.js`'s own nineteenth standing rule already settled that
// "Tribe" is what this project's recovered documents call a family —
// the real, already-built takeover key (`control.assess`/
// `control.attempt`, tasks #19/#47/#48) acts through a `tribeId`
// exactly as the instruction's "tribe gangs" names. "Community
// leaders" are not a second concept either: `control.roleOf`'s own
// `'elder'`/`'enforcer'` roster is this engine's real model of who
// leads and defends a tribe, read live from the same family this pass
// already acts through. Building a second, disagreeing "organization
// takeover" mechanic to answer the word "organizations" separately
// would be exactly this file's own third standing rule — the real
// actor behind every word in the sentence is the one already built.
//
// ---------------------------------------------------------------------
// "Open up gyms... take over high schools" is one real target set,
// not a new landmark category with nothing behind it
// ---------------------------------------------------------------------
// No gym/recreation-center landmark category exists anywhere in this
// registry, and no real source this project has already imported
// (HIFLD, Census, NCES) names one at the per-city grain
// `landmarkPacks.js` already works at the way it names `school`,
// `park` and `stadium-arena`. Inventing a `gym` category with no real
// data behind it, next to three real categories that already cover
// the same real-world function — a real US high school's own
// gymnasium, a real public park, a real stadium-arena — would be
// fabricating a parallel answer to a question these three already
// answer. `YOUTH_PROGRAM_CATEGORIES` is those three, named rather than
// invented.
//
// ---------------------------------------------------------------------
// The trigger reuses `recruitment.js`'s own real danger measure and
// real rate, rather than inventing a second "chaos has erupted"
// threshold
// ---------------------------------------------------------------------
// `recruitment.js`'s own header already argues this at length (the
// seventeenth standing rule's own case study, applied once already): a
// hard gate rolled every tick against a real, moving measure is the
// `keys.resolveAggression` trap, and `crime.dangerByCommunity`'s real
// 0..1 score scales a flat base rate directly instead. This pass is
// the identical real class of event ("once chaos starts to erupt,
// there will be a lot of recruitment") one real idle-youth gate
// narrower, so it reuses `recruitment.BASE_RECRUITMENT_RISK` verbatim
// rather than defining a second constant at the same value under a new
// name.

'use strict';

const crime = require('./crime.js');
const control = require('./control.js');
const property = require('./property.js');
const recruitment = require('./recruitment.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

// Real, already-existing landmark categories that cover a real youth
// recreation/education function — see this file's own header for why
// no fourth, invented category joins them.
const YOUTH_PROGRAM_CATEGORIES = ['school', 'park', 'stadium-arena'];

// At least one real idle youth actually resident here — `crime.
// isIdleYouth`, built for task #166, is the real, already-measured
// condition this pass answers rather than a second population scan.
function idleYouthPresent(worldState, communityId, tick) {
  return (worldState.npcs || []).some(
    (n) => n.communityId === communityId && crime.isIdleYouth(worldState, n, tick),
  );
}

// Every real family with at least one living member resident in this
// community — the same "who is here" question `control.
// residentsOfCommunity` answers for individuals, one join further to
// the family that resident belongs to.
function familiesResidentIn(worldState, communityId) {
  const residentIds = new Set(
    (worldState.npcs || [])
      .filter((n) => n.communityId === communityId)
      .map((n) => n.id),
  );
  const familyIds = new Set(
    (worldState.familyMemberships || [])
      .filter((m) => residentIds.has(m.entity_id))
      .map((m) => m.family_id),
  );
  return (worldState.families || []).filter((f) => familyIds.has(f.id));
}

// Real youth-program-capable properties in this community this family
// does not already hold — `property.getCurrentOwner` is the real,
// already-built ownership read (append-only `ownershipRecords`), so a
// building this tribe already took over here is not offered again.
function youthFacilityTargetsIn(worldState, communityId, tribeId) {
  return (worldState.properties || []).filter((p) => p.community_id === communityId
    && YOUTH_PROGRAM_CATEGORIES.includes(p.landmark_category)
    && property.getCurrentOwner(worldState, p.id)?.owner_entity_id !== tribeId);
}

// One real pass: for every community with real idle youth and a real,
// measured danger score, every real resident family gets one real
// seeded draw at `recruitment.js`'s own chaos rate against that score.
// On a hit, the real target this family is actually closest to
// fielding — `control.assess`'s own `finalSuccessProbability`, never
// array order — is the one it attempts, through the identical real
// `control.attempt` every other tribe takeover in this engine already
// goes through.
function runYouthProgramTakeovers(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const danger = crime.dangerByCommunity(worldState, { tick });
  const attempts = [];

  for (const community of worldState.communities || []) {
    const dangerScore = danger.get(community.id);
    if (!dangerScore) continue;
    if (!idleYouthPresent(worldState, community.id, tick)) continue;

    for (const family of familiesResidentIn(worldState, community.id)) {
      const targets = youthFacilityTargetsIn(worldState, community.id, family.id);
      if (targets.length === 0) continue;

      const chance = recruitment.BASE_RECRUITMENT_RISK * dangerScore;
      const draw = seededDraw([family.id, community.id, tick, 'youth-program-takeover']);
      if (draw >= chance) continue;

      let best = null;
      let bestProbability = -1;
      for (const target of targets) {
        const resolution = control.assess(worldState, {
          scale: 'property', locationId: target.id, tribeId: family.id, tick,
        });
        if (resolution === null) continue;
        if (resolution.finalSuccessProbability > bestProbability) {
          best = target;
          bestProbability = resolution.finalSuccessProbability;
        }
      }
      if (best === null) continue;

      const result = control.attempt(worldState, {
        scale: 'property', locationId: best.id, tribeId: family.id, tick,
      });
      if (result === null) continue;

      worldStore.addHistoricalRecord(worldState, {
        event_type: 'youth_program_takeover',
        description: `${family.surname ? `the ${family.surname}` : `family ${family.id}`} `
          + `${result.succeeded ? 'takes over' : 'fails to take over'} ${best.landmark_category} `
          + `${best.id} to give the community's idle youth somewhere to be`
          + `${community.name ? ` in ${community.name}` : ''}`,
        when_tick: tick,
        participants: result.events[0].affected_entity_ids,
        where_location_id: best.id,
      });

      attempts.push({
        familyId: family.id,
        communityId: community.id,
        propertyId: best.id,
        category: best.landmark_category,
        succeeded: result.succeeded,
      });
    }
  }

  return attempts;
}

module.exports = {
  YOUTH_PROGRAM_CATEGORIES,
  idleYouthPresent,
  familiesResidentIn,
  youthFacilityTargetsIn,
  runYouthProgramTakeovers,
};
