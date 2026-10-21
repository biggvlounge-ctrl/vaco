// server/africanEthnicGroupPacks.js
//
// **A real, documented, country-level ethnic/tribal composition
// reference — for the nationalities, not for any American community.**
//
// ---------------------------------------------------------------------
// What this answers, and what real data does not exist to answer
// ---------------------------------------------------------------------
// Asked to go a step deeper than country of ancestral origin and name
// actual ethnic/tribal groups (Hausa-Fulani, Yoruba, Igbo, Oromo,
// Amhara, and so on), the honest answer splits in two:
//
//   **Real, as a fact about the COUNTRY.** Standard public reference
//   sources (the CIA World Factbook's own published ethnic-group
//   percentages, the same kind of figure cited whenever anyone asks
//   "what is Nigeria's ethnic makeup") give real, citable, if
//   approximate, national composition for each of the four countries
//   `ancestryImport.js` names on their own: Nigeria, Ethiopia, Ghana,
//   Kenya.
//
//   **Not real, as a fact about the AMERICAN population this engine
//   models.** `ancestryImport.js`'s own real source — Census ACS
//   Table B04006 — reports ancestry by COUNTRY, not by sub-national
//   ethnic group. There is no U.S. government table breaking
//   Nigerian-American ancestry into Hausa-Fulani/Yoruba/Igbo shares,
//   so this module cannot and does not claim one — it reports the
//   COUNTRY's own documented composition, the same way
//   `migrationPathwayPacks.js` reports a country-level admission
//   pattern rather than inventing a per-tract one.
//
// ---------------------------------------------------------------------
// Why this is a flagged reference, not a pack
// ---------------------------------------------------------------------
// Same shape as `migrationPathwayPacks.js` and `gangPacks
// .SELF_REPORT_REFERENCE`: no geography of its own (a country's
// ethnic composition is not assigned to a U.S. tract by §88 position,
// because there is no U.S.-tract-level version of this fact to
// assign), so there is no `validatePack`/`assertPack`/`packFor` here
// — just a cited, static table keyed on the four country groups
// `ancestryPacks.GROUPS` names, checked against that list at load
// time so the two cannot drift.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to ethnicity, religion and
// migration pathway
// ---------------------------------------------------------------------
// A documented fact about a COUNTRY, reported through
// `demographics.compositionOf`'s ethnicity block alongside
// `dominantPathway`, never a per-person fact and never read by
// anything that decides an outcome. No NPC's own tribal affiliation
// is modelled — `npc.ethnicity` is a country of ancestral origin, and
// most people reporting one are generations removed from it; treating
// a country's ethnic-composition reference as evidence about any one
// generated person would be a worse version of the mistake this
// project already corrected once for ancestry itself.

'use strict';

const ancestryPacks = require('./ancestryPacks.js');

//: The four country groups this reference covers — exactly the ones
//: `ancestryImport.js` split out of `subsaharan-african` for this
//: purpose. Every other real group either has no comparably standard
//: single-country ethnic-composition reference (`subsaharan-african`
//: and `west-indian` are themselves multi-country buckets) or is a
//: legacy European ancestry with no comparable "home country" to
//: report on.
const COUNTRIES = ['nigerian', 'ethiopian', 'ghanaian', 'kenyan'];

//: CIA World Factbook-style published ethnic-group percentages —
//: approximate, as every such figure is (ethnic self-identification is
//: contested and censuses are infrequent in several of these
//: countries), carried here as a reference rather than a precise
//: measurement. Figures are the largest-named groups; the remainder is
//: the country's own long tail of smaller groups, named `other` rather
//: than distributed across them.
const COMPOSITION = {
  nigerian: {
    country: 'Nigeria',
    groups: {
      'hausa-fulani': 0.30, yoruba: 0.15, igbo: 0.15, other: 0.40,
    },
  },
  ethiopian: {
    country: 'Ethiopia',
    groups: {
      oromo: 0.35, amhara: 0.24, somali: 0.06, tigray: 0.06, other: 0.29,
    },
  },
  ghanaian: {
    country: 'Ghana',
    groups: {
      akan: 0.47, 'mole-dagbon': 0.17, ewe: 0.14, 'ga-dangme': 0.07, other: 0.15,
    },
  },
  kenyan: {
    country: 'Kenya',
    groups: {
      kikuyu: 0.17, luhya: 0.14, kalenjin: 0.13, luo: 0.10, kamba: 0.10, other: 0.36,
    },
  },
};

// **Checked once, at load time, not left to drift.** Every key here
// must be a real `ancestryPacks.GROUPS` entry — the same drift guard
// `migrationPathwayPacks.js` holds for the same reason.
for (const group of Object.keys(COMPOSITION)) {
  if (!ancestryPacks.GROUPS.includes(group)) {
    throw new Error(`africanEthnicGroupPacks.js: "${group}" is not in ancestryPacks.GROUPS`);
  }
}

// The real, documented ethnic-group composition for a country group,
// or null for any group this table does not cover.
function compositionFor(group) {
  return COMPOSITION[group] ?? null;
}

function describeComposition(group) {
  const composition = compositionFor(group);
  if (!composition) return null;
  return {
    group,
    ...composition,
    source: 'cia-world-factbook-style-reference',
  };
}

module.exports = {
  COUNTRIES,
  COMPOSITION,
  compositionFor,
  describeComposition,
};
