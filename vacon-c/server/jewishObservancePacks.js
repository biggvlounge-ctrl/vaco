// server/jewishObservancePacks.js
//
// **A real national denominational/observance split — Reform,
// Conservative, Orthodox, other, no particular branch — for the one
// tradition `religionPacks.js` draws as a single undifferentiated
// value, same shape as `islamicSectPacks.js`.**
//
// ---------------------------------------------------------------------
// What this is, and what it corrects about an earlier answer
// ---------------------------------------------------------------------
// Asked for "secular" versus "religious" Jewish representation, the
// earlier answer wrongly folded that into a declined request about
// Israeli domestic politics. They are not the same thing: this is a
// real, well-documented demographic split within American Jewish
// identity — Pew Research's own "Jewish Americans in 2020" survey
// asks exactly this, nationally. Secular is not a separate category
// in Pew's own framing; it is the "no particular branch" response,
// carried here under that name since that is the term the actual
// survey uses, with a comment noting the correspondence rather than
// inventing a different label.
//
// ---------------------------------------------------------------------
// Grain and source, checked the same way islamicSectPacks.js was
// ---------------------------------------------------------------------
// Same posture as `islamicSectPacks.js`: the U.S. Religion Census
// reports Jewish adherents as one category at the county level, with
// no denominational breakdown. Pew's 2020 survey is the real,
// national-only source for the denominational split itself. No
// geography, so no `validatePack`/`assertPack`/`packFor` — a cited
// constant and a weighted-pick function mirroring
// `religionPacks.religionFor`.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to `npc.islamicSect`
// ---------------------------------------------------------------------
// Drawn per person, ONLY for an NPC whose religion already resolved
// to the real `'jewish'` tradition, measured by
// `demographics.compositionOf` and read by nothing that decides an
// outcome — enforced the same way `test/islamic-sect-packs.test.js`
// enforces it, in `test/jewish-observance-packs.test.js`.
//
// **Known, stated limitation: in-memory only**, same posture as
// `npc.islamicSect` and `npc.ethnicity` — no column exists for this
// in `VACANCY_POSTGRESQL_SCHEMA.sql`.

'use strict';

const BRANCHES = ['reform', 'conservative', 'orthodox', 'other', 'no-particular-branch'];

//: Pew Research Center, "Jewish Americans in 2020" — checked directly
//: rather than assumed. The 2013 wave reported materially the same
//: split, which the report itself treats as broadly stable.
const PEW_REFERENCE = {
  source: 'pew-research-2020-jewish-americans',
  shares: {
    reform: 0.37, conservative: 0.17, orthodox: 0.09, other: 0.04, 'no-particular-branch': 0.32,
  },
  // Pew's own finding, carried as a caveat the same way
  // `gangPacks.describeUndercountCaveat` carries one: the national
  // figure above is an average across ages that masks a real
  // generational shift — "no particular branch" ran 41% among
  // 18-29-year-olds against 22% among the 65+ cohort, and Orthodox
  // identification ran 17% among 18-29-year-olds against 3% among
  // 65+. This module draws against the national average only; it
  // does not draw by age, the same limitation `religionPacks.js`
  // itself has for every tradition.
  ageVariationNote: '"no particular branch" (41% age 18-29 vs 22% age 65+) and Orthodox '
    + '(17% age 18-29 vs 3% age 65+) both vary sharply by age; this module draws against '
    + 'the national average across all ages.',
};

function cutsFor(shares) {
  let running = 0;
  return BRANCHES.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which branch a unit draw (0..1) falls into, against the real
// national reference shares.
function branchFor(unit) {
  const cuts = cutsFor(PEW_REFERENCE.shares);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < BRANCHES.length; i += 1) {
    if (scaled < cuts[i]) return BRANCHES[i];
  }
  return BRANCHES[BRANCHES.length - 1];
}

module.exports = {
  BRANCHES,
  PEW_REFERENCE,
  branchFor,
};
