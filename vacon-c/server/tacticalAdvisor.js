// server/tacticalAdvisor.js
//
// By direct instruction: "make sure everything is AI activated so
// that, like I said, let's say they're breaking into or they're going
// to invade a hotel, but you want to send two to the back door, three
// to a window. These are all options provided to you by AI, depending
// on what your team characteristics and statistics look like."
//
// ---------------------------------------------------------------------
// "AI" here means the identical real, weighted composite this engine
// already uses for every other recommendation — never a dice roll
// ---------------------------------------------------------------------
// `influenceRatingOf`, `espionageAptitudeOf`, `robberyAptitudeOf` are
// all the same shape: real, already-generated traits, weighted to sum
// to 1.0, centred on the trait scale's own neutral 50 for an unmeasured
// value. `approachAptitudeOf` is that shape a fourth time, over three
// real approach TYPES rather than one single score — which is the
// actual content of "options provided to you depending on what your
// team's statistics look like": a real per-person best-fit, not an
// invented tactical simulation.
//
// ---------------------------------------------------------------------
// "Back door" and "window" are the PLAYER's own narrative labels, not
// a new building schema
// ---------------------------------------------------------------------
// Nothing in `VACANCY_POSTGRESQL_SCHEMA.sql` or `property.js` names a
// door, a window, or any other specific point of entry on a building,
// and inventing one here would be asserting a fact about every
// generated property's floor plan nobody modelled. `APPROACH_TYPES`
// is a small, bounded, real GAME MECHANIC vocabulary instead — the
// same kind of invented-but-honest vocabulary `espionage.js`'s own
// `stance` (`low_profile`/`close_watch`/`deep_infiltration`) already
// is: `stealth_entry` (quiet, careful — a back door, a window, however
// the player wants to narrate it), `forced_entry` (loud, physical),
// `social_entry` (talk or blend past whoever is watching). A target
// property's own real `floors` is read only to REPORT how many
// separate physical approach points a building that size plausibly
// has (`physicalApproachSlots`), never to fabricate that it has
// exactly one of each.
//
// ---------------------------------------------------------------------
// Advisory only — applying it reuses the real compliance/authority
// chain already built, never a second one
// ---------------------------------------------------------------------
// `recommendSplit` is a pure read: it touches nothing, needs no
// authority check, the same posture `heists.js#successChanceFor`
// already has. `applyRecommendedSplit` is the one place anything
// moves, and it moves through `party.assignPartyRole` — the real
// current-escort check, then `leadership.assignRole`'s own real
// compliance draw and influence consequence — for every real
// assignment, one call per person. Agreeing to escort (joining the
// party) and agreeing to go through a specific window are two
// different real decisions; collapsing them into one would silently
// make joining a party mean "will do anything," which nothing else in
// this engine's compliance model does. A family-sponsored party
// inherits `assignRole`'s own real, pre-existing restriction to its
// five assignable roles and will refuse a tactical role string for
// that reason — a known, honest limitation, not special-cased around
// here.

'use strict';

const party = require('./party.js');
const property = require('./property.js');
const { getLiveEntity } = require('./entityTraits.js');

const APPROACH_TYPES = ['stealth_entry', 'forced_entry', 'social_entry'];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function neutral(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 50;
}

function approachAptitudeOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const stealth = neutral(live?.traits?.criminal?.Stealth);
  const tacticalAwareness = neutral(live?.traits?.combat?.['Tactical Awareness']);
  const deception = neutral(live?.traits?.criminal?.Deception);
  const persuasion = neutral(live?.traits?.social?.Persuasion);
  const meleeSkill = neutral(live?.traits?.combat?.['Melee Skill']);
  const weaponMastery = neutral(live?.traits?.combat?.['Weapon Mastery']);

  return {
    stealth_entry: 0.6 * stealth + 0.4 * tacticalAwareness,
    forced_entry: 0.5 * meleeSkill + 0.3 * weaponMastery + 0.2 * tacticalAwareness,
    social_entry: 0.6 * deception + 0.4 * persuasion,
  };
}

// How many separate real physical approach points a target this size
// plausibly has — reported, never enforced, since `social_entry`
// needs no physical point at all. `null` when no real target/floors
// were given, the same "unmeasured, not zero" posture this engine
// holds everywhere else.
function physicalApproachSlotsFor(worldState, targetPropertyId) {
  if (targetPropertyId == null) return null;
  const target = (worldState.properties || []).find((p) => p.id === Number(targetPropertyId));
  if (!target) return null;
  const floors = Number(target.floors);
  if (!Number.isFinite(floors) || floors < 1) return null;
  return clamp(floors, 1, 2);
}

function recommendSplit(worldState, leaderEntityId, options = {}) {
  const { targetPropertyId = null, includeLeader = true } = options;

  const escorts = party.partyOf(worldState, leaderEntityId).map((n) => n.id);
  const teamIds = includeLeader
    ? [...new Set([Number(leaderEntityId), ...escorts])]
    : escorts;

  if (teamIds.length === 0) {
    throw new Error('recommendSplit: this leader has no real party to split.');
  }

  const aptitudes = {};
  for (const id of teamIds) aptitudes[id] = approachAptitudeOf(worldState, id);

  const groups = { stealth_entry: [], forced_entry: [], social_entry: [] };
  for (const id of teamIds) {
    const own = aptitudes[id];
    const best = APPROACH_TYPES.reduce((bestType, type) => {
      if (own[type] > own[bestType]) return type;
      if (own[type] === own[bestType]
        && groups[type].length < groups[bestType].length) return type;
      return bestType;
    }, APPROACH_TYPES[0]);
    groups[best].push(id);
  }

  return {
    groups,
    aptitudes,
    physicalApproachSlots: physicalApproachSlotsFor(worldState, targetPropertyId),
  };
}

function applyRecommendedSplit(worldState, leaderEntityId, recommendation, tick) {
  const results = {};
  for (const approachType of APPROACH_TYPES) {
    for (const memberId of recommendation.groups[approachType] || []) {
      if (memberId === Number(leaderEntityId)) continue;
      results[memberId] = party.assignPartyRole(worldState, leaderEntityId, memberId, approachType, tick);
    }
  }
  return results;
}

module.exports = {
  APPROACH_TYPES,
  approachAptitudeOf,
  physicalApproachSlotsFor,
  recommendSplit,
  applyRecommendedSplit,
};
