// server/groupFights.js
//
// Group combat (gang wars, organized brawls) — by direct instruction:
// "a fight, 5 on 10... if a player is hurt badly, it shows... they can
// choose to continue the fight at a handicap, or they can leave and go
// to whatever hospital... if they end up dying, those characters stay
// off the system for a certain amount of time... they would come back
// quicker from a hospital leave than they would from a death."
// Explicit design goals, stated directly: realistic, not mass death;
// people are not trying to die; a fight can be "called in" and
// stopped before it goes that far.
//
// ---------------------------------------------------------------------
// The team rating is REUSED, not invented — contest.js already rates
// combat
// ---------------------------------------------------------------------
// `contest.js`'s own header found this exact gap once already: a real
// `combat` trait family (Melee Skill, Ranged Skill, Tactical
// Awareness, Bloodlust, Composure Under Fire, Weapon Mastery)
// generated on every NPC, read by nothing, until `contest.rateEntity`
// gave it a real weighted rating for one-on-one bouts. Its own header
// already made the one decision this file would otherwise have had to
// re-derive: "Bloodlust is deliberately absent from `combat`: it
// describes appetite for violence, not skill at it, and weighting it
// would make a bloodthirsty novice beat a disciplined professional."
// `teamRatingOf` is the mean of `contest.rateEntity(..., 'combat')`
// across a side — the identical rating, the identical scale,
// identical reasons, now averaged over a group instead of read for
// one person. `contest.winProbability` (a logistic already calibrated
// against this exact rating scale — a +30 edge wins about 9 times in
// 10, never 10) decides which SIDE wins, reused rather than a second,
// disagreeing formula invented here.
//
// ---------------------------------------------------------------------
// Size is a real, bounded RATIO term, not a second rating system
// ---------------------------------------------------------------------
// The nineteenth standing rule's own lesson — a composition read as a
// RATIO against whoever holds the ground now, not copied into a fixed
// constant — applies here one level over: `sizeEdgeFor` converts the
// DIFFERENCE in side sizes into a bounded rating-equivalent bonus
// (`SIZE_EDGE_PER_EXTRA_MEMBER`, flagged interpretive, capped at
// `SIZE_EDGE_CAP` so a mismatched mob is a real advantage, never an
// automatic, certain massacre).
//
// ---------------------------------------------------------------------
// Severity is the real ask: injured is the expected outcome, death is
// the rare tail, and an area with real authority can stop it first
// ---------------------------------------------------------------------
// Every rate below is flagged interpretive — no document gives a real
// gang-fight fatality rate — but anchored the same way this file's
// neighbours already are: this engine's OWN measured violent-offence
// rate is already far below its theft rate (the seventeenth standing
// rule's own case study), so a mechanism that made ordinary group
// violence routinely lethal would disagree with a number this project
// already calibrated. The real worst case this formula can produce —
// `DEATH_BASE_CHANCE` (0.04) plus the full margin and Bloodlust terms
// — is 0.165, and the small `DEATH_BASE_CHANCE` itself is the stated
// design goal in numbers: most people who lose a fight get hurt, not
// killed.
//
// "Called in and stopped" reuses `authority.writOf` directly rather
// than inventing a second notion of how much real authority reaches a
// place — its own `.writ` is already a real [0,1] measure of exactly
// that, the same number `authority.regimeFor` thresholds into
// governed/contested/lawless. A real draw against it, checked BEFORE
// severity is ever rolled, is the realistic version of "somebody calls
// it in": a governed area has a real, measured chance the fight never
// gets the chance to hurt anyone; a lawless one does not.
//
// ---------------------------------------------------------------------
// Hospitalization mirrors imprisonment's own real shape, on purpose
// ---------------------------------------------------------------------
// `justice.imprison` is the established pattern for "this person is
// genuinely unavailable, with a real release tick" — `npc.status`
// carries the state, a separate real record carries the release tick,
// and a pass inside the tick pipeline releases people once it passes.
// `hospitalize`/`advanceHospitalStays` are the identical shape, not a
// second invented one, and `HOSPITAL_RECOVERY_TICKS` is deliberately
// far shorter than any real prison sentence — the explicit ask was
// "they would come back quicker from a hospital leave than... a
// death," and death's own real cost is permanent for that character
// (killEntity), never a timed return at all.
//
// **It doesn't have to be a literal hospital, by direct instruction —
// "you go to a house and somebody could assist you," and keeping a
// real nurse or physician in-house speeds the whole thing up.**
// `recoveryPlanFor` checks the patient's own real organization AND
// family members first (`householdOf`) for a real, currently-employed
// `nurse`/`physician` among them — real occupations `occupations.js`
// already defines, not an invented medical-staff flag — and grants the
// faster `IN_HOUSE_RECOVERY_TICKS` when one is found. Otherwise it
// looks for a real referral anywhere else in the world ("your nurse or
// organization doctor will tell you to go to a specific doctor...
// maybe in a different tribe or a hospital or a different town") —
// found or not, the ticks stay at the unstaffed `HOSPITAL_RECOVERY_
// TICKS` default, because travelling to a real specialist buys real
// expertise but not real speed; only keeping one at home does, which
// is the one concrete incentive this adds for building up a tribe's
// own medical staff.
//
// ---------------------------------------------------------------------
// Continuing at a handicap is the one real CHOICE, and it is opt-IN
// ---------------------------------------------------------------------
// The safe outcome (hospitalized, recovering) is what already happens
// to an injured loser by default — nobody has to ask for it. Choosing
// to keep fighting is the exception, so it is the one new verb:
// `continueFight` pulls a hospitalized survivor back out and re-rolls
// them, alone, against the side that just beat them, at a real,
// bounded rating penalty (`CONTINUE_FIGHT_RATING_PENALTY`) for
// fighting hurt. That is the whole mechanism for "it's better to go
// to the hospital than to go all the way to your defeat" — the
// default is safer, and the player has to actively choose the riskier
// path for it to apply.

'use strict';

const contest = require('./contest.js');
const authority = require('./authority.js');
const mortality = require('./mortality.js');
const crime = require('./crime.js');
const membership = require('./membership.js');
const { seededDraw } = require('./seeded.js');
const { getLiveEntity } = require('./entityTraits.js');

const SIZE_EDGE_PER_EXTRA_MEMBER = 2;
const SIZE_EDGE_CAP = 20;

// No separate "cap" constant sits on top of these -- a first version
// had one (0.25 for death, 0.85 for injury) and a direct test of the
// worst real input this model can produce (margin 1, Bloodlust 100)
// found neither ever reachable: the weighted terms below only ever sum
// to 0.165 for death and 0.75 for injury, both already short of a
// cap that could never bind. A clamp that never activates is
// decorative, not a guard (the twentieth standing rule's own shape),
// so the real ceiling is just the weighted sum of these constants
// themselves -- read DEATH_BASE_CHANCE + DEATH_MARGIN_WEIGHT +
// DEATH_BLOODLUST_WEIGHT/2 for the true worst case, not a separate
// number that has to be kept in sync with it by hand.
const DEATH_BASE_CHANCE = 0.04;
const DEATH_MARGIN_WEIGHT = 0.10;
const DEATH_BLOODLUST_WEIGHT = 0.05;

const INJURED_BASE_CHANCE = 0.55;
const INJURED_MARGIN_WEIGHT = 0.20;

const HOSPITAL_RECOVERY_TICKS = 5;
const CONTINUE_FIGHT_RATING_PENALTY = 15;

// **"It doesn't have to be a hospital stay... you go to a house and
// somebody could assist you" — by direct instruction, extending the
// recovery half rather than the fight half.** `occupations.js` already
// carries `nurse` (real SOC 29-1141) and `physician` (real SOC
// 29-1xxx, this engine's own real `hospital`/`government` defining
// post) as real, drawable occupations — the real substrate this reads
// rather than a second, invented medical-staff vocabulary.
const MEDICAL_POSITIONS = ['nurse', 'physician'];

// Faster than the unstaffed default, on purpose: this is the real,
// concrete reward for a tribe or organization actually having kept a
// nurse or physician among its own living members — "this also helps
// by having this in-house... it helps things speed up the process,"
// in the user's own words. Flagged interpretive, same honesty as
// HOSPITAL_RECOVERY_TICKS, chosen strictly less than it rather than
// against any cited recovery-time ratio.
const IN_HOUSE_RECOVERY_TICKS = 2;

// Every living member of a real organization or family this entity
// actually belongs to — the real household/tribe a patched-up fighter
// would actually be surrounded by, not an invented "medical roster".
function householdOf(worldState, entityId) {
  const orgMemberIds = membership.organizationsOf(worldState, entityId)
    .flatMap((org) => membership.membersOf(worldState, org.id).map((n) => n.id));
  const familyId = (worldState.familyMemberships || [])
    .find((m) => m.entity_id === entityId)?.family_id;
  const familyMemberIds = familyId === undefined
    ? []
    : (worldState.familyMemberships || [])
      .filter((m) => m.family_id === familyId)
      .map((m) => m.entity_id);
  return new Set([...orgMemberIds, ...familyMemberIds].filter((id) => id !== entityId));
}

// A real, living, currently-employed nurse or physician among a real
// set of candidate entities, or null.
function medicAmong(worldState, candidateIds) {
  const medic = (worldState.employmentRecords || []).find(
    (r) => r.status === 'active' && MEDICAL_POSITIONS.includes(r.position)
      && candidateIds.has(r.entity_id),
  );
  return medic ? medic.entity_id : null;
}

// Who actually treats this person, and how long it really takes —
// in-house first (the patient's own real tribe/organization/family),
// then a real referral anywhere else in the world ("your nurse or
// organization doctor will tell you to go to a specific doctor...
// maybe in a different tribe or a hospital or a different town").
// A referral still finds a REAL specialist rather than an invented
// one, but travelling to them buys no speed -- only keeping one
// in-house does, which is the one real incentive this round adds.
function recoveryPlanFor(worldState, entityId) {
  const inHouse = medicAmong(worldState, householdOf(worldState, entityId));
  if (inHouse !== null) {
    return { ticks: IN_HOUSE_RECOVERY_TICKS, treatedBy: inHouse, referred: false };
  }
  const elsewhere = (worldState.employmentRecords || []).find(
    (r) => r.status === 'active' && MEDICAL_POSITIONS.includes(r.position) && r.entity_id !== entityId,
  );
  return {
    ticks: HOSPITAL_RECOVERY_TICKS,
    treatedBy: elsewhere ? elsewhere.entity_id : null,
    referred: !!elsewhere,
  };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function teamRatingOf(worldState, entityIds) {
  const ratings = entityIds.map((id) => contest.rateEntity(worldState, id, 'combat').rating);
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

function sizeEdgeFor(sideCount, otherSideCount) {
  return clamp((sideCount - otherSideCount) * SIZE_EDGE_PER_EXTRA_MEMBER, -SIZE_EDGE_CAP, SIZE_EDGE_CAP);
}

function meanBloodlustOf(worldState, entityIds) {
  const values = entityIds
    .map((id) => Number(getLiveEntity(worldState, id)?.traits?.combat?.Bloodlust))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return 50;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function hospitalize(worldState, entityId, tick) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return null;
  npc.status = 'hospitalized';
  const plan = recoveryPlanFor(worldState, entityId);
  const record = {
    entityId,
    admittedTick: tick,
    releaseTick: tick + plan.ticks,
    cause: 'group-fight',
    treatedBy: plan.treatedBy,
    referred: plan.referred,
  };
  (worldState.hospitalStays || (worldState.hospitalStays = [])).push(record);
  return record;
}

function isHospitalized(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  return !!npc && npc.status === 'hospitalized';
}

// Real release pass, the identical shape `justice.js`'s own sentence
// release already holds — called from the tick pipeline's Security
// phase, next to every other real advancement this engine runs once
// a tick.
function advanceHospitalStays(worldState, tick) {
  const released = [];
  for (const stay of worldState.hospitalStays || []) {
    if (stay.releaseTick > tick) continue;
    const npc = (worldState.npcs || []).find((n) => n.id === stay.entityId);
    if (npc && npc.status === 'hospitalized') {
      npc.status = 'active';
      released.push(stay.entityId);
    }
  }
  return released;
}

function severityFor(worldState, {
  loserId, loserRating, winningTeamRating, winningBloodlust, draw,
}) {
  const margin = clamp((winningTeamRating - loserRating) / 100, 0, 1);
  const deathChance = clamp(
    DEATH_BASE_CHANCE + margin * DEATH_MARGIN_WEIGHT + ((winningBloodlust - 50) / 100) * DEATH_BLOODLUST_WEIGHT,
    0,
    1,
  );
  const injuredChance = clamp(INJURED_BASE_CHANCE + margin * INJURED_MARGIN_WEIGHT, 0, 1);
  if (draw < deathChance) return 'dead';
  if (draw < deathChance + injuredChance) return 'injured';
  return 'unharmed';
}

function resolveGroupFight(worldState, options = {}) {
  const {
    sideA, sideB, communityId = null, tick = worldState.tick ?? 0, contestId = null,
  } = options;

  if (!Array.isArray(sideA) || sideA.length === 0 || !Array.isArray(sideB) || sideB.length === 0) {
    throw new Error('resolveGroupFight requires non-empty sideA and sideB.');
  }
  const overlap = sideA.filter((id) => sideB.includes(id));
  if (overlap.length > 0) {
    throw new Error(`resolveGroupFight: entity ${overlap[0]} cannot fight on both sides.`);
  }

  const ratingA = teamRatingOf(worldState, sideA) + sizeEdgeFor(sideA.length, sideB.length);
  const ratingB = teamRatingOf(worldState, sideB) + sizeEdgeFor(sideB.length, sideA.length);
  const probabilityA = contest.winProbability(ratingA, ratingB);

  const draw = seededDraw([
    worldState.seed ?? 'world', 'group-fight', contestId, tick, ...sideA, ...sideB,
  ]);
  const sideAWins = draw < probabilityA;
  const winningIds = sideAWins ? sideA : sideB;
  const losingIds = sideAWins ? sideB : sideA;
  const winningTeamRating = sideAWins ? ratingA : ratingB;

  const writ = communityId === null ? null : authority.writOf(worldState, communityId);
  const interventionChance = writ && writ.writ !== null ? writ.writ : 0;
  const intervened = seededDraw([
    worldState.seed ?? 'world', 'group-fight-intervention', contestId, tick,
  ]) < interventionChance;

  const outcomes = [];
  if (!intervened) {
    const winningBloodlust = meanBloodlustOf(worldState, winningIds);
    for (const loserId of losingIds) {
      const loserRating = contest.rateEntity(worldState, loserId, 'combat').rating;
      const severityDraw = seededDraw([
        worldState.seed ?? 'world', 'group-fight-severity', contestId, tick, loserId,
      ]);
      const severity = severityFor(worldState, {
        loserId, loserRating, winningTeamRating, winningBloodlust, draw: severityDraw,
      });
      if (severity === 'dead') {
        mortality.killEntity(worldState, { entityId: loserId, killerId: winningIds[0], tick });
      } else if (severity === 'injured') {
        hospitalize(worldState, loserId, tick);
      }
      outcomes.push({ entityId: loserId, severity });
    }
  } else {
    for (const loserId of losingIds) outcomes.push({ entityId: loserId, severity: 'unharmed' });
  }

  const incident = crime.recordCrime(worldState, {
    category: 'violent',
    perpetratorId: winningIds[0],
    victimId: losingIds[0],
    // Passed through only when real -- `recordCrime` treats an
    // explicit `null` as "no community", not as "derive one", so
    // omitting the key entirely for a caller who gave none keeps its
    // own real auto-derivation from perpetrator/victim intact.
    ...(communityId !== null ? { communityId } : {}),
    tick,
    detail: `a ${sideA.length}-vs-${sideB.length} group fight${intervened ? ' (stopped before anyone was hurt)' : ''}`,
  });

  return {
    sideA, sideB, winningSide: sideAWins ? 'A' : 'B', winningIds, losingIds,
    ratingA, ratingB, probabilityA, intervened, outcomes, incidentId: incident.id,
  };
}

// The one real player choice: pull a hospitalized survivor back out
// and re-roll them, alone, against the side that just beat them, at a
// real penalty for fighting hurt. The safe default -- staying
// hospitalized -- needs no call at all.
function continueFight(worldState, options = {}) {
  const { entityId, winningIds, communityId = null, tick = worldState.tick ?? 0, contestId = null } = options;
  if (!isHospitalized(worldState, entityId)) {
    throw new Error(`continueFight: entity ${entityId} is not hospitalized from a group fight.`);
  }
  const stay = (worldState.hospitalStays || []).find(
    (s) => s.entityId === entityId && s.releaseTick > tick,
  );
  if (stay) stay.releaseTick = tick;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (npc) npc.status = 'active';

  const loserRating = contest.rateEntity(worldState, entityId, 'combat').rating - CONTINUE_FIGHT_RATING_PENALTY;
  const winningTeamRating = teamRatingOf(worldState, winningIds);
  const winningBloodlust = meanBloodlustOf(worldState, winningIds);
  const severityDraw = seededDraw([
    worldState.seed ?? 'world', 'group-fight-continue', contestId, tick, entityId,
  ]);
  const severity = severityFor(worldState, {
    loserId: entityId, loserRating, winningTeamRating, winningBloodlust, draw: severityDraw,
  });

  if (severity === 'dead') {
    mortality.killEntity(worldState, { entityId, killerId: winningIds[0], tick });
  } else if (severity === 'injured') {
    hospitalize(worldState, entityId, tick);
  }

  return { entityId, severity, handicapRating: loserRating };
}

module.exports = {
  SIZE_EDGE_PER_EXTRA_MEMBER,
  SIZE_EDGE_CAP,
  DEATH_BASE_CHANCE,
  DEATH_MARGIN_WEIGHT,
  DEATH_BLOODLUST_WEIGHT,
  INJURED_BASE_CHANCE,
  INJURED_MARGIN_WEIGHT,
  HOSPITAL_RECOVERY_TICKS,
  CONTINUE_FIGHT_RATING_PENALTY,
  MEDICAL_POSITIONS,
  IN_HOUSE_RECOVERY_TICKS,
  teamRatingOf,
  sizeEdgeFor,
  householdOf,
  medicAmong,
  recoveryPlanFor,
  hospitalize,
  isHospitalized,
  advanceHospitalStays,
  severityFor,
  resolveGroupFight,
  continueFight,
};
