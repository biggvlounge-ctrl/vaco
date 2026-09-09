// A property test in about sixty lines, and no dependency.
//
// **Why this exists, specifically.** Two money bugs this repo found
// were found by *mutation*, not by the test written to catch them:
//
//   - The DREAMS 70/30 rounding test used a cost of 0.07. That value
//     happens to round cleanly both ways (0.05 + 0.02 = 0.07), so the
//     test passed against a mutant that computed the platform fee
//     independently and overcharged the advertiser a cent. Six other
//     costs would have caught it. I picked one and picked wrong.
//
//   - The world-expansion growth threshold was unreachable: every
//     "cold" fixture also failed the population and activity checks,
//     so the module could have ignored growth entirely and stayed
//     green.
//
// Both are the same mistake: **a hand-picked example is a guess about
// where the bug is.** A property says what must be true for *all*
// inputs and then goes looking for a value that breaks it. That is the
// right shape for money splits, which is exactly where this repo's
// arithmetic lives.
//
// `fast-check` does this properly and does far more. This is not that
// library, and does not pretend to be — no shrinking to a minimal
// counterexample, no generator combinators, no replay of a failing
// seed beyond the one printed. It is deliberately small enough to read
// in one sitting, and adds nothing to a dependency list that is
// otherwise express, dotenv and cors.
//
// **The seed is fixed by default**, so a failure is reproducible and
// CI does not go red on a Tuesday for a value it will never see again.
// Pass a different seed to search harder.

// Mulberry32 — small, fast, and deterministic from a 32-bit seed.
// Not cryptographic; nothing here needs it to be.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- Generators ----------------------------------------------------------
//
// Each takes the rng and returns a value. Deliberately biased toward
// the awkward end: money bugs live at 0.01, at values that do not
// divide, and at the boundaries — not in the middle of the range.

export const gen = {
  // A currency amount with 2 decimal places, in [min, max].
  money: (min = 0.01, max = 1000) => (r) => {
    const cents = Math.floor(r() * (max * 100 - min * 100 + 1)) + min * 100;
    return Math.round(cents) / 100;
  },

  // Small amounts specifically. Most rounding drift is here.
  smallMoney: () => (r) => (Math.floor(r() * 200) + 1) / 100,

  int: (min, max) => (r) => Math.floor(r() * (max - min + 1)) + min,

  // Picks from a list — for tiers, event types, formats.
  oneOf: (items) => (r) => items[Math.floor(r() * items.length)],
};

/**
 * Assert a property holds for many generated inputs.
 *
 * @param {object}   opts
 * @param {number}   [opts.runs=1000]  how many values to try
 * @param {number}   [opts.seed=1]     fixed, so failures reproduce
 * @param {Function} generator         (rng) => value
 * @param {Function} property          (value) => void — throws to fail
 *
 * On failure it reports the input that broke it and how many runs got
 * there, because "it fails somewhere" is not actionable and "it fails
 * at 0.15 on run 42" is.
 */
export function forAll(generator, property, opts = {}) {
  const { runs = 1000, seed = 1 } = opts;
  const r = rng(seed);
  for (let i = 0; i < runs; i += 1) {
    const value = generator(r);
    try {
      property(value);
    } catch (err) {
      err.message = `property failed on run ${i + 1}/${runs} `
        + `with input ${JSON.stringify(value)} (seed ${seed}):\n  ${err.message}`;
      throw err;
    }
  }
}

/**
 * The specific property this file was written for: two shares of an
 * amount must add back up to the amount exactly.
 *
 * Splitting money is the one piece of arithmetic that appears in
 * DREAMS, Vvltvre Pods, HVNTZ, VOKEN and VOID, always in the same
 * shape — round one side, derive the other by subtraction. Rounding
 * both independently drifts, and the payer eats the difference.
 *
 * @param {Function} split (amount) => [shareA, shareB]
 */
export function splitsExactly(split, opts = {}) {
  forAll(
    opts.generator ?? gen.money(0.01, 500),
    (amount) => {
      const [a, b] = split(amount);
      const sum = Math.round((a + b) * 100) / 100;
      if (sum !== amount) {
        const drift = Math.round((sum - amount) * 100);
        throw new Error(
          `${a} + ${b} = ${sum}, but the amount was ${amount} — `
          + `${drift > 0 ? 'overcharged' : 'undercharged'} by ${Math.abs(drift)} cent(s)`,
        );
      }
      if (a < 0 || b < 0) throw new Error(`a share went negative: ${a} / ${b}`);
    },
    opts,
  );
}
