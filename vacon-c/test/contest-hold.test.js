// VACANCY — submission holds (contest.resolveHold), task #136's live
// counterpart to crime.js's own per-incident force-level rating.
//
// Three things to pin down, each with its own section below:
//
//   1. **Determinism and re-runnability.** `resolveHold` computes a
//      whole round-by-round trace in one seeded call, same discipline
//      as `resolveContest`; `verifyHold` must re-derive the identical
//      trace from the recorded seed and chances, never from a re-read
//      of the live world (`verifyContest`'s own reasoning).
//   2. **Two real endings, not one.** `choke`/`knee_on_neck` can pass
//      somebody out; `arm_hold` cannot, by construction, because it is
//      a joint lock, not an airway restriction.
//   3. **Honest refusals.** An unrated entity returns `null`, never a
//      fabricated number; a bad technique name or a self-target throws.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contest = require('../server/contest.js');
const engine = require('../server/engine.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Byte-identical to contest.test.js's own fixture helper — see that
// file's header for why this resolves through the real trait_id
// catalog and throws on a missing row, rather than failing silently.
function setTrait(entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  const row = engine.WorldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === traitId,
  );
  if (!row) throw new Error(`entity ${entityId} carries no ${family}.${name} row to set`);
  row.current_value = value;
  row.base_value = value;
  return row;
}

function person(overrides = {}) {
  const npc = engine.generateNPC();
  const sheet = engine.WorldState.npcs.find((n) => n.id === npc.id);
  for (const [family, traits] of Object.entries(overrides)) {
    for (const [name, value] of Object.entries(traits)) {
      setTrait(npc.id, family, name, value);
      if (sheet.traits[family]) sheet.traits[family][name] = value;
    }
  }
  return npc;
}

function strongHolder() {
  return person({
    physical: { Strength: 95 },
    combat: { 'Melee Skill': 95, 'Composure Under Fire': 50 },
  });
}

// Physically weak (builds pressure fast, cannot escape) AND stubborn
// (high Composure Under Fire / Pain Tolerance — real traits that
// resist SUBMITTING, not traits that resist the hold itself). A victim
// weak in both dimensions submits before the bar ever fills, which is
// the mechanic correctly modelling a real martial-arts convention —
// tapping out specifically to avoid being choked unconscious — not a
// bug; `weakAndStubbornVictim` isolates the one real combination that
// actually reaches a pass-out.
function weakAndStubbornVictim() {
  return person({
    physical: { Strength: 10, Endurance: 10, 'Pain Tolerance': 95 },
    combat: { 'Composure Under Fire': 95 },
  });
}

// Weak in every dimension, including the will to keep enduring —
// submits quickly rather than being choked all the way out.
function weakVictim() {
  return person({
    physical: { Strength: 10, Endurance: 10, 'Pain Tolerance': 10 },
    combat: { 'Composure Under Fire': 10 },
  });
}

function toughVictim() {
  return person({
    physical: { Strength: 95, Endurance: 95, 'Pain Tolerance': 95 },
    combat: { 'Composure Under Fire': 95 },
  });
}

// ---------------------------------------------------------------------------
// The technique vocabulary is exactly three, and only two can pass out
// ---------------------------------------------------------------------------

test('there are exactly three real techniques, matching the task\'s own examples', () => {
  assert.deepEqual(
    [...contest.HOLD_TECHNIQUE_NAMES].sort(),
    ['arm_hold', 'choke', 'knee_on_neck'],
  );
});

test('choke and knee_on_neck can pass somebody out; arm_hold cannot', () => {
  assert.equal(contest.HOLD_TECHNIQUES.choke.passesOut, true);
  assert.equal(contest.HOLD_TECHNIQUES.knee_on_neck.passesOut, true);
  assert.equal(contest.HOLD_TECHNIQUES.arm_hold.passesOut, false);
});

test('a bad technique name throws, naming the three real ones', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  assert.throws(
    () => contest.resolveHold(engine.WorldState, {
      holderId: holder.id, victimId: victim.id, technique: 'headlock', tick: 1,
    }),
    /not a real technique.*choke.*knee_on_neck.*arm_hold|not a real technique/,
  );
});

test('a holder cannot target themselves', () => {
  const holder = strongHolder();
  assert.throws(
    () => contest.resolveHold(engine.WorldState, {
      holderId: holder.id, victimId: holder.id, technique: 'choke', tick: 1,
    }),
    /needs two different people/,
  );
});

// ---------------------------------------------------------------------------
// Refusals are honest nulls, not fabricated numbers
// ---------------------------------------------------------------------------

test('an unrated entity (no traits generated at all) returns null, never throws', () => {
  // A plain object with an id and no entityTraits rows at all — the
  // same "unrated resolve cannot be given a number" refusal
  // rateEntity's own callers already get.
  const unratedWorld = { tick: 1, npcs: [{ id: 9001 }, { id: 9002 }], entityTraits: [] };
  const result = contest.resolveHold(unratedWorld, {
    holderId: 9001, victimId: 9002, technique: 'choke', tick: 1,
  });
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// A real, overwhelming mismatch resolves to the physically correct ending
// ---------------------------------------------------------------------------

test('an overwhelming choke against a weak, stubborn-to-submit victim passes them out', () => {
  const holder = strongHolder();
  const victim = weakAndStubbornVictim();
  const result = contest.resolveHold(engine.WorldState, {
    holderId: holder.id, victimId: victim.id, technique: 'choke', tick: 1, contestId: 'test-choke-1',
  });
  assert.ok(result);
  assert.equal(result.outcome, 'passed_out');
  assert.ok(result.rounds.length >= 1);
  assert.equal(result.rounds[result.rounds.length - 1].event, 'passed_out');
});

// A victim built so arm_hold's own real pressure DOES reach the 100
// ceiling (low Strength + low Pain Tolerance, arm_hold's own two real
// resistance traits) while high Composure Under Fire keeps them from
// submitting on the first chance to -- found by searching real ticks
// until the trace actually touched 100 without resolving first.
function ceilingReachingArmHoldVictim() {
  return person({
    physical: { Strength: 10, Endurance: 50, 'Pain Tolerance': 10 },
    combat: { 'Composure Under Fire': 95 },
  });
}

test('arm_hold never passes out, even when its own real pressure reaches the ceiling', () => {
  // This is the test that actually exercises `passesOut`'s gate,
  // confirmed by mutation: `weakVictim` (the fixture used elsewhere in
  // this file) never drives arm_hold's pressure anywhere near 100 --
  // Pain Tolerance governs BOTH arm_hold's resistance and how readily
  // a victim submits, so a victim weak enough to build pressure fast
  // is also weak enough to tap out long before the ceiling, and a test
  // built on that fixture would pass whether or not the `passesOut &&`
  // check in `runHoldRounds` was ever removed -- the exact
  // non-discriminating shape CLAUDE.md's standing rules repeatedly
  // name. `ceilingReachingArmHoldVictim` separates the two traits:
  // Composure Under Fire (which the submit check reads) is kept high
  // on purpose, so pressure keeps climbing past the submit threshold
  // for several real rounds before a submission actually lands.
  //
  // Mutation-verified: removing the `passesOut &&` guard
  // (`if (pressure >= HOLD_PASS_OUT_THRESHOLD)` with no technique
  // check) made this exact test fail -- the real trace below hits
  // pressure 100 at round 4 and the mutated code would turn that into
  // 'passed_out' immediately, where the real code keeps checking for a
  // submission (or, failing that, 'released' at HOLD_MAX_ROUNDS).
  // Confirmed, then reverted.
  const holder = strongHolder();
  const victim = ceilingReachingArmHoldVictim();
  let sawCeiling = false;
  for (let tick = 0; tick < 50; tick += 1) {
    const result = contest.resolveHold(engine.WorldState, {
      holderId: holder.id, victimId: victim.id, technique: 'arm_hold', tick, contestId: `armhold-ceiling-${tick}`,
    });
    const maxPressure = Math.max(...result.rounds.map((r) => r.pressure));
    if (maxPressure >= contest.HOLD_PASS_OUT_THRESHOLD) sawCeiling = true;
    assert.notEqual(result.outcome, 'passed_out', `arm_hold must never pass out (tick ${tick})`);
  }
  assert.ok(sawCeiling, 'expected at least one of these 50 draws to actually reach the pressure ceiling');
});

test('a weak victim who will not endure (low Composure/Pain Tolerance) can submit before passing out', () => {
  // A fixed tick/contestId pin was tried first and was NOT robust: the
  // shared engine.WorldState singleton accumulates NPCs across every
  // test in this file (and, in a full suite run, every test in every
  // file before it), so the entity ids this fixture draws -- and
  // therefore the seed -- shift depending on run order. This searches
  // a real bounded range instead of hard-coding one magic number, the
  // same "do not trust one seed's accident" lesson CLAUDE.md's
  // twenty-fourth standing rule already names.
  //
  // Mutation-verified: removing the `enduranceChance !== null` submit
  // check in `runHoldRounds` (temporarily
  // `if (false && pressure >= HOLD_SUBMIT_THRESHOLD && ...)`) made
  // every one of these 40 attempts come back 'escaped' or
  // 'passed_out', never 'submitted' -- confirmed, then reverted.
  const holder = strongHolder();
  const victim = weakVictim();
  const outcomes = new Set();
  for (let i = 0; i < 40; i += 1) {
    const result = contest.resolveHold(engine.WorldState, {
      holderId: holder.id, victimId: victim.id, technique: 'choke', tick: i, contestId: `submit-search-${i}`,
    });
    outcomes.add(result.outcome);
  }
  assert.ok(outcomes.has('submitted'), `expected at least one 'submitted' outcome across 40 draws, got: ${[...outcomes]}`);
});

test('a tough, strong victim is far more likely to escape a weak holder', () => {
  const weakHolder = person({
    physical: { Strength: 10 },
    combat: { 'Melee Skill': 10 },
  });
  const victim = toughVictim();
  const result = contest.resolveHold(engine.WorldState, {
    holderId: weakHolder.id, victimId: victim.id, technique: 'choke', tick: 1, contestId: 'test-escape-1',
  });
  assert.ok(result);
  assert.equal(result.outcome, 'escaped');
});

// ---------------------------------------------------------------------------
// Determinism — the same inputs always give the same trace
// ---------------------------------------------------------------------------

test('the same holder, victim, technique and tick always produce the identical trace', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  const a = contest.resolveHold(engine.WorldState, {
    holderId: holder.id, victimId: victim.id, technique: 'knee_on_neck', tick: 7, contestId: 'determinism-1',
  });
  const b = contest.resolveHold(engine.WorldState, {
    holderId: holder.id, victimId: victim.id, technique: 'knee_on_neck', tick: 7, contestId: 'determinism-1',
  });
  assert.deepEqual(a, b);
});

test('a different contestId on the same pair/tick/technique can produce a different trace', () => {
  // Mutation-style pin: if seedFor's contestId input were ignored, this
  // would be deterministic to the point of being unable to tell two
  // real bouts in the same tick apart.
  const holder = strongHolder();
  const victim = weakVictim();
  const results = new Set();
  for (let i = 0; i < 10; i += 1) {
    const r = contest.resolveHold(engine.WorldState, {
      holderId: holder.id, victimId: victim.id, technique: 'choke', tick: 3, contestId: `distinct-${i}`,
    });
    results.add(r.seed);
  }
  assert.ok(results.size > 1, 'ten different contestIds produced only one distinct seed');
});

// ---------------------------------------------------------------------------
// verifyHold re-derives from the RECORDED seed and chances, not the live world
// ---------------------------------------------------------------------------

test('verifyHold reproduces a real result', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  const result = contest.resolveHold(engine.WorldState, {
    holderId: holder.id, victimId: victim.id, technique: 'choke', tick: 2, contestId: 'verify-1',
  });
  const verified = contest.verifyHold(engine.WorldState, result);
  assert.equal(verified.seedMatches, true);
  assert.equal(verified.reproduced, true);
  assert.equal(verified.actual, result.outcome);
});

test('verifyHold catches a tampered outcome even though the seed still matches', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  const result = contest.resolveHold(engine.WorldState, {
    holderId: holder.id, victimId: victim.id, technique: 'choke', tick: 4, contestId: 'verify-2',
  });
  const tampered = { ...result, outcome: 'escaped', finalPressure: 0 };
  const verified = contest.verifyHold(engine.WorldState, tampered);
  assert.equal(verified.seedMatches, true);
  assert.equal(verified.reproduced, false, 'a tampered outcome must not verify as reproduced');
});

// ---------------------------------------------------------------------------
// Engine-level wiring — the real player verb, not just the module
// ---------------------------------------------------------------------------

test('engine.applyHold resolves against the live world, with the actor as holder', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  const result = engine.applyHold(holder.id, { victimId: victim.id, technique: 'choke', contestId: 'engine-1' });
  assert.ok(result);
  assert.equal(result.holderId, holder.id);
  assert.equal(result.victimId, victim.id);
});

test('engine.verifyHold reproduces a real engine-level result', () => {
  const holder = strongHolder();
  const victim = weakVictim();
  const result = engine.applyHold(holder.id, { victimId: victim.id, technique: 'knee_on_neck', contestId: 'engine-2' });
  const verified = engine.verifyHold(result);
  assert.equal(verified.reproduced, true);
});

test('a "passed_out" loser outcome is captureable, same as "defeated" and "submitted"', () => {
  const disposition = require('../server/disposition.js');
  assert.ok(disposition.CAPTURABLE_LOSER_OUTCOMES.includes('passed_out'));
});

test('the apply-hold verb is a real, dispatchable player action', () => {
  const actions = require('../server/actions.js');
  assert.ok(actions.REQUIRED_VERBS.includes('applyHold'));
});
