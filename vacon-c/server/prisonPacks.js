// server/prisonPacks.js
//
// Real incarceration demographics, by real facility type — the
// "races in all the penitentiaries, county jails... juvenile and
// women's facilities" half of task #151, built the `countryPacks.js`
// way: a static, cited reference table, reported, never a per-NPC
// draw and never read by anything that decides an outcome.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as every other demographic field in
// this registry carries it
// ---------------------------------------------------------------------
// This is NOT a new `npc.*` field — there is no per-person draw here
// at all, so there is no `npc.race`-style firewall question about
// what a GENERATED PERSON'S value is used for. What this reports is a
// fact about the real, outside-world POPULATION of a kind of
// facility, the same grain `countryPacks.js`'s `conflictLevel` or
// `regimeType` already report about a country. `test/prison-
// packs.test.js` still carries its own copy of `test/ethnicity.
// test.js`'s forbidden-file scan, for the same reason this file's own
// header for `justice.js`'s prison-break mechanic gives: a reporting
// module earns the same proof a mechanism-adjacent one does, rather
// than relying on "it's just data" going unchecked forever.
//
// ---------------------------------------------------------------------
// What was found, and at what grain — checked this round, not assumed
// ---------------------------------------------------------------------
// Three real federal series, three different grains, and none of them
// agree on vintage — reported with each one's own `asOf` rather than
// forced onto a shared "current year" that doesn't exist across all
// three:
//
//   STATE_OR_FEDERAL_PRISON   BJS's own summary of *Prisoners in
//                             2022* (bjs.ojp.gov/document/p22st_sum.
//                             pdf): 32% Black, 31% White, 23% Hispanic
//                             among sentenced state-and-federal
//                             prisoners at yearend 2022 — BJS's own
//                             published figure, not a third party's
//                             transcription (EPI's chart draws on the
//                             same BJS Table 3 and agrees). The shares
//                             do not sum to 100%: BJS's own
//                             methodology note (carried via EPI's
//                             citation) says the Federal Bureau of
//                             Prisons does not break out "two or more
//                             races" or other races in this
//                             comparison, so the remainder is real and
//                             unassigned, not a rounding error. A
//                             *Prisoners in 2023* report exists
//                             (NCJ 310197, bjs.ojp.gov/document/
//                             p23st.pdf) but its own race table could
//                             not be retrieved this session — flagged
//                             here rather than silently used anyway.
//                             Women are 7.3% of the COMBINED state and
//                             federal population at yearend 2023 (BJS:
//                             91,100 of 1,254,200) — a separate,
//                             newer figure, reported with its own
//                             `asOf` rather than blended into the 2022
//                             race table's vintage.
//   LOCAL_JAIL                BJS midyear 2021: 49% White, 35% Black,
//                             14% Hispanic. Women are 14% of the local
//                             jail population at midyear 2022 (92,900
//                             of roughly 663,000) — again its own
//                             `asOf`, not forced to match the race
//                             table's year.
//   JUVENILE_RESIDENTIAL      OJJDP's Census of Juveniles in
//                             Residential Placement, 2021 (the most
//                             recent wave with a published race-by-age
//                             table reachable this session):
//                             10,460 Black, 8,197 White, 4,900 Hispanic
//                             of 24,894 total — percentages computed
//                             here from those published COUNTS, the
//                             same thing BJS's and OJJDP's own
//                             secondary reporting already does when a
//                             summary page doesn't carry a percentage
//                             directly. Female share: 2,233 of 15,428
//                             committed youth in the 2023 wave (14.5%)
//                             — the most current sex breakdown found,
//                             kept at its own `asOf` because the
//                             COVID-affected 2021 wave and the 2023
//                             wave are not directly comparable (OJJDP's
//                             own note on the 2023 release).
//
// **Deliberately left `null` rather than guessed**: a clean,
// current, citable per-type breakdown for FEDERAL prisons alone
// (BJS's combined figure covers state AND federal together); a
// current facility-COUNT distribution (how many of each real kind
// exist nationally) good enough to drive a believable generation-time
// split — see `landmarks.js`'s own header on `facilityType` for why
// that stays a single honest default instead. Same posture
// `countryPacks.js`'s sparse `globalIndicators2026` already took: a
// real figure where one was actually found, `null` everywhere a
// citable one was not, never a filled-in guess standing in for either.
//
// ---------------------------------------------------------------------
// Every crime category this engine actually tracks, named rather than
// quietly narrowed
// ---------------------------------------------------------------------
// `justice.js`'s own `SENTENCE_TICKS`/`LAW_FOR_OFFENCE` cover all
// eight of `crime.CATEGORIES`, and `crime.GENERATED_CATEGORIES` is the
// real subset (five: violent, property, theft, gun, domestic) this
// engine can actually produce a perpetrator for — `drug`, `fraud` and
// `sex_offense` stay `generated: false`, a declared boundary from
// before this round that this round does not reopen (see crime.js's
// own header). `describePopulationCaveat` below says this plainly,
// so a reader of this module's output is never left assuming the
// three undeclared categories simply don't exist in this engine's own
// vocabulary.
//
// ---------------------------------------------------------------------
// Why this is data, not a `require('../world-layer')`
// ---------------------------------------------------------------------
// No importer underlies this one — unlike `racePacks.js`/
// `religionPacks.js`, which read a REAL LOCAL tract through
// `world-layer`'s census/religion importers, BJS's and OJJDP's own
// national-series reports have no per-tract or per-county breakdown
// published for THIS statistic (facility-type racial/sex
// composition), so there is nothing to assign by city or community
// position (§88 does not apply — there is no location to seed on).
// This is a single national reference table, the same shape
// `migrationPathwayPacks.js` already took for DHS/CBP data with no
// geography of its own.
//
// ---------------------------------------------------------------------
// Re-checked, not re-trusted: the thirty-sixth standing rule's STG
// finding, revisited for `orgArchetypes.js`'s new
// `'racially-affiliated prison gang'` archetype
// ---------------------------------------------------------------------
// CLAUDE.md's thirty-sixth standing rule already found there is no
// current public, structured dataset on prison gang (STG) racial
// membership — CDCR abandoned its validation-based indefinite SHU
// isolation approach after *Ashker v. Brown*, the only public figure
// was a single stale 2012 press snapshot, and LA County's own
// Inspector General found its own jail-gang data too unreliable to
// release. Re-checked this round rather than trusted — still true: no
// newer CDCR or LA County STG racial-validation dataset was found.
//
// One real, current, ADJACENT chart was found and is named here
// rather than wired in: a 2014-2025 CDCR admissions chart showing
// admissions carrying a gang ENHANCEMENT running roughly 71% Hispanic
// against roughly 44% of all CDCR admissions. Not wired into this
// file or `orgArchetypes.js`, for three stated reasons: a gang
// enhancement is a court-applied sentencing outcome, not an STG
// membership validation — a different real fact from the one asked
// about; the chart's own authorship could not be confirmed this
// session; and PPIC separately notes CDCR does not publicly
// disaggregate Asian American, Native American or other groups at
// all in its own releases. The same posture this file already took
// declining the 2012 STG snapshot, CalGang and the Chicago gang-
// boundary FOIA release: a real number found at too low a confidence
// to stand behind is a gap to declare, not a number to use.
//
// `orgArchetypes.js`'s new sub-archetype instead cites the real,
// general, independent academic literature finding U.S. prison gangs
// have historically organised substantially along racial lines
// (Skarbek; a 2014 *Prison Journal* Texas study; Infante, Morse,
// Fahmy & Wright 2023; the *SAGE Encyclopedia of Race and Crime*) —
// enough to band a generic archetype's cohesion, not enough to claim
// a membership count. See that file's own header for the full
// reasoning; this file's own `FACILITY_DEMOGRAPHICS` table is
// unchanged by this round, on purpose — it already reports real BJS
// facility-level race composition, and a prison gang's own race
// composition is not the same statistic as the facility population's.

'use strict';

const crime = require('./crime.js');

//: The three real facility kinds a real BJS/OJJDP series actually
//: reports composition for. `landmarks.js`'s own `facilityType`
//: default is `'state-or-federal-prison'`, named identically so a
//: lookup never has to translate between two spellings of the same
//: fact.
const FACILITY_TYPES = ['state-or-federal-prison', 'local-jail', 'juvenile-residential'];

const FACILITY_DEMOGRAPHICS = {
  'state-or-federal-prison': {
    asOf: 2022,
    source: 'BJS, Prisoners in 2022 (yearend) — bjs.ojp.gov/document/p22st_sum.pdf',
    raceShare: {
      black: 0.32, white: 0.31, hispanic: 0.23, americanIndianAlaskaNative: 0.016,
      asianOrPacificIslander: 0.013,
    },
    raceShareNote: 'BJS/FBOP do not break out "two or more races" or other races in this '
      + 'comparison, so these five shares (0.889 combined) do not sum to 1 — a real, reported '
      + 'gap, not a rounding error.',
    femaleShare: { asOf: 2023, value: 0.073, note: '91,100 of 1,254,200 combined state+federal' },
  },
  'local-jail': {
    asOf: 2021,
    source: 'BJS, Jail Inmates in 2021 — Statistical Tables (midyear)',
    raceShare: { white: 0.49, black: 0.35, hispanic: 0.14 },
    raceShareNote: 'Reported total is 0.98 of the population; the remainder is real and '
      + 'uncategorized in BJS\'s own published split.',
    femaleShare: { asOf: 2022, value: 0.14, note: '92,900 of roughly 663,000 (midyear)' },
  },
  'juvenile-residential': {
    asOf: 2021,
    source: 'OJJDP, Census of Juveniles in Residential Placement, 2021 '
      + '(ojjdp.gov/ojstatbb/ezacjrp)',
    raceShare: {
      black: 0.420, white: 0.329, hispanic: 0.197,
    },
    raceShareNote: 'Percentages computed here from OJJDP\'s own published counts '
      + '(10,460 Black / 8,197 White / 4,900 Hispanic of 24,894 total) — OJJDP\'s page does not '
      + 'print a percentage directly, so these are a direct division of its own numbers, not a '
      + 'third-party figure.',
    femaleShare: {
      asOf: 2023, value: 0.145,
      note: '2,233 of 15,428 committed youth — the 2021 and 2023 waves are not directly '
        + 'comparable per OJJDP\'s own release note, so this is kept at its own year rather '
        + 'than blended with the 2021 demographic composition above.',
    },
  },
};

function describeFacilityDemographics(facilityType) {
  const entry = FACILITY_DEMOGRAPHICS[facilityType];
  if (!entry) return null;
  return { facilityType, ...entry };
}

// What this engine's OWN imprisonment pipeline can actually produce,
// named against the real taxonomy rather than quietly narrower than
// it. See crime.js's own CATEGORIES for why three stay absent.
function describePopulationCaveat() {
  return {
    trackedCategories: crime.CRIME_CATEGORIES,
    generatedCategories: crime.GENERATED_CATEGORIES,
    declaredAbsent: crime.CRIME_CATEGORIES.filter((c) => !crime.CATEGORIES[c].generated),
    note: 'This engine can convict and imprison a person for violent, property, theft, gun or '
      + 'domestic offences. drug, fraud and sex_offense are real categories in crime.CATEGORIES '
      + 'and real law categories in politics.LAW_CATEGORIES, carried through justice.js\'s own '
      + 'LAW_FOR_OFFENCE/SENTENCE_TICKS honestly — but nothing in this engine currently '
      + 'generates a perpetrator for them, a declared boundary from before this round (see '
      + 'crime.js\'s own CATEGORIES entries) that this round does not reopen. A population this '
      + 'engine generates is never a complete picture of who real facilities of this kind hold.',
  };
}

module.exports = {
  FACILITY_TYPES,
  FACILITY_DEMOGRAPHICS,
  describeFacilityDemographics,
  describePopulationCaveat,
};
