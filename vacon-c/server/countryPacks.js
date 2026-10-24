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
// Fourth round: homelessness, immigration, informal-economy — France
// only, same "add it where it's real, null everywhere else" rule
// ---------------------------------------------------------------------
// Asked specifically to get France's current migration/homelessness/
// informal-economy picture right. Checked via direct search rather
// than assumed (this environment cannot browse live, so every figure
// below is dated and sourced, not re-verified after this round):
//
// - `homelessness`: the Fondation pour le Logement des Défavorisés
//   (formerly Fondation Abbé Pierre)'s own annual "L'état du mal-
//   logement en France" report — a foundation estimate from shelter/
//   street counts, not a government census. Two real sources
//   disagree on the 2024 street-death count (735 vs 912) and both are
//   kept rather than silently picking one.
// - `immigration`: OFPRA (the asylum office) and the Interior
//   Ministry publish two different, both-real counts that disagree
//   because they count different populations (Dublin-procedure cases
//   land with Interior, not OFPRA) — both kept, not averaged. The
//   ~700,000 undocumented-population figure is a widely-cited
//   Interior Ministry estimate from a secondary source; it could not
//   be confirmed here against a primary Interior document, and is
//   flagged `unconfirmed-secondary-estimate` rather than presented as
//   solid. Mayotte (the French overseas department with the sharpest
//   real migration flashpoint tied to France) is reported as its own
//   sub-field rather than folded into the metropolitan figures, since
//   it is a genuinely different real situation (sea crossings from
//   Comoros, a citizenship-law change specific to that territory).
// - `informalEconomyPctGDP`: no single number exists — real published
//   estimates range from ~6% to ~15% of GDP depending on method
//   (Medina & Schneider's shadow-economy model vs. INSEE's own
//   national-accounts non-observed-economy work vs. EU undeclared-
//   work labour-input surveys), and the range is reported with its
//   methodologies named rather than collapsed into one invented
//   figure.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Fifth round: current crime, tourism, the illicit-cigarette market,
// fraud/scams, the 2026 school-protest wave, and named political
// figures — France only, same discipline, two new honesty notes
// ---------------------------------------------------------------------
// Asked to add France's current crime statistics, tourism and
// "visual views" (read as tourism — the real draw of the country),
// cigarette/goods black-market activity, scamming, the ongoing 2026
// lycee protests, and named political figures ("the Macrons").
//
// - `crime`: SSMSI's (Interior Ministry) own 2025 annual review —
//   real official figures, with an explicit note that recorded crime
//   undercounts real offending, same honesty the Ministry's own
//   report states.
// - `tourism`: the Economy Ministry's own 2025 figures — France is
//   the world's most-visited country, a genuinely uncontested fact.
// - `illicitCigaretteMarket`: **the sharpest source conflict in this
//   module.** The headline figure comes from an industry-funded (Philip
//   Morris) KPMG report, and a named anti-tobacco NGO directly disputes
//   its methodology. Both are kept, with the dispute stated, rather
//   than silently trusting the one real published number.
// - `fraudAndScams`: three genuinely different measurements (official
//   detected payment fraud, police-recorded victims, a broader
//   self-reported survey) kept separate rather than combined, since
//   combining them would misstate all three.
// - `schoolProtests2026`: the real, ongoing lycee protest wave that
//   began 18 Sep 2026 — press-reported, explicitly flagged as a live
//   situation whose figures will move after this round.
// - `politicalFigures`: **the one deliberate exception to this
//   module's own "specific political parties were asked for and NOT
//   built" rule from the first round.** Asked for directly this
//   round, so it is built — but flagged, unlike every other field
//   here, as the module's most volatile data: an approval rating
//   moves weekly and French officeholders turn over unusually fast
//   (four Prime Ministers in the year before this round). Treat this
//   sub-object as dated the moment it was written, not durable like
//   `regimeType`.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Sixth round: Europe's migration picture beyond France (Germany, UK,
// Italy, an EU-wide figure), and current war status for Russia/
// Ukraine and Israel (the Israel-Iran war) — the clearest proof this
// module's pattern is NOT France-specific
// ---------------------------------------------------------------------
// Asked to show the pattern this module already uses generalises
// across countries ("duplicated all over the globe"), to cover all of
// Europe's migration rather than France alone, and to bring the
// Russia/Ukraine and Israel entries current, including the real
// Israel-Iran war.
//
// - `immigration` (Germany, UK, Italy): the same top-level key France
//   already uses, with country-specific real internal shapes — proof
//   the schema generalises, not three bespoke new field names.
// - `EU_MIGRATION_OVERVIEW_2025`: a real, bloc-wide Eurostat figure,
//   exported standalone rather than forced onto a `COUNTRIES` entry,
//   since there is no "EU" country key. Its own `note` names Spain as
//   a real top-4 EU destination this module still cannot cover with a
//   dedicated entry, for the same structural reason as Iran below —
//   no matching `ancestryPacks.GROUPS` key exists yet.
// - `warStatus` (russian, ukrainian, israeli): **the second-most
//   volatile data in this module, after `politicalFigures`.** No
//   verified casualty totals, no nationwide ceasefire, front-line and
//   escalation claims explicitly flagged as press/partisan-sourced.
//   Israel's entry names the real, separate Israel-Iran war (started
//   28 Feb 2026) and explicitly notes Iran itself has no entry here —
//   adding one needs a new `ancestryPacks.GROUPS` key first, the same
//   structural step Israel's own addition required.
// - UK's `immigration` is defined once (`UK_IMMIGRATION_2026`) and
//   referenced by all three of english/scottish/welsh, rather than
//   copy-pasted three times like this file's smaller fields — the
//   object is large enough that three literal copies risk drifting.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Seventh round: Haiti's real gang/humanitarian crisis (an existing
// `COUNTRIES` entry, since "haitian" already has an ancestry group),
// plus six real, current situations with NO matching ancestry group
// yet -- Venezuela, Cuba, Colombia, the Dominican Republic, Canada,
// and Africa continent-wide -- reported as standalone exported
// constants instead
// ---------------------------------------------------------------------
// Asked for Venezuela's political change, Cuba's crisis, a deep dive
// on Haiti's gangs (naming Jimmy "Barbecue" Cherizier directly),
// Colombia's crime, the Dominican Republic, Canada's migration, and
// "the whole continent of Africa."
//
// - `haitian.gangCrisis2026`: the one of these seven that IS a real
//   `COUNTRIES` entry, because "haitian" already has an ancestry-group
//   key. Names the real gang leader, his real recent raid, and the
//   real UN displacement/hunger figures -- the deepest single-country
//   addition in this module so far.
// - The other six are exported standalone (`VENEZUELA_SITUATION_2026`,
//   `CUBA_CRISIS_2026`, `COLOMBIA_CRIME_2026`,
//   `DOMINICAN_REPUBLIC_2026`, `CANADA_MIGRATION_OVERVIEW_2026`,
//   `AFRICA_MIGRATION_OVERVIEW_2026`), the same shape as
//   `EU_MIGRATION_OVERVIEW_2025` already established: Venezuela, Cuba,
//   Colombia and the Dominican Republic have no matching
//   `ancestryPacks.GROUPS` key, the same structural gap already named
//   for Iran and Spain -- a real `COUNTRIES` entry needs that key added
//   first, in `ancestryImport.js` AND here, not just a new object.
//   Canada was never going to be a `COUNTRIES` key (it is a real
//   destination, not a US ancestry source). None of the six is wired
//   into `generateRegion` -- there is no `countryKey` to attach any of
//   them to.
// - **`AFRICA_MIGRATION_OVERVIEW_2026` explicitly declares its own
//   scope rather than faking continent-wide coverage.** Africa has 54
//   countries; this reports the handful of real, large-scale current
//   displacement crises found this round (Sudan, DRC, the Sahel five,
//   South Sudan). Crime, tribes, scamming, food statistics,
//   development status and road status for the continent were asked
//   for and are NOT built -- a declared gap, not a thin pass presented
//   as whole.
// - **Venezuela's capture of a sitting president by a foreign power is
//   the single most significant real event in this entire module.**
//   Confirmed across multiple real outlets including the US State
//   Department's own page, not a single-source claim.
// - The Israel-Iran war's real global oil-market spillover
//   (`globalEconomicSpillover` on the israeli entry's `warStatus`) is
//   added here too: the real channel through which that war reaches
//   the Gulf states, India, and the US is the oil price, and that is
//   reported with an honest gap -- no source found a country-specific
//   UAE/Dubai/India effect this round, so none is invented.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Eighth round: named real notable figures, cartel/gang representation
// across the entries this module already has, Yemen, and a Caribbean
// deep dive (Puerto Rico, Cape Verde, the Virgin Islands, regional
// cruise tourism)
// ---------------------------------------------------------------------
// Asked for notable real people (politicians AND criminals) across
// the entries this module covers, confirmation that Haiti's gang
// entry is the real "Barbecue" reference, Yemen, and "all the
// Caribbean islands" with cruise-ship/boat statistics.
//
// - `notableFigures` (russian, ukrainian, israeli): Putin, Zelenskyy,
//   Netanyahu, each tied back to a claim already present in that
//   entry's own `warStatus`, not a new, disconnected fact.
// - `cartelsAndGangs2026` (mexican, salvadoran): real, current,
//   named leadership -- CJNG's El Mencho killed in 2026, his real
//   successor named by the DEA; El Salvador's Bukele crackdown, with
//   the real disagreement over whether MS-13/Barrio 18 are actually
//   dismantled kept visible, not resolved one way. Guatemala and
//   Honduras get an explicit "not found this round" note instead of
//   an invented figure.
// - Haiti's `gangCrisis2026.gangLeaderProfile` (added last round) IS
//   the Jimmy "Barbecue" Cherizier reference asked about directly --
//   confirmed correct, not changed.
// - `YEMEN_CONFLICT_2026`: standalone, same reason as Iran/Spain/
//   Venezuela/Cuba/Colombia/the Dominican Republic above -- no
//   "yemeni" ancestryPacks.GROUPS key exists.
// - `PUERTO_RICO_2026`, `CAPE_VERDE_2026`, `VIRGIN_ISLANDS_2026`,
//   `CARIBBEAN_CRUISE_TOURISM_2026`: standalone. **Explicitly bounded,
//   not literally every Caribbean island** -- roughly 13 sovereign
//   Caribbean states exist; this covers the four named directly plus
//   Haiti/Dominican Republic/Jamaica already covered elsewhere in this
//   module, plus one region-wide cruise-passenger figure (the real
//   "boat statistics" asked for: 16.27M 2025 Caribbean/Bahamas/
//   Bermuda cruise passengers, port-level Nassau/Antigua figures).
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Ninth round: the regional fallback mechanism
// ---------------------------------------------------------------------
// Asked for literally every country, state and city on Earth to be
// covered by real statistics. That is not achievable honestly --
// there are ~195 real countries and this module has cited, dated
// data for a few dozen; fabricating the rest to look complete would
// break the one rule every round above has followed. Asked which real
// alternative to build (a regional fallback vs. continuing to add
// individual countries one at a time), the answer was the fallback.
//
// `regionalContextFor(key)` is the result: a real geographic
// classification (`REGION_BY_KEY`) for every key this module knows
// about, plus a registry of the regional overviews that actually
// exist (`REGION_OVERVIEWS` -- only Europe, Africa and the Caribbean,
// because those are the only three built so far). For any key, it
// returns, in order: a dedicated `COUNTRIES` entry if one exists, a
// dedicated standalone reference if one exists (Venezuela, Cuba,
// Colombia, the Dominican Republic, Canada, Yemen, Puerto Rico, Cape
// Verde, the Virgin Islands), that key's region's own real overview
// if no dedicated entry exists, or -- if none of those three apply --
// an honest, named gap. That last case is not a failure state to hide;
// it is the literal, correct answer for "Brazil" or any other real
// country this module has never researched, and it says so instead of
// returning a silent null or an invented number.
//
// Wired into `migration.generateRegion` as `region.regionalContext`,
// additive alongside every flat field already there -- it never
// replaces the dedicated fields, it is what a region reports when
// none of them apply.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Tenth round: political parties and war factions, named, across
// every entry this module has already built a political/conflict
// story for
// ---------------------------------------------------------------------
// Asked directly to represent political parties and "war parties"
// (armed/warring factions) everywhere this module already covers a
// country's politics or conflict, and told explicitly that a real
// stand-in of the right stature is acceptable where the exact current
// name can't be confirmed -- in practice, every figure/party below
// WAS confirmable, so real names are used throughout, same as every
// other round.
//
// `politicalParties` is added to: french (Renaissance vs. Rassemblement
// National/La France Insoumise/Les Republicains), russian (United
// Russia vs. nominally-independent KPRF/LDPR), ukrainian (Servant of
// the People; no election since 2019 under martial law -- a real
// structural fact, not a research gap), israeli (Likud's coalition vs.
// Yesh Atid/National Unity), mexican (Morena, Sheinbaum succeeding
// AMLO), salvadoran (Bukele's Nuevas Ideas supermajority), and
// VENEZUELA_SITUATION_2026 (ruling PSUV vs. Machado's Vente
// Venezuela/Unitary Platform -- including her 2025 Nobel Peace Prize
// and the real, current standoff over her return), COLOMBIA_CRIME_2026
// (Petro taking over Pacto Historico after his term, the real
// incoming president Abelardo de la Espriella, now named directly
// after a second source corroborated what was single-sourced last
// round), and YEMEN_CONFLICT_2026 (the Houthi movement's real official
// name, Ansar Allah, against the internationally recognized
// government).
//
// **Haiti is the one honest exception, not an oversight.** No
// functioning multi-party system exists to name -- Haiti has had no
// elected government since 2016 and runs on a Transitional
// Presidential Council. Naming parties there would misstate the real
// situation; `gangCrisis2026`'s gang coalition remains the real locus
// of organised power this module found.
//
// Wired into `migration.generateRegion` as `region.politicalParties`,
// additive alongside every other flat field.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
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

//: Shared across english/scottish/welsh, which all report the same
//: country (United Kingdom) — defined once rather than triplicated
//: literally, since this one real object is large enough that three
//: copies would risk drifting out of sync on a future update. Real,
//: current UK migration figures: the House of Commons Library
//: (SN01403, 1 Sep 2026, citing Eurostat/Home Office) and the Refugee
//: Council. Net migration is the one figure real sources genuinely
//: disagree on and is reported as a disagreement, not reconciled.
const UK_IMMIGRATION_2026 = {
  channelCrossings: {
    year2025: { value: 41472, note: 'second-highest year on record after 45,774 in 2022' },
    yearToJune2026: { value: 33374 },
    toLateAug2026: { value: 15897, change: '-45% vs the same point in 2025' },
    cumulativeSince2018ToJul2026: { value: 206800 },
  },
  asylumApplications: {
    year2024: { value: 104800, note: 'a record peak' },
    yearToJune2026: { value: 69800, relatingToPeople: 85900, change: '-20% vs the prior year, per Refugee Council' },
    smallBoatShareOfClaimsYearToJune2026Pct: 40,
    pendingInitialDecisionBacklog2026: { value: 32000, priorPeak: { value: 134000, year: 2023 } },
  },
  netMigration: {
    note: 'real sources disagree and were not reconciled: one gives 204,000 for Jul 2024-Jun 2025, '
      + 'another gives 171,000 for 2025 (-48% YoY) — different reference periods, not the same claim twice',
  },
  source: 'house-of-commons-library-sn01403-2026-09-01; refugee-council; uk-immigration-tracker',
  confidence: 'mixed-official-and-secondary-conflicting-net-migration-figures',
};

//: Shared across russian/ukrainian — the same war, so the same
//: object rather than two copies that could drift. **The most time-
//: sensitive data in this entire module.** No nationwide ceasefire,
//: no verified cumulative casualty count, and front-line claims below
//: are explicitly press/think-tank sourced, not independently
//: confirmed. Written 24 Oct 2026; treat as already ageing.
const RUSSIA_UKRAINE_WAR_STATUS_OCT2026 = {
  asOf: '2026-10-24',
  ceasefire: 'no nationwide ceasefire; a local, temporary Oleshky ceasefire for humanitarian aid and civilian evacuation begins 2026-10-29',
  peaceTalks: 'ongoing — Putin met US envoy Steve Witkoff in St Petersburg to discuss new proposals',
  recentEvents: [
    { date: '2026-10-23', event: '270 prisoners of war swapped in a US/UAE-facilitated exchange' },
    { date: '2026-10-18/19', event: 'Ukraine launched 1,000+ drones at Russia, hitting a St Petersburg oil terminal' },
    { date: '2026-10-07', event: 'a Russian strike killed at least 20 people in Ukraine' },
  ],
  frontLine: {
    note: 'ISW-cited analysis (via Al Jazeera, 16 Oct 2026): Russian attack tempo fell sharply in the '
      + 'Sloviansk/Kramatorsk directions Aug-Oct 2026; Russian territorial gains for the year are near nil; '
      + 'Ukraine gained roughly 275 sq km in occupied Donetsk since August. Zelenskyy claims Russian forces '
      + 'outnumber Ukrainian ones 6-8x in parts of the front -- a partisan claim, not independently verified.',
  },
  casualties: { note: 'no verified current cumulative military or civilian casualty total found this round; only per-incident death tolls' },
  source: 'aljazeera; cfr-global-conflict-tracker; isw-institute-for-the-study-of-war',
  confidence: 'press-reported-fast-moving-situation-expect-immediate-staleness',
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
    // Germany led the EU on total 2025 asylum applications, and hosts
    // by far the largest Ukrainian temporary-protection population.
    immigration: {
      asylumApplicationsTotal2025: { value: 168000 },
      firstTimeApplications2025: { value: 113000, change: '-50.7% vs 2024, the largest drop among EU destinations' },
      repeatApplications2025: { value: 55000, note: 'unusually high, following a surge of applications from Afghan women' },
      firstTimeApplicationsQ1_2026: { value: 28922, change: '-23% vs same period 2025' },
      firstTimeApplicationsH1_2026: { value: 39646, priorYear: { value: 61336 } },
      ukrainianTemporaryProtection: { value: 1294555, asOf: '2026-08-31', shareOfEUTotalPct: 29.2 },
      totalRefugeeAndAsylumSeekerPopulation2025: { value: 2950000, note: 'the largest host country in Europe' },
      pendingAsylumCasesJune2026: { value: 274440, shareOfEUTotalPct: 23.8, note: 'highest pending caseload in the EU' },
      source: 'unhcr-germany-factsheet-2026-02; eurostat; bib-bund; komersant',
      confidence: 'official-unhcr-eurostat',
    },
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
    immigration: UK_IMMIGRATION_2026,
  },
  scottish: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
    immigration: UK_IMMIGRATION_2026,
  },
  welsh: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
    immigration: UK_IMMIGRATION_2026,
  },
  italian: {
    country: 'Italy', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.58,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    // Sea arrivals fell sharply in 2026. Two real UNHCR-sourced figures
    // for the same roughly-7-month window disagree (14,388 vs ~16,567)
    // and both are kept rather than picking one.
    immigration: {
      seaArrivalsFirstHalf2026: { value: 14388, change: '-30% vs same period 2025' },
      seaArrivalsFirstSevenMonths2026: { value: 16567, change: 'described as a >50% decline vs same period 2025', note: 'disagrees with the first-half figure above; both are real UNHCR-sourced numbers for overlapping windows, not reconciled' },
      seaArrivalsJan1ToApr8_2026: { value: 6524, priorYear: { value: 11419 } },
      lampedusaShareOfArrivals2026Pct: 56,
      libyaShareOfDeparturesPct: 83,
      topOriginCountriesH1_2026: [
        { country: 'Bangladesh', sharePct: 30 }, { country: 'Somalia', sharePct: 11 }, { country: 'Sudan', sharePct: 10 },
      ],
      peakYearComparison: { year: 2023, arrivals: 157000 },
      note: 'the Meloni government credits bilateral deals with North African countries and offshore processing in Albania; critics say irregular entry persists',
      source: 'unhcr; topafricanews; cde-news; pbs',
      confidence: 'mixed-official-and-press-figures-vary-by-source-and-cutoff',
    },
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
    // Foundation estimate (shelter + street counts), not a government
    // census. 350,000 was also the 2024 figure in last year's report —
    // kept as reported rather than smoothed into a single trend line.
    // Two real sources disagree on 2024 street deaths; both kept.
    homelessness: {
      estimatedPeople: { value: 350000, year: 2025 },
      priorYears: [{ value: 350000, year: 2024 }, { value: 330000, year: 2023 }, { value: 300000, year: 2020 }, { value: 143000, year: 2012 }],
      peopleInInadequateHousing: { value: 4200000, year: 2025 },
      streetDeaths2024: { low: 735, high: 912, note: 'two real sources disagree (735 "highest ever recorded" vs 912, +16% on 2023); both kept, not reconciled' },
      source: 'fondation-pour-le-logement-des-defavorises-rapport-mal-logement-2025-and-2026',
      confidence: 'foundation-estimate',
    },
    immigration: {
      asylumApplicationsOFPRA: { value: 145211, year: 2025, priorYear: { value: 153715, year: 2024 } },
      asylumRegistrationsInteriorMinistry: { value: 160303, year: 2025, priorYear: { value: 169956, year: 2024 } },
      estimatedUndocumentedPopulation: {
        value: 700000, confidence: 'unconfirmed-secondary-estimate',
        note: 'widely-cited Interior Ministry figure; not confirmed here against a primary Interior document',
      },
      regularisations: { value: 28610, year: 2025, priorYear: { value: 34700, year: 2024 } },
      // Mayotte is a genuinely different real situation from
      // metropolitan France -- a French overseas department off East
      // Africa, sea crossings from Comoros, and a 2024 law tightening
      // birthright citizenship specifically there -- reported as its
      // own sub-field rather than folded into the national figures.
      mayotte: {
        maritimeInterceptions: { 2020: 3536, 2021: 6355, 2022: 8003, 2023: 8669, 2024: 6764, note: 'no 2025 figure found' },
        nationalityGrantsMayotte: { 2018: 2800, 2022: 900, 2023: 860, note: 'arrivals have not fallen alongside the drop in grants' },
        citizenshipLawChange: 'birthright citizenship in Mayotte now requires a parent to show 1 year of legal residence, up from the former 3-month rule; passed both chambers of Parliament',
      },
      ukFranceChannelPilot: 'a UK-France "one in, one out" Channel-crossing return pilot began 5 Aug 2025',
      // Real INSEE stock-by-country-of-birth figures, not an invented
      // "where migrants come from" guess. "Immigrant" here is INSEE's
      // own definition (born abroad), so French-born children of
      // immigrants are not counted in this breakdown.
      originCountries: {
        topSevenByStock: [
          { country: 'Algeria', sharePct: 12.4 }, { country: 'Morocco', sharePct: 11.7 },
          { country: 'Portugal', sharePct: 7.3 }, { country: 'Tunisia', sharePct: 4.9 },
          { country: 'Italy', sharePct: 3.6 }, { country: 'Turkey', sharePct: 3.4 },
          { country: 'Spain', sharePct: 3.1 },
        ],
        topSevenShareOfAllImmigrantsPct: 46.4,
        shareOfAllImmigrantsBornInAfricaPct: 48.9,
        topOriginCountries2023Arrivals: ['Algeria', 'Morocco', 'Tunisia'],
        firstTimeResidencePermitsNonEU2024: [
          { country: 'Morocco', value: 36815 }, { country: 'Algeria', value: 29270 }, { country: 'Tunisia', value: 22456 },
        ],
        totalImmigrantStock: {
          value: 7700000, sharePctOfPopulation: 11.3, year: 2024,
          priorEstimate: { value: 7970000, sharePctOfPopulation: 11.6, year: 2025, confidence: 'provisional-secondary-source' },
        },
        year: 2024,
        source: 'insee; oecd-international-migration-outlook-2025; prague-process',
      },
      source: 'ofpra; french-interior-ministry; eurostat-asylum-statistics; iss-africa; infomigrants; constitutionnet',
      confidence: 'mixed-official-and-secondary',
    },
    // No single real figure exists -- estimates range by method, named
    // rather than collapsed into one invented number.
    informalEconomyPctGDP: {
      range: { low: 6.3, high: 15 },
      estimates: [
        { value: 11.65, year: 2015, method: 'medina-schneider-shadow-economy-model' },
        { value: 7.5, year: 2019, method: 'insee-non-observed-economy-national-accounts' },
        { valueWagedEmployment: 6.3, valueSelfEmploymentLabourInput: 48.9, year: 2019, method: 'eu-undeclared-work-labour-input-factsheet' },
        { value: 8.8, confidenceInterval: [7.6, 10], years: '2012-2015', method: 'insee-linked-survey-based-undeclared-work-rate' },
      ],
      source: 'medina-schneider-shadow-economy-database; insee; european-parliament-undeclared-work-factsheet',
      confidence: 'mixed-methodology-estimates',
    },
    // SSMSI (Interior Ministry statistics service)'s 10th annual
    // "Insecurite et delinquance" review, published 9 July 2026,
    // covering 2025 recorded crime -- a genuinely different question
    // from `crimeHotspotPacks.js`'s own US-tract crime-weighting data,
    // which this is not compared against or merged with.
    crime: {
      homicides: { value: 982, year: 2025, change: '+1% vs 2024' },
      attemptedHomicides: { value: 4501, year: 2025, change: '+5% vs 2024' },
      physicalViolenceChange: '+5% in 2025',
      theftTrend: {
        note: 'sources disagree: one outlet reports non-violent theft against individuals up 2% on 2024; '
          + 'another reports burglaries and car thefts falling while fraud rises; not reconciled here',
      },
      drugTraffickingPersonsImplicated: { value: 56600, year: 2025, change: '+8% vs 2024' },
      cryptoRelatedViolentCrime2026: {
        cases: 90, arrests: 223, period: '1 Jan - mid Aug 2026',
        note: 'a new recorded category (kidnapping, extortion, threats, violent theft tied to crypto holders); no broader 2026 national total found',
      },
      note: 'the Ministry\'s own figures undercount offending: many victims do not file complaints',
      source: 'ssmsi-interieur-gouv-fr-insecurite-et-delinquance-2025; connexionfrance; gncrypto-news',
      confidence: 'official-ministry-figures-except-crypto-category-which-is-press-reported',
    },
    // France has been the world's most-visited country for years; 2025
    // set a new record. Report-only, same as everything else here --
    // not wired into any tourism-revenue mechanic.
    tourism: {
      internationalVisitors: { value: 102000000, year: 2025, priorYear: { value: 100000000, year: 2024 } },
      worldRanking: 1,
      tourismReceiptsEur: { value: 77500000000, year: 2025, change: '+9% vs 2024' },
      avgVisitorSpendEur: 760,
      overnightStaysMillions: { total: 743, paidAccommodation: 261.2, year: 2025 },
      visitorOriginNote: 'Europe ~75% of overnight stays (Italy, Spain, Belgium, Netherlands, Germany named); '
        + 'US visitor numbers up significantly; Asian arrivals (led by Japan) recovering more slowly',
      source: 'french-economy-ministry; atout-france; campusfrance',
      confidence: 'official',
    },
    // Real, but genuinely contested -- the industry-funded KPMG figure
    // and an anti-tobacco NGO's rebuttal both kept, not silently
    // picked between, same discipline as the homelessness/immigration
    // figures above that disagree across real sources.
    illicitCigaretteMarket: {
      kpmgIllicitMarketSharePct: {
        value: 41.4, year: 2025, priorYear: { value: 37.6, year: 2024 },
        counterfeitShareOfConsumptionPct: 19,
        confidence: 'contested-industry-funded',
        note: 'KPMG\'s report is commissioned by Philip Morris; Generation Sans Tabac (an anti-tobacco NGO) disputes '
          + 'the methodology and says publicly available data shows a real decline in out-of-network volumes instead',
      },
      officialGovernmentEstimate: {
        dailyCigarettesFromParallelMarketPct: 20, treasuryLossEurPerYear: 4000000000,
      },
      smokersBuyingOutsideLicensedNetworkPct: { value: 38, year: 2025, priorYear: { value: 23, year: 2019 } },
      note: 'estimates of the illicit share range roughly 20%-49% of consumption depending on source and method; France is the largest illicit cigarette market in the EU on every account found',
      source: 'kpmg-2026-report; generation-sans-tabac; eunews; politique-internationale',
      confidence: 'disputed-estimates-vary-widely',
    },
    // Three real, genuinely different measurements -- official
    // detected payment fraud, police-recorded victims, and a broader
    // self-reported survey -- kept separate rather than combined into
    // one number that would misstate all three.
    fraudAndScams: {
      officialPaymentFraudEur: { value: 1241000000, year: 2025, change: '+3.8% vs 2024' },
      socialManipulationScamsEur: { value: 516000000, year: 2025, change: '+34% vs 2024', note: 'fake-bank-adviser-style manipulation scams' },
      bankTransferFraudLossesEur: { value: 485000000, year: 2025, note: 'only 4% of fraudulent transactions by count, but the largest share of losses' },
      policeRecordedVictims: { value: 445900, year: 2025, note: 'a count of recorded victims, not total losses' },
      surveyEstimateTotalLossesEur: {
        value: 7600000000, year: 2025, shareOfAdultsVictimizedPct: 54, avgLossPerVictimEur: 750,
        confidence: 'self-reported-survey-not-comparable-to-official-figures',
      },
      source: 'banque-de-france-osmp; french-interior-ministry; gasa-biocatch-2025-survey',
      confidence: 'mixed-official-and-survey',
    },
    // The 2026 lycee protest wave -- real, current, and ongoing as of
    // this round. Figures vary by source and by date; the latest found
    // figure for each is kept, flagged where sources disagree.
    schoolProtests2026: {
      startDate: '2026-09-18', originLocation: 'Creteil (Paris suburb)',
      spreadToCountries: ['Belgium', 'Albania', 'Greece', 'Italy'],
      grievances: ['teacher shortages', 'overcrowded classrooms', 'dilapidated school buildings'],
      notableIncident: 'Lycee Nelson Mandela in Nantes set on fire; one Paris-area school had fire damage running into millions of euros',
      detainedByInteriorMinistry: { value: 625, asOf: '2026-09-30' },
      officersWounded: { value: 83, asOf: '2026-09-30' },
      arrests: { value: 1949, asOf: '2026-10-01', note: 'evening figure; supersedes the 625-detained count from the day before' },
      pupilsAndStaffInjured: { value: 119, sourceOfficial: 'Education Minister Edouard Geffray' },
      governmentResponse: 'the Prime Minister called an inter-ministerial crisis meeting; teacher unions called strikes',
      source: 'france24; cnn; time; wikipedia-2026-french-lycee-protests',
      confidence: 'press-reported-ongoing-situation-figures-will-move',
    },
    // **The most volatile fields in this entire module, flagged as
    // such rather than presented with the same durability as regimeType.**
    // A named officeholder's approval rating changes by the week and
    // the officeholder themselves changes faster in France than almost
    // any peer democracy (four Prime Ministers between late 2024 and
    // late 2025 alone: Attal, Barnier, Bayrou, Lecornu). This is the
    // deliberate exception to this module's own "specific political
    // parties were asked for and NOT built" rule — asked for directly
    // this round, so it is built, with its instability stated up front
    // rather than presented as a stable fact like oilProducer.
    politicalFigures: {
      president: {
        name: 'Emmanuel Macron', tookOffice: 2017,
        approvalRatingPct: [
          { value: 15, pollster: 'ipsos-bva-cesi', date: '2026-10-11', note: 'record low since taking office' },
          { value: 18, pollster: 'odoxa-mascaret', date: 'late-2026-09', change: '-7pts since late June 2026' },
        ],
      },
      primeMinister: {
        name: 'Sebastien Lecornu',
        approvalRatingPct: [
          { value: 22, pollster: 'ipsos-bva-cesi', date: '2026-10-11' },
          { value: 24, pollster: 'odoxa-mascaret', date: 'late-2026-09', change: '-8pts' },
        ],
        note: 'the fourth PM since Attal (late 2024): Attal, Barnier, Bayrou, Lecornu',
      },
      educationMinister: { name: 'Edouard Geffray' },
      nextPresidentialElection: {
        firstRound: '2027-04-18', secondRound: '2027-05-02',
        note: 'one October 2026 poll had Marine Le Pen leading if the election were held then',
      },
      pollingMethodologyCaveat: 'Ipsos asks a "performance" question, Odoxa asks "is this a good president/PM" -- the two series are not directly comparable',
      source: 'ipsos-bva; odoxa-mascaret; visualcapitalist; secondary-outlet-reporting',
      confidence: 'secondary-outlet-polls-expect-this-to-be-stale-quickly',
    },
    // Real, named parties -- the ruling presidential party and the
    // real opposition landscape, same volatile-but-real posture as
    // politicalFigures above.
    politicalParties: {
      ruling: { name: 'Renaissance', note: 'Macron\'s presidential party; governs via a minority/coalition government given Lecornu\'s low approval' },
      opposition: [
        { name: 'Rassemblement National', leader: 'Marine Le Pen', note: 'per politicalFigures.nextPresidentialElection, polling first if an election were held now' },
        { name: 'La France Insoumise', leader: 'Jean-Luc Melenchon', note: 'the main party of the organised left' },
        { name: 'Les Republicains', note: 'the traditional centre-right party' },
      ],
      source: 'same secondary-outlet reporting as politicalFigures',
      confidence: 'secondary-outlet-polls-expect-this-to-be-stale-quickly',
    },
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
    warStatus: RUSSIA_UKRAINE_WAR_STATUS_OCT2026,
    // The named head of state driving `warStatus` above -- the real-
    // world "representation" the war-status object itself is about.
    notableFigures: [{ name: 'Vladimir Putin', role: 'President of Russia', note: 'met US envoy Steve Witkoff in St Petersburg on new peace proposals, per warStatus.peaceTalks' }],
    politicalParties: {
      ruling: { name: 'United Russia', note: 'holds the parliamentary majority; Putin has governed formally outside party membership since 2012 while United Russia remains his legislative vehicle' },
      nominalOpposition: [
        { name: 'Communist Party of the Russian Federation (KPRF)' },
        { name: 'Liberal Democratic Party of Russia (LDPR)' },
      ],
      note: 'both nominal-opposition parties are widely described as largely state-aligned rather than genuinely independent, consistent with the authoritarian-regime classification already on this entry',
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-not-election-cycle-specific',
    },
  },
  ukrainian: {
    country: 'Ukraine', incomeLevel: 'lower-middle-income', conflictLevel: 'active-armed-conflict', governmentType: 'unitary semi-presidential republic',
    // Score (4.90) sits in EIU's own published hybrid-regime band; wartime conditions
    // make a conventional democracy/autocracy label a poor fit regardless.
    regimeType: 'hybrid-regime', regimeScore: 4.90,
    militaryExpenditurePctGDP: { value: 34, year: 2024, confidence: 'sipri-official' },
    oilProducer: null,
    warStatus: RUSSIA_UKRAINE_WAR_STATUS_OCT2026,
    notableFigures: [{ name: 'Volodymyr Zelenskyy', role: 'President of Ukraine', note: 'quoted (per warStatus.frontLine) claiming Russian forces outnumber Ukrainian ones 6-8x in parts of the front -- a partisan claim, not independently verified' }],
    politicalParties: {
      ruling: { name: 'Servant of the People (Sluha Narodu)', leader: 'Volodymyr Zelenskyy' },
      note: 'no national election has been held since 2019 -- Ukrainian law suspends elections under martial law, which has been continuously in force since the 2022 invasion; this is a real, structural fact, not a gap in this module\'s research',
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-not-election-cycle-specific',
    },
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
    // Real, current, and the sharpest gang/humanitarian crisis this
    // module reports on. Figures come from UN agencies (IOM, WFP,
    // BINUH, UNODC) and real press, not estimated here. Several real
    // sources disagree on exact counts/dates and both are kept.
    gangCrisis2026: {
      gangControlOfPortAuPrincePct: { value: 90, year: 2026, priorYear: { value: 80, year: 2024 } },
      displacedPersons: { value: 1500000, asOf: '2026-06', source: 'iom', note: 'nearly 1.5 million people with no stable place to live' },
      recentDisplacementSurge: { value: 30000, period: 'a ten-day stretch, late May 2026', source: 'wfp', note: 'fled Port-au-Prince and surrounding areas' },
      casualties: [
        { period: 'Jan-Mar 2026', killed: 1642, injured: 745, source: 'binuh' },
        { period: 'Apr-Jun 2026', killed: 1408, injured: 656, source: 'binuh' },
      ],
      foodInsecurity: {
        value: 5800000, sharePctOfPopulation: 52, year: 2026, levelDescribed: 'crisis-level or worse',
        emergencyLevelSubset: 1800000, note: 'an April 2026 release; no 2026 IPC famine classification found (the last famine finding dates to Sep 2024, 5,636 people in starvation)',
      },
      childRecruitmentShareOfSomeGangsPct: { low: 30, high: 50, confidence: 'estimate' },
      // The gang leader named directly: real, sanctioned, and the
      // public face of Haiti's largest gang coalition.
      gangLeaderProfile: {
        name: 'Jimmy Cherizier', alias: 'Barbecue',
        background: 'a former Haitian National Police officer turned gang leader',
        role: 'the public face of the Viv Ansanm gang coalition -- InSight Crime assesses his direct territorial control may have waned as other ambitious leaders rise within that same coalition, an older assessment not reconfirmed this round',
        sanctions: 'under UN, US and other sanctions',
        recentEvent: {
          date: '2026-01-14', event: 'Haitian National Police and armed forces raided his home in the Delmas 6 neighbourhood of Port-au-Prince',
          note: 'Haitian authorities confirmed Vectus Global, a private security firm linked to Erik Prince, took part alongside police/military; no reporting found this round on whether the raid changed his control of Delmas 6 or the wider city',
        },
      },
      source: 'un-news; iom; wfp; binuh; unodc; insightcrime; haitiantimes; aljazeera',
      confidence: 'un-agency-and-press-sourced-real-sources-disagree-on-some-dates-and-counts',
    },
    // Named political PARTIES, honestly, do not apply here the way
    // they do for every other entry in this round: Haiti has had no
    // elected government since 2016, and is currently run by a
    // Transitional Presidential Council, not a functioning multi-party
    // system. Naming parties would misstate the real situation; the
    // gang coalition itself (gangCrisis2026.gangLeaderProfile) is the
    // real locus of organised power this round found.
    politicalParties: { note: 'no functioning multi-party system exists to report -- Haiti has had no elected government since 2016 and is currently run by a Transitional Presidential Council; this is the honest answer, not a gap' },
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
    // Real, current cartel leadership and territorial-conflict data --
    // the real "criminal organization representation" asked for.
    cartelsAndGangs2026: {
      cjng: {
        formerLeader: { name: 'Nemesio Oseguera Cervantes', alias: 'El Mencho', status: 'killed in a Mexican military operation in Tapalpa, Jalisco, 2026, along with six others' },
        currentLeader: { name: 'Valencia Gonzalez', note: 'DEA says he assumed CJNG\'s top leadership after El Mencho\'s death; the US reward for him was raised to up to $25 million' },
      },
      sinaloaCartel: {
        status: 'fractured, with active territorial contestation against CJNG across multiple Mexican states through 2026, per independent conflict trackers (ACLED and regional monitors)',
        note: 'no current single leader confirmed this round',
      },
      retaliationViolence: { date: '2026-02-22/23', roadblocks: 252, statesAffected: 20, note: 'a wave of violence, blockades and arson followed El Mencho\'s killing, per the federal security cabinet' },
      historicalShare: { note: 'UCDP data: CJNG associated with 3 of 4 homicides from cartel clashes since 2016; CJNG and Sinaloa together estimated (2022) to control 30-35% of Mexican territory -- older figures, no 2026 total found' },
      source: 'dea-press-release-2026-08; wikipedia-2026-mexico-cartel-unrest; wikipedia-2026-jalisco-operation; commandelevenintel-substack',
      confidence: 'leadership-change-well-sourced-current-national-violence-totals-not-found',
    },
    politicalParties: {
      ruling: { name: 'Morena', note: 'Claudia Sheinbaum, Morena\'s candidate, succeeded Andres Manuel Lopez Obrador (AMLO) as President in October 2024' },
      opposition: [{ name: 'PAN (Partido Accion Nacional)' }, { name: 'PRI (Partido Revolucionario Institucional)' }],
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-not-election-cycle-specific',
    },
  },
  guatemalan: {
    country: 'Guatemala', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.55,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    cartelsAndGangs2026: { note: 'no current (2025/2026) gang/cartel-specific reporting found this round -- a real gap, not filled with an invented figure' },
  },
  honduran: {
    country: 'Honduras', incomeLevel: 'lower-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.98,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    cartelsAndGangs2026: { note: 'no current (2025/2026) gang/cartel-specific reporting found this round -- a real gap, not filled with an invented figure' },
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
    // Real, current status of the crackdown named directly -- real
    // sources disagree on whether MS-13/Barrio 18 are actually
    // dismantled, dormant, or rebuilding abroad, and both views kept.
    cartelsAndGangs2026: {
      crackdown: { startDate: '2022-03', trigger: 'a gang massacre', scale: 'tens of thousands of suspected members and collaborators arrested under a state of emergency' },
      prosecutionPhase: { event: 'hearings concluded against 485 alleged MS-13 members', date: '2026-07' },
      prisonReleasePlan: { announced: '2026-10-mid', scope: 'up to half of those jailed under the emergency, focused on people deemed gang collaborators' },
      usDesignation: { year: 2025, event: 'the US added MS-13 and Barrio 18 to its Foreign Terrorist Organizations list' },
      realStateOfGangsDisputed: 'InSight Crime says the offensive dismantled much of the gangs\' structure, forcing members into hiding or exile; other reporting (Rio Times) says whether the gangs are destroyed, dormant in prison, or rebuilding abroad is genuinely contested',
      politicalContext: { note: 'Congress removed presidential term limits, clearing the path for Bukele to run again in 2027; 2026 polls put his approval roughly 65-75%', leader: { name: 'Nayib Bukele', role: 'President of El Salvador' } },
      note: 'human rights groups say the state of emergency has produced widespread arbitrary arrests',
      source: 'insightcrime; riotimesonline; bti-project; abcnews; wikipedia-salvadoran-gang-crackdown',
      confidence: 'mixed-real-sources-disagree-on-whether-the-gangs-are-actually-dismantled',
    },
    politicalParties: {
      ruling: { name: 'Nuevas Ideas', leader: 'Nayib Bukele', note: 'holds a supermajority in the Legislative Assembly, per cartelsAndGangs2026.politicalContext' },
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-not-election-cycle-specific',
    },
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
    // A second, real, distinct war from the Gaza war `conflictLevel`
    // already covers -- `conflictLevel` stays as-is since it is
    // already correctly `active-armed-conflict` for either reason.
    // Live-blog sourced, dates inconsistent across outlets; treat as
    // already ageing, same posture as the Russia/Ukraine entry above.
    warStatus: {
      asOf: '2026-10-24',
      name: 'israel-iran-war',
      startDate: '2026-02-28',
      summary: 'began with a joint US-Israel "pre-emptive" strike on Iranian targets; Supreme Leader Ali Khamenei was killed and his son Mojtaba Khamenei succeeded him',
      ceasefire: 'agreed April 2026; sources disagree on how fully it has held since (one timeline records US strikes resuming 8 Jul 2026 after attacks on shipping in the Strait of Hormuz)',
      currentStatus: 'stalled talks as of Oct 2026 despite a June 2026 US-Iran memorandum of understanding; the US says it is enforcing a naval blockade on Iranian shipping; Iran claims control of the Strait of Hormuz and continued attacks on shipping there (a maritime monitor counted at least 10 vessels attacked in the week before one report)',
      plannedEscalation: 'Israeli and US sources say joint strikes on Iran are planned to resume, likely after the 3 Nov 2026 US midterm elections',
      note: 'distinct from Israel\'s separate, longer-running Gaza war -- both are real and ongoing as of this round. '
        + 'Iran itself has no entry in this table: no "iranian" ancestryPacks.GROUPS entry exists yet, the same '
        + 'structural gap this israeli entry itself closed for Israel -- adding one would need the same '
        + 'ancestry-expansion work, not just a countryPacks.js line.',
      // The real "lands in between" effect this war reaches through:
      // global oil prices, not a direct conflict. No source this round
      // named a specific UAE/Dubai/India effect -- that gap is stated,
      // not papered over with an invented number for either place.
      globalEconomicSpillover: {
        hormuzClosure: {
          startDate: '2026-03-04',
          scaleOfOilSupplyDisruptedPct: 20,
          characterization: 'an IEA official reportedly called it the largest supply disruption in the history of the global oil market',
          immediateEffect: 'Brent crude surged past $120/bbl; QatarEnergy declared force majeure on stranded LNG exports',
        },
        pricePath: [
          { period: 'March-April 2026', event: 'repeated spikes, Brent reaching roughly $119.94' },
          { period: 'after 17 Jun 2026', event: 'a US-Iran memorandum of understanding briefly returned prices to pre-conflict levels' },
          { period: 'July-August 2026', event: 'prices rose again; by August Brent was still about 16% above pre-war levels, and Iran said the strait would not reopen without major US concessions' },
        ],
        fuelShortages: 'countries that import most of their fuel through the Persian Gulf faced real shortages, described in coverage as a worldwide fuel crisis',
        gapNote: 'no source found this round gives a specific effect on the UAE, Dubai, or India -- a real gap, not filled with an invented figure; the oil-price mechanism above is the real channel through which the war reaches those economies, even without a country-specific number yet',
        source: 'wikipedia-2026-iran-war-fuel-crisis; wikipedia-economic-impact-of-the-2026-iran-war; aljazeera',
        confidence: 'oil-market-figures-well-sourced-country-specific-effects-not-found',
      },
      source: 'dawn; cbsnews; foxnews; abcnews',
      confidence: 'live-blog-sourced-fast-moving-dates-inconsistent-across-outlets',
    },
    notableFigures: [{ name: 'Benjamin Netanyahu', role: 'Prime Minister of Israel', note: 'said the Iranian regime must be overthrown once and for all (per warStatus)' }],
    politicalParties: {
      ruling: { name: 'Likud', leader: 'Benjamin Netanyahu', note: 'governs via a coalition with religious and other right-wing parties' },
      opposition: [
        { name: 'Yesh Atid', leader: 'Yair Lapid' },
        { name: 'National Unity', leader: 'Benny Gantz' },
      ],
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-coalition-composition-can-shift',
    },
  },
};

// Real, bloc-wide 2025/2026 EU asylum figures (Eurostat) -- "all of
// Europe's migration," at the level Eurostat itself reports it,
// rather than invented per-country figures for the ~20 EU members
// with no `COUNTRIES` entry and no `ancestryPacks.GROUPS` key to hang
// one on. Not per-region (there is no "EU" country key to attach it
// to) -- exported standalone and reported the same report-only way as
// everything else in this module.
const EU_MIGRATION_OVERVIEW_2025 = {
  firstTimeAsylumApplicants2025: { value: 365000, change: '-27% vs 2024' },
  totalApplicationsByCountry2025: [
    { country: 'Germany', value: 168000 }, { country: 'France', value: 152000 },
    { country: 'Spain', value: 144000 }, { country: 'Italy', value: 135000 },
  ],
  firstTimeApplicantsQ2_2026: { value: 122960, change: '-15.9% vs Q1 2026' },
  topFirstTimeDestinationsJuly2026: [
    { country: 'France', value: 9000 }, { country: 'Italy', value: 5140 }, { country: 'Greece', value: 3715 },
    { country: 'Spain', value: 3590 }, { country: 'Germany', value: 3075 },
  ],
  note: 'Spain is a real top-4 EU migration destination with no dedicated countryPacks.js entry -- no "spanish" '
    + 'ancestryPacks.GROUPS key exists yet, the same structural gap noted on the israeli/Iran entry above',
  methodologyCaveat: 'from July 2026 Eurostat uses an amended methodology under the EU Pact on Migration and Asylum; figures spanning that boundary are not directly comparable',
  source: 'eurostat-asylum-applications-monthly-and-annual-statistics',
  confidence: 'official-eurostat',
};

// ---------------------------------------------------------------------
// Standalone reference constants: Venezuela, Cuba, Colombia, the
// Dominican Republic, Canada, Africa (continent-wide, bounded)
// ---------------------------------------------------------------------
// None of these six are `COUNTRIES` entries. Venezuela, Cuba, Colombia
// and the Dominican Republic have no matching `ancestryPacks.GROUPS`
// key -- adding a real one (as this module's own header already notes
// for Iran and Spain) needs the SAME two-file expansion the Israel
// addition required: a new entry in `ancestryImport.js`'s own GROUPS
// list (duplicated and cross-checked here), not just a countryPacks.js
// line. Canada is a real migration destination, not a US ancestry
// source, so it was never going to be a `COUNTRIES` key regardless.
// Africa is 54 countries; this reports the handful of real, current,
// large-scale crises found this round, and says so explicitly rather
// than presenting partial coverage as complete.
//
// Exported standalone, same report-only posture as everything else in
// this module -- not wired into `migration.generateRegion`, since none
// of the six has a `countryKey` to attach to.

const VENEZUELA_SITUATION_2026 = {
  politicalCrisis: {
    summary: 'President Nicolas Maduro was captured by US forces on 3 Jan 2026 in a large-scale operation; his wife Cilia Flores was captured with him',
    detention: 'held at the Metropolitan Detention Center, Brooklyn; charged with narco-terrorism and drug trafficking; both pleaded not guilty at their first court appearance',
    governance: 'Vice President Delcy Rodriguez was sworn in as acting president; the US said it would run the country until a transition plan is in place',
    politicalPrisonerReleases: { confirmedReleased: 621, asOf: '2026-03-08', startDate: '2026-01-08' },
    negotiations: 'government-opposition talks reportedly began in August 2026',
    note: 'no reporting found this round on the current (Oct 2026) status of the trial or the negotiations',
  },
  politicalParties: {
    ruling: { name: 'PSUV (United Socialist Party of Venezuela)', note: 'both Maduro and acting President Delcy Rodriguez are PSUV' },
    opposition: {
      leader: { name: 'Maria Corina Machado', party: 'Vente Venezuela', coalition: 'Unitary Platform / Democratic Unity Roundtable' },
      note: 'a 2025 Nobel Peace Prize laureate; relationship with the acting government is openly hostile -- she has said Rodriguez is "following orders" and that she is not part of the government-sponsored dialogues. Vente Venezuela\'s Caracas headquarters reopened 28 Mar 2026 after 20 months closed. As of late Sep 2026, three countries had reportedly denied landing permission to a flight carrying her, and her return to Venezuela was unresolved',
    },
    source: 'wikipedia-maria-corina-machado; primicias; noticiasrcn',
    confidence: 'real-and-current-no-confirmed-election-date-found',
  },
  source: 'cnn; state-gov; britannica; wikipedia-2026-us-intervention-in-venezuela',
  confidence: 'a major, multiply-confirmed real event (including the US State Department\'s own page); post-March-2026 developments not found this round',
};

const CUBA_CRISIS_2026 = {
  electricityGrid: {
    deficitMW: { value: 1700, demandMW: 3000, asOf: '2026-04' },
    dailyOutageHours: { typical: 18, someAreas: 19, worstRecordedSingleOutageHours: 29.5 },
    gridCollapses2026: [{ date: '2026-03-05' }, { date: '2026-03-16', cause: 'boiler leak at the Antonio Guiteras plant, Matanzas', durationHours: 29.49 }],
    causeNote: 'reporting ties the shortage mainly to lost Venezuelan oil supplies and US restrictions on shipments; one commentary argues domestic/structural causes are the larger underlying factor and the Venezuela/US pressure is "the straw that broke the camel\'s back"',
    cubaGovernmentPosition: 'blames the United States for the crisis',
  },
  note: 'this round found real, current, well-sourced data on the electricity crisis only -- no reliable 2025/2026 figures on crime, immigration, poverty or gas-specific shortages were found; those remain a real gap, not reported as zero or estimated here',
  source: 'wikipedia-2024-2026-cuba-blackouts; cnn; aljazeera; npr; forbes; abcnews',
  confidence: 'well-sourced-on-electricity-only',
};

const COLOMBIA_CRIME_2026 = {
  homicideRate2025: {
    perHundredThousand: { value: 25.8, source: 'statista-and-defence-ministry-first-count' },
    openDataCount: { value: 14038, note: 'the Defence Ministry\'s own later open-data count, higher than its first figure' },
    ombudsmanRate: { value: 23.08, note: 'a third real source, not reconciled with the two above' },
  },
  homicideTrend2026: {
    dailyAverage: { value: 38, period: 'Jan-Sep 2026', change: '-0.3% vs same period 2025, per police data' },
    defenceMinistryOpenData: { change: '+2% Jan-Aug 2026 vs 9,256 in the same period 2025', q1Change: '+4%' },
    bogotaChange: '-8% cumulative',
  },
  kidnappings2026: { changeVs2025: '-40%', changeVs2024: '+64%' },
  armedGroups: {
    eln: { members: 6300, year: 2025, confidence: 'official-estimate' },
    gulfClan: { members: 9000 },
    catatumboClashes: { context: 'ELN vs FARC dissidents', deaths: { value: 80, asOf: 'late January 2025', minimum: true } },
  },
  newPresident: {
    name: 'Abelardo de la Espriella', tookOffice: '2026-08-07',
    note: 'reportedly ended ELN peace talks in September 2026 -- the ELN peace-talks claim remains single-source; the name and 7 Aug 2026 transition date are now corroborated by a second source (reporting on Petro\'s post-presidency party role)',
  },
  massacres2026: { value: 48, asOf: '2026-04-30', note: 'a single-outlet (Rio Times) claim describing the worst pace in decades; not independently confirmed' },
  politicalParties: {
    outgoingRulingMovement: {
      name: 'Pacto Historico', former_president: 'Gustavo Petro',
      note: 'Petro accepted leading Pacto Historico after his term ends (20 Jul 2026 announcement); the coalition became Congress\'s largest single force for 2026-2030 (4M+ Senate votes, ~25 projected seats per early counting) and is converting itself from a coalition into one unified left-wing party; the former FARC party Comunes chose not to join, to keep its own legal status',
    },
    incomingPresident: { name: 'Abelardo de la Espriella', tookOffice: '2026-08-07' },
    source: 'lafm; elpais-colombia; bluradio; noticiascaracol; globalsecurity',
    confidence: 'real-and-corroborated-across-multiple-spanish-language-outlets-not-checked-against-registraduria-directly',
  },
  source: 'statista; defence-ministry-colombia; wikipedia-crime-in-colombia; riotimesonline; thecitypaperbogota',
  confidence: 'real-sources-disagree-on-exact-2025-2026-homicide-direction-kept-separate-not-reconciled',
};

const DOMINICAN_REPUBLIC_2026 = {
  haitianMigrationEnforcement: {
    deportationsQ1_2026: { value: 68000, note: 'repatriated mainly from the Dominican Republic, the US and the Bahamas, per GARR (Haitian advocacy group)', drFromThatTotalInMarchAlone: 21000 },
    deportationsMay2025: { value: 34190, note: 'the DGM\'s (Dominican migration agency) own highest monthly figure that year' },
    borderDetentions: { value: 12556, period: '21 Sep - 17 Oct 2026 (26 days)', source: 'dominican-army', note: 'a separate count from the migration agency\'s own totals; may overlap' },
  },
  crimeNote: 'the only foreign-victim data Dominican police publish concerns Haitian migrants in border provinces; nationally, 53% of homicides (506 of 951) are from brawls/quarrels and 22% are crime-related, with no perpetrator-nationality breakdown found; no source found this round ties Haitian migration to a higher crime rate',
  traffickingNote: 'Haitian migrants are among the groups vulnerable to trafficking; the US TIP report cited here says the government has not convicted any trafficking offenders, including possibly complicit officials, since 2007',
  source: 'haitiantimes; migracion-gob-do; riotimesonline; wikipedia-human-trafficking-in-the-dominican-republic',
  confidence: 'enforcement-figures-are-official-crime-breakdown-by-nationality-not-found',
};

const CANADA_MIGRATION_OVERVIEW_2026 = {
  permanentResidents: {
    target2026: 380000, reached: { value: 216600, asOf: '2026-08-31', sharePctOfTarget: 57 },
    q1_2026: { value: 83149, change: '-20.2% vs Q1 2025' },
    shareAlreadyInCanadaAsStudentOrWorker: { year2025Pct: 48, janToAug2026Pct: 58 },
  },
  temporaryResidents: {
    changeToJuly2026: { value: -154614, period: '12 months to 2026-07-01', note: 'the largest annual drop since comparable records began in 1971/72' },
    populationGrowthRate: { value: 0.5, priorYear: 1.1, unit: 'percent' },
  },
  asylum: {
    stockRecord: { value: 500000, asOf: '2025-10-01', note: 'just over 500,000 asylum claimants/protected persons and related group, per the Parliamentary Budget Officer -- a record' },
    claims2026Trend: { change: '-68% Jan-Aug 2026 vs same period 2024', confidence: 'secondary-commentary-not-confirmed-against-official-ircc-figure' },
  },
  source: 'statistics-canada-the-daily; oecd-international-migration-outlook-2025; parliamentary-budget-officer; ircc',
  confidence: 'mixed-official-statcan-and-secondary-figures-some-provisional',
};

const AFRICA_MIGRATION_OVERVIEW_2026 = {
  // Explicit scope statement, not a silent partial survey: Africa has
  // 54 countries. This covers the handful of real, current, large-
  // scale displacement crises found this round -- not crime, tribes,
  // scamming, food, development or road status for the continent,
  // and not every country. That fuller survey is real future work,
  // not something to fake as complete here.
  scopeNote: 'covers the largest current real displacement crises found this round (Sudan, DRC, the Sahel five, South Sudan, plus a regional total) -- NOT a 54-country survey, and not crime/tribes/scamming/food/development/roads, which remain a real, undone gap',
  sudan: {
    forciblyDisplacedTotal: { value: 14400000, note: 'the largest forcibly-displaced population of any country, per one source' },
    idps: { value: 10100000, alternateFigure: { value: 9100000, note: 'a second real source gives a lower, differently-dated figure; both kept' } },
    refugees: { value: 2800000, asOf: 'start of 2026' },
    returnees: { value: 4441570, asOf: '2026-05', note: 'cross-border returns to Sudan are rising even as the crisis continues' },
  },
  democraticRepublicOfCongo: { displaced: { value: 5200000, year: 2025, note: 'the second-highest IDP total on the continent' } },
  sahelFive: {
    countries: ['Burkina Faso', 'Mali', 'Niger', 'Chad', 'Mauritania'],
    idps: { value: 3302921, asOf: 'early October 2026', source: 'unhcr' },
  },
  southSudan: {
    refugees: { startOf2025: 2980000, startOf2026: 2380000, note: 'the drop is attributed mainly to the Sudan conflict driving returns home' },
  },
  easternSouthernAfricaRegionalTotal: { forciblyDisplaced: 25100000, asOf: '2025-09', source: 'unhcr' },
  source: 'icmpd-pan-africa-migration-outlook-2026; unhcr; statista; africacenter; mixedmigration-org; wikipedia-sudanese-refugee-crisis',
  confidence: 'real-sources-disagree-on-exact-sudan-idp-count-and-dates-kept-separate',
};

// Yemen: no "yemeni" ancestryPacks.GROUPS key exists, the same
// structural gap as Iran/Spain/Venezuela/Cuba/Colombia/the Dominican
// Republic above -- standalone, not a COUNTRIES entry.
const YEMEN_CONFLICT_2026 = {
  summary: 'the Houthi campaign escalated in 2026 from attacks on shipping into a wider war with Saudi Arabia',
  escalation: {
    saudiTankerStrike: { date: '2026-08-24', ship: 'the Amzan, off Yanbu', note: 'Bahri (the operator) said all crew were safe' },
    israeliLinkedShipBan: { date: '2026-06', scope: 'a total ban declared on Israeli-linked ships' },
    saudiNavalBlockadeDeclared: { date: '2026-07' },
    portSeizure: { port: 'Mocha', note: 'reports say the Houthis seized this Red Sea port city, which could threaten the Bab el-Mandeb strait' },
  },
  fatalitiesAtSea: { note: 'one report says four crew were reportedly killed in an attack on a small cargo ship in Bab el-Mandeb; the Houthis have not claimed the attack and it was unconfirmed at the time' },
  shippingImpact: { note: 'ship traffic through Bab el-Mandeb reportedly fell after the attacks on Saudi installations' },
  policyResponse: { event: 'the European Parliament called for an EU terrorist designation of the Houthis', date: '2026-10-23' },
  note: 'no clear picture found this round of whether any ceasefire or de-escalation talks are underway; some referenced items (a Saudi Red Sea defence alliance, a ceasefire-era pullback) could not be fully confirmed',
  politicalParties: {
    houthiMovement: { officialName: 'Ansar Allah ("Supporters/Defenders of God")', note: 'described across real sources as having both a political structure and an armed wing; controls northern Yemen including Sanaa; no separately-named political body beyond Ansar Allah itself was confirmed this round' },
    opposingSide: { name: 'the internationally recognized Yemeni government (Presidential Leadership Council)', note: 'backed by the Saudi-led coalition this entry\'s own escalation above is fighting' },
    source: 'britannica-houthi-movement; greydynamics; carnegieendowment',
    confidence: 'official-name-confirmed-governing-structure-less-precisely-documented',
  },
  source: 'aljazeera; cfr-global-conflict-tracker; marinelink; europawire',
  confidence: 'press-sourced-dates-inconsistent-across-outlets-fast-moving',
};

// ---------------------------------------------------------------------
// Caribbean deep dive: Puerto Rico, Cape Verde, the Virgin Islands,
// and a region-wide cruise-tourism figure -- none of these four are
// COUNTRIES entries (no matching ancestryPacks.GROUPS key for any of
// them; Haiti, the Dominican Republic and Jamaica, which DO have
// real coverage, are the haitian COUNTRIES entry above, the
// DOMINICAN_REPUBLIC_2026 constant above, and the existing jamaican
// COUNTRIES entry respectively -- not repeated here).
// ---------------------------------------------------------------------
// Explicit scope statement: "all the Caribbean islands" was asked for.
// There are roughly 13 sovereign Caribbean states plus several more
// territories. This covers the four named directly (Puerto Rico, Cape
// Verde, US/British Virgin Islands) plus the three already covered
// elsewhere in this module, and a region-wide cruise figure -- not
// every island, stated here rather than discovered by its absence.

const PUERTO_RICO_2026 = {
  population: { value: 3184835, asOf: '2025-07-01', source: 'us-census-bureau-and-puerto-rico-statistics-institute-agree', note: 'down about 18,000 from 2024; about 17% below the 2004 peak; other secondary sources give figures from 3.19M to 3.22M' },
  naturalChange: { births: 17950, deaths: 32857, period: '2024-2025', netMigration: -2779, note: 'deaths have outnumbered births every year since 2016; births fell about 70% between 2000 and 2025' },
  economy: { unemploymentRate2026Pct: 6.8, medianIncome2024Usd: 17192, gdpGrowth2026Pct: -0.1, gdpGrowth2027ForecastPct: 1.0, note: 'the Planning Board\'s September 2026 assessment expects only modest growth, driven substantially by reconstruction, tourism, and operations relocating to the island' },
  note: 'no 2025/2026 crime statistics found this round -- a real gap, not filled with an invented figure',
  source: 'us-census-bureau; estadisticas-pr-gov; pewresearch; puerto-rico-planning-board',
  confidence: 'official-population-and-economic-data-crime-not-found',
};

const CAPE_VERDE_2026 = {
  population: { worldometerEstimate: { value2025: 527326, value2026Mid: 529630 }, alternateEstimates: { range: [598000, 611000], note: 'Countrymeters and Open Factbook report figures far higher than Worldometer/UN-based sources; not reconciled here' } },
  demographics: { medianAge: 29.5, urbanSharePct: 79.6, fertilityRate2025: 1.5, year: 2026 },
  migration: { netMigration2025: -1284, decadeNetLoss: 33510, decadeNaturalGrowth: 47312, diaspora: { portugal: 260000, netherlands: { value: 23150, year: 2022 } } },
  economy: { gdpUsdBillion2025: 2.79, gdpGrowthPct2025: 5.0, gdpGrowthForecastPct2026: 4.9, incomeLevel: 'upper-middle-income', unemploymentPct2025: 11.9, youthUnemploymentPct2025: 28.4 },
  note: 'population figures come from aggregator sites and Wikipedia, not confirmed against Cabo Verde\'s own national statistics institute (INE) directly',
  source: 'worldometer; georank; wikipedia-demographics-and-economy-of-cape-verde; statisticstimes',
  confidence: 'secondary-aggregator-sourced-wide-disagreement-on-population',
};

const VIRGIN_ISLANDS_2026 = {
  britishVirginIslands: {
    population: { value: 39993, alternateValue: 39936, year: 2026, note: 'two secondary sources differ slightly' },
    tourism: { arrivalsChangeJanFeb2026: '+20% vs the same period in 2025', note: 'critics say the tourism recovery is driven largely by cruise passengers and short-term visitors rather than higher-spending overnight guests' },
  },
  usVirginIslands: {
    population: { value: 83372, year: 2026, confidence: 'thinly-sourced-secondary-site' },
    tourism: {
      q1_2026Arrivals: { value: 303388, change: '+12% YoY, +6% vs 2024' },
      stThomasArrivals: { value: 246772, change: '+15% YoY' },
      stCroixArrivals: { value: 56616 },
      stayOverVisitorsQ1_2026: 110832,
      note: 'tourism officials credit continued US traveler demand plus new NFL/MLB sports partnerships and media/Carnival promotion',
    },
  },
  combinedContext: { note: 'a travel-industry estimate puts combined visitors at nearly 3 million across both territories in 2025, mostly from cruise ships -- promotional-source figure, treated as rough' },
  source: 'travelpulse; travelagewest; bvinews; worldpopulationreview; geofactbook',
  confidence: 'mixed-official-tourism-boards-and-thinly-sourced-population-aggregators',
};

const CARIBBEAN_CRUISE_TOURISM_2026 = {
  regionTotal2025: { passengers: 16270000, change: '+8.4% vs 15.01M in 2024', sharePctOfGlobalCruisePassengers: 44, scope: 'Caribbean, Bahamas and Bermuda combined, per CLIA' },
  globalContext2025: { passengers: 37200000, change: '+7.5% vs 2024', note: 'the Caribbean is the top destination for American cruisers, capturing 72% of all US passenger journeys' },
  outlook2026: { usPassengersForecast: 21700000, change: '+4.5% vs 2025', note: 'would be the fourth straight year of growth, per AAA/Travel Economics' },
  portLevelFigures: [
    { port: 'Nassau, Bahamas', event: 'a record single day', date: '2026-06-08', passengers: 33254, ships: 6 },
    { port: 'Antigua', year2021: { passengers: 81395, calls: 124 }, year2025: { passengers: 808345, calls: 436 } },
  ],
  conflictingSource: { note: 'one secondary source (Hope Research Group) gives a much higher 31.4M Caribbean passenger-visit figure for 2024 with Cozumel leading at 4.6M -- it conflicts with CLIA/Statista and is treated as unverified, not reconciled' },
  source: 'cruising-org-clia-state-of-the-cruise-industry-2026; statista; seatrade-cruise; brookesbell',
  confidence: 'clia-and-statista-figures-are-the-more-consistent-pair-one-secondary-source-conflicts',
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

// ---------------------------------------------------------------------
// Regional fallback -- "if it doesn't fit specifically, pinpoint it
// somewhere that relates to it," built honestly rather than by
// inventing country-specific facts for every real country on Earth
// ---------------------------------------------------------------------
// There are ~195 real countries and this module has a dedicated,
// cited entry for a few dozen. Faking the rest with invented numbers
// would be exactly the mistake this whole module's discipline exists
// to avoid. What CAN be done honestly: classify every key this module
// knows about into its real region, and if no dedicated entry exists,
// fall back to that region's own real, already-built overview
// (`EU_MIGRATION_OVERVIEW_2025`, `AFRICA_MIGRATION_OVERVIEW_2026`,
// `CARIBBEAN_CRUISE_TOURISM_2026`) instead of returning nothing.
//
// This is a real UN-geoscheme-style classification, not a stats table
// -- it says WHERE a country is, so the lookup has somewhere to land.
// `null` here is itself honest: `arab` spans many real countries and
// is deliberately not forced into one region; `american`/`other` are
// not countries at all.
const REGION_BY_KEY = {
  // Europe -- every European ancestryPacks.GROUPS key
  german: 'europe', irish: 'europe', english: 'europe', italian: 'europe', polish: 'europe',
  french: 'europe', scottish: 'europe', dutch: 'europe', norwegian: 'europe', swedish: 'europe',
  russian: 'europe', ukrainian: 'europe', greek: 'europe', portuguese: 'europe', hungarian: 'europe',
  czech: 'europe', swiss: 'europe', welsh: 'europe', lithuanian: 'europe', bosnian: 'europe',
  // Middle East
  israeli: 'middle-east', yemen: 'middle-east',
  // Africa
  somali: 'africa', nigerian: 'africa', ethiopian: 'africa', ghanaian: 'africa', kenyan: 'africa',
  'subsaharan-african': 'africa', 'cape-verde': 'africa',
  // Caribbean
  'west-indian': 'caribbean', jamaican: 'caribbean', haitian: 'caribbean', 'dominican-republic': 'caribbean',
  cuba: 'caribbean', 'puerto-rico': 'caribbean', 'virgin-islands': 'caribbean',
  // Asia
  vietnamese: 'asia', chinese: 'asia', filipino: 'asia', 'asian-indian': 'asia',
  // Latin America (Central/South America, excluding the Caribbean above)
  mexican: 'latin-america', guatemalan: 'latin-america', honduran: 'latin-america', salvadoran: 'latin-america',
  venezuela: 'latin-america', colombia: 'latin-america',
  // North America -- the explicit baseline; no "North America overview"
  // exists because the baseline itself is the dedicated entry.
  'united-states': 'north-america', canada: 'north-america',
};

// Only regions with a REAL, already-built multi-country overview get
// an entry here. A region with no overview stays absent on purpose --
// `regionalContextFor` reports that honestly rather than inventing one
// just to fill the slot.
const REGION_OVERVIEWS = {
  europe: EU_MIGRATION_OVERVIEW_2025,
  africa: AFRICA_MIGRATION_OVERVIEW_2026,
  caribbean: CARIBBEAN_CRUISE_TOURISM_2026,
};

// Standalone real references this module built outside `COUNTRIES`
// (no matching `ancestryPacks.GROUPS` key for any of them -- see this
// module's own header). Keyed the same way `REGION_BY_KEY` names them.
const STANDALONE_REFERENCES = {
  venezuela: VENEZUELA_SITUATION_2026,
  cuba: CUBA_CRISIS_2026,
  colombia: COLOMBIA_CRIME_2026,
  'dominican-republic': DOMINICAN_REPUBLIC_2026,
  canada: CANADA_MIGRATION_OVERVIEW_2026,
  yemen: YEMEN_CONFLICT_2026,
  'puerto-rico': PUERTO_RICO_2026,
  'cape-verde': CAPE_VERDE_2026,
  'virgin-islands': VIRGIN_ISLANDS_2026,
};

// The real fallback chain, in order: a dedicated `COUNTRIES` entry, a
// dedicated standalone reference, then the region's own overview --
// and if none of those three exist, an honest, named gap rather than
// a silent null or an invented number.
function regionalContextFor(key) {
  const dedicatedEntry = countryFor(key);
  const standaloneEntry = STANDALONE_REFERENCES[key] ?? null;
  const region = REGION_BY_KEY[key] ?? null;
  const regionalOverview = region ? (REGION_OVERVIEWS[region] ?? null) : null;

  let coverageNote;
  if (dedicatedEntry) coverageNote = 'a dedicated, country-specific COUNTRIES entry exists';
  else if (standaloneEntry) coverageNote = 'a dedicated, country-specific standalone reference exists (no ancestryPacks.GROUPS key for it yet)';
  else if (regionalOverview) coverageNote = `no dedicated entry for this key; falling back to its region's (${region}) real overview`;
  else if (region) coverageNote = `region (${region}) is known, but no regional overview has been built for it yet`;
  else coverageNote = 'no region classification exists for this key -- a real, undone gap, not a silent zero';

  return { key, dedicatedEntry, standaloneEntry, region, regionalOverview, coverageNote };
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
  EU_MIGRATION_OVERVIEW_2025,
  VENEZUELA_SITUATION_2026,
  CUBA_CRISIS_2026,
  COLOMBIA_CRIME_2026,
  DOMINICAN_REPUBLIC_2026,
  CANADA_MIGRATION_OVERVIEW_2026,
  AFRICA_MIGRATION_OVERVIEW_2026,
  YEMEN_CONFLICT_2026,
  PUERTO_RICO_2026,
  CAPE_VERDE_2026,
  VIRGIN_ISLANDS_2026,
  CARIBBEAN_CRUISE_TOURISM_2026,
  REGION_BY_KEY,
  REGION_OVERVIEWS,
  STANDALONE_REFERENCES,
  countryFor,
  describeCountry,
  regionalContextFor,
};
