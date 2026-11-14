// server/protestantDenominationPacks.js
//
// **A real national denominational-family split, Baptist/
// nondenominational/other, for the one tradition `religionPacks.js`
// draws as a single undifferentiated `'protestant'` value — the
// identical real shape `islamicSectPacks.js`/`jewishObservancePacks.js`
// already hold for `'muslim'`/`'jewish'`.**
//
// By direct instruction, as part of a wider request: "add in any
// other religions I missed in Baptist churches, mega churches." See
// CLAUDE.md's own standing rule for this round for the full reasoning,
// including why two OTHER specific movements asked for in the same
// message — the Nation of Islam and the Moorish Science Temple of
// America — are NOT built here or anywhere else in this engine.
//
// ---------------------------------------------------------------------
// What is real here, and at what grain
// ---------------------------------------------------------------------
// Pew Research Center's 2023-24 Religious Landscape Study (released
// Feb 2025, the most recent wave) is the real, current, national
// source — the same survey family `religionPacks.js`'s own tradition
// shares and `islamicSectPacks.js`'s sect shares already draw from.
// It publishes Baptist (the single largest Protestant family in all
// three RLS waves — 2007, 2014, 2023-24) at 12% of ALL U.S. adults,
// and nondenominational Protestant at 7% of all U.S. adults, against
// Protestant overall at 40%. There is no real county-level Baptist/
// nondenominational split published anywhere (the same reason
// `islamicSectPacks.js` stays a national constant rather than a
// geographic pack) — so this module has no `validatePack`/
// `assertPack`/`packFor`, only a cited constant and a weighted-pick
// function mirroring `religionPacks.religionFor`'s own mechanism.
//
// **"Megachurch" is explicitly declined, checked rather than
// assumed equivalent to "nondenominational."** Pew and the Religion
// Census classify by denominational FAMILY, never by congregation
// SIZE — "megachurch" is a real, separately-measured concept from
// the Hartford Institute for Religion Research's own National
// Congregations Study and megachurch database, which counts
// attendance size, not a respondent's self-identified tradition.
// Conflating the two would misstate both real datasets, so this file
// draws only the real denominational-family split Pew's own survey
// actually asks about.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to `npc.islamicSect`/
// `npc.jewishObservance`
// ---------------------------------------------------------------------
// Drawn per person, the same grain `religionPacks.religionFor`
// already draws `npc.religion` at, ONLY for an NPC whose religion
// already resolved to the real `'protestant'` tradition. Measured by
// `demographics.compositionOf` and read by nothing that decides an
// outcome, enforced the identical way `test/ethnicity.test.js`
// enforces it for `npc.ethnicity` — see
// `test/protestant-denomination-packs.test.js`.
//
// **Known, stated limitation: in-memory only.** `npcs` has no
// `protestant_denomination` column in
// `VACANCY_POSTGRESQL_SCHEMA.sql`, the same posture
// `npc.islamicSect`/`npc.jewishObservance` already hold.

'use strict';

const DENOMINATIONS = ['baptist', 'nondenominational', 'other-protestant'];

//: Pew Research Center, 2023-24 Religious Landscape Study. Published
//: as shares of ALL U.S. adults (`shareOfAllAdults`); `shares` is the
//: derived within-Protestant distribution this module actually draws
//: from (each real share divided by Protestant's own real 40% share),
//: shown explicitly rather than hidden, so the conversion is checkable
//: against the real published numbers rather than taken on faith.
const PEW_REFERENCE = {
  source: 'pew-research-2023-24-religious-landscape-study',
  shareOfAllAdults: { baptist: 0.12, nondenominational: 0.07, protestantOverall: 0.40 },
  shares: {
    baptist: 0.12 / 0.40,
    nondenominational: 0.07 / 0.40,
    'other-protestant': 1 - (0.12 + 0.07) / 0.40,
  },
};

// Cumulative cut points for a weighted pick, mirroring
// `islamicSectPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return DENOMINATIONS.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which denominational family a unit draw (0..1) falls into, against
// the real national reference shares.
function denominationFor(unit) {
  const cuts = cutsFor(PEW_REFERENCE.shares);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < DENOMINATIONS.length; i += 1) {
    if (scaled < cuts[i]) return DENOMINATIONS[i];
  }
  return DENOMINATIONS[DENOMINATIONS.length - 1];
}

module.exports = {
  DENOMINATIONS,
  PEW_REFERENCE,
  denominationFor,
};
