// Deterministic randomness, and the call that has silently returned 0
// in three separate systems.
//
// ---------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------
// `server/seeded.js` had **no test file at all** until now, which is
// its own small finding: it is the substrate under §88's replay
// guarantee, imported by `contest`, `mortality`, `births`,
// `environment`, `migration`, `worldgen` and `tribeMissions`, and
// nothing anywhere asserted what it does.
//
// It is also the site of a defect this project has now hit three
// times, always the same way and always silently:
//
//     seededUnit(seed, 'purpose', id, tick)     // WRONG, returns 0 forever
//     seededDraw([seed, 'purpose', id, tick])   // right
//
// The first looks exactly like the second and is the natural thing to
// type. The extra arguments are ignored, `'world' || 1` keeps the
// string, the bitwise operations coerce it to 0, and every call returns
// zero for the life of the world. Nothing throws.
//
//   - `environment.drawWeather`: 200 ticks, three cities, every one of
//     them `clear` and not one weather event in any world ever built.
//   - `migration.runMigration`, in TWO places. `0 >= chance` is false,
//     so `MOVE_CHANCE` has never gated anything and every pushed person
//     moved immediately — 21 moves in two herds became 2 moves by two
//     individuals once fixed.
//   - `tribeMissions`: every reward came out at exactly its floor,
//     which is how the other two were found.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { hashSeed, seededUnit, seededDraw } = require('../server/seeded.js');

// -- the guard, which is the point of this file --------------------------

test('seededUnit refuses the parts of a draw instead of returning zero', () => {
  // **The three-time bug, now a crash at the call site.** The sixth
  // standing rule says a read that is not there returns the same
  // plausible value forever; the fix for a rule that keeps recurring is
  // to make the mistake impossible to make quietly.
  assert.throws(() => seededUnit('world', 'migrate', 10, 3), /finite NUMBER/);
  assert.throws(() => seededUnit('world'), /finite NUMBER/);
  assert.throws(() => seededUnit(), /finite NUMBER/);
  assert.throws(() => seededUnit(undefined), /finite NUMBER/);
  assert.throws(() => seededUnit(null), /finite NUMBER/);
  assert.throws(() => seededUnit(NaN), /finite NUMBER/);
  assert.throws(() => seededUnit(Infinity), /finite NUMBER/);
  assert.throws(() => seededUnit([1, 2]), /finite NUMBER/);

  // And the error names the function the caller actually wanted, since
  // that is the whole difficulty — the two are one character apart in
  // intent and completely different in effect.
  assert.throws(() => seededUnit('world', 'x'), /seededDraw/);
});

test('a real number still works, including zero', () => {
  // `seed || 1` is deliberate: xorshift32 cannot use 0, so a genuine
  // zero seed maps to 1 rather than being refused. That is a real seed
  // value `hashSeed` can produce.
  assert.equal(typeof seededUnit(0), 'number');
  assert.equal(seededUnit(0), seededUnit(1));
  for (const seed of [1, 2, 41, 42, 1e9, 0x811c9dc5]) {
    const v = seededUnit(seed);
    assert.ok(v >= 0 && v < 1, `seededUnit(${seed}) returned ${v}, outside [0, 1)`);
  }
});

// -- what the module promises --------------------------------------------

test('the same question twice gets the same answer', () => {
  // §88: the same seed and the same rules give the same world. A defect
  // found on tick 4,000 has to be reachable again.
  assert.equal(seededDraw(['a', 1, 'x']), seededDraw(['a', 1, 'x']));
  assert.equal(hashSeed(['a', 1, 'x']), hashSeed(['a', 1, 'x']));
});

test('two different questions about the same entity get different answers', () => {
  // The reason callers pass a purpose alongside the id: asking "does
  // this person move" and "where do they move to" on the same tick must
  // not be the same draw. That was a real bug in `migration.js` —
  // the destination and the move chance shared a formula — and it is
  // the seventeenth rule's "the floor decides who CAN, the rate decides
  // how often" in a new place.
  const move = seededDraw(['world', 'migrate', 10, 3]);
  const where = seededDraw(['world', 'destination', 10, 3]);
  assert.notEqual(move, where);
});

test('adjacent seeds do not draw near-identical values', () => {
  // The stated reason for the xorshift round: "contest 41 and contest
  // 42 do not draw near-identical values". Asserted rather than
  // trusted, because a hash that failed this would make every
  // consecutive draw in a tick loop correlated and nothing would look
  // wrong.
  const a = seededUnit(hashSeed(['contest', 41]));
  const b = seededUnit(hashSeed(['contest', 42]));
  assert.ok(Math.abs(a - b) > 0.01,
    `consecutive contest seeds drew ${a} and ${b} — adjacent seeds are correlated`);
});

test('the draw is spread across the unit interval, not clustered', () => {
  // The failure mode this file is about produced a CONSTANT, and a
  // constant passes every test that only checks the range. So check the
  // distribution: a thousand draws should cover the interval and have a
  // mean near the middle.
  const draws = [];
  for (let i = 0; i < 1000; i += 1) draws.push(seededDraw(['spread', i]));
  const distinct = new Set(draws).size;
  assert.ok(distinct > 990, `only ${distinct} distinct values in 1000 draws`);

  const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
  assert.ok(mean > 0.45 && mean < 0.55, `mean of 1000 draws was ${mean.toFixed(4)}`);

  // Every decile occupied — the specific thing a constant cannot do.
  const deciles = new Set(draws.map((d) => Math.floor(d * 10)));
  assert.equal(deciles.size, 10, `draws only reached ${deciles.size} of 10 deciles`);
});

test('hashSeed returns an unsigned 32-bit integer, which is what seededUnit needs', () => {
  // The two halves have to fit together: `seededDraw` is just
  // `seededUnit(hashSeed(parts))`, so a `hashSeed` that returned a
  // string or a float would now throw rather than silently degrade.
  for (const parts of [['a'], ['a', 1], [1, 2, 3], ['long', 'list', 'of', 'parts', 99]]) {
    const h = hashSeed(parts);
    assert.equal(typeof h, 'number');
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xFFFFFFFF, `hashSeed(${parts}) = ${h}`);
    // And it composes, which is the contract `seededDraw` relies on.
    assert.equal(seededDraw(parts), seededUnit(h));
  }
});
