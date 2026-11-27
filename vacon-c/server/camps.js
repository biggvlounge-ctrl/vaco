// server/camps.js
//
// By direct instruction: off-grid wilderness camps — woods, caves,
// lakes — for groups who go off-grid after the chaos hits. The real
// group is `party.partyOf`'s own real roster, exactly the "group"
// `travel.js` already established rather than a second one invented
// here; a camp is not gated on having no real home first, the same
// openness `assembleParty` already has — nothing says only a
// genuinely homeless person may camp.
//
// ---------------------------------------------------------------------
// Three camp types, three different real answers, checked rather
// than assumed uniform
// ---------------------------------------------------------------------
// **`cave` is gated on a real, already-generated landmark.**
// `landmarks.js` already carries `'cave-system'`/`'natural-formation'`
// as real Key categories (`THE_KEY_BUILDING_TYPES.md`'s own
// "skyscrapers, churches, schools, hospitals, caves"), each a real
// `properties` row with a real `community_id` — the identical field
// `hiddenCaches.js` already reads to place a cache. A `cave` camp is
// refused outright when no such landmark exists in the named
// community, never invented as a site with nothing behind it.
//
// **`woods` closes a real, standing gap rather than inventing a
// signal.** `city.landCoverClass` — a real EarthEnv Consensus Land-
// Cover class, written at generation whenever a `landCoverPack`
// covers a city — had been read by NOTHING in `server/*.js` since the
// forty-third standing rule wrote it; `grep -rn "landCoverClass"
// server/*.js` before this file confirmed it. `FOREST_CLASSES`
// (`landCoverPacks.js`'s own five of the twelve published classes) is
// what a `woods` camp checks: a city whose real class disagrees is
// refused, and a city with no real land-cover pack at all is not —
// the same "narrow a real signal, never require one" posture
// `riskPacks.js`/`crimeHotspotPacks.js` already hold.
//
// **`lake` is honestly ungated, because no real signal exists here to
// gate it on — checked, not assumed.** Tuanmu & Jetz's twelve
// published Consensus Land-Cover classes have no open-water class at
// all (satellite land cover classifies LAND; a lake is masked out of
// the product entirely), so there is nothing in this registry's own
// `landCoverPacks.js` a `lake` camp could check against. Declared
// here rather than faked with a class that does not mean what the
// label would imply.
//
// ---------------------------------------------------------------------
// What this file deliberately does NOT add
// ---------------------------------------------------------------------
// No resource-consumption pass. `travel.js`'s own daily food/water
// draw answers a different request ("resource consumption over
// distance/TIME" while in transit); nothing in this request asked for
// ongoing survival pressure at a camp that already exists, and
// inventing one here would be exactly the kind of mechanic nobody
// asked for this registry's own discipline exists to avoid. A camped
// member can still be searched, traded with, and reached by every
// other real mechanic through the camp's own `locationPropertyId`
// (for a `cave` camp) or `communityId` — no new verbs needed for that,
// `search-location` and the rest already work on a real property or
// community id.
//
// No change to `motivation.js`'s housing need. Whether living at a
// camp should satisfy it is a real design question this request did
// not ask, and answering it silently here would quietly recalibrate a
// system this project's own twelfth standing rule already warns about
// touching without measuring first.
//
// ---------------------------------------------------------------------
// How this is effective — by direct follow-up instruction: "how that
// could be effective." Reuses `policing.js#evasionOf`, never a second
// detection model
// ---------------------------------------------------------------------
// `policing.evasionOf` already composes a skill base with a
// SITUATIONAL bonus for `disguise.isDisguised` — "the same skilled
// thief is harder to pin down wearing [a mask] than not," disguise.js's
// own words. Living off-grid is the identical kind of fact one level
// up: nobody at a real camp has a known address `policing.
// clearanceChance`'s own victim/witness/capacity terms could be run
// against, the same real reason a fugitive going off-grid is harder to
// locate than one who stays at a registered home. `CAMP_EVASION_BONUS`
// is deliberately the exact same value as `disguise.
// DISGUISE_EVASION_BONUS` — not a second invented number for a
// comparable real claim, the identical reuse disguise.js's own header
// already did borrowing from `policing.VICTIM_BONUS`. Reaches
// `evasionOf`'s every real consumer for free (victim/bystander witness
// confidence AND clearance chance) rather than a second check added to
// each — the same "one real number, many consumers" shape disguise.js
// itself established. All three camp types (woods/cave/lake) grant the
// identical bonus: the real common fact that matters here is "not at
// any known address," which every camp type shares equally — inventing
// a per-type split would assert a distinction `policing.js`'s own
// address-based clearance model has no way to use.

'use strict';

const party = require('./party.js');
const landCoverPacks = require('./landCoverPacks.js');

const CAMP_TYPES = ['woods', 'cave', 'lake'];

//: The two real `landmarks.js` Key categories a `cave` camp may sit
//: on — duplicated here as a short, explicit list rather than reached
//: for through a `landmarks.js` require, the same self-contained
//: posture `landCoverPacks.js`'s own `FOREST_CLASSES` duplicate takes.
const CAVE_LANDMARK_CATEGORIES = ['cave-system', 'natural-formation'];

//: Reused as-is from `disguise.DISGUISE_EVASION_BONUS` — see this
//: file's own header above for why this is the same number rather
//: than a second invented one.
const CAMP_EVASION_BONUS = 0.2;

let nextCampId = 1;

function communityExists(worldState, communityId) {
  return (worldState.communities || []).some((c) => c.id === Number(communityId));
}

function cityOf(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === Number(communityId));
  if (!community) return null;
  return (worldState.cities || []).find((c) => c.id === community.city_id) ?? null;
}

// A real cave/natural-formation landmark already generated in this
// community, or null. Never invented when none exists.
function caveLandmarkIn(worldState, communityId) {
  return (worldState.properties || []).find(
    (p) => p.community_id === Number(communityId) && CAVE_LANDMARK_CATEGORIES.includes(p.landmark_category),
  ) ?? null;
}

// `true`/`false` only when a real land-cover pack actually covers this
// community's own city; `null` (unknown, not a refusal) otherwise —
// the same "unobserved is not a zero" discipline this registry holds
// everywhere else.
function hasRealForestSignal(worldState, communityId) {
  const city = cityOf(worldState, communityId);
  if (!city || city.landCoverClass == null) return null;
  return landCoverPacks.FOREST_CLASSES.includes(city.landCoverClass);
}

function activeCampFor(worldState, entityId) {
  return (worldState.camps || []).find(
    (c) => c.active && c.memberEntityIds.includes(Number(entityId)),
  ) ?? null;
}

function campOf(worldState, campId) {
  return (worldState.camps || []).find((c) => c.id === Number(campId)) ?? null;
}

function membersFor(worldState, founderEntityId) {
  const partyIds = party.partyOf(worldState, founderEntityId).map((n) => n.id);
  return [...new Set([Number(founderEntityId), ...partyIds])];
}

function establishCamp(worldState, founderEntityId, options = {}) {
  const { communityId, campType, tick = worldState.tick ?? 0 } = options;
  if (!CAMP_TYPES.includes(campType)) {
    throw new Error(`establishCamp: campType must be one of ${CAMP_TYPES.join(', ')}.`);
  }
  if (communityId == null || !communityExists(worldState, communityId)) {
    throw new Error(`establishCamp: no real community ${communityId}.`);
  }

  const founder = (worldState.npcs || []).find((n) => n.id === Number(founderEntityId));
  if (!founder) throw new Error(`establishCamp: entity ${founderEntityId} is not among the living.`);

  const members = membersFor(worldState, founderEntityId);
  for (const id of members) {
    if (activeCampFor(worldState, id)) {
      throw new Error(`establishCamp: entity ${id} is already at a real camp.`);
    }
  }

  let locationPropertyId = null;
  if (campType === 'cave') {
    const landmark = caveLandmarkIn(worldState, communityId);
    if (!landmark) {
      throw new Error(`establishCamp: no real cave-system or natural-formation landmark in community ${communityId}.`);
    }
    locationPropertyId = landmark.id;
  } else if (campType === 'woods') {
    const signal = hasRealForestSignal(worldState, communityId);
    if (signal === false) {
      throw new Error(`establishCamp: community ${communityId}'s own real land-cover class is not a forest class.`);
    }
  }
  // 'lake' has no real signal to check — see this file's own header.

  worldState.camps = worldState.camps || [];
  const camp = {
    id: nextCampId++,
    founderEntityId: Number(founderEntityId),
    memberEntityIds: members,
    communityId: Number(communityId),
    campType,
    locationPropertyId,
    establishedTick: tick,
    active: true,
  };
  worldState.camps.push(camp);
  return camp;
}

// Joining is a free real act, not a persuasion draw — a camp is a
// shared living arrangement somebody walks into, not a subordinate
// obeying a leader the way `assembleParty`'s compliance draw models.
function joinCamp(worldState, campId, entityId) {
  const camp = campOf(worldState, campId);
  if (!camp || !camp.active) throw new Error(`joinCamp: no real active camp ${campId}.`);
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc) throw new Error(`joinCamp: entity ${entityId} is not among the living.`);
  if (activeCampFor(worldState, entityId)) {
    throw new Error(`joinCamp: entity ${entityId} is already at a real camp.`);
  }
  camp.memberEntityIds.push(Number(entityId));
  return camp;
}

function leaveCamp(worldState, entityId) {
  const camp = activeCampFor(worldState, entityId);
  if (!camp) throw new Error(`leaveCamp: entity ${entityId} is not currently at a real camp.`);
  camp.memberEntityIds = camp.memberEntityIds.filter((id) => id !== Number(entityId));
  if (camp.memberEntityIds.length === 0) camp.active = false;
  return { left: Number(entityId), campStillActive: camp.active };
}

// Only the founder can strike the whole camp — the same single-
// authority shape `releaseFromParty`'s own leader-only release holds,
// one level up (the camp itself, not one member of it).
function breakCamp(worldState, campId, founderEntityId) {
  const camp = campOf(worldState, campId);
  if (!camp || !camp.active) throw new Error(`breakCamp: no real active camp ${campId}.`);
  if (camp.founderEntityId !== Number(founderEntityId)) {
    throw new Error(`breakCamp: entity ${founderEntityId} did not found camp ${campId}.`);
  }
  camp.active = false;
  return camp;
}

module.exports = {
  CAMP_TYPES,
  CAVE_LANDMARK_CATEGORIES,
  CAMP_EVASION_BONUS,
  caveLandmarkIn,
  hasRealForestSignal,
  activeCampFor,
  campOf,
  membersFor,
  establishCamp,
  joinCamp,
  leaveCamp,
  breakCamp,
};
