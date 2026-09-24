// server/seeded.js
//
// Deterministic randomness, in its own file for the same reason
// `nextAfter.js` is: two unrelated systems need it, and putting it in
// either one would make the other import a module it has no other
// business with.
//
// **Both functions were written in `contest.js` and are unchanged.**
// They moved here when mortality needed them, because §88 requires
// that the same seed and the same rules produce the same world — and a
// world where contests are reproducible but deaths are not is not
// reproducible. `contest.js` imports them from here now; the algorithm
// is byte-identical, which `contest.test.js` already pins by verifying
// a settled result can be re-verified.
//
// **Why not `Math.random()`.** A simulation that cannot be replayed
// cannot be debugged: the world-seed guarantee in §88 exists so that a
// defect found on tick 4,000 can be reached again. Every draw here is
// a pure function of what it is drawing about.

'use strict';

// FNV-1a over the joined parts. Callers pass the things that identify
// the draw — an entity id, a tick, a purpose — so two different
// questions about the same entity on the same tick get different
// answers, and the same question asked twice gets the same one.
function hashSeed(parts) {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// A number in [0, 1) from the seed. Deterministic by construction.
//
// ---------------------------------------------------------------------
// **It takes a NUMBER, and it refuses anything else — because this has
// silently returned 0 forever in three separate systems.**
// ---------------------------------------------------------------------
// `seededUnit(seed, 'purpose', id, tick)` looks exactly like
// `seededDraw([seed, 'purpose', id, tick])` and is the natural thing to
// type. It is also catastrophic and completely silent: the extra
// arguments are ignored, `'world' || 1` keeps the STRING, the bitwise
// operations below coerce it to 0, and every call returns **0**.
//
// Nothing throws, nothing looks wrong, and the consumer gets a
// plausible constant for the life of the world. The three:
//
//   - `environment.drawWeather` — measured, 200 ticks, three cities,
//     every one of them `clear` the entire time and not one weather
//     event in any world ever generated.
//   - `migration.runMigration`, twice. `0 >= chance` is false for any
//     positive chance, so **`MOVE_CHANCE` has never gated anything**:
//     every pushed person with an acceptable destination moved
//     immediately, which is why moves arrived as whole cohorts. Fixing
//     it took a 600-tick world from 21 moves in two herds to 2 moves by
//     two individuals.
//   - `tribeMissions.runTribeMissions` — every mission reward came out
//     at exactly its floor, which is how the other two were found.
//
// That is the sixth standing rule's shape (a read that is not there
// returns the same plausible value forever), and the fix for a rule
// that keeps recurring is not another comment — it is making the
// mistake impossible to make quietly. A string seed is now a crash at
// the call site rather than a constant somewhere downstream.
//
// `hashSeed` is what turns parts into a number, and `seededDraw` does
// both in one call, which is what nearly every caller actually wants.
function seededUnit(seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new TypeError(
      `seededUnit takes a finite NUMBER, got ${typeof seed} ${JSON.stringify(seed)}. `
      + 'Did you mean seededDraw([...parts])? Passing the parts of a draw here '
      + 'silently returns 0 on every call — see the note above this line.',
    );
  }
  // xorshift32, one round — enough to decorrelate adjacent seeds so
  // that contest 41 and contest 42 do not draw near-identical values.
  let x = seed || 1;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5; x >>>= 0;
  return x / 4294967296;
}

// The two together, which is what every caller actually wants.
function seededDraw(parts) {
  return seededUnit(hashSeed(parts));
}

module.exports = { hashSeed, seededUnit, seededDraw };
