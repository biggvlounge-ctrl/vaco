// A house game against the world's own virtual economy — added 26 Sep
// 2026 alongside server/gambling.js. See that file's own header for
// what this is not: real-money gambling, which stays behind the
// #291-305 compliance gate competition.js already declines.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gambling = require('../server/gambling.js');
const economy = require('../server/economy.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// **tick 0, not the usual fixture default of 100.** `economy
// .generateIndividualFinances` is append-only and `getLatestFinances`
// picks the row with the highest tick — a person seeded at tick 100
// and then wagered on at ticks 1..50 would have every wager's result
// shadowed by the seed row for the whole test, which is a bug in a
// fixture rather than in `gambling.js`.
function world({ tick = 0 } = {}) {
  return {
    tick,
    npcs: [],
    entityTraits: [],
    individualFinances: [],
  };
}

let nextId = 1;
function person(w, { savings = 100, traits = {} } = {}) {
  const npc = { id: nextId++, status: 'active' };
  w.npcs.push(npc);
  economy.generateIndividualFinances(w, npc.id, { savings, tick: w.tick });
  for (const [family, values] of Object.entries(traits)) {
    for (const [name, value] of Object.entries(values)) {
      w.entityTraits.push({
        entity_id: npc.id,
        trait_id: getTraitId(family, name),
        base_value: value,
        temporary_modifier: 0,
        permanent_modifier: 0,
        experience_modifier: 0,
        environmental_modifier: 0,
        relationship_modifier: 0,
        key_modifier: 0,
        current_value: value,
      });
    }
  }
  return npc;
}

// ---------------------------------------------------------------------
// One game
// ---------------------------------------------------------------------

test('a wager beyond savings is refused rather than going into debt', () => {
  const w = world();
  const p = person(w, { savings: 10 });
  const result = gambling.play(w, { entityId: p.id, amount: 50 });
  assert.equal(result.played, false);
  assert.equal(economy.getLatestFinances(w, p.id).savings, 10);
});

test('every wager moves savings by exactly the stake or exactly the payout', () => {
  const w = world();
  const p = person(w, { savings: 1000 });
  for (let t = 1; t <= 50; t += 1) {
    const before = economy.getLatestFinances(w, p.id).savings;
    const result = gambling.play(w, { entityId: p.id, amount: 10, tick: t });
    const after = economy.getLatestFinances(w, p.id).savings;
    assert.equal(after - before, result.net);
    assert.equal(result.net, result.won ? 10 : -10);
  }
});

test('the same seed and the same tick produce the same result', () => {
  // A fixed id in both worlds rather than one from the shared `nextId`
  // counter, which advances across the whole file and would never
  // hand two different worlds the same id.
  const a = world();
  const b = world();
  a.npcs.push({ id: 777, status: 'active' });
  b.npcs.push({ id: 777, status: 'active' });
  economy.generateIndividualFinances(a, 777, { savings: 1000, tick: 0 });
  economy.generateIndividualFinances(b, 777, { savings: 1000, tick: 0 });
  const ra = gambling.play(a, { entityId: 777, amount: 10, tick: 5 });
  const rb = gambling.play(b, { entityId: 777, amount: 10, tick: 5 });
  assert.equal(ra.won, rb.won);
});

test('over enough plays the house edge favours the house, not the player', () => {
  const w = world();
  const p = person(w, { savings: 1_000_000 });
  let wins = 0;
  let plays = 0;
  for (let t = 1; t <= 2000; t += 1) {
    const result = gambling.play(w, { entityId: p.id, amount: 10, tick: t });
    if (!result.played) break;
    plays += 1;
    if (result.won) wins += 1;
  }
  assert.ok(plays > 1900, 'ran out of savings before the sample was large enough');
  const rate = wins / plays;
  assert.ok(rate < 0.5, `win rate ${rate} is not below even money — the edge favours the player`);
  assert.ok(rate > 0.4, `win rate ${rate} is implausibly low for a 47% game`);
});

// ---------------------------------------------------------------------
// Urges — Risk Appetite/Greed's first reader
// ---------------------------------------------------------------------

test('an ordinary person with no risk appetite never gambles on their own', () => {
  const w = world();
  const ordinary = person(w, {
    savings: 1000,
    traits: { economic: { 'Risk Appetite': 50, Greed: 50 }, psychological: { Compulsiveness: 50 } },
  });
  for (let t = 1; t <= 3000; t += 1) gambling.runUrges(w, t);
  assert.equal(economy.getLatestFinances(w, ordinary.id).savings, 1000);
});

test('a high-propensity person eventually gambles without being told to', () => {
  const w = world();
  const gambler = person(w, {
    savings: 1000,
    traits: { economic: { 'Risk Appetite': 100, Greed: 100 }, psychological: { Compulsiveness: 100 } },
  });
  for (let t = 1; t <= 3000; t += 1) gambling.runUrges(w, t);
  assert.notEqual(economy.getLatestFinances(w, gambler.id).savings, 1000,
    'nobody at maximum propensity ever gambled in 3000 ticks');
});

test('the floor is a real gate, not a slope that starts at zero', () => {
  const w = world();
  const justBelow = person(w, {
    traits: {
      economic: { 'Risk Appetite': gambling.PROPENSITY_FLOOR - 1, Greed: 0 },
      psychological: { Compulsiveness: 0 },
    },
  });
  for (let t = 1; t <= 5000; t += 1) {
    assert.equal(gambling.urgesThisTick(w, justBelow.id, t), false);
  }
});

test('describeGambling counts who is even eligible, not who has played', () => {
  const w = world();
  person(w, { traits: { economic: { 'Risk Appetite': 30, Greed: 0 }, psychological: { Compulsiveness: 0 } } });
  person(w, { traits: { economic: { 'Risk Appetite': 90, Greed: 90 }, psychological: { Compulsiveness: 90 } } });
  assert.equal(gambling.describeGambling(w).eligiblePlayers, 1);
});
