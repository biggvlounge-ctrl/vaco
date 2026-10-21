// server/islamicSectPacks.js
//
// **A real national self-identification split, Sunni/Shia/
// unaffiliated, for the one tradition `religionPacks.js` draws as a
// single undifferentiated value — reported, with the same §9
// firewall `npc.ethnicity` already holds.**
//
// ---------------------------------------------------------------------
// What is real here, and at what grain
// ---------------------------------------------------------------------
// Checked directly rather than assumed: the U.S. Religion Census
// (`religionImport.js`'s own source) reports Muslims as ONE category
// at the county level, in every edition (2000, 2010, 2020) — there is
// no county-level Sunni/Shia split in any U.S. government or ARDA
// table. What IS real, and the only real source for this split at
// all, is Pew Research Center's own national surveys of American
// Muslims, which ask self-identified Muslims directly whether they are
// Sunni, Shia, or "just a Muslim" — but only at the NATIONAL level,
// and the published shares move noticeably between survey waves
// (2007: roughly half Sunni, 16% Shia, 22% "just a Muslim"; 2011: 65%
// Sunni, 11% Shia, 15% unaffiliated). This module uses the 2007 wave's
// published figures as the concrete reference rather than averaging
// across waves, which would be an invented blend with no survey behind
// it — the 2011 figures are carried in the same constant as the
// documented range, not discarded.
//
// ---------------------------------------------------------------------
// Why this is a national constant, not a geographic pack
// ---------------------------------------------------------------------
// Same shape as `gangPacks.SELF_REPORT_REFERENCE` and
// `migrationPathwayPacks.js`: no U.S. county-level data exists to
// assign by §88 position, so there is no `validatePack`/`assertPack`/
// `packFor` here, only a cited constant and a weighted-pick function
// mirroring `religionPacks.religionFor`'s own mechanism.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to `npc.religion` and
// `npc.ethnicity`
// ---------------------------------------------------------------------
// Drawn per person, the same grain `religionPacks.religionFor`
// already draws `npc.religion` at, ONLY for an NPC whose religion
// already resolved to the real `'muslim'` tradition — never for the
// invented religion vocabulary, which has no `'muslim'` value to
// condition on. `npc.islamicSect` is measured by
// `demographics.compositionOf` and read by nothing that decides an
// outcome, enforced the same way `test/ethnicity.test.js` enforces it
// for `npc.ethnicity` — see `test/islamic-sect-packs.test.js`.
//
// **Known, stated limitation: in-memory only.** `npcs` has no
// `islamic_sect` column in `VACANCY_POSTGRESQL_SCHEMA.sql`, same
// posture as `npc.ethnicity` itself — this does not survive a
// restore from Postgres and falls back to null, which is the honest
// behaviour for a field with no column to restore it from.

'use strict';

const SECTS = ['sunni', 'shia', 'unaffiliated-muslim', 'other'];

//: Pew Research Center, 2007 "Muslim Americans: Middle Class and
//: Mostly Mainstream" — the wave this module draws from. The 2011
//: wave ("Muslim Americans: No Signs of Growth in Alienation or
//: Support for Extremism") reported 65% Sunni / 11% Shia / 15%
//: unaffiliated instead, carried here as `laterWaveRange` rather than
//: blended into the figure actually used, since averaging the two
//: would be an invented number neither survey published.
const PEW_REFERENCE = {
  source: 'pew-research-2007-muslim-americans',
  shares: {
    sunni: 0.50, shia: 0.16, 'unaffiliated-muslim': 0.22, other: 0.12,
  },
  laterWaveRange: {
    source: 'pew-research-2011-muslim-americans',
    shares: { sunni: 0.65, shia: 0.11, 'unaffiliated-muslim': 0.15 },
  },
};

// Cumulative cut points for a weighted pick, mirroring
// `religionPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return SECTS.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which sect a unit draw (0..1) falls into, against the real national
// reference shares. Returns the last vocabulary entry (`other`) if
// the draw lands past the end of the stated shares.
function sectFor(unit) {
  const cuts = cutsFor(PEW_REFERENCE.shares);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < SECTS.length; i += 1) {
    if (scaled < cuts[i]) return SECTS[i];
  }
  return SECTS[SECTS.length - 1];
}

module.exports = {
  SECTS,
  PEW_REFERENCE,
  sectFor,
};
