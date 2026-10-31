// VDP -- live wrestling: two real players, each controlling one real
// wrestler on a real `combatSports.js` card, deciding the match
// themselves round by round, rather than a result being declared for
// them. By direct instruction ("people can wrestle other players live
// too"), and a direct follow-up choosing the mechanic: a turn-based
// move exchange, not an instant simulation and not a real-time
// animated engine (this stack has no renderer -- see
// `world-layer/buildEstimate.js`'s own WORLD_KINDS split; VDP is
// state, not geometry, the same as everywhere else in this repo).
//
// **Scope, stated up front: two-participant matches only.**
// `one-on-one` and `cage-match` both take exactly two fighters
// (`combatSports.js`'s own `FORMAT_RULES`), which is what a
// simultaneous-move-exchange round can resolve cleanly. A live
// `royal-rumble` or `tag-team` -- three to thirty people, or two
// teams of two -- needs a genuinely different turn structure (whose
// turn, elimination order, tag mechanics) and is real, later work,
// not silently implied by this module's existence.
//
// **This module never calls `combatSports.recordResult` itself.**
// Same discipline that module's own header states for VAGO/VOKEN/
// Vavlt Stvdios: a second place that decides a winner is how two
// systems start disagreeing about who won. `resolveMatch`'s "ended"
// flag and `winnerId` are the fact; the caller (`server.cjs`) is the
// one place that feeds it to `combatSports.recordResult`, exactly the
// way it already does for an operator-declared result.
//
// **Training affects the match, by direct instruction ("they can get
// bigger, they can work out... incorporate working out and lifting
// weights").** Not a second stat system: `startLiveMatch`'s own
// `attributesByWrestler` reads the same real `Athletics`/`Combat`
// skills `skills.js` already has, real sources a player bumps by
// working out (`gainFromWorkout`) or any of the other three real
// sources that skill already had. Combat training raises a wrestler's
// own `strengthBonus` -- a real, bounded bonus to the damage THEY
// deal; Athletics training raises their `staminaDiscount` -- a real,
// bounded discount on the stamina cost THEY pay. Deliberately not a
// bonus to a wrestler's own max health: training makes you hit harder
// and gas out slower, not literally unkillable, and the health pool
// stays the one number every wrestler starts level on.
//
// **Every number below is a flagged, invented balance choice, not a
// transcription of real wrestling rules or a confirmed design
// document.** Same discipline `cardMarketPrice.js`'s own constants
// carry -- there is no source here to be unfaithful to, only a
// reasonable default to replace once real playtesting says otherwise.

export const STARTING_HEALTH = 100;
export const STARTING_STAMINA = 100;

// Below this health, an opponent's pin attempt can succeed. Below this
// stamina, an opponent's submission attempt can succeed. Deliberately
// separate thresholds on separate resources -- a pin wears down the
// body, a submission wears down the gas tank, and a real match can be
// won either way.
export const PIN_HEALTH_THRESHOLD = 25;
export const SUBMISSION_STAMINA_THRESHOLD = 25;

export const MOVES = ["strike", "grapple", "highRisk", "reversal", "pinAttempt", "submissionAttempt"];

const OFFENSIVE_MOVES = ["strike", "grapple", "highRisk"];
const FINISHER_MOVES = ["pinAttempt", "submissionAttempt"];

// Stamina is a real cost paid whether the move lands or not -- a
// missed top-rope move is exactly as tiring as a landed one.
const STAMINA_COST = {
  strike: 10, grapple: 15, highRisk: 25, reversal: 5, pinAttempt: 10, submissionAttempt: 15,
};

// Base damage for an offensive move that connects clean (no beat/lose
// interaction either way -- see `clashOutcome`).
const BASE_DAMAGE = { strike: 12, grapple: 10, highRisk: 20 };

// A real rock-paper-scissors triangle, in wrestling terms: a quick
// strike catches a wrestler mid-grapple setup; a grapple catches a
// high-flyer before they can leave the mat; a top-rope move catches a
// striker who is not looking up. The winner of a beat deals its base
// damage plus this bonus; the loser deals nothing -- they were beaten
// to the exchange, not merely out-traded.
const TRIANGLE_BONUS = 8;
const BEATS = { strike: "grapple", grapple: "highRisk", highRisk: "strike" };

// A mirrored exchange (same move both sides) is a real trade, not a
// non-event -- both wrestlers take half the move's base damage.
function clashDamage(move) {
  return Math.round(BASE_DAMAGE[move] / 2);
}

// Real, bounded training bonuses -- see this file's own header for
// why they scale damage dealt and stamina spent rather than max
// health. Flagged, invented numbers, same as every other constant
// above: a maxed-out skill (100) is a real, meaningful edge, not a
// small flavor bonus, but training can never make a wrestler's own
// moves free or guarantee a kill the opponent's health total doesn't
// already allow.
export const MAX_STRENGTH_BONUS = 0.3;
export const MAX_STAMINA_DISCOUNT = 0.3;

// `skills` is the caller's own real `{ combat, athletics }` reading --
// this module stays storage-agnostic about where that number lives,
// the same posture `combatSports.js` already takes about fighter data
// generally. Missing/omitted reads as untrained (0), not an error:
// a wrestler who has never touched a gym is a real, valid wrestler.
function deriveAttributes(skills = {}) {
  const combat = clamp(skills.combat ?? 0, 0, 100);
  const athletics = clamp(skills.athletics ?? 0, 0, 100);
  return {
    strengthBonus: (combat / 100) * MAX_STRENGTH_BONUS,
    staminaDiscount: (athletics / 100) * MAX_STAMINA_DISCOUNT,
  };
}

// Stamina spent by a real, specific wrestler -- their own training
// (not their opponent's) decides how far it is discounted.
function chargeStamina(state, move) {
  state.stamina = clamp(state.stamina - STAMINA_COST[move] * (1 - state.staminaDiscount), 0, STARTING_STAMINA);
}

// Damage dealt BY `attackerState` TO `defenderState` -- the
// attacker's own training decides how far `baseAmount` is scaled up;
// the defender's training has no say in how hard they get hit (that
// would double-count Athletics as both a stamina discount and a
// damage shield, which this module deliberately does not do).
function dealDamage(attackerState, defenderState, baseAmount) {
  defenderState.health = clamp(defenderState.health - baseAmount * (1 + attackerState.strengthBonus), 0, STARTING_HEALTH);
}

export class WrestlingError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WrestlingError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// `match` is a real `combatSports.js` match object -- this function
// does not re-validate its shape, only the two things specific to
// going live: the format must be one this module can referee, and it
// must already be `startMatch`'d (a live wrestling round makes no
// sense ahead of the broadcast/prediction-market machinery that
// `combatSports.js`'s own `startMatch` already gates).
// `options.attributesByWrestler` is an optional real
// `{ [wrestlerId]: { combat, athletics } }` map -- the caller's own
// reading of each wrestler's real skills (`server.cjs` passes
// `player.skills.Combat`/`.Athletics`). Omitted entirely, every
// wrestler starts untrained (0/0), identical to this function's
// behavior before training existed -- every existing caller and test
// that never passed this option sees exactly the same numbers it
// always has.
export function startLiveMatch(match, options = {}) {
  const a = "startLiveMatch";
  if (!match) throw new WrestlingError(`${a} requires a match`);
  if (match.matchFormat !== "one-on-one" && match.matchFormat !== "cage-match") {
    throw new WrestlingError(
      `${a}: live wrestling only referees one-on-one and cage-match today -- `
      + `"${match.matchFormat}" needs a turn structure this module does not have yet`,
    );
  }
  if (match.status !== "live") {
    throw new WrestlingError(`${a}: match ${match.matchId} is "${match.status}", not live`);
  }
  const attributesByWrestler = options.attributesByWrestler || {};
  const [a1, a2] = match.participantIds;
  return {
    matchId: match.matchId,
    wrestlers: {
      [a1]: { health: STARTING_HEALTH, stamina: STARTING_STAMINA, ...deriveAttributes(attributesByWrestler[a1]) },
      [a2]: { health: STARTING_HEALTH, stamina: STARTING_STAMINA, ...deriveAttributes(attributesByWrestler[a2]) },
    },
    round: 1,
    pendingMoves: {},
    log: [],
    status: "live",
    winnerId: null,
    endedBy: null, // "pin" | "submission" | "stoppage" | "forfeit"
  };
}

function otherWrestler(liveMatch, wrestlerId) {
  return Object.keys(liveMatch.wrestlers).find((id) => id !== wrestlerId);
}

// A finisher is eligible against the opponent's health/stamina AS OF
// the start of the round -- not after this round's offense has
// landed. A finisher and a strike thrown in the same round are a
// real-time race, not a sequence, and the honest simultaneous-move
// answer is "judge it on what was already true going in."
function finisherEligible(move, opponentState) {
  if (move === "pinAttempt") return opponentState.health <= PIN_HEALTH_THRESHOLD;
  if (move === "submissionAttempt") return opponentState.stamina <= SUBMISSION_STAMINA_THRESHOLD;
  return false;
}

// Resolves one round once both moves are known. Pure with respect to
// `liveMatch` beyond the mutations it is documented to make -- no
// hidden randomness, so the same two moves against the same state
// always resolve the same way (a real, auditable referee, not a dice
// roll dressed as one).
function resolveRound(liveMatch, idA, moveA, idB, moveB) {
  const stateA = liveMatch.wrestlers[idA];
  const stateB = liveMatch.wrestlers[idB];
  const startA = { ...stateA };
  const startB = { ...stateB };

  // Stamina is spent by both, regardless of what happens next.
  chargeStamina(stateA, moveA);
  chargeStamina(stateB, moveB);

  const finisherA = FINISHER_MOVES.includes(moveA);
  const finisherB = FINISHER_MOVES.includes(moveB);

  let outcome = null;

  if (finisherA || finisherB) {
    const aLands = finisherA && finisherEligible(moveA, startB);
    const bLands = finisherB && finisherEligible(moveB, startA);

    if (aLands && bLands) {
      // Both wrestlers were genuinely finishable going into the round
      // and both went for it. A documented, deterministic tie-break
      // rather than an unexplained coin flip: the wrestler already
      // worse off (lower own health) is the one who gets caught --
      // they had less left to fight the finish off with.
      const loser = stateA.health <= stateB.health ? idA : idB;
      outcome = { type: moveA === "pinAttempt" || moveB === "pinAttempt" ? "pin" : "submission", winnerId: loser === idA ? idB : idA, loserId: loser };
    } else if (aLands) {
      outcome = { type: moveA === "pinAttempt" ? "pin" : "submission", winnerId: idA, loserId: idB };
    } else if (bLands) {
      outcome = { type: moveB === "pinAttempt" ? "pin" : "submission", winnerId: idB, loserId: idA };
    } else {
      // Neither finisher landed. A failed finisher leaves its own
      // wrestler fully exposed: if the opponent threw real offense
      // this round, it connects clean, no clash reduction -- you
      // cannot defend a strike while trying to lock in a submission.
      if (finisherA && OFFENSIVE_MOVES.includes(moveB)) {
        dealDamage(stateB, stateA, BASE_DAMAGE[moveB]);
      } else if (finisherB && OFFENSIVE_MOVES.includes(moveA)) {
        dealDamage(stateA, stateB, BASE_DAMAGE[moveA]);
      }
      // Both attempted finishers against someone not yet ready, or a
      // finisher against a reversal: nothing connects this round.
    }
  } else {
    // Ordinary offense/defense round -- no finisher in play.
    outcome = resolveOffense(stateA, moveA, stateB, moveB);
  }

  liveMatch.log.push({
    round: liveMatch.round,
    moves: { [idA]: moveA, [idB]: moveB },
    healthAfter: { [idA]: stateA.health, [idB]: stateB.health },
    staminaAfter: { [idA]: stateA.stamina, [idB]: stateB.stamina },
    outcome: outcome ? outcome.type : null,
  });

  if (outcome && (outcome.type === "pin" || outcome.type === "submission")) {
    liveMatch.status = "finished";
    liveMatch.winnerId = outcome.winnerId;
    liveMatch.endedBy = outcome.type;
  } else if (stateA.health <= 0 || stateB.health <= 0) {
    liveMatch.status = "finished";
    liveMatch.winnerId = stateA.health <= 0 ? idB : idA;
    liveMatch.endedBy = "stoppage";
  } else {
    liveMatch.round += 1;
  }
}

// The offense/defense half of a round -- no finisher involved.
// Mutates the two wrestler states it is given and returns nothing;
// `resolveRound` already logs the outcome type from the states alone.
function resolveOffense(stateA, moveA, stateB, moveB) {
  if (moveA === "reversal" && moveB === "reversal") return null; // a mutual feint -- nothing lands
  if (moveA === "reversal" || moveB === "reversal") {
    const [attackerMove, attackerState] = moveA === "reversal" ? [moveB, stateB] : [moveA, stateA];
    if (attackerMove === "highRisk") {
      // The hard punish: a read top-rope move is turned back on its
      // own wrestler, for its own full base damage -- self-inflicted,
      // not scaled by the reverser's own strength (they didn't throw
      // the move that hurt the attacker, the botch did).
      attackerState.health = clamp(attackerState.health - BASE_DAMAGE.highRisk, 0, STARTING_HEALTH);
    }
    // A reversed strike or grapple lands on nobody -- the point of
    // reading it correctly.
    return null;
  }
  if (moveA === moveB) {
    dealDamage(stateA, stateB, clashDamage(moveA));
    dealDamage(stateB, stateA, clashDamage(moveB));
    return null;
  }
  // The triangle. Exactly one direction can be true for two distinct
  // offensive moves.
  if (BEATS[moveA] === moveB) {
    dealDamage(stateA, stateB, BASE_DAMAGE[moveA] + TRIANGLE_BONUS);
  } else {
    dealDamage(stateB, stateA, BASE_DAMAGE[moveB] + TRIANGLE_BONUS);
  }
  return null;
}

// A wrestler submits their move for the current round. Returns the
// live match either way -- `resolved: true` on the return value when
// this call was the second move in and the round actually ran, so the
// caller (server.cjs) knows whether to broadcast a resolved round or
// just acknowledge a pending one.
export function submitMove(liveMatch, wrestlerId, move) {
  const a = "submitMove";
  if (!liveMatch) throw new WrestlingError(`${a} requires a live match`);
  if (liveMatch.status !== "live") {
    throw new WrestlingError(`${a}: match ${liveMatch.matchId} is "${liveMatch.status}", not live`);
  }
  requireString(wrestlerId, "wrestlerId", a);
  if (!liveMatch.wrestlers[wrestlerId]) {
    throw new WrestlingError(`${a}: ${wrestlerId} is not one of the two wrestlers in this match`);
  }
  if (!MOVES.includes(move)) {
    throw new WrestlingError(`${a}: move must be one of ${MOVES.join(", ")}`);
  }
  if (liveMatch.pendingMoves[wrestlerId]) {
    throw new WrestlingError(`${a}: ${wrestlerId} already submitted a move for round ${liveMatch.round}`);
  }

  liveMatch.pendingMoves[wrestlerId] = move;

  const otherId = otherWrestler(liveMatch, wrestlerId);
  const otherMove = liveMatch.pendingMoves[otherId];
  if (!otherMove) {
    return { liveMatch, resolved: false };
  }

  resolveRound(liveMatch, wrestlerId, move, otherId, otherMove);
  liveMatch.pendingMoves = {};
  return { liveMatch, resolved: true };
}

// A wrestler concedes -- a real, honest way for a live match to end
// when a player disconnects or quits, not something `server.cjs`
// should have to reinvent per route.
export function forfeitMatch(liveMatch, wrestlerId) {
  const a = "forfeitMatch";
  if (!liveMatch) throw new WrestlingError(`${a} requires a live match`);
  if (liveMatch.status !== "live") {
    throw new WrestlingError(`${a}: match ${liveMatch.matchId} is "${liveMatch.status}", not live`);
  }
  const otherId = otherWrestler(liveMatch, wrestlerId);
  if (!liveMatch.wrestlers[wrestlerId]) {
    throw new WrestlingError(`${a}: ${wrestlerId} is not one of the two wrestlers in this match`);
  }
  liveMatch.status = "finished";
  liveMatch.winnerId = otherId;
  liveMatch.endedBy = "forfeit";
  return liveMatch;
}

export function describeLiveMatch(liveMatch) {
  return {
    matchId: liveMatch.matchId,
    round: liveMatch.round,
    status: liveMatch.status,
    winnerId: liveMatch.winnerId,
    endedBy: liveMatch.endedBy,
    wrestlers: liveMatch.wrestlers,
    waitingOn: liveMatch.status === "live"
      ? Object.keys(liveMatch.wrestlers).filter((id) => !liveMatch.pendingMoves[id])
      : [],
    rounds: liveMatch.log.length,
  };
}
