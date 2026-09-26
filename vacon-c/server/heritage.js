// server/heritage.js
//
// **Real ethnicity and religion values — added 26 Sep 2026 at the
// owner's direct request, reversing a prior, deliberate decision.**
//
// ---------------------------------------------------------------------
// The decision this reverses, and why it was made in the first place
// ---------------------------------------------------------------------
// `worldgen.js`'s `ethnicities` list was fictional on purpose:
//
//   "Deliberately named for this setting rather than for any real-world
//   group — the engine needs a demographic dimension with more than one
//   value in it so composition and diversity mean something, and
//   borrowing real ethnonyms would attach real-world associations to a
//   simulation that models none of them."
//
// That reasoning was sound and is not being overruled lightly. It is
// being reversed because the owner asked for real nationalities,
// African ethnic and tribal groups that persist across a lineage even
// after migrating elsewhere, and a named "Foundational Black American"
// category for descendants of the enslaved and free Black population
// in America before and after slavery — a real, specific, and
// deliberate request, not a side effect of wanting more variety.
//
// ---------------------------------------------------------------------
// The firewall this does not touch
// ---------------------------------------------------------------------
// `server/demographics.js`'s header and `test/ethnicity.test.js` hold a
// real, enforced guarantee: `crime.js`, `policing.js`, `economy.js`,
// `mortality.js`, `traits.js`, `keys.js`, `contest.js`, `motivation.js`,
// `archetypes.js`, `migration.js` and `succession.js` may never read
// `.ethnicity` — §9's own clause, "demographic modelling... without
// making demographics determine an NPC's morality, criminality,
// intelligence, or worth." This file changes WHAT VALUES the field can
// hold. It does not add a second reader, and `test/ethnicity.test.js`'s
// existing firewall test covers every value this file produces the
// same way it covered the fictional ones — nothing about the guard
// depends on the strings being fictional.
//
// ---------------------------------------------------------------------
// One field, not two
// ---------------------------------------------------------------------
// `npcs.ethnicity` is the one real, schema-backed, already-inherited,
// already-migrated column (`schema-extensions.sql`). Adding a second
// `nationality` column would need a new migration this environment has
// no reachable Postgres to write and verify against — the same
// constraint `server/warfare.js`'s header already documents for
// `worldState.wars`. So nationality and ethnicity are carried together
// in one value, the way a person actually describes both at once —
// "Nigerian — Yoruba" names the nationality and the ethnic group in the
// same breath, and "Foundational Black American" names a lineage that
// IS the nationality and the heritage together, because that category
// has no separate country of origin to name.
//
// ---------------------------------------------------------------------
// Lineage — already built, nothing to add
// ---------------------------------------------------------------------
// `births.js#bearChild` already inherits `ethnicity` from a parent
// (`ethnicity: bearer.ethnicity ?? other?.ethnicity ?? null`) — a
// person's heritage already survives to their children regardless of
// where they live, which is what makes a real value here carry across
// generations rather than needing new inheritance logic. Moving to a
// new community or city changes nothing about the field; nothing in
// this engine has ever kept ethnicity local to a place.
//
// ---------------------------------------------------------------------
// What this list is, and is not
// ---------------------------------------------------------------------
// Broad and real, not exhaustive — the same honesty
// `data/st-louis.landmarks.json` already declares itself with `source:
// "sample"`. A world that wants more supplies it through
// `DEFAULTS.ethnicities`/`DEFAULTS.religions`, the same override path
// every other worldgen default already has. Coverage spans multiple
// African nations with named ethnic/tribal groups (the owner's own
// example), several Native American nations, and multiple regions
// across the Americas, Europe, the Middle East and Asia, so the
// specificity given to African heritage is not the only specificity in
// the list.

'use strict';

//: Real nationalities and ethnic/tribal groups. Grouped by region in
//: comments for anyone extending this list, not because the game reads
//: the grouping — it is one flat array of strings, exactly like the
//: fictional list it replaces.
const ETHNICITIES = [
  // -- West Africa --
  'Nigerian — Yoruba',
  'Nigerian — Igbo',
  'Nigerian — Hausa-Fulani',
  'Ghanaian — Akan',
  'Ghanaian — Ewe',
  'Senegalese — Wolof',
  'Malian — Bambara',
  'Ivorian — Akan',
  // -- East Africa --
  'Ethiopian — Amhara',
  'Ethiopian — Oromo',
  'Kenyan — Kikuyu',
  'Kenyan — Luo',
  'Somali',
  'Eritrean — Tigrinya',
  // -- Central and Southern Africa --
  'Congolese — Kongo',
  'Congolese — Luba',
  'South African — Zulu',
  'South African — Xhosa',
  'Zimbabwean — Shona',
  // -- North Africa --
  'Egyptian',
  'Moroccan — Amazigh',
  // -- Foundational Black American, added by explicit request --
  // A lineage, not an import: descendants of the enslaved and free
  // Black population in America before and after slavery — a distinct
  // heritage from a recent African immigrant's, named on its own terms
  // rather than folded into either "African" or "American" generally.
  'Foundational Black American',
  // -- Native American nations --
  'Native American — Navajo',
  'Native American — Cherokee',
  'Native American — Lakota',
  'Native American — Ojibwe',
  // -- Other United States heritage groups --
  'Irish American',
  'Italian American',
  'German American',
  'Polish American',
  // -- Latin America and the Caribbean --
  'Mexican',
  'Mexican American',
  'Puerto Rican',
  'Cuban American',
  'Dominican',
  'Guatemalan',
  'Brazilian',
  'Haitian',
  // -- Europe --
  'English',
  'Ukrainian',
  // -- Middle East --
  'Lebanese',
  'Syrian',
  'Iranian — Persian',
  'Palestinian',
  // -- South and East Asia --
  'Han Chinese',
  'Vietnamese',
  'Filipino',
  'Korean',
  'Japanese',
  'Indian — Punjabi',
  'Indian — Tamil',
];

//: Real religions and non-religious affiliations. Denominational where
//: a single umbrella term would erase a real distinction the way
//: "Christian" alone erases Protestant/Catholic/Orthodox.
const RELIGIONS = [
  'Protestant Christian',
  'Catholic Christian',
  'Orthodox Christian',
  'Sunni Muslim',
  'Shia Muslim',
  'Jewish',
  'Hindu',
  'Buddhist',
  'Sikh',
  'Traditional African Religion',
  'Indigenous American Spirituality',
  'Unaffiliated',
  'Agnostic',
  'Atheist',
];

module.exports = {
  ETHNICITIES,
  RELIGIONS,
};
