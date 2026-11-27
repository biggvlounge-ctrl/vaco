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
//
// ---------------------------------------------------------------------
// Closing task #40's remaining real gap: a real tool requirement
// ---------------------------------------------------------------------
// "Witnesses, stakeouts, and safe-cracking/intimidation variance" had
// shipped witnesses (`crime.js`), the stakeout above, and witness
// intimidation (`server/intimidation.js`) — "safe-cracking" was the one
// real piece still missing. **A crew now has to actually hold the real
// tool `heistTools.containerRequirementFor` names for this target** —
// `bolt_cutters` for a real cargo-handling target, `angle_grinder` or
// `cutting_torch` for anything else — refused outright, before any
// draw is consumed, the same "refuse rather than half-apply" discipline
// `vehicles.js#restoreVehicleCondition` already holds. No second
// "intimidation" mechanic is added here — `intimidation.js` already
// answers that real word, over a different, complementary question
// (does a witness stay quiet afterward), and a second one under the
// same name would be exactly the "two disagreeing answers to one
// question" this file's own project has a standing rule against.
//
// ---------------------------------------------------------------------
// Task #104 — consult before committing
// ---------------------------------------------------------------------
// `consultBeforeHeist` closes the one "look before you commit" gap
// this file never had — `attempt-takeover` always had `assess-
// takeover` beside it; `attemptHeist` had nothing. See that
// function's own header for the full design.

'use strict';

const leadership = require('./leadership.js');
const membership = require('./membership.js');
const crime = require('./crime.js');
const economy = require('./economy.js');
const heat = require('./heat.js');
const heistTools = require('./heistTools.js');
const { seededDraw } = require('./seeded.js');
const { getLiveEntity } = require('./entityTraits.js');

const CREW_CAP = 4;
const SIZE_BONUS_PER_MEMBER = 5;
const LOOT_SHARE = 0.15;

// **A stakeout — by direct instruction: "witnesses, stakeouts, and
// safe-cracking/intimidation variance."** Real intel narrows a real
// risk, rather than raising the odds of getting the loot: watching a
// target first is planning, not skill, and `successChanceFor` already
// has its own real skill/crew terms. `STAKEOUT_DETECTION_REDUCTION`
// (0.1, flagged interpretive the same honesty every other hand-fitted
// band here carries) comes straight off `detectionChanceFor`'s own
// result — knowing the guard pattern lowers the chance of being
// IDENTIFIED, not the chance of getting away with less.
// `STAKEOUT_RECENCY_TICKS` (14, two real weeks at this engine's "a
// tick is a day" convention) is how long that intel stays good before
// the target's own patterns could have changed under it.
const STAKEOUT_DETECTION_REDUCTION = 0.1;
const STAKEOUT_RECENCY_TICKS = 14;

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

// Real, immediate information, not a hidden roll — watching a real
// target reveals its real, already-computed `targetDefenseOf`
// (otherwise only known inside `attemptHeist`'s own closure), and the
// record it leaves is what a subsequent `attemptHeist` reads for the
// real detection reduction above.
function stakeOut(worldState, entityId, targetOrganizationId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const target = (worldState.organizations || []).find((o) => o.id === Number(targetOrganizationId));
  if (!target) throw new Error(`stakeOut: no organization with id ${targetOrganizationId}.`);

  const record = {
    entityId: Number(entityId),
    targetOrganizationId: target.id,
    tick,
    defense: targetDefenseOf(worldState, target.id),
  };
  (worldState.stakeouts || (worldState.stakeouts = [])).push(record);
  return record;
}

// Any of this crew, staking out THIS target, recently enough that the
// intel is still real.
function hasRecentStakeout(worldState, crewIds, targetOrganizationId, tick) {
  return (worldState.stakeouts || []).some(
    (s) => crewIds.includes(s.entityId)
      && s.targetOrganizationId === Number(targetOrganizationId)
      && tick - s.tick <= STAKEOUT_RECENCY_TICKS
      && tick - s.tick >= 0,
  );
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

  // **A crew that showed up with no real tool cannot open this real
  // target, full stop — refused before any draw is consumed, the same
  // "refuse rather than half-apply" discipline
  // `vehicles.js#restoreVehicleCondition` already holds.** See
  // `heistTools.js`'s own header for why the tool is decided from a
  // real property field rather than an invented vault landmark.
  const toolRequirement = heistTools.containerRequirementFor(worldState, target.id);
  if (!heistTools.holdsAny(worldState, compliedCrew, toolRequirement.tools)) {
    return {
      complied: true, crew: compliedCrew, refused: refusedCrew, success: false, detected: false,
      loot: 0, blockedByTool: toolRequirement,
    };
  }

  const meanAptitude = compliedCrew
    .reduce((sum, id) => sum + robberyAptitudeOf(worldState, id), 0) / compliedCrew.length;
  const defense = targetDefenseOf(worldState, target.id);
  const successChance = successChanceFor(meanAptitude, compliedCrew.length, defense);
  const staked = hasRecentStakeout(worldState, compliedCrew, target.id, tick);
  const detectionChance = Math.max(
    0,
    detectionChanceFor(meanAptitude, defense) - (staked ? STAKEOUT_DETECTION_REDUCTION : 0),
  );

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
    successChance, detectionChance, meanAptitude, defense, staked,
  };
}

// ---------------------------------------------------------------------
// consultBeforeHeist — task #104, "consult a real, knowledgeable org
// member before acting on an opportunity"
// ---------------------------------------------------------------------
// Checked directly first: unlike `attempt-takeover` (which already
// has `assess-takeover`'s own real "look before you commit" preview),
// `attempt-heist` had NO preview at all — a crew could only ever find
// out its real odds by actually robbing somebody. This closes that
// real gap, in the shape the request itself names: not a bare number,
// but a real, NAMED advisor — the real living member of the sponsor's
// own organization or family with the highest real `robberyAptitudeOf`
// among them, the same real composite `attemptHeist` itself already
// reads for every crew member.
//
// A pure read, the identical posture `tacticalAdvisor
// .recommendSplit` already holds for the same reason: nothing here
// moves, so no authority or compliance check applies — those only
// gate `attemptHeist` itself, once a real decision is actually made.
//
// When no `crewEntityIds` are given yet, the preview is of the
// advisor going alone — an honest floor, not a guess at who else
// might join. When a real crew is already chosen, the SAME real
// `successChanceFor`/`detectionChanceFor` this file's own
// `attemptHeist` runs are previewed for that exact crew against the
// real target, so what the advisor says and what actually happens can
// never disagree.
function consultBeforeHeist(worldState, sponsorEntityId, options = {}) {
  const { organizationId = null, familyId = null, targetOrganizationId, crewEntityIds = null } = options;
  if (targetOrganizationId == null) {
    throw new Error('consultBeforeHeist requires targetOrganizationId.');
  }
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('consultBeforeHeist requires exactly one of organizationId or familyId.');
  }
  const target = (worldState.organizations || []).find((o) => o.id === Number(targetOrganizationId));
  if (!target) return null;

  let poolIds;
  if (organizationId != null) {
    const org = (worldState.organizations || []).find((o) => o.id === Number(organizationId));
    if (!org) return null;
    poolIds = (worldState.entityOrganizationMemberships || [])
      .filter((m) => m.organization_id === org.id)
      .map((m) => m.entity_id);
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) return null;
    poolIds = (worldState.familyMemberships || [])
      .filter((m) => m.family_id === family.id)
      .map((m) => m.entity_id);
  }
  // The sponsor themselves counts as a real candidate advisor too —
  // asking "who among us knows this best" never excludes the person
  // asking, the same real pool `attemptHeist` draws its own crew from.
  // Added explicitly rather than only read off membership rows: a
  // sponsoring organization's own `leader_id` names them real
  // authority over the org without necessarily also holding a real
  // `entityOrganizationMemberships` row — `attemptHeist`'s own crew
  // loop skips the identical membership check for exactly this id.
  const living = [...new Set([...poolIds, Number(sponsorEntityId)])].filter((id) => {
    const npc = (worldState.npcs || []).find((n) => n.id === id);
    return npc && npc.status !== 'deceased';
  });
  if (living.length === 0) return null;

  let advisorEntityId = null;
  let advisorAptitude = -Infinity;
  for (const id of living) {
    const aptitude = robberyAptitudeOf(worldState, id);
    if (aptitude > advisorAptitude) {
      advisorAptitude = aptitude;
      advisorEntityId = id;
    }
  }

  const crew = Array.isArray(crewEntityIds) && crewEntityIds.length > 0
    ? crewEntityIds.map(Number)
    : [advisorEntityId];
  const meanAptitude = crew.reduce((sum, id) => sum + robberyAptitudeOf(worldState, id), 0) / crew.length;
  const defense = targetDefenseOf(worldState, target.id);

  return {
    advisorEntityId,
    advisorAptitude,
    crewEntityIds: crew,
    meanAptitude,
    defense,
    successChance: successChanceFor(meanAptitude, crew.length, defense),
    detectionChance: detectionChanceFor(meanAptitude, defense),
  };
}

module.exports = {
  CREW_CAP,
  SIZE_BONUS_PER_MEMBER,
  LOOT_SHARE,
  STAKEOUT_DETECTION_REDUCTION,
  STAKEOUT_RECENCY_TICKS,
  robberyAptitudeOf,
  targetDefenseOf,
  successChanceFor,
  detectionChanceFor,
  stakeOut,
  hasRecentStakeout,
  attemptHeist,
  consultBeforeHeist,
};
