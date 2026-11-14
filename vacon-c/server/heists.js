// server/heists.js
//
// By direct instruction, among a wider request for "stealing,
// robberies, bank robberies... certain tasks, certain people will be
// better and certain people will be worse in your organization, gang
// ... or if you need to add 2, 3, 4 people for a job or task, all this
// matters."
//
// ---------------------------------------------------------------------
// No new landmark category, no new crime category -- reuses what this
// engine already has rather than inventing a vault
// ---------------------------------------------------------------------
// `landmarks.js` has no `bank` category and no document names one; a
// "bank robbery" here is the real, general case -- a crew robbing a
// real business organization's own real `assets` column, the same
// column `economy.js`/`investments.js`/`worldgen.js` already read and
// write directly. §9's `theft`/`property` crime categories already
// cover this; a bigger, crew-based instance of an existing category
// needed no ninth one invented for it.
//
// ---------------------------------------------------------------------
// Who assembles a crew: the identical real authority `assignRole` and
// `espionage.js#sendSpy` already established
// ---------------------------------------------------------------------
// A sponsor (an organization's real `leader_id` or a family's real
// `head_npc_id`) assembles the crew from their own real people; each
// crew member complies or refuses independently
// (`leadership.complianceDraw`, "whatever they want to do" — the
// identical real per-person agency `sendSpy` already respects, not a
// single roll for the whole crew).
//
// ---------------------------------------------------------------------
// "Certain people will be better and certain people will be worse" —
// a real composite, not a dice roll on the job itself
// ---------------------------------------------------------------------
// `robberyAptitudeOf` is the `influenceRatingOf`/`espionageAptitudeOf`
// shape applied to this question: `criminal.Stealth` (not being
// caught in the act) and `criminal.Deception` (talking past whoever
// is there) at 0.35 each, `combat.'Tactical Awareness'` (reading and
// timing the job) at 0.3 — three real, already-generated traits,
// weighted to sum to 1.0, never a fourth composite invented from
// nothing.
//
// ---------------------------------------------------------------------
// "If you need to add 2, 3, 4 people... all this matters" — crew size
// as its own real term, capped rather than unbounded
// ---------------------------------------------------------------------
// More real, complying people raise the odds, up to `CREW_CAP` (4,
// the user's own named ceiling) — beyond that a bigger crew is not
// assumed to keep helping, the same diminishing-returns discipline
// `control.js`'s own takeover ratio already holds rather than letting
// a number run away.
//
// ---------------------------------------------------------------------
// A target's own real defenders, not an invented "security" number
// ---------------------------------------------------------------------
// `organizations.security` is a real schema column nothing in
// `server/` writes a real value to or reads — a dormant column, the
// eleventh standing rule's own shape one column over. Reading it here
// would be reading a number every world shares by construction (the
// schema default, 0), which is not a real measurement. `guards`/
// `enforcer`s this engine ALREADY generates real employment for
// (`config.prisonStaffing`'s own guards, `securityForces`'s officers,
// any ordinary `enforcer` hire) are the real substrate instead —
// `targetDefenseOf` counts a target organization's own real,
// currently-employed guards and enforcers.
//
// ---------------------------------------------------------------------
// Success and detection are two different real questions, not one
// ---------------------------------------------------------------------
// Getting the loot and getting IDENTIFIED afterward are not the same
// event — a crew can succeed and still be identified, or fail and get
// away clean. Both are real, separate, bounded, centred draws (the
// `espionage.js#detectionChanceFor` shape, applied twice rather than
// once). Service (`leadership.recordService`) is recorded only on a
// real success that was NOT also detected — the identical "came
// through, and it actually counted" standard `espionage.js` already
// holds for an undetected spy return. Detection raises real heat with
// the specific organization that caught them, the same narrow,
// first-party event `espionage.js`'s own header already argues does
// not reopen `heat.js`'s declared scope.

'use strict';

const leadership = require('./leadership.js');
const membership = require('./membership.js');
const crime = require('./crime.js');
const economy = require('./economy.js');
const heat = require('./heat.js');
const { seededDraw } = require('./seeded.js');
const { getLiveEntity } = require('./entityTraits.js');

const CREW_CAP = 4;
const SIZE_BONUS_PER_MEMBER = 5;
const LOOT_SHARE = 0.15;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function robberyAptitudeOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const stealth = Number(live?.traits?.criminal?.Stealth);
  const deception = Number(live?.traits?.criminal?.Deception);
  const tactical = Number(live?.traits?.combat?.['Tactical Awareness']);
  return 0.35 * (Number.isFinite(stealth) ? stealth : 50)
    + 0.35 * (Number.isFinite(deception) ? deception : 50)
    + 0.3 * (Number.isFinite(tactical) ? tactical : 50);
}

// A real count of this specific organization's own currently-employed
// guards/enforcers, scaled to a 0..1 term — see this file's own header
// on why `organizations.security` itself is not read here.
function targetDefenseOf(worldState, organizationId) {
  const guards = (worldState.employmentRecords || []).filter(
    (r) => r.status === 'active' && r.employer_organization_id === organizationId
      && ['guard', 'enforcer'].includes(r.position),
  ).length;
  return Math.min(1, guards * 0.15);
}

// Flagged interpretive, same posture as every other hand-fitted band
// in this engine with no document to cite a number from: centred on
// 50/no-defense so an ordinary crew against an undefended target
// reads as a real, moderate chance, never a certainty either way.
function successChanceFor(meanAptitude, crewSize, defense) {
  const effectiveCrew = Math.min(crewSize, CREW_CAP);
  const sizeBonus = (effectiveCrew - 1) * SIZE_BONUS_PER_MEMBER;
  return clamp01(0.5 + (meanAptitude - 50) / 100 + sizeBonus / 100 - defense);
}

function detectionChanceFor(meanAptitude, defense) {
  const base = 0.3 + defense * 0.4;
  const scaled = base * (1 - (meanAptitude - 50) / 100);
  return Math.max(0.05, Math.min(0.9, scaled));
}

function attemptHeist(worldState, sponsorEntityId, options = {}) {
  const {
    organizationId = null, familyId = null, crewEntityIds = [], targetOrganizationId,
    tick = worldState.tick ?? 0,
  } = options;

  if (!Array.isArray(crewEntityIds) || crewEntityIds.length === 0) {
    throw new Error('attemptHeist requires a non-empty crewEntityIds array.');
  }
  if (targetOrganizationId == null) throw new Error('attemptHeist requires targetOrganizationId.');
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('attemptHeist requires exactly one of organizationId or familyId.');
  }

  const target = (worldState.organizations || []).find((o) => o.id === Number(targetOrganizationId));
  if (!target) throw new Error(`attemptHeist: no organization with id ${targetOrganizationId}.`);

  let membershipCheck;
  if (organizationId != null) {
    const sponsorOrg = (worldState.organizations || []).find((o) => o.id === Number(organizationId));
    if (!sponsorOrg) throw new Error(`attemptHeist: no organization with id ${organizationId}.`);
    if (sponsorOrg.leader_id !== Number(sponsorEntityId)) {
      throw new Error(`attemptHeist: entity ${sponsorEntityId} does not lead organization ${organizationId}.`);
    }
    if (target.id === sponsorOrg.id) {
      throw new Error('attemptHeist: a crew cannot rob its own sponsoring organization.');
    }
    membershipCheck = (id) => !!membership.findMembership(worldState, id, sponsorOrg.id);
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) throw new Error(`attemptHeist: no family with id ${familyId}.`);
    if (family.head_npc_id !== Number(sponsorEntityId)) {
      throw new Error(`attemptHeist: entity ${sponsorEntityId} does not head family ${familyId}.`);
    }
    membershipCheck = (id) => (worldState.familyMemberships || []).some(
      (m) => m.entity_id === id && m.family_id === family.id,
    );
  }

  const crewIds = crewEntityIds.map(Number);
  for (const id of crewIds) {
    if (id === Number(sponsorEntityId)) continue;
    if (!membershipCheck(id)) {
      throw new Error(`attemptHeist: entity ${id} is not a real member under this sponsor's authority.`);
    }
  }

  const compliedCrew = [];
  const refusedCrew = [];
  for (const id of crewIds) {
    if (id === Number(sponsorEntityId)) { compliedCrew.push(id); continue; }
    const { complied } = leadership.complianceDraw(worldState, sponsorEntityId, id, 'attempt-heist', tick);
    if (complied) compliedCrew.push(id);
    else refusedCrew.push(id);
  }

  if (compliedCrew.length === 0) {
    return {
      complied: false, crew: [], refused: refusedCrew, success: null, detected: false, loot: 0,
    };
  }

  const meanAptitude = compliedCrew
    .reduce((sum, id) => sum + robberyAptitudeOf(worldState, id), 0) / compliedCrew.length;
  const defense = targetDefenseOf(worldState, target.id);
  const successChance = successChanceFor(meanAptitude, compliedCrew.length, defense);
  const detectionChance = detectionChanceFor(meanAptitude, defense);

  const successDraw = seededDraw([
    worldState.seed ?? 'world', 'attempt-heist-success', target.id, tick, ...compliedCrew,
  ]);
  const detectionDraw = seededDraw([
    worldState.seed ?? 'world', 'attempt-heist-detect', target.id, tick, ...compliedCrew,
  ]);
  const success = successDraw < successChance;
  const detected = detectionDraw < detectionChance;

  let loot = 0;
  if (success) {
    const assets = Number(target.assets) || 0;
    loot = Math.round(assets * LOOT_SHARE);
    if (loot > 0) {
      target.assets = assets - loot;
      const share = Math.round((loot / compliedCrew.length) * 100) / 100;
      for (const id of compliedCrew) {
        const current = economy.getLatestFinances(worldState, id);
        economy.generateIndividualFinances(worldState, id, {
          income: current?.income ?? 0,
          savings: Math.round(((current?.savings ?? 0) + share) * 100) / 100,
          debt: current?.debt ?? 0,
          assets: current?.assets ?? 0,
          tick,
        });
      }
    }
    crime.recordCrime(worldState, {
      category: 'theft',
      perpetratorId: compliedCrew[0],
      victimId: target.leader_id ?? null,
      tick,
      detail: `a ${compliedCrew.length}-person crew robbed organization ${target.id} for ${loot}`,
    });
  }

  if (detected) {
    for (const id of compliedCrew) {
      heat.raiseHeat(worldState, { entityId: id, factionOrganizationId: target.id });
    }
  }

  if (success && !detected) {
    for (const id of compliedCrew) leadership.recordService(worldState, id);
  }

  return {
    complied: true, crew: compliedCrew, refused: refusedCrew, success, detected, loot,
    successChance, detectionChance, meanAptitude, defense,
  };
}

module.exports = {
  CREW_CAP,
  SIZE_BONUS_PER_MEMBER,
  LOOT_SHARE,
  robberyAptitudeOf,
  targetDefenseOf,
  successChanceFor,
  detectionChanceFor,
  attemptHeist,
};
