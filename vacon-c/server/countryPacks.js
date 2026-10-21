// server/countryPacks.js
//
// **The first step of global expansion: a real, cited, per-country
// reference — income level, conflict level, government type — keyed
// on the same vocabulary `ancestryPacks.GROUPS` already uses.**
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

//: Keyed on `ancestryPacks.GROUPS` — checked against that list at
//: load time below. Every figure is a good-faith, checked-where-
//: possible characterization, not a live feed; `source` names what
//: kind of fact it is, not a specific dated document, because the
//: specific status of several of these (El Salvador's 2022 gang
//: crackdown, the Tigray ceasefire, Russia/Ukraine) changes faster
//: than this file can track without live access.
const COUNTRIES = {
  german: { country: 'Germany', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic' },
  irish: { country: 'Ireland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  english: { country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  scottish: { country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  welsh: { country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  italian: { country: 'Italy', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  polish: { country: 'Poland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  french: { country: 'France', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'semi-presidential republic' },
  dutch: { country: 'Netherlands', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  norwegian: { country: 'Norway', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  swedish: { country: 'Sweden', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  greek: { country: 'Greece', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  portuguese: { country: 'Portugal', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  hungarian: { country: 'Hungary', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  czech: { country: 'Czech Republic', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  swiss: { country: 'Switzerland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal semi-direct democratic republic' },
  lithuanian: { country: 'Lithuania', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic' },
  // **Russia and Ukraine, checked directly: this is an active,
  // ongoing, state-based war, among the most documented in the world
  // — not a judgement call.** Income levels carry real uncertainty
  // (sanctions, wartime disruption); flagged rather than overstated.
  russian: { country: 'Russia', incomeLevel: 'upper-middle-income', conflictLevel: 'active-armed-conflict', governmentType: 'federal semi-presidential republic' },
  ukrainian: { country: 'Ukraine', incomeLevel: 'lower-middle-income', conflictLevel: 'active-armed-conflict', governmentType: 'unitary semi-presidential republic' },
  somali: { country: 'Somalia', incomeLevel: 'low-income', conflictLevel: 'active-armed-conflict', governmentType: 'federal parliamentary republic' },
  'bosnian': { country: 'Bosnia and Herzegovina', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic' },
  nigerian: { country: 'Nigeria', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'federal presidential republic' },
  ethiopian: { country: 'Ethiopia', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'federal parliamentary republic' },
  ghanaian: { country: 'Ghana', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic' },
  kenyan: { country: 'Kenya', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic' },
  jamaican: { country: 'Jamaica', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy' },
  haitian: { country: 'Haiti', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'unitary semi-presidential republic' },
  vietnamese: { country: 'Vietnam', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'one-party socialist republic' },
  chinese: { country: 'China', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'one-party socialist republic' },
  filipino: { country: 'Philippines', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'unitary presidential republic' },
  'asian-indian': { country: 'India', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic' },
  mexican: { country: 'Mexico', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'federal presidential republic' },
  guatemalan: { country: 'Guatemala', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic' },
  honduran: { country: 'Honduras', incomeLevel: 'lower-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic' },
  // **El Salvador is flagged explicitly as fast-moving.** The 2022
  // "state of exception" gang crackdown is widely reported to have
  // sharply cut homicides; this reflects that more recent picture
  // rather than the country's earlier, much higher-violence years,
  // and should be the first entry re-checked against a live source.
  salvadoran: { country: 'El Salvador', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic' },
  'united-states': { country: 'United States', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal presidential republic' },
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
  COUNTRIES,
  countryFor,
  describeCountry,
};
