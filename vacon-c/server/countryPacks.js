// server/countryPacks.js
//
// **The first step of global expansion: a real, cited, per-country
// reference — income level, conflict level, government type,
// democratic regime type, military expenditure, oil-producer status
// — keyed on the same vocabulary `ancestryPacks.GROUPS` already
// uses.**
//
// ---------------------------------------------------------------------
// Three fields added after the first round, same discipline
// ---------------------------------------------------------------------
// `regimeType` (EIU Democracy Index 2024), `militaryExpenditurePctGDP`
// (SIPRI, confidence-flagged — only Russia and Ukraine are SIPRI's own
// published figures, everything else present is a third-party
// estimate marked `secondary-estimate`), and `oilProducer` (EIA 2024,
// present only for the handful of these 36 countries that are
// actually major producers/exporters — `null` everywhere else, not a
// forced "not applicable" row). "Specific political parties" was
// asked for and deliberately NOT built: a currently-ruling party goes
// stale at the next election and could not be verified with
// confidence across three dozen countries from here. Regime type is
// the honest substitute — durable, published, stable methodology.
//
// ---------------------------------------------------------------------
// What this is a first step TOWARD, and what it does not attempt yet
// ---------------------------------------------------------------------
// Asked to expand this engine beyond the United States — other
// countries' militaries, first/second/third-world realism, war-level
// chaos, realistic landscape — the honest starting point is that this
// engine generates exactly ONE region per world
// (`migration.generateRegion`, called once in `worldgen.js`), and
// every real source wired before this module is U.S. federal data
// with no non-U.S. equivalent in this registry. This module is the
// first real, cited piece of that expansion: which real income
// bracket and conflict level a country is in, from real, standard,
// public sources — not every country on Earth, and not yet wired
// into any mechanic that would need its own calibration (see below).
//
// **"First/second/third world" is retired on purpose, not softened.**
// That was always a Cold War political alignment scheme, not an
// economic one, and using it to describe poverty would be exactly
// the kind of imprecision this whole project's discipline exists to
// avoid. The real, current, standard replacement is the World Bank's
// own income classification, updated every July 1st on GNI per
// capita (Atlas method). This module's own `checkedAt: null` on that
// threshold set is this project's usual flag that a network-blocked
// environment cannot re-verify it live — the thresholds below are
// the FY2027 set (effective 1 July 2026, based on 2025 GNI),
// checked directly via search rather than assumed.
//
// **"War level" is UCDP's real vocabulary, generalised one step.**
// The Uppsala Conflict Data Program is the standard academic source
// for whether a country has active armed conflict, and it
// distinguishes NATIONWIDE/state-based conflict from localised
// insurgency and from high non-state (cartel/gang) violence that
// does not meet its state-based conflict threshold. Collapsing
// Mexico's cartel violence and Somalia's decades-long state conflict
// into one "war" bucket would misdescribe both, so this keeps the
// distinction UCDP itself draws.
//
// ---------------------------------------------------------------------
// A modest, named set — not global coverage, and said so
// ---------------------------------------------------------------------
// Covers the countries `ancestryPacks.GROUPS` already names a single
// country for (legacy European ancestries, the African four,
// Mexico/Northern Triangle/Haiti/Jamaica, Vietnam/China/Philippines/
// India, Russia/Ukraine, Somalia, Bosnia and Herzegovina), plus the
// United States as the explicit baseline. Multi-country buckets
// (`subsaharan-african`, `west-indian`, `arab`) and non-country values
// (`american`, `other`) have no single country to report on and are
// not in this table — adding more real countries here is the natural
// next step, not a different kind of module.
//
// ---------------------------------------------------------------------
// Deliberately report-only, for the same reason crimeHotspotPacks.js
// stayed out of the violent-crime mechanism
// ---------------------------------------------------------------------
// `authority.js`'s regime/writ system and `environment.js`'s climate-
// weighted weather were each calibrated through measured, written-
// down work (CLAUDE.md's seventeenth and twenty-eighth standing
// rules). Wiring a real conflict-level multiplier into either without
// equivalent measurement would risk re-breaking exactly the balance
// that work fixed — the same risk already named for crime hot spots.
// This module reports `region.incomeLevel` / `region.conflictLevel` /
// `region.governmentType` and nothing reads them to decide an
// outcome; wiring one into a mechanic is a separate, future round
// with its own calibration pass, not an oversight here.

'use strict';

//: World Bank Country and Lending Groups, FY2027 thresholds (GNI per
//: capita, Atlas method, 2025 data) — checked directly, not assumed.
//: `checkedAt: null` because this environment cannot re-verify a live
//: source; re-check before relying on this past July 2027, when the
//: FY2028 thresholds take effect.
const INCOME_THRESHOLDS_USD = {
  source: 'world-bank-country-lending-groups-fy2027',
  checkedAt: null,
  lowIncomeMax: 1175,
  lowerMiddleIncomeMax: 4635,
  upperMiddleIncomeMax: 14375,
};

const INCOME_LEVELS = [
  'low-income', 'lower-middle-income', 'upper-middle-income', 'high-income',
];

//: UCDP's own distinction, generalised one step: nationwide state-
//: based conflict, localised insurgency/humanitarian-crisis-level
//: violence short of that, high non-state (cartel/gang) violence UCDP
//: tracks separately from state-based conflict, or none.
const CONFLICT_LEVELS = [
  'no-active-conflict', 'high-nonstate-violence', 'localized-conflict', 'active-armed-conflict',
];

//: EIU Democracy Index 2024 (https://www.eiu.com) — four regime
//: types by published score band: full democracy >=8.01, flawed
//: democracy 6.01-8.00, hybrid regime 4.01-6.00, authoritarian
//: regime <4.00. **This is the deliberate, honest substitute for
//: "specific political parties."** A currently-ruling party goes
//: stale at the next election and cannot be verified with confidence
//: across three dozen countries from here; a country's democratic
//: character, scored on a stable published methodology, is a durable
//: fact this module can actually stand behind without re-checking it
//: every few months.
const REGIME_TYPE_REFERENCE = {
  source: 'eiu-democracy-index-2024',
  checkedAt: null,
  thresholds: { fullDemocracyMin: 8.01, flawedDemocracyMin: 6.01, hybridRegimeMin: 4.01 },
};

const REGIME_TYPES = [
  'full-democracy', 'flawed-democracy', 'hybrid-regime', 'authoritarian-regime',
];

//: SIPRI military expenditure as % of GDP. Only Russia's and
//: Ukraine's figures below are SIPRI's own reported numbers — every
//: other value present is a third-party estimate that cites SIPRI
//: without being SIPRI's own published fact sheet, and is marked
//: `confidence: 'secondary-estimate'` rather than presented as
//: equally solid. Where no figure at all could be found (most of
//: this list), the field is `null` — left unknown rather than guessed.
const MILITARY_EXPENDITURE_REFERENCE = {
  source: 'sipri-military-expenditure-database',
  checkedAt: null,
  note: 'confidence: "sipri-official" is SIPRI\'s own figure; "secondary-estimate" cites '
    + 'SIPRI via a third party and is not independently confirmed here.',
};

//: EIA 2024 crude oil export figures. Only included for the handful
//: of these 36 countries that are actually major producers/exporters
//: — forcing an oil figure onto every entry would misstate the ones
//: that aren't. Everyone else in COUNTRIES gets `oilProducer: null`.
const OIL_PRODUCER_REFERENCE = {
  source: 'eia-2024-crude-export-figures',
  checkedAt: null,
};

//: Keyed on `ancestryPacks.GROUPS` — checked against that list at
//: load time below. Every figure is a good-faith, checked-where-
//: possible characterization, not a live feed; `source` names what
//: kind of fact it is, not a specific dated document, because the
//: specific status of several of these (El Salvador's 2022 gang
//: crackdown, the Tigray ceasefire, Russia/Ukraine) changes faster
//: than this file can track without live access.
const COUNTRIES = {
  german: {
    country: 'Germany', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'full-democracy', regimeScore: 8.73,
    militaryExpenditurePctGDP: { value: 1.84, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
  },
  irish: {
    country: 'Ireland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'full-democracy', regimeScore: 9.19,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  english: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    // North Sea production is real but in long, well-documented decline; no solid
    // 2024 production figure was found, so this flags the status without a number.
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
  },
  scottish: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
  },
  welsh: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
  },
  italian: {
    country: 'Italy', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.58,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  polish: {
    country: 'Poland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.40,
    // Poland is widely reported as NATO's highest %-of-GDP spender in 2024, but no
    // specific figure was confirmed this round — left null rather than guessed.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  french: {
    country: 'France', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'semi-presidential republic',
    // EIU downgraded France from full to flawed democracy in the 2024 index.
    regimeType: 'flawed-democracy', regimeScore: null,
    militaryExpenditurePctGDP: { value: 2.01, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
  },
  dutch: {
    country: 'Netherlands', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 9.00,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  norwegian: {
    country: 'Norway', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 9.81,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 1690000, exportValueUsd2024: 49700000000 },
  },
  swedish: {
    country: 'Sweden', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 9.39,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  greek: {
    country: 'Greece', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'full-democracy', regimeScore: 8.07,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  portuguese: {
    country: 'Portugal', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    // EIU upgraded Portugal to full democracy in the 2024 index; exact score not confirmed.
    regimeType: 'full-democracy', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  hungarian: {
    country: 'Hungary', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 6.51,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  czech: {
    country: 'Czech Republic', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    // EIU upgraded the Czech Republic to full democracy in the 2024 index; exact score not confirmed.
    regimeType: 'full-democracy', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  swiss: {
    country: 'Switzerland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal semi-direct democratic republic',
    regimeType: 'full-democracy', regimeScore: 9.32,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  lithuanian: {
    country: 'Lithuania', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.59,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  // **Russia and Ukraine, checked directly: this is an active,
  // ongoing, state-based war, among the most documented in the world
  // — not a judgement call.** Income levels carry real uncertainty
  // (sanctions, wartime disruption); flagged rather than overstated.
  russian: {
    country: 'Russia', incomeLevel: 'upper-middle-income', conflictLevel: 'active-armed-conflict', governmentType: 'federal semi-presidential republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.03,
    militaryExpenditurePctGDP: { value: 7.1, year: 2024, confidence: 'sipri-official' },
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 4500000, exportValueUsd2024: 122500000000 },
  },
  ukrainian: {
    country: 'Ukraine', incomeLevel: 'lower-middle-income', conflictLevel: 'active-armed-conflict', governmentType: 'unitary semi-presidential republic',
    // Score (4.90) sits in EIU's own published hybrid-regime band; wartime conditions
    // make a conventional democracy/autocracy label a poor fit regardless.
    regimeType: 'hybrid-regime', regimeScore: 4.90,
    militaryExpenditurePctGDP: { value: 34, year: 2024, confidence: 'sipri-official' },
    oilProducer: null,
  },
  somali: {
    country: 'Somalia', incomeLevel: 'low-income', conflictLevel: 'active-armed-conflict', governmentType: 'federal parliamentary republic',
    // No EIU Democracy Index score was found for Somalia at all — left null
    // rather than invented, same discipline as every other "not found" field here.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  'bosnian': {
    country: 'Bosnia and Herzegovina', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'hybrid-regime', regimeScore: 5.06,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  nigerian: {
    country: 'Nigeria', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'federal presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.16,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 1520000, exportValueUsd2024: 38400000000 },
  },
  ethiopian: {
    country: 'Ethiopia', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'authoritarian-regime', regimeScore: 3.24,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  ghanaian: {
    country: 'Ghana', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.24,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  kenyan: {
    country: 'Kenya', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic',
    // Score (5.05) sits in EIU's own published hybrid-regime band.
    regimeType: 'hybrid-regime', regimeScore: 5.05,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  jamaican: {
    country: 'Jamaica', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'flawed-democracy', regimeScore: 6.74,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  haitian: {
    country: 'Haiti', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'unitary semi-presidential republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.74,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  vietnamese: {
    country: 'Vietnam', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'one-party socialist republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.62,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  chinese: {
    country: 'China', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'one-party socialist republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.11,
    militaryExpenditurePctGDP: { value: 1.66, year: 2024, confidence: 'secondary-estimate' },
    // China is the world's largest crude IMPORTER despite large domestic production —
    // not a net exporter, so this is deliberately null rather than misleadingly "producer".
    oilProducer: null,
  },
  filipino: {
    country: 'Philippines', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.63,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  'asian-indian': {
    country: 'India', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.3,
    militaryExpenditurePctGDP: { value: 2.22, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
  },
  mexican: {
    country: 'Mexico', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'federal presidential republic',
    // Score (5.3) sits in EIU's own published hybrid-regime band.
    regimeType: 'hybrid-regime', regimeScore: 5.3,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'exporter', dailyProductionBbl: 848000, exportValueUsd2024: 21700000000 },
  },
  guatemalan: {
    country: 'Guatemala', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.55,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  honduran: {
    country: 'Honduras', incomeLevel: 'lower-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.98,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
  },
  // **El Salvador is flagged explicitly as fast-moving.** The 2022
  // "state of exception" gang crackdown is widely reported to have
  // sharply cut homicides; this reflects that more recent picture
  // rather than the country's earlier, much higher-violence years,
  // and should be the first entry re-checked against a live source.
  salvadoran: {
    country: 'El Salvador', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.61,
    militaryExpenditurePctGDP: { value: 1.39, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
  },
  'united-states': {
    country: 'United States', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal presidential republic',
    regimeType: 'flawed-democracy', regimeScore: null,
    militaryExpenditurePctGDP: { value: 3.4, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 4100000, exportValueUsd2024: 118500000000 },
  },
  // **Added after a direct question: "why did you build the United
  // States entry but not Israel?"** The honest answer was structural,
  // not political — this table is keyed on `ancestryPacks.GROUPS`, and
  // there was no `israeli` group in that vocabulary until this round
  // (see `ancestryImport.js`'s header). The earlier Jewish-observance
  // work (`jewishObservancePacks.js`) answered a RELIGION question —
  // Reform/Conservative/Orthodox — not a nationality/ancestry one, so
  // it never created this key. Figures below: EIU Democracy Index 2024
  // score 7.80 (rank 31/167, flawed democracy — confirmed directly,
  // not assumed from the judicial-overhaul coverage); SIPRI military
  // expenditure 8.8% of GDP in 2024 (world's 2nd-highest after
  // Ukraine, corroborated across multiple sources citing SIPRI but not
  // SIPRI's own fact sheet directly, so flagged `secondary-estimate`
  // like every other non-Russia/Ukraine figure in this table).
  // `conflictLevel` is checked the same direct way Russia/Ukraine's
  // was: UCDP's 2025 report counts the Gaza war among its state-based
  // conflicts and ACLED separately rates it an "Extreme"-severity hot
  // spot — real, current, not a judgement call — though no single
  // citable UCDP conflict-ID for it was found, which is noted rather
  // than overstated. `oilProducer` is `null`: Israel is a significant
  // NATURAL GAS producer/exporter (the Leviathan field), which is a
  // different resource than this field tracks, not the same fact
  // understated.
  israeli: {
    country: 'Israel', incomeLevel: 'high-income', conflictLevel: 'active-armed-conflict', governmentType: 'unitary parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.80,
    militaryExpenditurePctGDP: { value: 8.8, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
  },
};

function requireAncestryPacks() {
  // Required lazily, inside the function rather than at module scope,
  // so a future reorganisation that makes this module load first does
  // not create a require-order dependency neither side needs. The
  // load-time check below runs once at require time, so this is only
  // ever called that one time.
  return require('./ancestryPacks.js');
}

// **Checked once, at load time, not left to drift.** Every key here
// must be a real `ancestryPacks.GROUPS` entry, the same drift guard
// `migrationPathwayPacks.js` and `africanEthnicGroupPacks.js` already
// hold. `united-states` is the one deliberate exception — it is not
// an ancestry group, it is this table's explicit baseline.
{
  const ancestryPacks = requireAncestryPacks();
  for (const key of Object.keys(COUNTRIES)) {
    if (key === 'united-states') continue;
    if (!ancestryPacks.GROUPS.includes(key)) {
      throw new Error(`countryPacks.js: "${key}" is not in ancestryPacks.GROUPS`);
    }
  }
}

function countryFor(key) {
  return COUNTRIES[key] ?? null;
}

function describeCountry(key) {
  const entry = countryFor(key);
  if (!entry) return null;
  return { key, ...entry };
}

module.exports = {
  INCOME_THRESHOLDS_USD,
  INCOME_LEVELS,
  CONFLICT_LEVELS,
  REGIME_TYPE_REFERENCE,
  REGIME_TYPES,
  MILITARY_EXPENDITURE_REFERENCE,
  OIL_PRODUCER_REFERENCE,
  COUNTRIES,
  countryFor,
  describeCountry,
};
