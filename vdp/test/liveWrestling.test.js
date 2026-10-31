// VDP — live wrestling: the real-time, two-player move-exchange
// engine. Every assertion was watched failing against a reintroduced
// bug before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

import test from "node:test";
import assert from "node:assert";

import {
  MOVES, STARTING_HEALTH, STARTING_STAMINA, PIN_HEALTH_THRESHOLD, SUBMISSION_STAMINA_THRESHOLD,
  WrestlingError, startLiveMatch, submitMove, forfeitMatch, describeLiveMatch,
} from "../src/lib/liveWrestling.js";

function singlesMatch(over = {}) {
  return { matchId: "m1", matchFormat: "one-on-one", participantIds: ["ada", "bo"], status: "live", ...over };
}

// -- Starting a live match -------------------------------------------

test("starting a live match seeds both wrestlers at full health and stamina", () => {
  const live = startLiveMatch(singlesMatch());
  assert.deepEqual(live.wrestlers.ada, { health: STARTING_HEALTH, stamina: STARTING_STAMINA });
  assert.deepEqual(live.wrestlers.bo, { health: STARTING_HEALTH, stamina: STARTING_STAMINA });
  assert.equal(live.round, 1);
  assert.equal(live.status, "live");
});

test("only one-on-one and cage-match can go live — a rumble needs a turn structure this module does not have", () => {
  assert.throws(() => startLiveMatch(singlesMatch({ matchFormat: "royal-rumble" })), WrestlingError);
  assert.throws(() => startLiveMatch(singlesMatch({ matchFormat: "tag-team" })), WrestlingError);
  assert.doesNotThrow(() => startLiveMatch(singlesMatch({ matchFormat: "cage-match" })));
});

test("a match that is not already started cannot go live", () => {
  assert.throws(() => startLiveMatch(singlesMatch({ status: "scheduled" })), /not live/);
});

// -- Submitting moves, round pacing -----------------------------------

test("a round does not resolve until both wrestlers have submitted", () => {
  const live = startLiveMatch(singlesMatch());
  const first = submitMove(live, "ada", "strike");
  assert.equal(first.resolved, false);
  assert.equal(live.round, 1, "the round should not advance on one submission");
  assert.deepEqual(live.wrestlers.ada, { health: STARTING_HEALTH, stamina: STARTING_STAMINA }, "stamina should not be spent until the round resolves");
});

test("the second submission resolves the round for both", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "strike");
  const second = submitMove(live, "bo", "grapple");
  assert.equal(second.resolved, true);
  assert.equal(live.round, 2);
  assert.deepEqual(live.pendingMoves, {}, "pending moves should clear after a round resolves");
});

test("the same wrestler cannot submit twice in one round", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "strike");
  assert.throws(() => submitMove(live, "ada", "grapple"), /already submitted/);
});

test("an unknown wrestler or move is refused", () => {
  const live = startLiveMatch(singlesMatch());
  assert.throws(() => submitMove(live, "carl", "strike"), /not one of the two/);
  assert.throws(() => submitMove(live, "ada", "clothesline"), /must be one of/);
});

test("every real move is a valid submission", () => {
  for (const move of MOVES) {
    const live = startLiveMatch(singlesMatch());
    assert.doesNotThrow(() => submitMove(live, "ada", move));
  }
});

// -- The triangle ------------------------------------------------------

test("strike beats grapple, grapple beats highRisk, highRisk beats strike — each for base + bonus, the loser deals nothing", () => {
  const cases = [["strike", "grapple", "bo"], ["grapple", "highRisk", "bo"], ["highRisk", "strike", "bo"]];
  for (const [winMove, loseMove, loserId] of cases) {
    const live = startLiveMatch(singlesMatch());
    submitMove(live, "ada", winMove);
    submitMove(live, "bo", loseMove);
    assert.ok(live.wrestlers[loserId].health < STARTING_HEALTH, `${winMove} should have damaged ${loserId}`);
    const winnerId = loserId === "bo" ? "ada" : "bo";
    assert.equal(live.wrestlers[winnerId].health, STARTING_HEALTH, `${loseMove} should deal no damage when it loses the triangle`);
  }
});

test("the same offensive move on both sides is a clash — both take half damage, neither is spared", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "strike");
  submitMove(live, "bo", "strike");
  assert.ok(live.wrestlers.ada.health < STARTING_HEALTH);
  assert.ok(live.wrestlers.bo.health < STARTING_HEALTH);
  assert.equal(live.wrestlers.ada.health, live.wrestlers.bo.health, "a mirrored clash should be symmetric");
});

// -- Reversal -----------------------------------------------------------

test("reversal against a strike or grapple nullifies it — no damage either way", () => {
  for (const move of ["strike", "grapple"]) {
    const live = startLiveMatch(singlesMatch());
    submitMove(live, "ada", "reversal");
    submitMove(live, "bo", move);
    assert.equal(live.wrestlers.ada.health, STARTING_HEALTH);
    assert.equal(live.wrestlers.bo.health, STARTING_HEALTH);
  }
});

test("reversal against highRisk punishes the attacker for their own move's base damage", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "reversal");
  submitMove(live, "bo", "highRisk");
  assert.equal(live.wrestlers.ada.health, STARTING_HEALTH, "the reverser should take no damage");
  assert.ok(live.wrestlers.bo.health < STARTING_HEALTH, "a reversed top-rope move should hurt its own attacker");
});

test("two reversals is a mutual feint — nothing lands, stamina still spent", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "reversal");
  submitMove(live, "bo", "reversal");
  assert.equal(live.wrestlers.ada.health, STARTING_HEALTH);
  assert.equal(live.wrestlers.bo.health, STARTING_HEALTH);
  assert.ok(live.wrestlers.ada.stamina < STARTING_STAMINA);
});

// -- Finishers ------------------------------------------------------

function wearDownHealth(live, id, target) {
  live.wrestlers[id].health = target;
}
function wearDownStamina(live, id, target) {
  live.wrestlers[id].stamina = target;
}

test("a pin attempt against a healthy opponent fails and leaves the attempter fully exposed to real offense", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "pinAttempt");
  submitMove(live, "bo", "strike");
  assert.equal(live.status, "live", "a pin against full health should not end the match");
  assert.equal(live.wrestlers.ada.health, STARTING_HEALTH - 12, "a failed pin attempt should take the opponent's offense at full, undefended damage");
  assert.equal(live.wrestlers.bo.health, STARTING_HEALTH);
});

test("a pin attempt against a worn-down opponent wins the match outright", () => {
  const live = startLiveMatch(singlesMatch());
  wearDownHealth(live, "bo", PIN_HEALTH_THRESHOLD);
  submitMove(live, "ada", "pinAttempt");
  submitMove(live, "bo", "strike");
  assert.equal(live.status, "finished");
  assert.equal(live.winnerId, "ada");
  assert.equal(live.endedBy, "pin");
});

test("a pin attempt exactly one point above the threshold still fails", () => {
  const live = startLiveMatch(singlesMatch());
  wearDownHealth(live, "bo", PIN_HEALTH_THRESHOLD + 1);
  submitMove(live, "ada", "pinAttempt");
  submitMove(live, "bo", "reversal");
  assert.equal(live.status, "live");
});

test("a submission attempt against a worn-down opponent wins the match", () => {
  const live = startLiveMatch(singlesMatch());
  wearDownStamina(live, "bo", SUBMISSION_STAMINA_THRESHOLD);
  submitMove(live, "ada", "submissionAttempt");
  submitMove(live, "bo", "strike");
  assert.equal(live.status, "finished");
  assert.equal(live.winnerId, "ada");
  assert.equal(live.endedBy, "submission");
});

test("a reversal defeats neither a pin nor a submission attempt directly, but the attempt still only lands if the opponent qualifies", () => {
  const live = startLiveMatch(singlesMatch());
  // bo is healthy — the pin should not land even though ada played reversal-adjacent caution.
  submitMove(live, "ada", "reversal");
  submitMove(live, "bo", "pinAttempt");
  assert.equal(live.status, "live");
  assert.equal(live.wrestlers.ada.health, STARTING_HEALTH, "a reversal is not offense, so a failed pin against it should not connect");
});

test("two simultaneous, both-eligible finishers resolve deterministically — the wrestler worse off going in is caught, regardless of submission order", () => {
  // bo is worse off (lower health) here, and bo is also the SECOND
  // submitter -- the two cases below swap who submits first, so a
  // mutant that just hardcodes "whoever resolved the round" or
  // "whoever submitted second" as the loser cannot pass both.
  const first = startLiveMatch(singlesMatch());
  wearDownHealth(first, "ada", PIN_HEALTH_THRESHOLD);
  wearDownStamina(first, "ada", SUBMISSION_STAMINA_THRESHOLD);
  wearDownHealth(first, "bo", PIN_HEALTH_THRESHOLD - 5); // bo is worse off
  wearDownStamina(first, "bo", SUBMISSION_STAMINA_THRESHOLD);
  submitMove(first, "ada", "submissionAttempt");
  submitMove(first, "bo", "pinAttempt"); // bo submits second
  assert.equal(first.winnerId, "ada", "bo (worse off) should be caught even as the second submitter");

  const second = startLiveMatch(singlesMatch());
  wearDownHealth(second, "ada", PIN_HEALTH_THRESHOLD);
  wearDownStamina(second, "ada", SUBMISSION_STAMINA_THRESHOLD);
  wearDownHealth(second, "bo", PIN_HEALTH_THRESHOLD - 5); // bo is still worse off
  wearDownStamina(second, "bo", SUBMISSION_STAMINA_THRESHOLD);
  submitMove(second, "bo", "pinAttempt"); // bo submits first this time
  submitMove(second, "ada", "submissionAttempt");
  assert.equal(second.winnerId, "ada", "bo (worse off) should be caught even as the first submitter");
});

// -- Stoppage (health reaches 0 without a finisher) --------------------

test("health reaching 0 from ordinary offense ends the match by stoppage, even with no pin or submission", () => {
  const live = startLiveMatch(singlesMatch());
  wearDownHealth(live, "bo", 10);
  submitMove(live, "ada", "strike"); // beats nothing in particular, but strike vs reversal...
  submitMove(live, "bo", "grapple"); // strike beats grapple: 12+8=20 damage, bo at 10 -> 0
  assert.equal(live.status, "finished");
  assert.equal(live.winnerId, "ada");
  assert.equal(live.endedBy, "stoppage");
});

// -- Forfeit --------------------------------------------------------

test("forfeiting ends the match in the other wrestler's favor immediately", () => {
  const live = startLiveMatch(singlesMatch());
  const result = forfeitMatch(live, "ada");
  assert.equal(result.status, "finished");
  assert.equal(result.winnerId, "bo");
  assert.equal(result.endedBy, "forfeit");
});

test("forfeiting an already-finished match is refused", () => {
  const live = startLiveMatch(singlesMatch());
  forfeitMatch(live, "ada");
  assert.throws(() => forfeitMatch(live, "bo"), /not live/);
});

test("submitting a move after the match has finished is refused", () => {
  const live = startLiveMatch(singlesMatch());
  forfeitMatch(live, "ada");
  assert.throws(() => submitMove(live, "bo", "strike"), /not live/);
});

// -- describeLiveMatch --------------------------------------------------

test("describeLiveMatch reports who the server is still waiting on", () => {
  const live = startLiveMatch(singlesMatch());
  submitMove(live, "ada", "strike");
  const described = describeLiveMatch(live);
  assert.deepEqual(described.waitingOn, ["bo"]);
  assert.equal(described.rounds, 0, "a pending round has not been logged yet");
});

test("describeLiveMatch reports no one waited-on once the match is finished", () => {
  const live = startLiveMatch(singlesMatch());
  forfeitMatch(live, "ada");
  assert.deepEqual(describeLiveMatch(live).waitingOn, []);
});

// -- Determinism (no hidden randomness) ---------------------------------

test("the same two moves against the same state always resolve the same way", () => {
  const liveA = startLiveMatch(singlesMatch());
  const liveB = startLiveMatch(singlesMatch());
  submitMove(liveA, "ada", "highRisk");
  submitMove(liveA, "bo", "strike");
  submitMove(liveB, "ada", "highRisk");
  submitMove(liveB, "bo", "strike");
  assert.deepEqual(liveA.wrestlers, liveB.wrestlers);
});
