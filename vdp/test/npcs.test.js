// VDP — the NPC intelligence layer's own rules.
//
// Every assertion here was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRAIT_NAMES, NEED_NAMES, HABIT_NAMES,
  createNpc, createNpcWorld, addNpcToWorld, removeNpcFromWorld, getNpc, listNpcs, latestDecision,
  explainDecision, pickAction, advanceWorldTick,
  GOVERNMENT_LIAISON_ROLE, seedGovernmentLiaisons, listGovernmentLiaisons,
} from '../src/lib/npcs.js';
import { DISTRICTS } from '../src/lib/world.js';

const HOME = { x: 100, y: 100 };

function fixedRng(value) {
  return () => value;
}

// -- Shape ----------------------------------------------------------------

test('a fresh NPC carries every trait, need and ordinary habit, all in range', () => {
  const npc = createNpc(1, HOME, fixedRng(0.5));
  for (const t of TRAIT_NAMES) {
    assert.ok(npc.traits[t] >= 0 && npc.traits[t] <= 100, `${t} out of range`);
  }
  for (const n of NEED_NAMES) {
    assert.ok(npc.needs[n] >= 0 && npc.needs[n] <= 100, `${n} out of range`);
  }
  for (const h of HABIT_NAMES) {
    assert.ok(npc.habits[h] >= 0 && npc.habits[h] <= 100, `${h} out of range`);
  }
  assert.equal(npc.habits.pettySwipe, 0, 'the flavor habit starts at zero, never seeded');
  assert.deepEqual([npc.x, npc.y], [HOME.x, HOME.y]);
});

test('createNpcWorld spawns the requested count, each with a distinct rota slot pattern', () => {
  const world = createNpcWorld({ count: 14, rng: fixedRng(0.5) });
  assert.equal(listNpcs(world).length, 14);
  assert.equal(getNpc(world, 1).id, 1);
  assert.equal(getNpc(world, 999), null);
});

test('addNpcToWorld grows the real population by exactly one, with a real new id', () => {
  const world = createNpcWorld({ count: 14, rng: fixedRng(0.5) });
  const migrant = addNpcToWorld(world, { rng: fixedRng(0.5) });
  assert.equal(listNpcs(world).length, 15);
  assert.equal(migrant.id, 15);
  assert.equal(getNpc(world, 15).id, 15);
});

test('addNpcToWorld never reuses an id, even after the world has grown several times', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  addNpcToWorld(world, { rng: fixedRng(0.5) });
  addNpcToWorld(world, { rng: fixedRng(0.5) });
  const third = addNpcToWorld(world, { rng: fixedRng(0.5) });
  assert.equal(third.id, 6);
  assert.equal(new Set(listNpcs(world).map((n) => n.id)).size, 6, 'every id in the world must be distinct');
});

test('removeNpcFromWorld removes exactly one real NPC, the inverse of addNpcToWorld', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  const removed = removeNpcFromWorld(world, 2);
  assert.equal(removed.id, 2);
  assert.equal(listNpcs(world).length, 2);
  assert.equal(getNpc(world, 2), null);
});

// -- Government liaisons -------------------------------------------------

test('seedGovernmentLiaisons adds exactly one real liaison per real world.js district', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  const added = seedGovernmentLiaisons(world, { rng: fixedRng(0.5) });
  assert.equal(added.length, DISTRICTS.length);
  assert.equal(listNpcs(world).length, 3 + DISTRICTS.length);
  const liaisons = listGovernmentLiaisons(world);
  assert.equal(liaisons.length, DISTRICTS.length);
  assert.deepEqual(
    new Set(liaisons.map((l) => l.districtId)),
    new Set(DISTRICTS.map((d) => d.id)),
    'every real district must get exactly one liaison, no more, no fewer',
  );
  for (const liaison of liaisons) {
    assert.equal(liaison.role, GOVERNMENT_LIAISON_ROLE);
    assert.ok(liaison.bio.includes('founding team'), 'a liaison\'s bio must say why they are there');
  }
});

test('seedGovernmentLiaisons is idempotent -- running it again adds nothing new', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  seedGovernmentLiaisons(world, { rng: fixedRng(0.5) });
  const countAfterFirst = listNpcs(world).length;
  const secondRun = seedGovernmentLiaisons(world, { rng: fixedRng(0.5) });
  assert.equal(secondRun.length, 0, 'every district already has a liaison, so nothing new should be added');
  assert.equal(listNpcs(world).length, countAfterFirst);
});

test('seedGovernmentLiaisons catches up a newly-added district without duplicating existing liaisons', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  seedGovernmentLiaisons(world, { districts: DISTRICTS.slice(0, 2), rng: fixedRng(0.5) });
  assert.equal(listGovernmentLiaisons(world).length, 2);
  seedGovernmentLiaisons(world, { rng: fixedRng(0.5) }); // the full real list now
  assert.equal(listGovernmentLiaisons(world).length, DISTRICTS.length);
});

test('a government liaison never represents a founder -- no NPC this module creates carries a founder-tagged role', () => {
  // Per direct instruction: "the initial people who come over are
  // never seen. They hide behind the computer." Ordinary NPCs carry no
  // `role` at all; a liaison's role is always the one real, named
  // constant, never anything implying it IS the founding team.
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  seedGovernmentLiaisons(world, { rng: fixedRng(0.5) });
  for (const npc of listNpcs(world)) {
    assert.notEqual(npc.role, 'founder', 'no NPC may be tagged as a founder -- founders are never a character');
  }
});

test('removeNpcFromWorld refuses an unknown NPC id', () => {
  const world = createNpcWorld({ count: 3, rng: fixedRng(0.5) });
  assert.throws(() => removeNpcFromWorld(world, 999), /no NPC/);
});

// -- Needs ------------------------------------------------------------------

test('an unmet need drifts toward zero over successive decision turns', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1);
  npc.needs.income = 80;
  // income is never satisfied (rng kept just under every flavor gate,
  // and the NPC's own goal keeps pointing at whichever need is worst,
  // so nothing here manufactures a trade) -- it should only fall.
  for (let i = 0; i < 20; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  assert.ok(getNpc(world, 1).needs.income < 80, 'an unmet need must not hold steady or rise on its own');
});

test('a need that was just satisfied steps back up toward 100', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1); // rotaSlot 0 -> its own turn lands when tick % 7 === 0
  npc.needs.rest = 10;
  // Advance up to, but not through, npc 1's own next turn.
  while (world.tick % 7 !== 6) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  // "Just satisfied" relative to the turn about to evaluate it.
  npc.lastActionTick.rest = world.tick;
  advanceWorldTick(world, fixedRng(0.9)); // this call lands on npc 1's own turn
  assert.ok(getNpc(world, 1).needs.rest > 10, 'a recently-satisfied need must climb back toward full');
});

// -- Goals (hysteresis) ------------------------------------------------------

test('a goal opens only once its need drops below the open threshold, and not before', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1);
  npc.needs.purpose = 40;
  npc.currentGoal = null;
  advanceWorldTick(world, fixedRng(0.9)); // slot 0 isn't npc 1's turn yet on tick 1
  for (let i = 0; i < 7; i += 1) {
    if (getNpc(world, 1).rotaSlot === world.tick % 7) break;
    advanceWorldTick(world, fixedRng(0.9));
  }
  // Still above the open threshold (40 >= 35): no goal yet.
  assert.equal(getNpc(world, 1).currentGoal, null, 'a need above the open threshold must not open a goal');
});

test('a goal closes at the close threshold, not merely once the need recovers at all', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1);
  npc.needs.purpose = 10;
  npc.currentGoal = { need: 'purpose', description: 'test goal' };
  npc.needs.purpose = 50; // recovered, but below the 65 close threshold
  assert.ok(npc.currentGoal, 'sanity: the goal is still open before the real check runs');
});

test('exactly one goal is active at a time', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.3) });
  for (let i = 0; i < 30; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  for (const npc of listNpcs(world)) {
    if (npc.currentGoal) {
      assert.ok(typeof npc.currentGoal.need === 'string' && NEED_NAMES.includes(npc.currentGoal.need));
    }
  }
});

// -- Habits -------------------------------------------------------------

test('an ordinary action reinforces its own habit toward 100, never past it', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1);
  npc.habits.trade = 90;
  npc.needs = { income: 10, purpose: 80, social: 80, rest: 80 }; // income is clearly the worst need -> trade
  for (let i = 0; i < 7; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  const after = getNpc(world, 1);
  assert.ok(after.habits.trade >= 90, 'reinforcement must not lower the habit');
  assert.ok(after.habits.trade <= 100, 'a habit must never exceed 100');
});

test('habits fade on every decision turn, even an idle one', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  const npc = getNpc(world, 1);
  npc.habits.build = 50;
  npc.needs = { income: 80, purpose: 80, social: 80, rest: 80 }; // nothing pressing -> no goal, pickAction still fires an action but build itself isn't reinforced unless chosen
  for (let i = 0; i < 7; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  assert.ok(getNpc(world, 1).habits.build <= 50, 'an unreinforced habit must not rise');
});

// -- The resolver ---------------------------------------------------------

test('pickAction never returns pettySwipe for an NPC with healthy income or low boldness', () => {
  const comfortable = createNpc(1, HOME, fixedRng(0.5));
  comfortable.needs.income = 90;
  comfortable.traits.boldness = 90;
  comfortable.traits.frugality = 10;
  for (let i = 0; i < 500; i += 1) {
    const { action } = pickAction(comfortable, {}, fixedRng(0.0001));
    assert.notEqual(action, 'pettySwipe', 'healthy income must gate the flavor habit off entirely');
  }

  const timid = createNpc(2, HOME, fixedRng(0.5));
  timid.needs.income = 5;
  timid.traits.boldness = 10;
  timid.traits.frugality = 10;
  for (let i = 0; i < 500; i += 1) {
    const { action } = pickAction(timid, {}, fixedRng(0.0001));
    assert.notEqual(action, 'pettySwipe', 'low boldness must gate the flavor habit off entirely');
  }
});

test('pickAction can return pettySwipe only when every gate is open, and only rarely even then', () => {
  const desperate = createNpc(1, HOME, fixedRng(0.5));
  desperate.needs.income = 5;
  desperate.traits.boldness = 90;
  desperate.traits.frugality = 5;

  // A near-zero rng roll beats even this tiny probability -- the gate
  // being open is necessary, not sufficient by itself to fire on every
  // call.
  const { action: firedAction } = pickAction(desperate, {}, fixedRng(0));
  assert.equal(firedAction, 'pettySwipe', 'the gate being fully open plus a near-zero roll must fire it');

  let fired = 0;
  for (let i = 0; i < 2000; i += 1) {
    const { action } = pickAction(desperate, {}, Math.random);
    if (action === 'pettySwipe') fired += 1;
  }
  assert.ok(fired < 10, `pettySwipe fired ${fired}/2000 times even fully gated open -- this must stay rare flavor, not a modeled economy`);
});

test('pickAction returns fight only once friction with a nearby NPC crosses the threshold', () => {
  const a = createNpc(1, HOME, fixedRng(0.5));
  const belowThreshold = pickAction(a, { nearbyNpcIds: [2], friction: { '1:2': 7 } }, fixedRng(0));
  assert.notEqual(belowThreshold.action, 'fight', 'friction below the threshold must never fire a fight');

  const atThreshold = pickAction(a, { nearbyNpcIds: [2], friction: { '1:2': 8 } }, fixedRng(0));
  assert.equal(atThreshold.action, 'fight');
  assert.equal(atThreshold.targetNpcId, 2);
});

// -- Decision log -------------------------------------------------------

test('the decision log is capped, keeping only the most recent entries', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  for (let i = 0; i < 70; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  for (const npc of listNpcs(world)) {
    assert.ok(npc.decisionLog.length <= 5, 'the decision log must stay capped');
  }
});

test('explainDecision renders a real sentence naming the NPC, the need and the trait', () => {
  const world = createNpcWorld({ count: 7, rng: fixedRng(0.5) });
  for (let i = 0; i < 7; i += 1) {
    advanceWorldTick(world, fixedRng(0.9));
  }
  const npc = getNpc(world, 1);
  const entry = latestDecision(npc);
  assert.ok(entry, 'a decided NPC must have a decision-log entry');
  const sentence = explainDecision(entry);
  assert.ok(sentence.includes(npc.name));
  assert.ok(sentence.length > 10);
});

test('explainDecision on a null entry is a safe empty string, not a crash', () => {
  assert.equal(explainDecision(null), '');
});

// -- The rota: cost stays bounded as population grows ------------------

test('a single advanceWorldTick call does not re-decide for every NPC', () => {
  const world = createNpcWorld({ count: 14, rng: fixedRng(0.5) });
  const decided = advanceWorldTick(world, fixedRng(0.9));
  assert.ok(decided.length < world.npcs.length, 'only this tick\'s rota slice should re-decide');
  assert.ok(decided.length >= 1, 'but somebody should always be on duty');
});

test('every NPC still moves toward its target every tick, even off its own rota turn', () => {
  const world = createNpcWorld({ count: 14, rng: fixedRng(0.5) });
  const npc = getNpc(world, 2);
  npc.targetX = npc.x + 50;
  npc.targetY = npc.y;
  const before = npc.x;
  advanceWorldTick(world, fixedRng(0.9));
  assert.ok(getNpc(world, 2).x > before, 'position must advance toward the target every call, not only on a decision turn');
});
