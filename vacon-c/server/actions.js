// server/actions.js
//
// The player action dispatcher — `POST /api/players/:id/action`.
//
// ---------------------------------------------------------------------
// **Why this exists now and did not before.**
//
// server.js has carried this note since the Phase 3 routing pass:
//
//   > POST /api/players/:id/action is a "generic action dispatcher"
//   > with no specification of what actions exist. Guessing at that
//   > would invent game design, not expose it.
//
// That was correct when it was written and is obsolete now. Nothing
// about the map changed — the engine did. It has since grown a set of
// concrete verbs that a person can actually perform, each already
// built, already tested, and each with rules of its own:
//
//   accept a mission · resolve a mission · take up a routine ·
//   pick up a habit · enter a contest · resolve one of the seven Keys
//
// So this file invents no game design. It is a registry over verbs that
// already exist, which is exactly what the map asks for: "routes to the
// right Key/decision".
//
// ---------------------------------------------------------------------
// **The one property that matters: a player acts as themselves.**
//
// Every action below is performed by `player.linked_entity_id`, taken
// from the player record. The actor is NEVER read from the request
// body, and that is not a stylistic preference — the mission state
// machine enforces "only the holder can resolve a mission, because
// otherwise somebody finishes another player's mission and collects for
// it", and a dispatcher that forwarded a caller-supplied `entityId`
// would hand that check its own bypass. Anything an action needs beyond
// the actor comes from the body; the actor does not.
//
// A body that names an `entityId` is REFUSED rather than ignored.
// Silently dropping it would let a caller believe they had acted as
// somebody else and had it work.
//
// ---------------------------------------------------------------------
// **This dispatches. It does not decide — and it requires nothing.**
//
// Note the absence of imports below. The first version of this file
// required `missions.js`, `behavior.js` and `contest.js` directly, and
// that was wrong in a way that only showed up when a completed mission
// paid nothing: `engine.js#resolveMission` supplies a `payReward`
// callback that the raw `missions.resolveMission` has no way to know
// about, so calling the lower layer silently skipped the money.
//
// A dispatcher reaching past the bound layer is how it grows a second,
// disagreeing copy of the rules — which this header warned about while
// the file did it. So the verbs are INJECTED by engine.js, and
// `assertVerbsPresent()` refuses a set that is missing any of them
// rather than failing later on whichever single action nobody tried.

'use strict';

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------
// Data, not a switch. Each action names the modes it is available in,
// the parameters it requires, and the one call it makes.
//
// `modes` is here because Leader and Simulation modes are deferred by
// CLAUDE.md, not because they are unimplemented details: an action list
// that silently offered a Leader verb would be advertising a mode
// nobody can enter.
const ACTIONS = {
  'accept-mission': {
    summary: 'Take on an available mission.',
    modes: ['citizen'],
    requires: ['missionId'],
    verbs: ['acceptMission'],
    run: (verbs, actorId, body) => ({
      mission: verbs.acceptMission(body.missionId, actorId),
      paid: null,
    }),
  },

  'resolve-mission': {
    summary: 'Complete, fail or abandon a mission you are holding.',
    modes: ['citizen'],
    requires: ['missionId', 'outcome'],
    verbs: ['resolveMission'],
    run: (verbs, actorId, body) => verbs.resolveMission(body.missionId, {
      outcome: body.outcome,
      // The actor, from the player record. The state machine refuses a
      // mission held by somebody else, and this is what lets it.
      entityId: actorId,
      note: body.note,
    }),
  },

  'adopt-routine': {
    summary: 'Add a recurring event to your own schedule.',
    modes: ['citizen'],
    requires: ['eventType', 'frequency'],
    verbs: ['addScheduleEvent'],
    run: (verbs, actorId, body) => verbs.addScheduleEvent(actorId, {
      eventType: body.eventType,
      frequency: body.frequency,
      timeSlot: body.timeSlot,
      locationPropertyId: body.locationPropertyId ?? null,
    }),
  },

  'practise-habit': {
    summary: 'Reinforce a habit of your own, for better or worse.',
    modes: ['citizen'],
    requires: ['name'],
    verbs: ['reinforceHabit'],
    run: (verbs, actorId, body) => verbs.reinforceHabit(actorId, body.name, {
      harmful: body.harmful,
      amount: body.amount,
    }),
  },

  'enter-contest': {
    summary: 'Compete against a named opponent.',
    modes: ['citizen'],
    requires: ['opponentId'],
    verbs: ['resolveContest'],
    run: (verbs, actorId, body) => verbs.resolveContest({
      // The actor is always a participant. A player cannot enter a
      // contest between two other people and have it count as theirs.
      participantIds: [actorId, Number(body.opponentId)],
      discipline: body.discipline,
      contestId: body.contestId ?? null,
    }),
  },
};

const ACTION_NAMES = Object.keys(ACTIONS);

// The actor is never named by the caller. Listed explicitly so the
// refusal below can say WHICH field was the problem.
const ACTOR_FIELDS = ['entityId', 'entity_id', 'actorId', 'participantIds'];

function listActions(mode = 'citizen') {
  return ACTION_NAMES
    .filter((name) => ACTIONS[name].modes.includes(mode))
    .map((name) => ({
      action: name,
      summary: ACTIONS[name].summary,
      requires: ACTIONS[name].requires,
    }));
}

// ---------------------------------------------------------------------------
// dispatch()
// ---------------------------------------------------------------------------
// Every verb any action names, so a set can be checked once rather
// than per-action.
const REQUIRED_VERBS = [...new Set(
  Object.values(ACTIONS).flatMap((a) => a.verbs),
)].sort();

function assertVerbsPresent(verbs) {
  const missing = REQUIRED_VERBS.filter((v) => typeof verbs?.[v] !== 'function');
  if (missing.length) {
    throw new Error(
      `dispatchAction was given a verb set missing: ${missing.join(', ')}. `
      + 'Actions call the ENGINE\'s bound functions, never the modules underneath — '
      + 'calling the module directly is what made a completed mission pay nothing.',
    );
  }
}

function dispatchAction(worldState, playerId, body = {}, verbs) {
  assertVerbsPresent(verbs);
  const player = (worldState.players || []).find((p) => p.id === Number(playerId));
  if (!player) throw new Error(`no player with id ${playerId}`);

  const { action } = body;
  if (!action) {
    throw new Error(
      `an action is required — one of: ${listActions(player.mode).map((a) => a.action).join(', ')}`,
    );
  }

  const spec = ACTIONS[action];
  if (!spec) {
    throw new Error(
      `"${action}" is not an action. Available: ${ACTION_NAMES.join(', ')}`,
    );
  }
  if (!spec.modes.includes(player.mode)) {
    throw new Error(
      `"${action}" is not available in ${player.mode} mode (it needs one of: ${spec.modes.join(', ')})`,
    );
  }

  // Refused, not ignored. See the header: a caller who supplies an
  // actor and has it silently dropped believes they acted as somebody
  // else and that it worked.
  const smuggled = ACTOR_FIELDS.filter((f) => body[f] !== undefined);
  if (smuggled.length) {
    throw new Error(
      `a player acts as themselves — remove ${smuggled.join(', ')}. `
      + `This action is performed by entity ${player.linked_entity_id}, from the player record.`,
    );
  }

  const missing = spec.requires.filter((field) => body[field] === undefined || body[field] === null);
  if (missing.length) {
    throw new Error(`"${action}" requires ${missing.join(', ')}`);
  }

  const actorId = player.linked_entity_id;
  const result = spec.run(verbs, actorId, body);

  return {
    playerId: player.id,
    action,
    actorEntityId: actorId,
    tick: worldState.tick,
    result,
  };
}

// ---------------------------------------------------------------------------
// Every registered action must actually be callable, checked at require
// time. A `run` pointing at a function that no longer exists would fail
// only when somebody tried that one action — and the whole point of a
// registry is that nothing enumerates it by hand.
// ---------------------------------------------------------------------------
function assertActionsAreReal() {
  const bad = [];
  for (const [name, spec] of Object.entries(ACTIONS)) {
    if (typeof spec.run !== 'function') bad.push(`${name}: run is not a function`);
    if (!Array.isArray(spec.requires)) bad.push(`${name}: requires must be a list`);
    if (!Array.isArray(spec.modes) || !spec.modes.length) bad.push(`${name}: no modes`);
    if (!spec.summary) bad.push(`${name}: no summary — the action list is a player-facing menu`);
    if (!Array.isArray(spec.verbs) || !spec.verbs.length) {
      bad.push(`${name}: names no verbs, so nothing checks its wiring`);
    }
  }
  if (bad.length) throw new Error(`actions.js registry is malformed:\n  ${bad.join('\n  ')}`);
}

assertActionsAreReal();

module.exports = {
  ACTIONS,
  ACTION_NAMES,
  ACTOR_FIELDS,
  REQUIRED_VERBS,
  listActions,
  dispatchAction,
  assertVerbsPresent,
  assertActionsAreReal,
};
