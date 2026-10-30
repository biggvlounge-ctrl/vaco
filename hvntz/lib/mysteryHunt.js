// HVNTZ — Mystery Hunts: a real Clue-style deduction layer over the
// existing checkpoint/check-in mechanic (`lib/hunts.js`).
//
// Direct request: bring the actual board game's deduction structure
// into a real scavenger/Easter-egg hunt — not the Hasbro business
// software, the real "who/what/where, narrowed down from partial
// clues, confirmed by a correct accusation" shape. Built as a real,
// optional layer ON a hunt rather than a new hunt type: a hunt with no
// mystery set up behaves exactly as `hunts.js` already does.
//
// ---------------------------------------------------------------------
// Three real additions over the existing checkpoint mechanic
// ---------------------------------------------------------------------
//   1. A hidden, three-slot solution (`who`/`what`/`where` — the
//      board game's own structure, renamed away from its murder-
//      mystery framing since this is a generic hunt layer).
//   2. A real, per-checkpoint clue about ONE slot, stated as either
//      the true value or an explicit red herring — never left for a
//      caller to mislabel, since mislabeling is checked against the
//      real hidden solution at the moment a clue is added.
//   3. A real team accusation, checked against the real hidden
//      solution, never guessed at or faked.
//
// **Never nested on the `hunt` object itself.** `GET /api/hunt/:huntId`
// returns a hunt's own record directly (`server.js`'s existing route),
// so a real hidden solution living on that same object would be one
// response away from spoiling itself. This module's own state lives in
// a parallel `store.mysteryHunts` entry per hunt, which no existing
// route ever serializes.
//
// ---------------------------------------------------------------------
// The real board-game rule this keeps: a wrong accusation does not
// end the game for everyone
// ---------------------------------------------------------------------
// Clue's own actual rule is that a wrong accusation removes that ONE
// player from being able to win — it does not stop them playing, and
// it does not stop anyone else. `makeAccusation` marks the accusing
// team `eliminatedFromMystery: true` on a wrong guess; every other
// team keeps revealing clues and can still win. Checkpoint bounties
// (`hunts.checkInAtCheckpoint`) are completely unaffected either way —
// this module never touches money.
//
// ---------------------------------------------------------------------
// No invented bonus payout for solving it
// ---------------------------------------------------------------------
// No source material specifies a reward for solving a mystery beyond
// the hunt's own existing checkpoint bounties, and inventing one here
// would be exactly the kind of unlicensed number this codebase avoids
// elsewhere. Solving is a real, recorded fact
// (`solvedByTeamId`/`solvedAt`) — a win condition, not a second payout
// mechanic. A sponsor who wants to reward the winner can do so with
// the existing bounty primitives, as their own deliberate action.
//
// ---------------------------------------------------------------------
// Teams are a real, new grouping — deliberately not the same thing as
// a hunt's per-user participation log
// ---------------------------------------------------------------------
// `hunts.js`'s `participations` already tracks which individual user
// checked in where. A mystery's clues are deliberately SHARED within a
// team — that sharing is the entire deduction tension the board game
// depends on, and a hunt with no teams (every user solo) still works:
// a solo user's own reveals are tracked under their own identity.

const { getHunt, getCheckpoint } = require('./hunts');

const SLOTS = ['who', 'what', 'where'];

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

// The parallel, never-serialized-with-the-hunt record. Created lazily
// on first real use — a hunt with no mystery never gets one.
function ensureMysteryRecord(store, huntId) {
  if (!store.mysteryHunts) store.mysteryHunts = [];
  let record = store.mysteryHunts.find((m) => m.huntId === huntId);
  if (!record) {
    record = {
      huntId,
      solution: null,
      clues: [],
      nextClueId: 1,
      teams: [],
      nextTeamId: 1,
      reveals: [],
      accusations: [],
      solvedByTeamKey: null,
      solvedAt: null,
    };
    store.mysteryHunts.push(record);
  }
  return record;
}

function getMysteryRecord(store, huntId) {
  return (store.mysteryHunts || []).find((m) => m.huntId === huntId) || null;
}

function requireHunt(store, huntId, action) {
  const hunt = getHunt(store, huntId);
  if (!hunt) throw new Error(`${action}: no hunt with id ${huntId}`);
  return hunt;
}

// ---------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------

function createMysteryTeam(store, options = {}) {
  const { huntId, name, memberUserIds } = options;
  requireHunt(store, huntId, 'createMysteryTeam');
  requireString(name, 'name', 'createMysteryTeam');
  if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
    throw new Error('createMysteryTeam requires a non-empty memberUserIds array');
  }
  const record = ensureMysteryRecord(store, huntId);
  // A real person solves one mystery at a time, on a given hunt — not
  // because of a rule in the box, but because sharing clues across two
  // teams they both belong to would make "team" meaningless.
  const alreadyOnATeam = memberUserIds.find(
    (userId) => record.teams.some((t) => t.memberUserIds.includes(userId)),
  );
  if (alreadyOnATeam) {
    throw new Error(`createMysteryTeam: ${alreadyOnATeam} is already on a team for this hunt's mystery`);
  }

  const team = {
    id: record.nextTeamId++,
    huntId,
    name: name.trim(),
    memberUserIds: [...memberUserIds],
    eliminatedFromMystery: false,
  };
  record.teams.push(team);
  return team;
}

function getMysteryTeam(store, huntId, teamId) {
  const record = getMysteryRecord(store, huntId);
  if (!record) return null;
  return record.teams.find((t) => t.id === teamId) || null;
}

// A real user's own team on this hunt's mystery, or null for a solo
// player — null is the honest, ordinary answer, not an error.
function teamFor(store, huntId, userId) {
  const record = getMysteryRecord(store, huntId);
  if (!record) return null;
  return record.teams.find((t) => t.memberUserIds.includes(userId)) || null;
}

// The real key clues/accusations are tracked under — a team's own id,
// or the solo user's own id when they have no team. One real identity
// either way, never both at once for the same person.
function identityKeyFor(store, huntId, userId) {
  const team = teamFor(store, huntId, userId);
  return team ? `team:${team.id}` : `user:${userId}`;
}

// ---------------------------------------------------------------------
// The hidden solution
// ---------------------------------------------------------------------

function setMysterySolution(store, options = {}) {
  const { huntId, who, what, where } = options;
  requireHunt(store, huntId, 'setMysterySolution');
  const solution = {
    who: requireString(who, 'who', 'setMysterySolution'),
    what: requireString(what, 'what', 'setMysterySolution'),
    where: requireString(where, 'where', 'setMysterySolution'),
  };
  const record = ensureMysteryRecord(store, huntId);
  // Once real play has started on this mystery, changing the hidden
  // answer underneath it would invalidate every clue and accusation
  // already made — refused outright rather than silently allowed.
  if (record.clues.length > 0 || record.accusations.length > 0) {
    throw new Error('setMysterySolution: this mystery already has real clues or accusations on it and cannot be changed');
  }
  record.solution = solution;
  return { huntId, slots: SLOTS };
}

function hasMysterySolution(store, huntId) {
  return Boolean(getMysteryRecord(store, huntId)?.solution);
}

// ---------------------------------------------------------------------
// Clues
// ---------------------------------------------------------------------

// `isRedHerring` is required, not inferred — a caller states their
// intent and this function checks it against the real hidden answer,
// so a clue can never be mislabeled by mistake.
function addMysteryClue(store, options = {}) {
  const { huntId, checkpointId, slot, value, isRedHerring } = options;
  const hunt = requireHunt(store, huntId, 'addMysteryClue');
  if (!getCheckpoint(hunt, checkpointId)) {
    throw new Error(`addMysteryClue: no checkpoint ${checkpointId} on hunt ${huntId}`);
  }
  if (!SLOTS.includes(slot)) {
    throw new Error(`addMysteryClue: slot must be one of ${SLOTS.join(', ')}`);
  }
  const realValue = requireString(value, 'value', 'addMysteryClue');
  if (typeof isRedHerring !== 'boolean') {
    throw new Error('addMysteryClue requires a real isRedHerring (true or false), stated explicitly');
  }
  const record = ensureMysteryRecord(store, huntId);
  if (!record.solution) {
    throw new Error('addMysteryClue: this hunt has no mystery solution set yet — call setMysterySolution first');
  }

  const isActuallyTrue = realValue === record.solution[slot];
  if (isRedHerring === isActuallyTrue) {
    throw new Error(
      isActuallyTrue
        ? `addMysteryClue: "${realValue}" IS the real ${slot} — it cannot be declared a red herring`
        : `addMysteryClue: "${realValue}" is NOT the real ${slot} — it must be declared a red herring (isRedHerring: true)`,
    );
  }

  const clue = {
    id: record.nextClueId++,
    huntId,
    checkpointId,
    slot,
    value: realValue,
    isRedHerring,
  };
  record.clues.push(clue);
  return clue;
}

function clueForCheckpoint(store, huntId, checkpointId) {
  const record = getMysteryRecord(store, huntId);
  if (!record) return null;
  return record.clues.find((c) => c.checkpointId === checkpointId) || null;
}

// ---------------------------------------------------------------------
// Revealing — the real sharing mechanic a team depends on
// ---------------------------------------------------------------------

// Called after a real checkpoint check-in (`hunts.checkInAtCheckpoint`)
// — this module never performs the check-in itself, it only shares
// whatever clue that checkpoint carries with the checking-in user's
// real team (or the user alone, with no team). Returns `null`,
// honestly, for a checkpoint with no mystery clue — the ordinary case
// on a hunt whose mystery only covers some of its checkpoints.
//
// **Idempotent per real identity.** `hunts.hasCheckedIn` already
// prevents a user checking in twice at the same checkpoint through
// the normal route; this guard exists for a caller invoking this
// function directly, so a repeat call never double-reveals.
function revealCluesFor(store, options = {}) {
  const { huntId, checkpointId, userId } = options;
  const hunt = requireHunt(store, huntId, 'revealCluesFor');
  if (!getCheckpoint(hunt, checkpointId)) {
    throw new Error(`revealCluesFor: no checkpoint ${checkpointId} on hunt ${huntId}`);
  }
  const clue = clueForCheckpoint(store, huntId, checkpointId);
  if (!clue) return null;

  const record = ensureMysteryRecord(store, huntId);
  const identityKey = identityKeyFor(store, huntId, userId);
  const already = record.reveals.some((r) => r.clueId === clue.id && r.identityKey === identityKey);
  if (!already) {
    record.reveals.push({ clueId: clue.id, identityKey, revealedAt: Date.now() });
  }
  return clue;
}

// Every real fact revealed so far to this user's own identity (their
// team, or themselves solo) — never the hidden solution itself, only
// what has actually been shown.
function knownFacts(store, options = {}) {
  const { huntId, userId } = options;
  const record = getMysteryRecord(store, huntId);
  if (!record) return [];
  const identityKey = identityKeyFor(store, huntId, userId);
  const clueIds = new Set(
    record.reveals.filter((r) => r.identityKey === identityKey).map((r) => r.clueId),
  );
  return record.clues
    .filter((c) => clueIds.has(c.id))
    .map((c) => ({ checkpointId: c.checkpointId, slot: c.slot, value: c.value, isRedHerring: c.isRedHerring }));
}

// ---------------------------------------------------------------------
// Accusation
// ---------------------------------------------------------------------

function makeAccusation(store, options = {}) {
  const { huntId, userId, guess } = options;
  requireHunt(store, huntId, 'makeAccusation');
  const record = ensureMysteryRecord(store, huntId);
  if (!record.solution) {
    throw new Error('makeAccusation: this hunt has no mystery solution set yet');
  }
  for (const slot of SLOTS) {
    requireString(guess?.[slot], slot, 'makeAccusation');
  }

  const identityKey = identityKeyFor(store, huntId, userId);
  const team = teamFor(store, huntId, userId);
  if (team?.eliminatedFromMystery) {
    throw new Error(`makeAccusation: team "${team.name}" already made a wrong accusation and cannot try again`);
  }
  if (record.solvedByTeamKey) {
    throw new Error('makeAccusation: this mystery has already been solved');
  }

  const correct = SLOTS.every((slot) => guess[slot] === record.solution[slot]);
  const accusation = {
    id: record.accusations.length + 1,
    huntId,
    identityKey,
    userId,
    guess: { who: guess.who, what: guess.what, where: guess.where },
    correct,
    madeAt: Date.now(),
  };
  record.accusations.push(accusation);

  if (correct) {
    record.solvedByTeamKey = identityKey;
    record.solvedAt = accusation.madeAt;
  } else if (team) {
    team.eliminatedFromMystery = true;
  }
  return accusation;
}

// A real, safe overview — never the hidden solution, never an
// individual clue's real value, only what has actually happened.
function mysteryStatus(store, huntId) {
  const record = getMysteryRecord(store, huntId);
  if (!record || !record.solution) {
    return { huntId, hasMystery: false };
  }
  return {
    huntId,
    hasMystery: true,
    slots: SLOTS,
    totalClues: record.clues.length,
    totalTeams: record.teams.length,
    totalAccusations: record.accusations.length,
    solved: Boolean(record.solvedByTeamKey),
    solvedAt: record.solvedAt,
  };
}

module.exports = {
  SLOTS,
  createMysteryTeam,
  getMysteryTeam,
  teamFor,
  setMysterySolution,
  hasMysterySolution,
  addMysteryClue,
  clueForCheckpoint,
  revealCluesFor,
  knownFacts,
  makeAccusation,
  mysteryStatus,
};
