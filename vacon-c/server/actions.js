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

const justice = require('./justice.js');

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

  // **Sitting down with people.** The spec's NPC vocabulary names
  // `negotiate` three separate times and `teach`, `recruit` and `form
  // alliance` once each, and none of the four had a home anywhere in
  // the engine — five verbs about two or more people doing something
  // together, in a simulation whose entire subject is people.
  //
  // `attendeeIds` is a list of OTHER people, and the actor is added to
  // it by the dispatcher rather than being nameable. It is not in
  // `ACTOR_FIELDS` because it does not claim to be the actor — but a
  // player who could omit themselves from their own meeting would be
  // arranging one between other people and calling it theirs, which is
  // the same mistake `enter-contest` refuses.
  'call-meeting': {
    summary: 'Sit down with people you know — to plan, negotiate, teach or recruit.',
    modes: ['citizen'],
    requires: ['attendeeIds'],
    verbs: ['holdMeeting'],
    run: (verbs, actorId, body) => verbs.holdMeeting(actorId, {
      attendeeIds: (Array.isArray(body.attendeeIds) ? body.attendeeIds : [body.attendeeIds])
        .map(Number),
      purpose: body.purpose,
      topic: body.topic ?? null,
    }),
  },

  // **A building's past does not fix its future.** Take the Arch and
  // make it a fortress. Only an owner may — which is what gives the
  // takeover key a consequence beyond a line in the history.
  'repurpose-property': {
    summary: 'Change what a building you hold is for. Its history stays with it.',
    modes: ['citizen'],
    requires: ['propertyId', 'toType'],
    verbs: ['repurposeProperty'],
    run: (verbs, actorId, body) => verbs.repurposeProperty(actorId, {
      propertyId: Number(body.propertyId),
      toType: body.toType,
      note: body.note ?? null,
    }),
  },

  // **The takeover key, as two verbs rather than one.**
  // `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` splits the shapes the
  // same way: `ControlKeyComposition` is what a target requires and
  // `TakeoverAttemptResolution` is what happened. A player has to be
  // able to look before they leap — "a Tribe can meet every technical
  // requirement and still fail" is only a meaningful risk if they can
  // see the requirement first.
  'assess-takeover': {
    summary: 'See what it would take for your tribe to hold a place, and your odds.',
    modes: ['citizen'],
    requires: ['scale', 'locationId'],
    verbs: ['assessTakeover'],
    run: (verbs, actorId, body) => ({
      resolution: verbs.assessTakeover(actorId, {
        scale: body.scale, locationId: Number(body.locationId),
      }),
    }),
  },

  'attempt-takeover': {
    summary: 'Try to take control of a place, with your tribe behind you.',
    modes: ['citizen'],
    requires: ['scale', 'locationId'],
    verbs: ['attemptTakeover'],
    // The tribe is NOT a parameter. `engine.tribeIdFor` reads it off
    // the actor's family membership, for the same reason the actor is
    // never a parameter: a player acts as themselves, and that means
    // for their own family.
    run: (verbs, actorId, body) => verbs.attemptTakeover(actorId, {
      scale: body.scale, locationId: Number(body.locationId),
    }),
  },

  // **Salvage, as three verbs.** `server/salvage.js` is the one system
  // in the engine a player is meant to touch constantly rather than at
  // a turning point — you take things apart and make things all day —
  // so all three are plain and none of them takes an actor.
  //
  // Note which way round the refusals go. `make` and `break-down` throw
  // when they cannot proceed, because the player asked for a specific
  // thing; `can-make` is the one that answers "no" without throwing,
  // and it is separate for the same reason `assess-takeover` is
  // separate from `attempt-takeover` — a player has to be able to look
  // before they spend what they are carrying.
  'break-down': {
    summary: 'Take something you carry apart for what it is made of.',
    modes: ['citizen'],
    requires: ['itemName'],
    verbs: ['breakDownItem'],
    run: (verbs, actorId, body) => verbs.breakDownItem(actorId, {
      itemName: body.itemName,
      quantity: body.quantity === undefined ? 1 : Number(body.quantity),
    }),
  },

  'strip-building': {
    summary: 'Strip an empty building for materials. It will not survive many visits.',
    modes: ['citizen'],
    requires: ['propertyId'],
    verbs: ['stripBuilding'],
    run: (verbs, actorId, body) => verbs.stripBuilding(actorId, {
      propertyId: Number(body.propertyId),
    }),
  },

  // **Searching a landmark for what is in it.** The other half of
  // `strip-building`: salvage takes a building apart for what it is
  // MADE of, this carries out what it HELD. A library is worth
  // searching and worth nothing to a scrapper.
  'search-location': {
    summary: 'Search a landmark for what is still inside it.',
    modes: ['citizen'],
    requires: ['propertyId'],
    verbs: ['searchLocation'],
    run: (verbs, actorId, body) => verbs.searchLocation(actorId, {
      propertyId: Number(body.propertyId),
    }),
  },

  'make-thing': {
    summary: 'Make something from the materials you carry.',
    modes: ['citizen'],
    requires: ['product'],
    verbs: ['makeThing', 'canMakeThing'],
    run: (verbs, actorId, body) => (
      body.check === true
        ? { check: verbs.canMakeThing(actorId, { product: body.product }) }
        : verbs.makeThing(actorId, { product: body.product })
    ),
  },

  // **§24, the player-facing half.** `knowledge.study()` has moved real
  // traits — the field's skill, Literacy, Self-Taught Aptitude — since
  // the file that built it, and nothing ever let a player trigger it.
  // `source`/`field` name one of `knowledge.sourcesFor`'s own real
  // candidates (a book you carry, a library in your city, somebody
  // nearby who holds a trade) — validated against what this entity can
  // actually reach right now, same posture `generateMission` already
  // holds for an artifact or location: never trust a caller-declared
  // pair, confirm it against real state first.
  study: {
    summary: 'Study from a book you carry, a place in your city, or somebody nearby.',
    modes: ['citizen'],
    requires: ['source', 'field'],
    verbs: ['studySource'],
    run: (verbs, actorId, body) => verbs.studySource(actorId, {
      source: body.source, field: body.field, teacherId: body.teacherId ?? null,
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

  // **A player serving a sentence cannot act.** `npcs.status` gained
  // `imprisoned` with server/justice.js, and without this check the one
  // person in the world with a keyboard would be the only one for whom
  // being convicted changed nothing: every NPC loses their job, their
  // routine and their place in the household, while the player accepts
  // missions and enters contests from a cell.
  //
  // Refused with the reason and the release tick rather than a bare
  // error, because "why can I not do anything" is the question this
  // will be asked.
  const actor = (worldState.npcs || []).find((n) => n.id === player.linked_entity_id);
  if (actor && actor.status === 'imprisoned') {
    const serving = justice.servingCase(worldState, actor.id);
    const releaseAt = serving
      ? Number(serving.charged_tick) + Number(serving.sentence_ticks)
      : null;
    throw new Error(
      `entity ${actor.id} is serving a sentence${serving ? ` for ${serving.category}` : ''} `
      + `and cannot act${releaseAt === null ? '' : ` until tick ${releaseAt}`}.`,
    );
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
