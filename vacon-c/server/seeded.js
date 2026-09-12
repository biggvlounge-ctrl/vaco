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
function seededUnit(seed) {
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
