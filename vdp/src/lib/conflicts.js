// VDP — Conflicts: disputes and street/turf fights between two sides
// of any size, including deliberately uneven ("handicap") sides.
//
// Per direct instruction (31 Oct 2026): "tribes, organization, gangs,
// cities, cultures, families can choose to fight to settle disputes.
// And also, these things can be done just on turf as well... It could
// be a 2-on-2, a 1-versus-3, 5-versus-5, 10-versus-10. It could be any
// uneven handicap on the streets. No rules, but the same type of
// things apply."
//
// **This is deliberately not `combatSports.js`.** That module owns the
// sanctioned career ladder for an individual fighter (street/amateur/
// semi-pro/professional), and its own header already records a
// considered, documented compliance decision: street-tier bouts there
// settle no money, because "an unlicensed underground-fight economy
// is a different compliance object than a sanctioned one." A dispute
// between two tribes, or a no-rules turf fight with no referee and no
// career at stake, is a different real thing again -- an event
// between groups, not a fighter's sanctioned bout -- so it gets its
// own object here instead of reopening that decision.
// `combatSports.js`'s `SETTLING_TIERS` is untouched by this file.
//
// **Mechanic: a real gauntlet, not a new combat engine.** Each side is
// a real, ordered queue of fighters. The current front fighter of
// each side fights one real duel (`liveWrestling.js` -- the exact same
// turn-based engine two individual players already use); the loser is
// eliminated from their side's queue, the winner stays in and faces
// the other side's next fighter. A side whose queue empties has lost
// the whole conflict. This is what makes an uneven handicap (12 versus
// 8) a real, run-able thing instead of a special case: the smaller
// side simply has fewer fighters left to lose, nothing about the duel
// itself changes.
//
// **No format/headcount rule, by design.** `combatSports.js` checks a
// roster against `FORMAT_RULES` because a sanctioned card has to be a
// real, run-able bout of a known shape. A street fight has no such
// shape -- "no rules" is the direct instruction -- so the only real
// constraints here are the ones that make a gauntlet well-formed at
// all: each side needs at least one fighter, and nobody can fight for
// both sides at once.

export class ConflictError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConflictError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function buildSide(side, label, action) {
  if (!side || typeof side !== 'object') {
    throw new ConflictError(`${action} requires a real ${label}`);
  }
  const participantIds = Array.isArray(side.participantIds)
    ? side.participantIds.map((p) => requireString(String(p ?? ''), `${label}.participantIds entry`, action))
    : [];
  if (participantIds.length === 0) {
    throw new ConflictError(`${action}: ${label} needs at least one fighter`);
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new ConflictError(`${action}: ${label} has the same fighter listed twice`);
  }
  return {
    // A real tribe/gang/org/city id, or null for an ad hoc street
    // crew with no group behind it -- both are real, per direct
    // instruction ("these things can be done just on turf as well").
    groupId: side.groupId != null ? requireString(String(side.groupId), `${label}.groupId`, action) : null,
    label: side.label ? requireString(side.label, `${label}.label`, action) : (side.groupId != null ? String(side.groupId) : 'street crew'),
    participantIds,
    queue: [...participantIds],
  };
}

// `kind` stays an open string, the same deliberate choice
// `combatSports.js` makes for `combatSportType` -- "dispute" and
// "street-fight" are the two the direct instruction names, but a
// turf war, a tribal rite of combat, or anything else real is not a
// code change away.
export function createConflict(options = {}) {
  const a = 'createConflict';
  const { conflictId, kind, reason = null, sideA, sideB, scheduledAt = null } = options;

  const id = requireString(conflictId, 'conflictId', a);
  const conflictKind = requireString(kind, 'kind', a).toLowerCase();
  const builtA = buildSide(sideA, 'sideA', a);
  const builtB = buildSide(sideB, 'sideB', a);

  const overlap = builtA.participantIds.filter((p) => builtB.participantIds.includes(p));
  if (overlap.length > 0) {
    throw new ConflictError(`${a}: ${overlap.join(', ')} ${overlap.length === 1 ? 'is' : 'are'} listed on both sides`);
  }

  return {
    conflictId: id,
    kind: conflictKind,
    reason: reason != null ? String(reason) : null,
    sideA: builtA,
    sideB: builtB,
    scheduledAt,
    startedAt: null,
    status: 'scheduled',
    winningSide: null,
    resolution: null, // "gauntlet" | "forfeit", once decided
    log: [],
    escalation: null, // set by `escalateToWar` once a real war threshold is crossed
  };
}

// -- Escalation to war ----------------------------------------------------
//
// Per direct instruction (31 Oct 2026): "after so many people are
// involved in a street confrontation, and for so long... once people
// have took injuries, and so many people are involved, and so much of
// them, it could be considered a war between two different factions."
// Three real, compounding factors, not one: real injuries (every
// resolved duel is a real loser -- `conflict.log.length` is already
// that count, nothing new to track), real headcount (both sides'
// starting rosters), and real elapsed time since the conflict went
// live. All three invented thresholds below are flagged, the same way
// every other made-up game-balance number in this district is --
// `WAR_THRESHOLDS` is the one place to retune them.
//
// A war is not a different object: it is the same two-faction conflict
// with `escalation` set, so `recordConflictResult` can credit it under
// its own `conflict:war` discipline (a tribe's war record is a real,
// separate stat from its ordinary dispute record) without inventing a
// parallel conflict type.
export const WAR_THRESHOLDS = {
  minInjuries: 3,
  minTotalParticipants: 6,
  minDurationMs: 10 * 60 * 1000, // 10 real minutes of live confrontation
};

// Read-only -- how close a live conflict is to the real war threshold,
// for a narrator/promoter deciding whether to call it, or a VAGO
// market asking "will this become a war?" before it has.
export function assessWarEscalation(conflict, { now = Date.now() } = {}) {
  const injuries = conflict.log.length;
  const totalParticipants = conflict.sideA.participantIds.length + conflict.sideB.participantIds.length;
  const durationMs = conflict.startedAt != null ? Math.max(0, now - conflict.startedAt) : 0;
  const metrics = { injuries, totalParticipants, durationMs };
  const escalated = injuries >= WAR_THRESHOLDS.minInjuries
    && totalParticipants >= WAR_THRESHOLDS.minTotalParticipants
    && durationMs >= WAR_THRESHOLDS.minDurationMs;
  return { escalated, metrics };
}

// The real state change -- refuses early (nothing invents a war that
// has not actually crossed the threshold) and refuses late (a decided
// conflict has nothing left to escalate). Idempotent once a war,
// because the same conflict asked twice should not throw.
export function escalateToWar(conflict, { now = Date.now() } = {}) {
  const a = 'escalateToWar';
  if (conflict.escalation) return conflict;
  if (conflict.status === 'finished') {
    throw new ConflictError(`${a}: conflict ${conflict.conflictId} is already decided -- nothing left to escalate`);
  }
  const assessment = assessWarEscalation(conflict, { now });
  if (!assessment.escalated) {
    throw new ConflictError(
      `${a}: conflict ${conflict.conflictId} has not crossed the real war threshold yet `
      + `(${JSON.stringify(assessment.metrics)} vs ${JSON.stringify(WAR_THRESHOLDS)})`,
    );
  }
  conflict.escalation = { since: now, metrics: assessment.metrics };
  return conflict;
}

// The same real reason `combatSports.assertBookable` exists: a fighter
// already engaged elsewhere (a sanctioned live match, or another live
// conflict) cannot also be fighting here. Conflicts has no global
// fixture list of its own, so the caller passes in every id currently
// engaged anywhere -- the same "do not invent a second source of
// truth" the sanctioned version already documents.
export function assertBookable(conflict, busyParticipantIds = []) {
  const a = 'assertBookable';
  const busy = new Set(busyParticipantIds);
  const clash = [...conflict.sideA.participantIds, ...conflict.sideB.participantIds].filter((p) => busy.has(p));
  if (clash.length > 0) {
    throw new ConflictError(`${a}: ${clash.join(', ')} ${clash.length === 1 ? 'is' : 'are'} already engaged elsewhere`);
  }
  return conflict;
}

export function startConflict(conflict, { now = Date.now() } = {}) {
  if (conflict.status !== 'scheduled') {
    throw new ConflictError(`startConflict: conflict ${conflict.conflictId} is "${conflict.status}", not scheduled`);
  }
  conflict.status = 'live';
  conflict.startedAt = now;
  return conflict;
}

// The one duel that is actually live right now -- the front of each
// side's queue. `null` once either side (or an already-finished
// conflict) has nobody left to fight.
export function currentDuel(conflict) {
  return {
    sideAFighter: conflict.sideA.queue[0] ?? null,
    sideBFighter: conflict.sideB.queue[0] ?? null,
  };
}

function finishConflict(conflict, winningSideKey, resolution) {
  conflict.status = 'finished';
  conflict.winningSide = winningSideKey;
  conflict.resolution = resolution;
}

// Called once a duel between the current two front fighters has a
// real winner (settled the same way an individual live wrestling
// match already settles -- see `server.cjs`). The loser is eliminated
// from their side's queue; the winner stays at the front of their own
// side to face whoever the other side sends next. A side whose queue
// is now empty has lost the whole conflict.
export function recordDuelResult(conflict, winnerId) {
  const a = 'recordDuelResult';
  if (conflict.status !== 'live') {
    throw new ConflictError(`${a}: conflict ${conflict.conflictId} is "${conflict.status}", not live`);
  }
  const { sideAFighter, sideBFighter } = currentDuel(conflict);
  if (sideAFighter == null || sideBFighter == null) {
    throw new ConflictError(`${a}: one side has already run out of fighters`);
  }
  if (winnerId !== sideAFighter && winnerId !== sideBFighter) {
    throw new ConflictError(`${a}: ${winnerId} is not fighting in the current duel`);
  }
  const winnerOnA = winnerId === sideAFighter;
  const winnerSide = winnerOnA ? conflict.sideA : conflict.sideB;
  const loserSide = winnerOnA ? conflict.sideB : conflict.sideA;
  const loserId = loserSide.queue.shift();

  conflict.log.push({ winnerId, loserId });

  if (loserSide.queue.length === 0) {
    finishConflict(conflict, winnerOnA ? 'A' : 'B', 'gauntlet');
  }
  return conflict;
}

// A side can concede the whole conflict outright -- the same real
// option `liveWrestling.forfeitMatch` already gives one wrestler in a
// single duel, raised to the level of an entire side.
export function forfeitSide(conflict, sideKey) {
  const a = 'forfeitSide';
  if (conflict.status !== 'live' && conflict.status !== 'scheduled') {
    throw new ConflictError(`${a}: conflict ${conflict.conflictId} is "${conflict.status}", already decided`);
  }
  if (sideKey !== 'A' && sideKey !== 'B') {
    throw new ConflictError(`${a}: sideKey must be "A" or "B"`);
  }
  finishConflict(conflict, sideKey === 'A' ? 'B' : 'A', 'forfeit');
  return conflict;
}

// The gate before calling VAGO -- unlike `combatSports.js`, this gate
// never excludes "street" by tier. Per direct instruction ("people can
// also predict on street fights as well... bystanders or users can
// bet on street fights or confrontations or conflicts"), a dispute and
// a street fight are both real, bettable events the moment they
// exist; the only real reason prediction closes is that the outcome
// is already known.
export function predictionEligibility(conflict) {
  if (conflict.status === 'finished') {
    return { eligible: false, reason: 'this conflict is already decided' };
  }
  return { eligible: true, reason: null };
}

export function describeConflict(conflict) {
  const market = predictionEligibility(conflict);
  const duel = currentDuel(conflict);
  return {
    conflictId: conflict.conflictId,
    kind: conflict.kind,
    reason: conflict.reason,
    status: conflict.status,
    resolution: conflict.resolution,
    winningSide: conflict.winningSide,
    escalation: conflict.escalation,
    warEscalation: conflict.status !== 'finished' ? assessWarEscalation(conflict) : null,
    sideA: {
      groupId: conflict.sideA.groupId, label: conflict.sideA.label,
      startingCount: conflict.sideA.participantIds.length, remaining: conflict.sideA.queue.length,
    },
    sideB: {
      groupId: conflict.sideB.groupId, label: conflict.sideB.label,
      startingCount: conflict.sideB.participantIds.length, remaining: conflict.sideB.queue.length,
    },
    currentDuel: conflict.status === 'live' ? duel : null,
    rounds: conflict.log.length,
    predictions: market.eligible ? 'open' : market.reason,
  };
}
