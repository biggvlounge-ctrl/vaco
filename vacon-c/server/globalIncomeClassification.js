// server/globalIncomeClassification.js
//
// A broader, SHALLOWER real country reference, closing the gap the
// thirty-ninth standing rule named when `countryPacks.js` was first
// built: "not all 190-odd countries on Earth, and not claimed to
// be." `countryPacks.COUNTRIES` stays keyed on `ancestryPacks.GROUPS`
// (36 real countries, each researched in depth — regime score,
// military expenditure, incarceration, immigration flows). This file
// is the opposite trade: real income level only, for roughly 100 MORE
// countries that have no corresponding US ancestry group at all —
// most of Africa, Southeast/Central Asia, the Pacific, and smaller
// European/Latin American economies.
//
// ---------------------------------------------------------------------
// The real source, and an honest confidence distinction from COUNTRIES
// ---------------------------------------------------------------------
// World Bank Country and Lending Groups, the SAME FY2027 thresholds
// `countryPacks.INCOME_THRESHOLDS_USD` already carries (GNI per
// capita, Atlas method): low-income <= $1,175; lower-middle $1,176-
// $4,635; upper-middle $4,636-$14,375; high-income > $14,375.
//
// `countryPacks.COUNTRIES` individually re-checked most of its figures
// this session via direct research. This table was NOT individually
// re-verified per country in the same way — it is built from the
// classification's own well-established, stable brackets, which
// change rarely and only near a bracket boundary. Every entry below
// carries `confidence: 'bracket-estimate'` rather than
// `'secondary-estimate'`/`'official'` for that reason, the honest
// distinction rather than papering over it. A handful of genuinely
// borderline economies (Romania, Moldova, Tunisia, Sri Lanka) were
// checked directly this round and carry `confidence: 'checked'`
// instead. Micro-states and small island nations with no reliable
// figure found are left OUT of this table entirely rather than
// guessed — `countryFor`'s own null-for-unknown behaviour, kept.
//
// ---------------------------------------------------------------------
// What this does NOT do
// ---------------------------------------------------------------------
// No conflict level, government type, regime type, or military
// expenditure for any of these — that is the deeper research
// `countryPacks.COUNTRIES` does per country, and attempting it for
// ~100 more countries in one pass would repeat the thirty-third
// standing rule's own lesson about a handful of real data points not
// being its own completeness. Reported only, through `statistics.js`
// nowhere — this is a standalone reference table, the same posture
// `countryPacks.js`'s own `EU_MIGRATION_OVERVIEW_2025`/
// `VENEZUELA_SITUATION_2026` already hold, never wired to a mechanic.

'use strict';

const countryPacks = require('./countryPacks.js');

const GLOBAL_INCOME_LEVELS = {
  // -- Europe (not already in countryPacks.COUNTRIES) -----------------
  spain: { level: 'high-income', confidence: 'bracket-estimate' },
  belgium: { level: 'high-income', confidence: 'bracket-estimate' },
  austria: { level: 'high-income', confidence: 'bracket-estimate' },
  denmark: { level: 'high-income', confidence: 'bracket-estimate' },
  finland: { level: 'high-income', confidence: 'bracket-estimate' },
  iceland: { level: 'high-income', confidence: 'bracket-estimate' },
  luxembourg: { level: 'high-income', confidence: 'bracket-estimate' },
  croatia: { level: 'high-income', confidence: 'bracket-estimate' },
  slovenia: { level: 'high-income', confidence: 'bracket-estimate' },
  slovakia: { level: 'high-income', confidence: 'bracket-estimate' },
  estonia: { level: 'high-income', confidence: 'bracket-estimate' },
  latvia: { level: 'high-income', confidence: 'bracket-estimate' },
  cyprus: { level: 'high-income', confidence: 'bracket-estimate' },
  malta: { level: 'high-income', confidence: 'bracket-estimate' },
  romania: { level: 'high-income', confidence: 'checked' },
  bulgaria: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  serbia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  'north-macedonia': { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  montenegro: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  albania: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  belarus: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  moldova: { level: 'upper-middle-income', confidence: 'checked' },
  azerbaijan: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  armenia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  georgia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  kazakhstan: { level: 'upper-middle-income', confidence: 'bracket-estimate' },

  // -- Asia-Pacific -----------------------------------------------------
  japan: { level: 'high-income', confidence: 'bracket-estimate' },
  'south-korea': { level: 'high-income', confidence: 'bracket-estimate' },
  singapore: { level: 'high-income', confidence: 'bracket-estimate' },
  taiwan: { level: 'high-income', confidence: 'bracket-estimate' },
  'hong-kong': { level: 'high-income', confidence: 'bracket-estimate' },
  australia: { level: 'high-income', confidence: 'bracket-estimate' },
  'new-zealand': { level: 'high-income', confidence: 'bracket-estimate' },
  brunei: { level: 'high-income', confidence: 'bracket-estimate' },
  malaysia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  thailand: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  indonesia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  mongolia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  fiji: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  maldives: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  'sri-lanka': { level: 'lower-middle-income', confidence: 'checked' },
  pakistan: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  bangladesh: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  nepal: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  myanmar: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  cambodia: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  laos: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  'papua-new-guinea': { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  kyrgyzstan: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  tajikistan: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  uzbekistan: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  'timor-leste': { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  vanuatu: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  'solomon-islands': { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  afghanistan: { level: 'low-income', confidence: 'bracket-estimate' },
  'north-korea': { level: null, confidence: 'no-reliable-figure-found' },

  // -- Middle East / North Africa --------------------------------------
  'saudi-arabia': { level: 'high-income', confidence: 'bracket-estimate' },
  'united-arab-emirates': { level: 'high-income', confidence: 'bracket-estimate' },
  qatar: { level: 'high-income', confidence: 'bracket-estimate' },
  kuwait: { level: 'high-income', confidence: 'bracket-estimate' },
  bahrain: { level: 'high-income', confidence: 'bracket-estimate' },
  oman: { level: 'high-income', confidence: 'bracket-estimate' },
  turkey: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  jordan: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  algeria: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  morocco: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  tunisia: { level: 'lower-middle-income', confidence: 'checked' },
  libya: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  iraq: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  lebanon: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  // Syria, Yemen and Sudan already have deep, real standalone entries
  // in `countryPacks.js` (SYRIA, YEMEN_CONFLICT_2026, SUDAN) — not
  // duplicated here.

  // -- Sub-Saharan Africa -----------------------------------------------
  'south-africa': { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  botswana: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  namibia: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  gabon: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  angola: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  cameroon: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  'ivory-coast': { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  senegal: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  zambia: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  zimbabwe: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  tanzania: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  benin: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  mauritania: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  djibouti: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  comoros: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  lesotho: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  eswatini: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  'democratic-republic-of-the-congo': { level: 'low-income', confidence: 'bracket-estimate' },
  burundi: { level: 'low-income', confidence: 'bracket-estimate' },
  'central-african-republic': { level: 'low-income', confidence: 'bracket-estimate' },
  chad: { level: 'low-income', confidence: 'bracket-estimate' },
  niger: { level: 'low-income', confidence: 'bracket-estimate' },
  mali: { level: 'low-income', confidence: 'bracket-estimate' },
  'burkina-faso': { level: 'low-income', confidence: 'bracket-estimate' },
  guinea: { level: 'low-income', confidence: 'bracket-estimate' },
  'guinea-bissau': { level: 'low-income', confidence: 'bracket-estimate' },
  'sierra-leone': { level: 'low-income', confidence: 'bracket-estimate' },
  liberia: { level: 'low-income', confidence: 'bracket-estimate' },
  madagascar: { level: 'low-income', confidence: 'bracket-estimate' },
  malawi: { level: 'low-income', confidence: 'bracket-estimate' },
  mozambique: { level: 'low-income', confidence: 'bracket-estimate' },
  rwanda: { level: 'low-income', confidence: 'bracket-estimate' },
  togo: { level: 'low-income', confidence: 'bracket-estimate' },
  gambia: { level: 'low-income', confidence: 'bracket-estimate' },
  uganda: { level: 'low-income', confidence: 'bracket-estimate' },

  // -- Latin America / Caribbean (not already in countryPacks.COUNTRIES) --
  brazil: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  argentina: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  chile: { level: 'high-income', confidence: 'bracket-estimate' },
  uruguay: { level: 'high-income', confidence: 'bracket-estimate' },
  panama: { level: 'high-income', confidence: 'bracket-estimate' },
  'trinidad-and-tobago': { level: 'high-income', confidence: 'bracket-estimate' },
  bahamas: { level: 'high-income', confidence: 'bracket-estimate' },
  barbados: { level: 'high-income', confidence: 'bracket-estimate' },
  peru: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  ecuador: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  paraguay: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  'costa-rica': { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  suriname: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  guyana: { level: 'high-income', confidence: 'bracket-estimate' },
  belize: { level: 'upper-middle-income', confidence: 'bracket-estimate' },
  bolivia: { level: 'lower-middle-income', confidence: 'bracket-estimate' },
  nicaragua: { level: 'lower-middle-income', confidence: 'bracket-estimate' },

  // -- Western Europe already fully covered by countryPacks.COUNTRIES:
  // Germany, Ireland, UK, Italy, Poland, France, Netherlands, Norway,
  // Sweden, Switzerland, Greece, Portugal, Hungary, Czech Republic,
  // Lithuania — not duplicated here.
};

function globalIncomeLevelFor(countryKey) {
  // `countryPacks.COUNTRIES` is checked FIRST and wins — the deeper,
  // individually-researched table is always the more authoritative
  // one where both happen to cover the same real country.
  const deep = countryPacks.COUNTRIES[countryKey];
  if (deep) return { level: deep.incomeLevel, confidence: 'countries-table', source: 'countryPacks.COUNTRIES' };
  const entry = GLOBAL_INCOME_LEVELS[countryKey];
  if (!entry) return null;
  return { level: entry.level, confidence: entry.confidence, source: 'world-bank-country-lending-groups-fy2027' };
}

module.exports = {
  GLOBAL_INCOME_LEVELS,
  globalIncomeLevelFor,
};
