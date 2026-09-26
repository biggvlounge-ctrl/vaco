// server/warfare.js
//
// **Armed conflict between two organizations — added 26 Sep 2026 at the
// owner's direct request.** New design; no source document names this.
//
// ---------------------------------------------------------------------
// What this reuses rather than invents
// ---------------------------------------------------------------------
// `server/contest.js` resolves a fight deterministically from live
// `combat` traits and has exactly one caller in the whole engine —
// `competition.js`, which explicitly EXCLUDES the `combat` discipline
// from what it runs ("It holds games, not fights... `combat` is
// excluded on purpose"). So the engine has had a real, seeded,
// verifiable fight-resolver since `contest.js` was written, with
// nothing ever asking it to settle a fight rather than a sport. This
// file is that caller.
//
// `server/mortality.killEntity` is the other half: exported since
// mortality.js was written and, before this file, called from nowhere
// in `server/` — the eleventh standing rule's shape, a function instead
// of a trait this time. A battle's loser can die by it, the same
// "violence" cause path a domestic or violent crime escalation already
// uses.
//
// `server/membership.membersOf` supplies the combatants: living members
// of an organization, the same membership table `crime.js`'s gang
// statistics already read.
//
// ---------------------------------------------------------------------
// What this does NOT do
// ---------------------------------------------------------------------
// It does not seize territory. `server/control.js`'s takeover key has
// its own composition and cohesion requirements, built and tested on
// its own terms — a decisive war winner is left free to ATTEMPT a
// takeover afterward through that existing system, rather than this
// file reaching into it and bypassing what it checks. Two systems each
// built for their own reason, not one system pretending to be both.
//
// It is not a twelfth tick phase. Battles happen in the same
// cross-cutting slot `drugs.js`/`gambling.js` already share, because
// the pipeline is locked at eleven.
//
// It has no player-facing verb yet (`server/actions.js` does not list
// `declare-war`). `declareWar`/`runWarfare` are real, callable, and
// tested; wiring a verb through `engine.js` the way `attemptTakeover`
// wraps `control.attempt` is real but separate work, not done here.
//
// **`worldState.wars` has no Postgres table.** `migrate.js`/`restore.js`
// checkpoint the rest of the world; a `wars` array added only to the
// in-memory shape would be silently dropped on the next restore, which
// is exactly the "looks durable, is not" failure this project's own
// notes describe elsewhere. Left undone here rather than guessed at: no
// Postgres instance is reachable from this environment to write and
// verify a migration against, and a schema change nobody could run is
// worse than a documented gap. `schema-extensions.sql` is where a
// `wars`/`war_battles` pair belongs when one can be.

'use strict';

const membership = require('./membership.js');
const mortality = require('./mortality.js');
const contest = require('./contest.js');
const { seededDraw } = require('./seeded.js');

//: The same floor `control.WORKING_AGE`/`meetings.ATTENDANCE_AGE` use
//: for "an adult" — not a fourth opinion about when someone counts as
//: one.
const ADULT_AGE = 16;

//: How many of its own people a side can lose before the war is
//: decided. Flagged interpretive — no document gives a casualty
//: threshold for anything in this engine, so this is the shape of the
//: model, the same status `crime.js`'s `BASE_DEPRIVATION_RISK` carries.
const CASUALTIES_TO_END = 5;
//: Not every tick of an active war is a battle — armies do not fight
//: daily. Small on purpose, the same order of magnitude as
//: `gambling.URGE_CHANCE_AT_MAX_PROPENSITY`.
const BATTLE_CHANCE_PER_TICK = 0.05;
//: Losing a battle does not always mean dying it. Interpretive; roughly
//: "one fight in three is fatal to the loser," which is high for a
//: single skirmish and appropriate for a world where a war is meant to
//: actually end.
const DEATH_CHANCE_ON_LOSS = 0.3;

let nextWarId = 1;

function reseedIds(worldState) {
  nextWarId = (worldState.wars || []).reduce((max, w) => Math.max(max, w.id), 0) + 1;
}

function activeWars(worldState) {
  return (worldState.wars || []).filter((w) => w.endedTick === null);
}

// Living, not imprisoned, adult members of an organization — the
// people it can actually put in a fight. `membersOf` already excludes
// the dead (they are moved to `worldState.deceased`, never left in
// `npcs`); this adds the two further exclusions a combatant needs.
function combatantsOf(worldState, organizationId, tick) {
  return membership.membersOf(worldState, organizationId)
    .filter((n) => n.status === 'active')
    .filter((n) => {
      const age = mortality.ageInYears(worldState, n, tick);
      return age !== null && age >= ADULT_AGE;
    });
}

// ---------------------------------------------------------------------
// declareWar
// ---------------------------------------------------------------------
// Idempotent: declaring a war already underway between the same two
// organizations returns the existing one rather than opening a second,
// concurrent war between the same two sides — two wars would double-
// count casualties toward `CASUALTIES_TO_END` for no reason a player
// asked for.
function declareWar(worldState, options = {}) {
  const { aOrgId, bOrgId, tick = worldState.tick ?? 0, reason = null } = options;

  if (aOrgId === bOrgId) throw new Error('warfare.declareWar: an organization cannot war itself');
  for (const [role, id] of [['a', aOrgId], ['b', bOrgId]]) {
    if (!(worldState.organizations || []).some((o) => o.id === id)) {
      throw new Error(`warfare.declareWar: ${role} organization ${id} does not exist`);
    }
  }

  const existing = activeWars(worldState).find(
    (w) => (w.aOrgId === aOrgId && w.bOrgId === bOrgId)
      || (w.aOrgId === bOrgId && w.bOrgId === aOrgId),
  );
  if (existing) return existing;

  if (!Array.isArray(worldState.wars)) worldState.wars = [];
  const war = {
    id: nextWarId,
    aOrgId,
    bOrgId,
    reason,
    startedTick: tick,
    endedTick: null,
    winnerOrgId: null,
    battles: [],
    casualties: { [aOrgId]: 0, [bOrgId]: 0 },
  };
  nextWarId += 1;
  worldState.wars.push(war);
  return war;
}

// ---------------------------------------------------------------------
// One battle
// ---------------------------------------------------------------------
// One fighter a side, picked by a seeded draw so a replay of the same
// world picks the same combatants — §88 holds here the same as
// everywhere else a draw decides something. `contest.resolveContest`
// decides who wins from what they are actually rated at; this decides
// nothing about who fights better, only who shows up and what losing
// costs.
function runBattle(worldState, war, tick) {
  const aFighters = combatantsOf(worldState, war.aOrgId, tick);
  const bFighters = combatantsOf(worldState, war.bOrgId, tick);
  if (aFighters.length === 0 || bFighters.length === 0) return null;

  const a = aFighters[Math.floor(
    seededDraw([worldState.seed ?? 'world', 'war:pick-a', war.id, tick]) * aFighters.length,
  )];
  const b = bFighters[Math.floor(
    seededDraw([worldState.seed ?? 'world', 'war:pick-b', war.id, tick]) * bFighters.length,
  )];

  const result = contest.resolveContest(worldState, {
    participantIds: [a.id, b.id], discipline: 'combat', contestId: `war-${war.id}`, tick,
  });
  const loserId = result.winnerId === a.id ? b.id : a.id;
  const loserOrgId = result.winnerId === a.id ? war.bOrgId : war.aOrgId;

  let died = false;
  if (seededDraw([worldState.seed ?? 'world', 'war:casualty', war.id, tick, loserId]) < DEATH_CHANCE_ON_LOSS) {
    mortality.killEntity(worldState, {
      entityId: loserId,
      killerId: result.winnerId,
      tick,
      detail: `killed in the war between organization ${war.aOrgId} and organization ${war.bOrgId}`,
    });
    died = true;
  }

  war.casualties[loserOrgId] = (war.casualties[loserOrgId] || 0) + 1;
  const battle = {
    tick, winnerId: result.winnerId, loserId, loserOrgId, died, contestId: result.contestId,
  };
  war.battles.push(battle);
  return battle;
}

// ---------------------------------------------------------------------
// Ending a war
// ---------------------------------------------------------------------
// Three ways out, checked in the same call: a side with nobody left to
// fight, and a side that has taken enough losses to be finished without
// being annihilated. Ends with a winner named rather than merely
// stopping, because "the war is over" and "the war is over and X lost"
// are different facts and only one of them is useful to whatever reads
// `winnerOrgId` afterward (a takeover attempt, a diplomacy system, a
// player's own read of the world).
function checkForEnd(worldState, war, tick) {
  const aFighters = combatantsOf(worldState, war.aOrgId, tick);
  const bFighters = combatantsOf(worldState, war.bOrgId, tick);

  let winnerOrgId;
  if (aFighters.length === 0 && bFighters.length === 0) winnerOrgId = null;
  else if (aFighters.length === 0) winnerOrgId = war.bOrgId;
  else if (bFighters.length === 0) winnerOrgId = war.aOrgId;
  else if (war.casualties[war.aOrgId] >= CASUALTIES_TO_END) winnerOrgId = war.bOrgId;
  else if (war.casualties[war.bOrgId] >= CASUALTIES_TO_END) winnerOrgId = war.aOrgId;
  else return false;

  war.endedTick = tick;
  war.winnerOrgId = winnerOrgId;
  return true;
}

// ---------------------------------------------------------------------
// One tick's worth of every active war
// ---------------------------------------------------------------------
// Returns events for the two things worth telling the rest of the
// engine about: a battle happened (`war_battle`, or `war_casualty` when
// it killed somebody — different types because they cost a different
// amount of stress, the same reason `crime`/`crime_cleared` are split
// in `behavior.STRESS_BY_EVENT`) and a war ended.
function runWarfare(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const events = [];

  for (const war of activeWars(worldState)) {
    if (seededDraw([worldState.seed ?? 'world', 'war:battle-happens', war.id, tick])
      < BATTLE_CHANCE_PER_TICK) {
      const battle = runBattle(worldState, war, tick);
      if (battle) {
        events.push({
          type: battle.died ? 'war_casualty' : 'war_battle',
          severity: battle.died ? 'high' : 'medium',
          note: `a battle in the war between organization ${war.aOrgId} and organization ${war.bOrgId}`,
          tick,
          affected_entity_ids: [battle.winnerId, battle.loserId],
          global_effects: { warId: war.id, ...battle },
        });
      }
    }

    if (checkForEnd(worldState, war, tick)) {
      events.push({
        type: 'war_ended',
        severity: 'high',
        note: `the war between organization ${war.aOrgId} and organization ${war.bOrgId} ended`,
        tick,
        affected_entity_ids: [],
        global_effects: { warId: war.id, winnerOrgId: war.winnerOrgId },
      });
    }
  }

  return events;
}

// The measurement, standing rule 11's guard on this file specifically.
function describeWarfare(worldState) {
  const wars = worldState.wars || [];
  return {
    active: wars.filter((w) => w.endedTick === null).length,
    ended: wars.filter((w) => w.endedTick !== null).length,
    totalBattles: wars.reduce((sum, w) => sum + w.battles.length, 0),
    totalDeaths: wars.reduce((sum, w) => sum + w.battles.filter((b) => b.died).length, 0),
  };
}

module.exports = {
  ADULT_AGE,
  CASUALTIES_TO_END,
  BATTLE_CHANCE_PER_TICK,
  DEATH_CHANCE_ON_LOSS,
  reseedIds,
  activeWars,
  combatantsOf,
  declareWar,
  runBattle,
  checkForEnd,
  runWarfare,
  describeWarfare,
};
