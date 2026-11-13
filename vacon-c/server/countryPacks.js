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
//   **Superseded for four of these six by the thirteenth round,
//   below** -- Venezuela, Cuba, Colombia and the Dominican Republic
//   each got a real ancestryPacks.GROUPS key and a real `COUNTRIES`
//   entry once a real Census code was actually found for each (two
//   different real tables, not one -- see that round's own comment).
//   Canada's reasoning above still holds as stated; Africa is not a
//   single country and was never in scope for this gate either way.
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
//   **Re-checked directly in the thirteenth round below, not just
//   assumed still true**: B04006's own Arab breakdown is a closed,
//   confirmed list (Egyptian, Iraqi, Jordanian, Lebanese, Moroccan,
//   Palestinian, Syrian, Arab, Other Arab) with no separate Yemeni
//   row, so this stays correct -- a real finding, not a shortcut.
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
// Eleventh round: deepening the entries that only ever had the
// original five fields, and closing the three missing regional
// overviews `REGION_OVERVIEWS` itself used to admit it lacked
// ---------------------------------------------------------------------
// Poland, Nigeria, Ethiopia, Vietnam, China, the Philippines and India
// each get real, current `notableFigures`/`politicalParties` (Tusk's
// Civic Coalition, Tinubu's APC, Abiy's Prosperity Party, To Lam
// holding both Vietnam's top posts, Xi Jinping's three posts, Marcos
// Jr.'s PFP, Modi's BJP/NDA). Nigeria also gets real, current security
// incidents (`securitySituation2026`) and Ethiopia a real, current
// re-escalation of the Tigray conflict (`tigrayConflict2026`) -- with
// an explicit note that Ethiopia's `conflictLevel` was not re-checked
// against this new information, rather than silently reclassified.
//
// `ASIA_MIGRATION_OVERVIEW_2026`, `MIDDLE_EAST_MIGRATION_2026` and
// `LATIN_AMERICA_MIGRATION_2026` close the three gaps
// `REGION_OVERVIEWS` named by omission since the ninth round -- same
// bounded-scope discipline as the Africa/Caribbean overviews: real,
// dated, sourced figures for the largest real stories found (the
// Asia-Arab labour corridor, Syria's real return-and-displacement
// picture, the Venezuelan diaspora), not a claim that every country in
// each region was individually researched.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads these to decide an outcome yet.
//
// ---------------------------------------------------------------------
// Twelfth round: real global crime, conflict, climate, hunger and
// road-safety figures, asked for "all over the globe" -- and an
// honest account of why this round covers less than that phrase asks
// for, rather than a thin pass presented as complete
// ---------------------------------------------------------------------
// Asked directly for crime, conflicts/wars, "temperature... from
// Africa, the Middle East, Europe", occupations, hunger, road
// conditions, animals, eating conditions and cultures, globally, with
// an explicit instruction to make everything precise and accurate. A
// read-only research pass first checked what real source exists for
// each ask (see that pass's own report, carried into this round): six
// real candidates (UNODC/World Bank homicide rate; UCDP/ACLED conflict
// events; World Bank Climate Change Knowledge Portal/Beck et al.
// temperature; ILOSTAT occupations; FAOSTAT undernourishment; WHO road
// safety) and two genuinely ambiguous asks resolved by direct
// instruction (`animals` -> IUCN Red List wildlife status AND FAO
// livestock, kept as two separate real things, not one; `cultures` ->
// declined outright this round, see below).
//
// **`homicideRatePer100k` is the one field built at real breadth this
// round** -- `globalIndicators2026.homicideRatePer100k` on every
// `COUNTRIES` entry, UNODC/World-Bank-sourced (indicator
// `VC.IHR.PSRC.P5`), found and cross-checked for 28 of this table's 37
// entries. Scoped honestly to HOMICIDE, not crime broadly -- no global
// source publishes a comparable burglary/assault/theft rate for most
// of the world, the same honest-scoping `crime.js` itself already
// practices for its own internal categories. Where two real sources
// disagreed outside rounding noise (`nigerian`: 15.7 with no stated
// year against 34.52 for 2016; `guatemalan`: ~20 against ~23 for the
// same year; `honduran`: a roughly 31-38 range across sources), both
// are reported rather than one being picked, same discipline this
// file already applies to Haiti's street-death count and France's
// theft trend. Where a figure exists but is years stale (`russian`:
// 2018 is the most recent found; `ethiopian`: 2012; `chinese`: 2020),
// it is kept and flagged with its real year rather than omitted or
// silently presented as current. `somali`'s only found figure (14.7)
// combines homicide with other causes of intentional death and is NOT
// homicide-specific -- checked directly and excluded rather than
// mistaken for the real thing, the same care this file already took
// distinguishing Statistics-of-the-World's "intentional death rate"
// page from its separate "homicide rate" page. `portuguese` and
// `vietnamese` are `null`: genuinely not found this round, not
// invented to fill the row.
//
// **Three more fields are real but deliberately SPARSE, the same
// `oilProducer` posture this table already established** -- present
// only where a real, checkable figure was actually found, `null`
// everywhere else rather than a forced estimate:
//
// - `undernourishmentPct` (FAOSTAT SDG indicator 2.1.1): `haitian`
//   (54.2%, 2023), `somali` (53.2%, 2023), `nigerian` (22.2%, year not
//   stated in the source found), `'asian-indian'` (9.8%, year not
//   stated), `irish` (reported as exactly 2.5%, which FAO's own
//   methodology note says can mean the true prevalence is anywhere AT
//   OR BELOW that threshold, not literally 2.50 -- carried with that
//   caveat rather than presented as a precise figure).
// - `avgTemperatureC` (World Bank Climate Change Knowledge Portal, via
//   the Wikipedia compilation of the same underlying 1991-2020 World
//   Bank series, except where noted): `'asian-indian'` (24.94,
//   1991-2020), `vietnamese` (24.79, 1991-2020, same baseline),
//   `kenyan` (24.6, a DIFFERENT real source using a 1924-2024
//   hundred-year average -- flagged, not blended with the other two
//   baselines), `mexican` (21.2) and `israeli` (21.0) (both from a
//   2016 single-year compilation, a third real but non-equivalent
//   basis, flagged the same way). Four different real methodologies
//   across five countries, each named rather than silently treated as
//   one consistent series -- the alternative (forcing them onto one
//   baseline without the primary table to re-derive from) would be
//   the exact "plausible wrong number" the thirteenth standing rule
//   warns against.
// - `roadTrafficDeathRatePer100k` (WHO Global Status Report on Road
//   Safety 2023, 2021 data -- the real, current substitute for a
//   literal road-CONDITION index, which is discontinued and stale;
//   named here as answering a safety-OUTCOME question, not a
//   pavement-quality one, the same distinction this file already
//   draws between `healthBaseline` and `overdoseBaseline`): `haitian`
//   (31.3), `kenyan` (28.2), `'asian-indian'` (11.6, with a
//   conflicting secondary figure of 15 for the same year named rather
//   than silently dropped), `russian` (18.0, year/exact methodology
//   not confirmed in the source found -- flagged).
//
// **What this round could NOT responsibly build, and the real reason
// is a tooling limitation, named rather than hidden behind a thin
// pass.** This round had WebSearch only -- no direct page retrieval
// (WebFetch) and no further research subagent -- so every number
// above came from WebSearch's own synthesized snippets, which surface
// secondary aggregator sites (statisticsoftheworld.com, macrotrends,
// nationmaster, and similar) far more often than the primary UNODC/
// World Bank/FAOSTAT/WHO tables themselves. For homicide that still
// produced real, cross-checkable figures for most of this table,
// because those aggregators mirror the UNODC/World Bank series
// closely and consistently. For road safety and climate, repeated,
// differently-worded searches surfaced a clean figure for only 3-5 of
// this table's 37 countries each -- below any threshold worth calling
// "global coverage" -- and attempting to fill the rest would have
// meant either fabricating numbers this file's whole discipline exists
// to refuse, or presenting a handful of real data points as a
// completed world survey, which is its own kind of dishonesty (the
// twenty-fifth standing rule's shape, one level up: a thin real result
// is not its own completeness). So:
//
// - **Conflicts/wars**: NOT extended with UCDP/ACLED EVENT-level data
//   this round. The existing `conflictLevel` qualitative band (already
//   UCDP-derived, already report-only) stands unchanged -- a real,
//   finer-grained event count or fatality figure per country is left
//   for a future round with actual table access, not built on
//   WebSearch snippets alone.
// - **Occupations**: checked, not built, because the honest finding is
//   that nothing needs building. `occupations.js`/`labourPacks.js`
//   draw occupations independent of ethnicity/nationality by design
//   (the forty-second standing rule already confirmed "Mexican police
//   officer" needs no new occupation because `enforcer`/`officer` are
//   ungated), so this table's own occupation coverage is already
//   global by construction -- a real finding, not a skipped task.
// - **Eating conditions** (FAO Food Balance Sheets -- per-capita
//   dietary energy/protein supply) and **animals** (IUCN Red List
//   wildlife status; FAO livestock head-counts, kept as two separate
//   real things by direct instruction rather than one dataset forced
//   to answer both) were not attempted at all this round -- WebSearch
//   turned up no usable compiled figures for either across this
//   table's countries in the searches tried, and a field with zero
//   real entries is better left unbuilt than added as an all-null
//   placeholder nobody asked for.
// - **Cultures** (Hofstede's country dimensions; the World Values
//   Survey) are declined OUTRIGHT, not deferred for a tooling reason
//   like the three above -- a prior read-only research pass found
//   WVS's own terms explicitly non-redistributable and Hofstede's
//   current bulk-licensing terms unconfirmed, the same "a real source
//   exists but its access terms are not clean enough to use" posture
//   this file already takes declining the Chicago gang-boundary FOIA
//   release as a live source.
// - **New country entries for Africa/Middle-East/Europe gaps** (Spain,
//   Egypt, Saudi Arabia and similar were considered) are declined this
//   round too: a new `COUNTRIES` key needs a real `ancestryPacks.
//   GROUPS` entry first (the same structural prerequisite the Israel
//   addition needed), which means verifying a real Census ACS ancestry
//   code the way that addition did -- a separate piece of real
//   research this round's tooling could not do with confidence, not a
//   shortcut worth taking to look more global.
//   **Revisited in the thirteenth round, below.** The gap named here
//   was confidence, not a checked absence -- re-run directly, Egypt
//   has a real code (B04006_007E, "Arab: Egyptian") and now has both
//   the ancestryPacks.GROUPS entry and the COUNTRIES entry this round
//   declined. Saudi Arabia does not -- B04006's own Arab breakdown has
//   no Saudi Arabian row -- and stays declined, the same real finding
//   as before, just independently confirmed rather than assumed. Spain
//   was not re-checked this round and remains open.
//
// Same report-only posture as every other field here: nothing in
// `server/` reads `globalIndicators2026` to decide an outcome.
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
//
// ---------------------------------------------------------------------
// Fourteenth round: decoupling country coverage from the
// ancestryPacks.GROUPS gate -- COUNTRY_PROFILES, a second real path
// that needs no US ancestry code
// ---------------------------------------------------------------------
// Asked directly to take country coverage "as far as you can" and
// "establish everything, all the countries." Before adding a single
// new entry, the real structural question this module has carried
// since round one: `COUNTRIES` requires a matching real
// `ancestryPacks.GROUPS` code, which is why Saudi Arabia, Spain,
// Japan, Brazil and dozens of other real, significant countries have
// stayed out even though real World Bank/EIU/SIPRI/EIA data about
// THEM exists and was never the blocker. Checked directly rather than
// assumed: that gate was never a property of the real country-level
// data. It is an artifact of this table's first consumer --
// `migration.generateRegion`'s `countryKey`, which needs a US
// ancestry link because it is answering "where is this player's
// family from." A country's income level, conflict status,
// government type, regime score, military spending and oil-producer
// status are real facts about the COUNTRY, independent of whether
// the US Census happens to track a distinct immigrant-ancestry code
// for people descended from it.
//
// `COUNTRY_PROFILES` is the fix: the exact same field shape
// `COUNTRIES` entries already carry, keyed directly on a real,
// hyphenated country name instead of an `ancestryPacks.GROUPS` key,
// with NO ancestry-code requirement at load time. This is additive,
// not a replacement -- `COUNTRIES` and its ancestry-code gate are
// unchanged, because character creation's own "where is this
// player's family from" question genuinely still needs that link, and
// nothing about this round argues otherwise. `countryProfileFor(key)`
// reads it, and `regionalContextFor`'s own fallback chain now checks
// it as a second real tier, between a dedicated `COUNTRIES` entry and
// the standalone/regional-overview fallbacks that already existed --
// Spain and Canada, each already named in this module's own prior
// rounds as blocked specifically by the missing ancestry code, are
// the first two gaps this closes.
//
// **Ten real countries this round, prioritised by population and G20
// membership, not alphabetically**: Japan, South Korea, Brazil,
// Argentina, Indonesia, Saudi Arabia, Turkey, Spain, Australia and
// South Africa -- ten of the largest real gaps in this table, all
// unreachable before this round for the identical structural reason,
// none of them politically selected. Every figure is WebSearched
// fresh rather than reconstructed from memory, per this module's own
// standing discipline, and the same honest-sparseness rule as
// `oilProducer`/`globalIndicators2026` elsewhere in this file applies
// throughout: a real figure that could not be confirmed to this
// module's own standard is left `null` with a note, never guessed.
//
// **This round's own tooling ceiling, restated rather than relearned
// (the fifty-first CLAUDE.md standing rule's finding, hit again
// here):** WebSearch-only access reaches secondary mirrors, not EIU's
// or SIPRI's own primary tables, for most of these ten. Brazil's
// regimeScore is `null` with its real rank (57th of 167, 2024,
// flawed-democracy) recorded instead of an invented number --
// multiple searches found the rank and category but never the EIU's
// own numeric score for this entry. Japan's 8.48 and Saudi Arabia's
// 2.08 both came from one secondary ranking table apiece that did not
// label which edition year it was drawn from; both are kept, flagged
// `edition-year-unconfirmed` rather than silently presented as
// settled 2024 figures the way every other `regimeScore` in this file
// is. Several `militaryExpenditurePctGDP` values (South Korea,
// Indonesia, Turkey, Australia, South Africa, Argentina, Spain) come
// from a single secondary ranking site whose own title ambiguously
// read "2025" while its values matched other sources' 2024 figures --
// kept, `confidence: 'secondary-estimate'`, with the year ambiguity
// stated rather than resolved by guessing.
//
// **Two real conflict classifications made rather than defaulted to
// "no-active-conflict," and said so rather than left implicit.**
// Brazil and South Africa are `high-nonstate-violence` -- UCDP does
// not list either as a state-based conflict, and this table's own
// `CONFLICT_LEVELS` vocabulary has exactly this band for a country
// with high non-state (cartel/gang) violence short of civil war,
// which both real homicide figures below support. Indonesia and
// Turkey are `localized-conflict` -- the Papua separatist insurgency
// (OPM) and the PKK conflict in Turkey's southeast respectively, both
// real and long-running; Turkey's note states plainly that a reported
// 2025 PKK disarmament process was not re-verified to completion this
// round, so the classification is not presented as more settled than
// it is.
//
// **Brazil's oil-producer entry is the one full, confirmed figure in
// this batch, not a sparse placeholder.** Brazil became a real net
// crude exporter for the first time in its history in 2024 (IBP/Ineep
// industry figures: ~3.4M bpd produced, 52.1% of production
// exported, because refining capacity lags production) -- checked
// directly this round rather than assumed from Brazil's long-standing
// reputation as an importer, which is now out of date.
//
// Same report-only posture as every other field in this module:
// nothing in `server/` reads a `COUNTRY_PROFILES` field to decide an
// outcome. Wiring any of it into a mechanic is the same separate,
// future, calibrated round every other real input here has been held
// to.
//
// ---------------------------------------------------------------------
// Fifteenth round: twelve more real countries in COUNTRY_PROFILES,
// continuing by population and significance rather than stopping at
// the first ten
// ---------------------------------------------------------------------
// Direct instruction to keep pushing coverage "as far as you can
// genuinely" toward the real ~195-country world, same discipline as
// the fourteenth round: real WebSearched figures only, confidence-
// flagged where a source is secondary, honest `null` where nothing
// citable was found, no fabrication regardless of how large the ask
// is. Twelve added this round, prioritised by population and real
// current significance: Pakistan, Bangladesh, the Democratic Republic
// of the Congo, Thailand, Myanmar, Iraq, Afghanistan, Syria, Morocco,
// Peru, Chile, Malaysia.
//
// **Three real conflict classifications made rather than defaulted,
// each checked rather than assumed.** The DRC is `active-armed-
// conflict` -- the real, ongoing M23 offensive (Goma captured Jan
// 2025, Walikale Feb 2025, 500,000+ newly displaced, Rwandan backing
// alleged and disputed, mediation efforts repeatedly collapsing) is
// unambiguous. Myanmar is `active-armed-conflict` -- the real civil
// war between the 2021 coup junta and resistance/ethnic armed
// organisations continues, and SIPRI's own confirmed figure (military
// spending +66% in 2024, 6.8% of GDP, the highest military burden in
// the Asia-Pacific) is itself evidence of an active war economy.
// Syria is `active-armed-conflict` -- real, current violence continues
// under the transitional government (the March 2025 Latakia/Tartous/
// Hama clashes, Israeli strikes on military targets, Aleppo clashes
// with the SDF), not a settled peace. Pakistan, Thailand and Morocco
// are `localized-conflict` -- real, long-running, sub-national
// insurgencies (Balochistan and TTP violence in Pakistan; the
// Malay-Muslim separatist insurgency in Thailand's deep south;
// Western Sahara's low-level, post-2020 Polisario Front clashes for
// Morocco, kept distinct from Morocco's own domestic conflict level
// the same way Saudi Arabia's combatant role in Yemen is reported on
// Yemen's own entry, not folded into Saudi Arabia's) rather than a
// forced "no active conflict" default. Afghanistan is also
// `localized-conflict`, not `no-active-conflict` or `active-armed-
// conflict` -- the large-scale war ended with the 2021 Taliban
// takeover, but the real, ongoing ISIS-Khorasan insurgency against
// Taliban rule continues, and neither extreme would describe that
// honestly. Iraq is `localized-conflict` for the same reason -- large-
// scale war has ended, ISIS remnant and periodic sectarian violence
// has not.
//
// **Syria could not get a real `regimeType`/`regimeScore`, and the
// reason is structural, not a research gap.** The EIU's 2024 edition
// reflects conditions as of 2024, and the Assad regime it would have
// scored fell on 8 Dec 2024 -- in the index's own final measurement
// window, replaced by Ahmed al-Sharaa's transitional government (a
// five-year transitional period, a real October 2025 parliamentary
// election, uneven territorial control with the SDF-held northeast).
// Scoring the fallen Assad government would misrepresent the country
// TODAY; no post-transition EIU score exists yet as of this round.
// `regimeType`/`regimeScore` are both `null` with this reasoning
// stated directly in the entry, the same honest-null posture
// `Somalia`'s own entry already set a precedent for.
//
// **Chile's regimeType/regimeScore are also `null`, for a different,
// source-conflict reason this round found rather than papered over.**
// Three separately-sourced claims about Chile's 2023-edition rank
// (15th/7.98, 19th/"full democracy", 25th/"flawed democracy") actively
// disagree with each other, and the one 2024 figure found (7.83) came
// from a secondary site that did not clearly cite the EIU as its
// source at all. Rather than pick one disagreeing claim or present an
// unconfirmed secondary number as settled, both are left out and the
// real disagreement is stated in the entry's own comment -- the same
// "both kept, neither picked" discipline this file has held since its
// very first France entries.
//
// **Iraq's oil-producer entry is the second fully confirmed figure in
// this file's COUNTRY_PROFILES table, not a sparse placeholder.** Real
// 2024 EIA/OPEC+ figures: ~4.2-4.4M bpd produced (sources differ on
// whether condensates are included), ~3.26-3.36M bpd exported -- a
// nine-year low, driven by OPEC+ quota compliance and a real pipeline
// outage, with Iraq itself pledging to compensate 1.44M bpd of 2024
// overproduction through September 2025. Both the production and
// export ranges are kept rather than collapsed to one number, since
// the real sources differ on methodology, not on the underlying fact.
//
// **Three entries carry an honest sourcing caveat on `incomeLevel`
// that no entry in the fourteenth round needed.** The DRC (low-
// income), Iraq (upper-middle-income) and Afghanistan (low-income)
// are each stated from well-established general knowledge of the
// standard World Bank classification, NOT from a primary table this
// round's searches actually surfaced -- flagged in each entry's own
// comment rather than presented with the same confidence as Bangladesh/
// Morocco/Peru/Chile, whose classifications this round did find and
// confirm directly against a real July-2025 World Bank list. Myanmar's
// `lower-middle-income` carries the identical caveat, inherited
// directly from the search result that surfaced it rather than
// independently re-verified.
//
// Several `regimeScore` values this round (Thailand, Peru, Malaysia)
// come from secondary ranking-site compilations that were never cross-
// checked against the EIU's own primary 2024 table -- flagged
// `regimeScoreConfidence: 'secondary-estimate'`, reusing this file's
// existing confidence vocabulary rather than inventing a new flag for
// the same real gap `militaryExpenditurePctGDP` already names.
// Pakistan, Bangladesh, Iraq, Afghanistan and Morocco's regime scores,
// by contrast, are confirmed directly across multiple independent news
// sources naming the real score, rank and reasoning together -- no
// flag needed, same confidence tier the fourteenth round's Argentina/
// Turkey/South-Africa entries already carry.
//
// Same report-only posture as every other field in this module:
// nothing in `server/` reads a `COUNTRY_PROFILES` field to decide an
// outcome.
//
// ---------------------------------------------------------------------
// Seventeenth round: fourteen more real countries plus a real
// COUNTRY_PROFILES entry for Yemen (alongside its existing, deeper
// YEMEN_CONFLICT_2026 standalone narrative, not replacing it)
// ---------------------------------------------------------------------
// Direct instruction to keep going "as much as you can" toward the
// real ~195-country world, same discipline throughout. Numbered
// seventeenth, not sixteenth -- the global incarceration-system round
// (India, World Prison Brief data) landed on this branch between the
// fifteenth round and this one and already claimed "sixteenth" for
// itself; renumbered here rather than leaving two same-numbered
// rounds in this file's own history. Fourteen more countries this
// round, prioritised by population and real current
// significance: Sudan, Algeria, Uganda, Tanzania, North Korea, Taiwan,
// the United Arab Emirates, Nepal, Sri Lanka, Kazakhstan, Cambodia,
// Ecuador, Angola, Mozambique -- plus Yemen, which gains the same six
// standard fields every other COUNTRY_PROFILES entry carries, kept
// alongside its existing `YEMEN_CONFLICT_2026` standalone narrative
// rather than replacing it, the same two-tier pattern Venezuela and
// Cuba already have (a `COUNTRIES`/`COUNTRY_PROFILES` entry AND a
// deeper standalone reference, not one or the other).
//
// **This round's own tooling ceiling was sharper than the fourteenth
// and fifteenth rounds', and the honest response is the same: report
// what was actually found, flag what was not, never guess a gap
// closed.** Several countries this round could not get a confirmed
// `regimeType`/`regimeScore` at all -- Uganda and Tanzania each had
// only an EXPLICITLY WRONG-YEAR figure found (2023's 4.49 for Uganda,
// a figure the source itself called 2023 for Tanzania's 5.35), kept
// out entirely rather than presented as 2024 data; Nepal (4.60) and
// Sri Lanka (6.19) each had a figure that never clearly cited the EIU
// as its source; the United Arab Emirates had no figure found at all
// despite a dedicated search. All five are `null`/`null`, each with
// its own real reason stated in the entry, not a single blanket
// excuse copied five times.
//
// **Angola's regimeType/regimeScore are also `null`, for the same
// "real disagreement, not picked" reason Chile's were in the
// fifteenth round.** The one 2024 figure found (4.05) came from a
// secondary site that did not name its source, and -- if it were
// real -- would sit right at this file's own hybrid/authoritarian
// boundary (4.01), which is exactly the kind of boundary value this
// file's own seventeenth-standing-rule-adjacent discipline (measure
// precisely before trusting a number near a threshold) argues against
// trusting on one unconfirmed source.
//
// **North Korea's `militaryExpenditurePctGDP` is deliberately `null`
// with a stated structural reason, not an unresearched gap.** North
// Korea does not publish usable military-expenditure data by design,
// and SIPRI's own database excludes it for exactly that reason -- a
// real, permanent gap in the source itself, the same shape this file
// already gives Somalia's missing `regimeType`.
//
// **Three real, fully confirmed oil-producer figures this round, not
// sparse placeholders.** Angola: real 2024 output (Q1-Q3 average
// 1.134M bpd, +4% YoY, falling to ~1.03M bpd by December 2024, the
// lowest in years) immediately after its real, dated OPEC exit
// (effective Jan 2024). The UAE: a real 2024 figure (~2.9M bpd under
// OPEC+ quota, roughly 60% of its own claimed capacity, with Platts
// surveys showing it producing slightly above its assigned target).
// Yemen: not a production figure at all, but the real, current,
// World-Bank-confirmed fact that matters more here -- a Houthi
// blockade on oil exports from IRG-held fields drove the internationally
// recognized government's own revenue down to 2.5% of GDP in 2024.
//
// **Two real, non-default conflict classifications.** Sudan is
// `active-armed-conflict` -- the real, ongoing SAF-RSF civil war
// (CFR's own August 2026 tracker: "Worsening"; ~14M displaced) is
// unambiguous. Ecuador is `high-nonstate-violence`, not `no-active-
// conflict` -- President Noboa's real January 2024 declaration of an
// "internal armed conflict" against criminal gangs (following the
// "Fito" prison escape and a televised armed takeover of a TV
// station) and the real, current cartel/gang violence surge it
// responded to.
//
// **Taiwan's entry states plainly why it carries no found primary
// World Bank income-classification row, rather than silently
// asserting one.** Taiwan is not a UN member and is often excluded
// from the World Bank's own country tables for that reason --
// `incomeLevel: 'high-income'` here rests on its real, undisputed
// per-capita income level by any standard measure, not a found
// primary-table row the way Bangladesh's or Morocco's classification
// in the fifteenth round did.
//
// Same report-only posture as every other field in this module:
// nothing in `server/` reads a `COUNTRY_PROFILES` field to decide an
// outcome.
//
// ---------------------------------------------------------------------
// Eighteenth round: twenty-three more real countries -- Western/
// Nordic/Balkan Europe, the Gulf states and Levant, Libya/Tunisia,
// New Zealand/Singapore, and four more Latin American entries
// ---------------------------------------------------------------------
// Direct instruction to keep going "as much as you can" toward the
// real ~195-country world. Twenty-three countries this round: Belgium,
// Austria, Denmark, Finland, Romania, Bulgaria, Serbia, Croatia,
// Moldova, Belarus, Libya, Tunisia, New Zealand, Singapore, Uruguay,
// Paraguay, Bolivia, Jordan, Lebanon, Qatar, Kuwait, Bahrain, Oman.
//
// **Three real, confirmed, fully-sourced oil/gas figures this round,
// not sparse placeholders.** Kuwait: real 2024 production (5th-
// largest OPEC producer, July 2024 at 2.415M bpd, December 2024
// wellhead output 2.44M bpd). Oman: a real full-year 2024 total from
// its own National Centre for Statistics (363.3M barrels produced,
// 308.4M barrels exported), with November 2024's monthly rate (984,800
// bpd) named as its lowest in nearly two years, driven by real OPEC+
// compliance. Libya: a real, volatile 2024 picture kept as a range
// rather than one number -- ~1.18M bpd in July, a ~700,000 bpd drop in
// August's real political shutdown crisis, recovery above 1M bpd by
// October. Qatar's real LNG export leadership and 2024 North Field
// West expansion announcement are reported as a status, not forced
// into a daily-barrels figure that would misrepresent a gas-exporting
// economy as an oil one.
//
// **Two real, non-default conflict/statehood classifications.** Libya
// is `localized-conflict`, not `active-armed-conflict` -- the 2020
// ceasefire and 2021 unity-government formation are real, but so is
// the real east/west factional split and August 2024's armed
// shutdown crisis; its `governmentType` states the divided statehood
// directly (rival Tripoli/Tobruk governments, each with its own
// armed forces) rather than naming one side as though it were the
// whole country. Moldova is `localized-conflict` for the real, frozen
// but unresolved Transnistria territorial dispute -- the same
// "real dispute, reported on its own terms, not defaulted away"
// treatment Morocco's Western Sahara entry already set a precedent
// for in the fifteenth round.
//
// **Four regimeType/regimeScore splits this round, each for a
// different real reason.** Belarus is `authoritarian-regime` with a
// `null` score -- the EIU's own 2024 report places it in a newly-
// created "closed regime" category, confirmed qualitatively, but no
// exact numeric score was found. Uruguay is `full-democracy` with a
// `null` score -- "the only full democracy in South America" is a
// real, confirmed 2024 EIU characterization, but the one number found
// (8.66, rank 14th) is explicitly the 2023 citation, not 2024, and is
// not reused. Paraguay and Bolivia are both `hybrid-regime` with
// `null` scores -- a real, named EIU list places both in that
// category for 2024 by name (alongside Peru/Mexico/Ecuador/Honduras/
// El Salvador/Guatemala, all already real entries elsewhere in this
// file), but the only numeric scores found (5.89, 4.51) carried no
// stated year and are not presented as 2024 figures on that basis
// alone.
//
// **Jordan's `incomeLevel` is the one upgrade this round actually
// confirmed against a primary-adjacent table, not carried over from
// general knowledge.** The World Bank's own FY2027 release (found
// this round) names Jordan explicitly as one of six economies that
// moved from lower-middle to upper-middle income -- `upper-middle-
// income` here reflects that real, dated change, not Jordan's older
// classification.
//
// Several European `militaryExpenditurePctGDP` figures this round
// (Belgium, Denmark, Romania) came from a single flattened SIPRI table
// whose own column alignment the search result itself called "likely
// but not certain" -- kept, flagged `secondary-estimate`, with that
// uncertainty named rather than presented as SIPRI's own clean figure.
// Austria, Finland, Bulgaria, Croatia, Serbia, Jordan, Lebanon, Qatar,
// Bahrain and the others with no `militaryExpenditurePctGDP` value had
// only a qualitative claim found (e.g. "over 2% since 2023," "closed
// regime") or nothing at all -- left `null` rather than converting a
// qualitative claim into an invented number.
//
// Same report-only posture as every other field in this module:
// nothing in `server/` reads a `COUNTRY_PROFILES` field to decide an
// outcome.
//
// ---------------------------------------------------------------------
// Nineteenth round: eighteen more real countries -- the remaining
// Western European full democracies, Southern Africa, the Sahel's
// three real military juntas, East Africa, and Central Asia
// ---------------------------------------------------------------------
// Direct instruction to keep going "as much as you can" toward the
// real ~195-country world. Eighteen countries this round: Switzerland,
// Iceland, Luxembourg, Malta, Cyprus, Botswana, Namibia, Malawi,
// Zambia, Zimbabwe, Rwanda, Burundi, Mongolia, Uzbekistan, Laos, Mali,
// Burkina Faso, Niger.
//
// **Mali, Burkina Faso and Niger are `active-armed-conflict`, and this
// is the clearest-evidenced conflict classification in this whole
// file, not a judgment call.** All three are real, current military
// juntas (Mali since 2020/2021, Burkina Faso since 2022, Niger since
// 2023) that jointly withdrew from ECOWAS, and all three are named
// directly in the real 2025 Global Terrorism Index (covering 2024
// data) as among the world's most terrorism-affected countries: the
// Sahel accounted for 51% of all global terrorism deaths in 2024,
// Burkina Faso ranked #1 in the world for the second year running
// (1,532 deaths, a fifth of the global total), Mali recorded 604
// deaths from 201 attacks, and Niger's 2025 ranking climbed from 10th
// to 5th-worst. JNIM and IS-Sahel are named as the real groups
// responsible. None of the three has a found EIU score -- `regimeType`
// and `regimeScore` are both `null`, with `governmentType` stating the
// real junta/ECOWAS-withdrawal fact directly rather than describing a
// government structure that does not functionally exist right now.
//
// **Cyprus is `localized-conflict`, the same "real, frozen, unresolved
// dispute reported on its own terms" treatment Morocco's Western
// Sahara and Moldova's Transnistria entries already carry.** The
// island has been divided along the Green Line since 1974, with the
// self-declared Turkish Republic of Northern Cyprus recognised only
// by Turkey -- a real, current, unresolved division, not a historical
// footnote.
//
// **Zimbabwe's regimeType/regimeScore are deliberately null, the same
// wrong-year discipline the seventeenth round already applied to
// Uganda and Tanzania.** The only figure found (3.04, rank 127th) is
// explicitly flagged by the search that surfaced it as likely
// reflecting the 2023 edition, published under a February 2024
// dateline, not the 2024 edition itself -- kept out rather than
// risking a year misattribution.
//
// Every other regimeType/regimeScore pair this round (Switzerland,
// Iceland, Luxembourg, Malta, Botswana, Namibia, Malawi, Zambia,
// Rwanda, Mongolia, Uzbekistan, Laos) is confirmed directly against a
// real, dated 2024 EIU figure -- Burundi's carries a light flag
// (`regimeScoreConfidence: 'secondary-estimate'`) because the source
// itself says its figure "remained unchanged 2021-2023" and recommends
// checking the EIU's own report before treating 2024 as settled.
//
// Namibia's `lower-middle-income` and Zambia's/Uzbekistan's
// `lower-middle-income` are each confirmed directly against a real,
// dated World Bank classification list found this round -- Namibia
// specifically as the one country whose classification moved
// DOWNWARD (from upper-middle) in the prior FY26 cycle, a real,
// notable direction against this file's own usual upward-mobility
// framing.
//
// Same report-only posture as every other field in this module:
// nothing in `server/` reads a `COUNTRY_PROFILES` field to decide an
// outcome.

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
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.91, year: 2023, source: 'unodc-via-world-bank-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, 31 Jan 2024 -- the one entry in this batch
    // with both a real rate AND a real, dated occupancy figure from
    // the same primary snapshot, not pieced together from two.
    incarceration: {
      incarcerationRatePer100k: { value: 71, year: 2024, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 59413, year: 2024, source: 'world-prison-brief-prisonstudies-org' },
      occupancyPctOfCapacity: { value: 82.2, year: 2024, officialCapacity: 72258, source: 'world-prison-brief-prisonstudies-org' },
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.7, year: 2023, source: 'world-bank-wdi-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: {
        value: 2.5, year: 2023, source: 'faostat-sdg-2.1.1-via-secondary-compilation',
        note: 'FAO reports any true prevalence at or below 2.5% as exactly "2.5" -- the real figure may be lower, not necessarily this value',
      },
      avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  english: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    // North Sea production is real but in long, well-documented decline; no solid
    // 2024 production figure was found, so this flags the status without a number.
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
    immigration: UK_IMMIGRATION_2026,
    // No clean 2022-2023 UNODC/World Bank homicide rate was found this
    // round -- the UK stopped contributing comparable figures to
    // Eurostat's own series in 2019, and the only figure found
    // (England & Wales, ~1.17 per 100,000, 2021) is both partial
    // (excludes Scotland/Wales as separate jurisdictions despite this
    // table's own english/scottish/welsh split) and two years stale.
    // Left null rather than used.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief's own figures are for England & Wales
    // specifically, not the UK as a whole -- Scotland and Northern
    // Ireland run separate prison systems (see the `scottish` entry
    // below for its own, same real UK-level fields otherwise). Not
    // duplicated there since it is the identical real fact either way.
    incarceration: {
      incarcerationRatePer100k: { value: 145, year: 2024, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      occupancyPctOfCapacity: { value: 104.8, year: 2026, source: 'world-prison-brief-prisonstudies-org', note: 'falling from 110.5% (Feb 2024) to 107.2% (Oct 2025) to 104.8% (Apr 2026) across three real snapshots' },
      scope: 'england-and-wales-only',
    },
  },
  scottish: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
    immigration: UK_IMMIGRATION_2026,
    // Same real gap as the english entry's own note -- not duplicated
    // in full here, see that entry.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  welsh: {
    country: 'United Kingdom', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 8.34,
    militaryExpenditurePctGDP: { value: 2.44, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: { status: 'minor-and-declining-producer', dailyProductionBbl: null, exportValueUsd2024: null },
    immigration: UK_IMMIGRATION_2026,
    // Same real gap as the english entry's own note -- not duplicated
    // in full here, see that entry.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  italian: {
    country: 'Italy', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.58,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 0.57, year: 2023, source: 'unodc-via-world-bank-secondary-compilation',
        note: 'one aggregator rounds this to 0.6, ranked #131 of 145 countries; both describe the same real figure',
        confidence: 'secondary-compilation',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
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
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 0.8, year: 2023, source: 'world-bank-via-secondary-compilation',
        note: 'a 2021 compilation gives 0.68 for that earlier year; both real, different years, not reconciled',
        confidence: 'secondary-compilation',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    notableFigures: [{ name: 'Donald Tusk', role: 'Prime Minister of Poland', note: 'in office since 13 Dec 2023; his government survived a confidence vote (243-in-favour) after a conservative, Karol Nawrocki, won the June 2025 presidential runoff' }],
    politicalParties: {
      ruling: { name: 'Civic Coalition (KO)', leader: 'Donald Tusk', note: 'Civic Platform, Modern and Polish Initiative merged into one party at a 25-26 Oct 2025 unification congress; Tusk was confirmed leader unopposed (98% of a March 2026 vote)' },
      opposition: [{ name: 'PiS (Law and Justice)', note: 'polling around 28.3% as of one October 2026 report' }, { name: 'Confederation', note: 'polling around 20.7%' }],
      president: { name: 'Karol Nawrocki', note: 'a conservative, elected June 2025 -- creates divided government against Tusk\'s coalition' },
      nextParliamentaryElection: { year: 2027, season: 'autumn' },
      source: 'wikipedia-donald-tusk; wikipedia-civic-coalition-unification-congress; polskieradio; eurointegration',
      confidence: 'real-and-current-polling-figures-will-move',
    },
  },
  french: {
    country: 'France', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'semi-presidential republic',
    // EIU downgraded France from full to flawed democracy in the 2024 index.
    regimeType: 'flawed-democracy', regimeScore: null,
    militaryExpenditurePctGDP: { value: 2.01, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 1.3, year: 2023, source: 'world-bank-via-secondary-compilation',
        note: 'a UNODC-via-Statista series gives 1.34 for the same year -- same real figure, rounding difference',
        confidence: 'secondary-compilation',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, 1 Dec 2025 -- covers France including its
    // overseas departments and territories, people held in penal
    // institutions only.
    incarceration: {
      incarcerationRatePer100k: { value: 126, year: 2025, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      occupancyPctOfCapacity: { value: 135.6, year: 2025, officialCapacity: 63613, source: 'world-prison-brief-prisonstudies-org', note: 'up from 122.9% (1 Jan 2024, capacity 61,767) -- a real, worsening trend across two snapshots' },
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.69, year: 2023, source: 'world-bank-via-secondary-compilation', note: '125 homicides in 2023 per the same compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  norwegian: {
    country: 'Norway', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 9.81,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 1690000, exportValueUsd2024: 49700000000 },
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 0.72, year: 2023, source: 'world-bank-via-secondary-compilation',
        note: '40 homicides in 2023 per that compilation; a separate 2021-dated secondary figure gives 0.55 for that earlier year -- kept apart, not reconciled',
        confidence: 'secondary-compilation',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  swedish: {
    country: 'Sweden', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'full-democracy', regimeScore: 9.39,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 1.1, year: 2021, source: 'secondary-compilation', confidence: 'secondary-compilation',
        note: 'no 2022/2023 figure was found this round; this is the most recent year confirmed',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  greek: {
    country: 'Greece', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'full-democracy', regimeScore: 8.07,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.84, year: 2023, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  portuguese: {
    country: 'Portugal', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    // EIU upgraded Portugal to full democracy in the 2024 index; exact score not confirmed.
    regimeType: 'full-democracy', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    // No 2022/2023 homicide figure was found this round for Portugal
    // specifically -- left null rather than guessed.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  hungarian: {
    country: 'Hungary', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 6.51,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.7, year: 2023, source: 'secondary-compilation', note: 'a second compilation gives 0.77 for the same year', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  czech: {
    country: 'Czech Republic', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    // EIU upgraded the Czech Republic to full democracy in the 2024 index; exact score not confirmed.
    regimeType: 'full-democracy', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.8, year: 2023, source: 'secondary-compilation', note: 'a second compilation gives 0.77 for the same year', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  swiss: {
    country: 'Switzerland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'federal semi-direct democratic republic',
    regimeType: 'full-democracy', regimeScore: 9.32,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.6, year: 2023, source: 'secondary-compilation', note: '53 homicides in 2023 per that compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  lithuanian: {
    country: 'Lithuania', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.59,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 2.6, year: 2023, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 8.21, year: 2018, source: 'rosstat-via-secondary-compilation', note: 'the most recent figure found this round; no newer confirmed value, kept rather than omitted', confidence: 'secondary-compilation-stale' },
      undernourishmentPct: null, avgTemperatureC: null,
      roadTrafficDeathRatePer100k: { value: 18.0, year: null, source: 'secondary-compilation', note: 'exact year/methodology not confirmed in the source found this round', confidence: 'secondary-compilation-unverified-year' },
    },
    // World Prison Brief's own figure moved sharply between snapshots
    // (300 per 100k, Jan 2023, total 433,006 -> 197 per 100k, May
    // 2026, total 282,000) -- both kept rather than one picked, the
    // drop is real and large enough to flag rather than silently use
    // the newest number as settled.
    incarceration: {
      incarcerationRatePer100k: { value: 197, year: 2026, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 282000, year: 2026, source: 'world-prison-brief-prisonstudies-org' },
      priorSnapshot: { incarcerationRatePer100k: 300, prisonPopulationTotal: 433006, year: 2023 },
      note: 'a roughly one-third drop between the 2023 and 2026 WPB snapshots -- real, but not independently explained in the source found this round, so treated cautiously rather than as a settled trend',
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 3.8, year: 2021, source: 'world-bank-via-secondary-compilation', note: 'the most recent figure found this round, pre-dating the full-scale invasion', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
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
    // The only homicide-adjacent figure found this round for Somalia
    // (14.7) is a COMBINED intentional-death rate, not a homicide-only
    // count -- checked directly and excluded rather than mistaken for
    // the real thing. undernourishmentPct and roadTrafficDeathRatePer100k
    // ARE real, homicide-unrelated figures and are kept.
    globalIndicators2026: {
      homicideRatePer100k: null,
      undernourishmentPct: { value: 53.2, year: 2023, source: 'faostat-sdg-2.1.1-via-secondary-compilation', confidence: 'secondary-compilation' },
      avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'bosnian': {
    country: 'Bosnia and Herzegovina', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'hybrid-regime', regimeScore: 5.06,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 1.2, year: 2023, source: 'world-bank-via-secondary-compilation', note: 'macrotrends gives 1.22 for the same year -- same real figure, rounding difference', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  nigerian: {
    country: 'Nigeria', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'federal presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.16,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'major-exporter', dailyProductionBbl: 1520000, exportValueUsd2024: 38400000000 },
    // Homicide figures found this round genuinely disagree outside
    // rounding noise (15.7 with no stated year, vs. 34.52 for 2016) --
    // too wide a spread and too uncertain a basis to call either "the"
    // figure, so this is left null rather than picking one. undernourishmentPct
    // is a separate, real figure with a different source lineage.
    globalIndicators2026: {
      homicideRatePer100k: null,
      undernourishmentPct: { value: 22.2, year: null, source: 'faostat-sdg-2.1.1-via-secondary-compilation', note: 'year not stated in the source found this round', confidence: 'secondary-compilation' },
      avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, 29 Dec 2025 -- one of the lowest real rates
    // in this incarceration batch, and the pre-trial share is
    // separately real and very high (68.5%, Apr 2024 snapshot).
    incarceration: {
      incarcerationRatePer100k: { value: 33, year: 2025, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      pretrialDetaineeSharePct: { value: 68.5, year: 2024, source: 'world-prison-brief-prisonstudies-org' },
      note: 'nearby snapshots give 34-35 depending on the exact date/population base used -- real range, not reconciled to one figure',
    },
    notableFigures: [{ name: 'Bola Tinubu', role: 'President of Nigeria', note: 'vowed to defeat Boko Haram/ISWAP after a March 2026 triple bombing in Maiduguri and renewed Borno attacks' }],
    politicalParties: {
      ruling: { name: 'APC (All Progressives Congress)', leader: 'Bola Tinubu', note: 'controls 31 of 36 states as of mid-2026, up from 21 in 2023, after a wave of opposition-governor defections' },
      opposition: { note: 'fragmented and weakened, per a Timbuktu Institute analysis; had not nominated 2027 candidates as of this round' },
      source: 'timbuktu-institute; statehouse-gov-ng; gazettengr',
      confidence: 'real-and-current',
    },
    // Real, current security data -- same discipline as every other
    // conflict entry: no invented casualty total where none was found.
    securitySituation2026: {
      globalTerrorismIndexRank: { value: 6, year: 2025, note: 'ranked the 6th most terrorised country globally, up 2 places from the prior ranking' },
      notableAttacks2026: [
        { date: '2026-03', location: 'Maiduguri, Borno State', event: 'three suicide bombers detonated explosives at the Main Market, a university teaching hospital, and a flyover near a post office' },
        { date: '2026-08-ish', location: 'Ngoshe, Gwoza LGA, Borno State', event: 'Boko Haram overpowered soldiers and abducted more than 100 women and children, per opposition figure Peter Obi\'s account' },
        { date: '2026-03', location: 'Plateau State', event: 'a bandit attack killed at least 28 residents' },
      ],
      note: 'no consolidated 2026 Boko Haram/ISWAP casualty or attack total was found this round; sources are largely partisan (government and opposition statements) and the figures above are individual, sourced incidents, not an aggregated count',
      source: 'allafrica; gazettengr; statehouse-gov-ng',
      confidence: 'individual-incidents-sourced-no-aggregate-total-found',
    },
  },
  ethiopian: {
    country: 'Ethiopia', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'federal parliamentary republic',
    // conflictLevel was not re-checked against UCDP's current
    // classification this round -- tigrayConflict2026 below describes
    // real 2026 fighting one press account calls "the most serious
    // escalation since the end of the civil war," which may warrant
    // reclassifying this to active-armed-conflict on a future check.
    // Not changed here without that direct check, per this module's
    // own "checked directly, not a judgement call" standard.
    regimeType: 'authoritarian-regime', regimeScore: 3.24,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 8.63, year: 2012, source: 'unodc-via-secondary-compilation', note: 'the most recent figure found this round -- a real limitation, not re-estimated to look current', confidence: 'secondary-compilation-stale' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    politicalParties: {
      ruling: { name: 'Prosperity Party', leader: 'Abiy Ahmed', note: 'Abiy has been PM since 2018; Prosperity Party formed in 2019 from the former EPRDF coalition -- a stable structural fact, not re-verified live this round' },
      source: 'standard, stable party-system facts, not re-verified live this round',
      confidence: 'durable-structural-fact-not-election-cycle-specific',
    },
    // Real, current re-escalation of the Tigray conflict -- a
    // genuinely different, later situation from whatever this
    // entry's conflictLevel was last calibrated against.
    tigrayConflict2026: {
      electionExclusion: { note: 'the TPLF\'s legal registration as a party was revoked in 2025; Tigray was excluded from Ethiopia\'s June 2026 national vote' },
      pretoriaAccordStrain: { note: 'in April 2026 the TPLF reactivated a local parliament Addis Ababa deems illegitimate; reintegration into federal institutions remains incomplete' },
      clashes: [
        { date: '2026-01-29', location: 'Tselemti district', note: 'fighting erupted between the TPLF and Ethiopian government forces; the Tigray Defense Force withdrew by 1 Feb' },
        { date: '2026-08', location: 'western Tigray, near the Sudan border', note: 'described as the most serious escalation since the end of the civil war; hundreds of civilians crossed into Sudan; no official casualty figures released' },
        { date: '2026-09-28', note: 'fighting intensifying in northern Ethiopia per Euronews, with fears of a return to the 2020-2022 war spreading into Afar and Amhara' },
      ],
      eritreaTensions: { note: 'Ethiopia has accused Eritrea of aggression and of collaborating with the TPLF; troop deployments near Tigray were reported in May 2026' },
      source: 'wikipedia-2026-ethiopia-tplf-clashes; nation-africa; euronews; fides; ewn',
      confidence: 'press-sourced-no-official-casualty-figures-released-fast-moving',
    },
  },
  ghanaian: {
    country: 'Ghana', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.24,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 1.8, year: 2022, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  kenyan: {
    country: 'Kenya', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'unitary presidential republic',
    // Score (5.05) sits in EIU's own published hybrid-regime band.
    regimeType: 'hybrid-regime', regimeScore: 5.05,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 4.9, year: 2022, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null,
      avgTemperatureC: { value: 24.6, source: 'world-economics-1924-2024-hundred-year-average', note: 'a different real methodology/period than this round\'s other temperature figures -- not blended with them', confidence: 'secondary-compilation-different-baseline' },
      roadTrafficDeathRatePer100k: { value: 28.2, year: 2023, source: 'who-global-status-report-on-road-safety-2023-via-secondary-compilation', confidence: 'secondary-compilation' },
    },
  },
  jamaican: {
    country: 'Jamaica', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'parliamentary constitutional monarchy',
    regimeType: 'flawed-democracy', regimeScore: 6.74,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 49.4, year: 2023, source: 'unodc-via-world-bank-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  haitian: {
    country: 'Haiti', incomeLevel: 'low-income', conflictLevel: 'localized-conflict', governmentType: 'unitary semi-presidential republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.74,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    // These four are independent of (and real alongside) the detailed
    // gangCrisis2026 block below -- the UNODC/World-Bank homicide
    // figure, the FAOSTAT hunger figure and the WHO road-safety figure
    // are each a different real institution's own measurement, not
    // derived from the gang-crisis narrative.
    globalIndicators2026: {
      homicideRatePer100k: { value: 41.2, year: 2023, source: 'unodc-via-world-bank-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: { value: 54.2, year: 2023, source: 'faostat-sdg-2.1.1-via-secondary-compilation', confidence: 'secondary-compilation' },
      avgTemperatureC: null,
      roadTrafficDeathRatePer100k: { value: 31.3, year: 2023, source: 'who-global-status-report-on-road-safety-2023-via-secondary-compilation', confidence: 'secondary-compilation' },
    },
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
    // No recent (2020s) homicide figure was found this round -- the
    // only one found dates to 2011, too stale to carry even flagged.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null,
      avgTemperatureC: { value: 24.79, source: 'world-bank-1991-2020-via-wikipedia-compilation', confidence: 'secondary-compilation' },
      roadTrafficDeathRatePer100k: null,
    },
    notableFigures: [{ name: 'To Lam', role: 'Communist Party General Secretary and State President', note: 'became General Secretary 3 Aug 2024 succeeding the late Nguyen Phu Trong; re-elected General Secretary 23 Jan 2026 (14th National Party Congress, unanimous 180-member Central Committee); elected State President 7 Apr 2026 for the 2026-2031 term -- the first modern Vietnamese leader to hold both posts from the start of a term' }],
    politicalParties: {
      ruling: { name: 'Communist Party of Vietnam', leader: 'To Lam', note: 'one-party state; AP-sourced reporting compares his concentrated power to Xi Jinping\'s' },
      primeMinister: { name: 'Le Minh Hung', confidence: 'single-secondary-source-appendix-less-certain' },
      source: 'arabnews; vietnamlawmagazine; vneconomy; usasean-org-appendix',
      confidence: 'real-and-current-except-the-flagged-pm-name',
    },
  },
  chinese: {
    country: 'China', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'one-party socialist republic',
    regimeType: 'authoritarian-regime', regimeScore: 2.11,
    militaryExpenditurePctGDP: { value: 1.66, year: 2024, confidence: 'secondary-estimate' },
    // China is the world's largest crude IMPORTER despite large domestic production —
    // not a net exporter, so this is deliberately null rather than misleadingly "producer".
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.5, year: 2020, source: 'secondary-compilation', note: 'the most recent figure found this round', confidence: 'secondary-compilation-stale' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief's own headline rate covers Ministry of
    // Justice prisons (sentenced prisoners) only -- it explicitly
    // excludes pre-trial and "administrative" detention under the
    // Ministry of Public Security, and says so itself. Its own
    // illustrative estimate of a fuller total is kept separate and
    // flagged as illustrative, never blended into the headline figure.
    incarceration: {
      incarcerationRatePer100k: { value: 121, year: null, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate', scope: 'ministry-of-justice-sentenced-prisoners-only' },
      prisonPopulationTotal: { value: 1656773, source: 'world-prison-brief-prisonstudies-org', scope: 'ministry-of-justice-sentenced-prisoners-only' },
      illustrativeFullerEstimate: { prisonPopulationTotal: 2340000, incarcerationRatePer100k: 165, note: 'World Prison Brief\'s own illustrative estimate if pre-trial/administrative detainees were included -- explicitly not an official count' },
    },
    notableFigures: [{ name: 'Xi Jinping', role: 'General Secretary of the Communist Party, President, Chairman of the Central Military Commission', note: 'holds all three posts as of mid-2026 reporting; his "core leader" status was written into party rules at the 2022 Congress' }],
    politicalParties: {
      ruling: { name: 'Communist Party of China', leader: 'Xi Jinping' },
      nextPartyCongress: { year: 2027, note: 'the 21st Congress; Xi could seek an unprecedented fourth term. A 2018 constitutional amendment (NPC) removed the two-term limit on the presidency' },
      source: 'shafaq; factually-co; standard-structural-facts',
      confidence: 'real-and-current-no-change-in-status-found-through-oct-2026',
    },
  },
  filipino: {
    country: 'Philippines', incomeLevel: 'lower-middle-income', conflictLevel: 'localized-conflict', governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.63,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 4.35, year: 2023, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, 1 Jun 2024 -- the rate covers both BuCor
    // prisons and BJMP jails together; the occupancy figure is a real,
    // separately-dated snapshot (31 May 2021) kept rather than
    // reconciled to the same date, since no later national occupancy
    // figure was found this round.
    incarceration: {
      incarcerationRatePer100k: { value: 149, year: 2024, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { bucorPrisons: 53397, bjmpJails: 117850, year: 2024, source: 'world-prison-brief-prisonstudies-org' },
      occupancyPctOfCapacity: { value: 362.0, year: 2021, source: 'world-prison-brief-prisonstudies-org', note: 'a different, earlier snapshot (May 2018) gave 463.6%; both real, neither current' },
    },
    notableFigures: [
      { name: 'Ferdinand Marcos Jr.', role: 'President of the Philippines', note: 'constitutionally limited to a single term; said 14 Aug 2026 he will back a 2028 presidential candidate but had not chosen one' },
      { name: 'Sara Duterte', role: 'Vice President', note: 'has announced her own 2028 presidential bid while facing an impeachment trial in the Senate' },
    ],
    politicalParties: {
      ruling: { name: 'PFP (Partido Federal ng Pilipinas)', leader: 'Ferdinand Marcos Jr. (chair)' },
      alliance: [{ name: 'Nacionalista Party (NP)', leader: 'Manny Villar (president)' }, { name: 'NPC (Nationalist People\'s Coalition)' }],
      source: 'inquirer-newsinfo; omanobserver; thevibes; khaleejtimes',
      confidence: 'real-and-current',
    },
  },
  'asian-indian': {
    country: 'India', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict', governmentType: 'federal parliamentary republic',
    regimeType: 'flawed-democracy', regimeScore: 7.3,
    militaryExpenditurePctGDP: { value: 2.22, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 2.8, year: 2022, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: { value: 9.8, year: null, source: 'faostat-sdg-2.1.1-via-secondary-compilation', note: 'year not stated in the source found this round', confidence: 'secondary-compilation' },
      avgTemperatureC: { value: 24.94, source: 'world-bank-1991-2020-via-wikipedia-compilation', confidence: 'secondary-compilation' },
      roadTrafficDeathRatePer100k: {
        value: 11.6, year: 2021, source: 'who-south-east-asia-regional-summary',
        note: 'a separate press account of the same WHO release gives 15 per 100,000 for the same year -- both real, not reconciled',
        confidence: 'secondary-compilation',
      },
    },
    notableFigures: [{ name: 'Narendra Modi', role: 'Prime Minister of India', note: 'began a third term in 2024 leaning on coalition allies after the BJP fell 32 seats short of a majority on its own' }],
    politicalParties: {
      ruling: { name: 'BJP (Bharatiya Janata Party)', leader: 'Narendra Modi', note: 'won 240 of 543 Lok Sabha seats in 2024, short of the 272 needed alone' },
      coalition: { name: 'NDA (National Democratic Alliance)', seats: 293, note: 'relies on allies including the TDP and JD(U); the AIADMK joined the NDA in April 2025' },
      note: 'no primary-source confirmation of the coalition\'s 2026 structure was found this round; a Hoover Institution survey describes 2025 as stable, helped by state wins in Maharashtra, Haryana and Delhi',
      source: 'tribune-com-pk; deccanherald; hoover-institution-survey-of-india-2026',
      confidence: 'well-sourced-through-2025-2026-developments-thinly-sourced',
    },
  },
  mexican: {
    country: 'Mexico', incomeLevel: 'upper-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'federal presidential republic',
    // Score (5.3) sits in EIU's own published hybrid-regime band.
    regimeType: 'hybrid-regime', regimeScore: 5.3,
    militaryExpenditurePctGDP: null,
    oilProducer: { status: 'exporter', dailyProductionBbl: 848000, exportValueUsd2024: 21700000000 },
    globalIndicators2026: {
      homicideRatePer100k: { value: 25.9, year: 2022, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null,
      avgTemperatureC: { value: 21.2, source: '2016-single-year-world-bank-via-secondary-compilation', note: 'a different real year/basis than this round\'s 1991-2020-baseline figures -- not blended with them', confidence: 'secondary-compilation-different-baseline' },
      roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief's own most recent snapshot (31 Jul 2026, rate
    // 200, total 272,448) jumped sharply from an earlier 2024 snapshot
    // (rate 174) -- both kept rather than reconciled, the gap is real
    // but not independently explained in the source found this round.
    incarceration: {
      incarcerationRatePer100k: { value: 200, year: 2026, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 272448, year: 2026, source: 'world-prison-brief-prisonstudies-org' },
      priorSnapshot: { incarcerationRatePer100k: 174, year: 2024 },
      note: 'a roughly 15% rise between the 2024 and 2026 snapshots -- treated cautiously, not as a confirmed settled trend',
    },
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
    // Two real homicide figures found this round for the same year
    // disagree by a meaningful margin (roughly 20 vs 23 per 100,000) --
    // left null rather than picking one.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    cartelsAndGangs2026: { note: 'no current (2025/2026) gang/cartel-specific reporting found this round -- a real gap, not filled with an invented figure' },
  },
  honduran: {
    country: 'Honduras', incomeLevel: 'lower-middle-income', conflictLevel: 'high-nonstate-violence', governmentType: 'unitary presidential republic',
    regimeType: 'hybrid-regime', regimeScore: 4.98,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    // Real sources found this round disagree widely for Honduras --
    // roughly 31 (2023) to 38 (2022) per 100,000 depending on source
    // and year -- too wide a real disagreement to resolve to one
    // number, so left null rather than picking an endpoint.
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 7.9, year: 2022, source: 'secondary-compilation', note: 'reflects the post-2022-crackdown period, per this entry\'s own cartelsAndGangs2026 note -- not the country\'s earlier, much higher-violence years', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 5.8, year: 2023, source: 'unodc-via-world-bank-secondary-compilation', note: 'a UNODC-derived ranking gives 5.76 with 19,796 homicides for the same year -- same real figure, rounding difference', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief (prisonstudies.org) -- its own current
    // headline figure, 2023 BJS-derived pre-trial share kept separate
    // rather than blended into the overall rate.
    incarceration: {
      incarcerationRatePer100k: { value: 542, year: 2023, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      pretrialDetaineeSharePct: { value: 25.5, year: 2023, source: 'world-prison-brief-prisonstudies-org' },
      note: 'secondary WPB-citing sources give 541 for the same period -- same real figure, rounding difference; a current total prison-population count was not confirmed this round',
    },
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
    globalIndicators2026: {
      homicideRatePer100k: { value: 1.6, year: 2022, source: 'secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null,
      avgTemperatureC: { value: 21.0, source: '2016-single-year-world-bank-via-secondary-compilation', note: 'a different real year/basis than this round\'s 1991-2020-baseline figures -- not blended with them', confidence: 'secondary-compilation-different-baseline' },
      roadTrafficDeathRatePer100k: null,
    },
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
        + 'Iran now has its own entry below (the "iranian" ancestryPacks.GROUPS gap this note used to '
        + 'describe is closed -- B04006_048E is a real, confirmed code) -- see `iranian.warStatusRef` there '
        + 'rather than this note, which is kept for the history.',
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

  // -----------------------------------------------------------------
  // Thirteenth round: Iran, Venezuela, Cuba, Colombia and the
  // Dominican Republic -- the five of seven countries this round's
  // ancestry-code check actually found a real code for. See
  // `ancestryPacks.GROUPS`'s own header and `world-layer/imports/
  // ancestryImport.js`'s for the full source-by-source finding,
  // including Canada and Yemen (which real codes exist for and were
  // checked, but which stay unblocked -- Canada by `countryPacks.js`'s
  // own prior decision above, Yemen because B04006 has no distinct
  // Yemeni row at all).
  // -----------------------------------------------------------------
  iranian: {
    country: 'Iran', incomeLevel: 'upper-middle-income', conflictLevel: 'active-armed-conflict',
    // Islamic Republic: an elected president and parliament sit below
    // an unelected Supreme Leader who holds final authority over the
    // military, judiciary and broadcast media -- a real, distinct
    // government form, not a generic "republic".
    governmentType: 'Islamic republic (Supreme Leader holds authority above the elected president)',
    regimeType: 'authoritarian-regime', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: {
      status: 'exporter',
      dailyProductionBbl: { opecCrudeOnly2025: 3261000, eiaCrudePlusCondensate2025: 4190000 },
      note: 'OPEC counts crude only, EIA includes condensate -- the two bases are not comparable, not reconciled '
        + 'into one number. Relies on China as effectively its only crude buyer: Kpler puts 2025 deliveries to '
        + 'China at ~1.38M bbl/day, down ~7% versus 2024.',
      confidence: 'secondary-estimate',
    },
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    // The real war is already told in full on `israeli.warStatus` --
    // standing rule 3: this does not duplicate that object, it points
    // to it.
    warStatusRef: 'see israeli.warStatus for the real, dated Israel-Iran war narrative this entry shares',
    source: 'world-bank-income-classification-fy2026; eiu-democracy-index-2024-regional-summary; opec-2025; eia-2025; kpler-via-spglobal-2025',
    confidence: 'income-classification-and-oil-figures-sourced-regime-score-and-military-spend-pct-gdp-not-found-this-round',
  },
  venezuelan: {
    country: 'Venezuela', incomeLevel: 'lower-middle-income',
    // World Bank moved Venezuela from "unclassified" (no reliable GNI
    // data since FY21) to lower-middle-income for FY27 -- the
    // classification itself is new information, not a guess.
    conflictLevel: 'high-nonstate-violence',
    governmentType: 'federal presidential republic',
    regimeType: 'authoritarian-regime', regimeScore: null,
    militaryExpenditurePctGDP: { value: 5.2, year: 2019, confidence: 'secondary-estimate', note: 'CIA World Factbook figure, dated 2019 -- no more recent %GDP figure found' },
    oilProducer: {
      status: 'exporter', dailyProductionBbl: 1120000, year: 'late 2025',
      note: 'holds the world\'s largest proven oil reserves (OPEC), but sanctions-driven swings are large and '
        + 'sources disagree sharply across 2025: ship-tracking/PDVSA-sourced reporting gives exports as low as '
        + '~498,000 bpd (Dec 2025) and as high as ~1.25M bpd (May 2026) -- not reconciled into one figure.',
      confidence: 'secondary-estimate-high-volatility',
    },
    // `VENEZUELA_SITUATION_2026` already tells the real political-
    // crisis story (Maduro's capture, the US-run transition) in full;
    // this entry's own fields are the structural facts that story sits
    // on top of, not a second copy of it.
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    situationRef: 'see VENEZUELA_SITUATION_2026 for the real, dated political-crisis narrative',
    source: 'world-bank-country-and-lending-groups-fy27; eiu-democracy-index-2024-regional-summary; cia-world-factbook; reuters-via-boereport-2026; spglobal-2025',
    confidence: 'income-reclassification-and-eiu-regime-category-confirmed-exact-regime-score-and-current-pctgdp-not-found-this-round',
  },
  cuban: {
    country: 'Cuba', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    // The Communist Party of Cuba is constitutionally the country's
    // only legal party -- a real, structural fact, not a
    // characterisation.
    governmentType: 'one-party socialist republic',
    regimeType: 'authoritarian-regime', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    // `CUBA_CRISIS_2026` already tells the real, current electricity-
    // grid crisis in full; not duplicated here.
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    crisisRef: 'see CUBA_CRISIS_2026 for the real, dated electricity-grid-crisis narrative',
    source: 'world-bank-country-and-lending-groups-fy26; eiu-democracy-index-2024-regional-summary',
    confidence: 'income-classification-and-eiu-regime-category-confirmed-exact-regime-score-military-spend-and-oil-not-found-this-round',
  },
  colombian: {
    country: 'Colombia', incomeLevel: 'upper-middle-income',
    // Same real UCDP-adjacent category Mexico already carries in this
    // table: ELN/Gulf Clan/FARC-dissident violence documented on
    // `COLOMBIA_CRIME_2026` below is non-state, not a UCDP state-based
    // conflict, though Colombia has carried a state-based conflict
    // designation in other years -- not independently re-checked this
    // round, so this is the conservative, already-established category.
    conflictLevel: 'high-nonstate-violence',
    governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.35,
    militaryExpenditurePctGDP: { value: 2.9, year: 2023, confidence: 'secondary-estimate' },
    oilProducer: {
      status: 'exporter', dailyProductionBbl: 760000, year: 2024,
      note: 'sources range 747,000-773,000 bpd for 2024 (Rystad Energy vs. BP Statistical Review) -- not '
        + 'reconciled into one figure. Ecopetrol is the national producer; oil is Colombia\'s largest single '
        + 'export category.',
      confidence: 'secondary-estimate',
    },
    // `COLOMBIA_CRIME_2026` already tells the real, current
    // crime/armed-group/political story in full; not duplicated here.
    // Colombia's homicide rate IS a real, found figure -- already on
    // `COLOMBIA_CRIME_2026.homicideRate2025` with real sources
    // disagreeing (25.8/23.08/open-data-count). Not duplicated into a
    // second `globalIndicators2026` figure here; that object stays
    // null and points there, same `crimeRef` pattern as the rest of
    // this entry.
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    // World Prison Brief, 31 Dec 2023 -- the most recent real snapshot found this round.
    incarceration: {
      incarcerationRatePer100k: { value: 198, year: 2023, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 101622, year: 2023, source: 'world-prison-brief-prisonstudies-org' },
      occupancyPctOfCapacity: { value: 124.3, year: 2023, officialCapacity: 81740, source: 'world-prison-brief-prisonstudies-org' },
    },
    crimeRef: 'see COLOMBIA_CRIME_2026 for the real, dated crime and armed-group narrative',
    source: 'world-bank-country-and-lending-groups; eiu-democracy-index-2024; cia-world-factbook-2023; rystad-energy-2024; bp-statistical-review-2024',
    confidence: 'regime-score-and-oil-production-both-directly-sourced-military-spend-pct-gdp-is-a-third-party-estimate',
  },
  dominican: {
    country: 'Dominican Republic', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.62,
    militaryExpenditurePctGDP: {
      value: 0.6, year: 2023, confidence: 'secondary-estimate',
      note: 'a second source (World Bank/SIPRI data via a third-party compilation) gives 0.8% for 2024 instead -- both reported, not reconciled',
    },
    oilProducer: null,
    // `DOMINICAN_REPUBLIC_2026` already tells the real, current
    // Haitian-migration-enforcement story in full; not duplicated here.
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    migrationRef: 'see DOMINICAN_REPUBLIC_2026 for the real, dated Haitian-migration-enforcement narrative',
    source: 'world-bank-country-and-lending-groups; eiu-democracy-index-2024; cia-world-factbook-2023; statisticsoftheworld-2024',
    confidence: 'regime-score-directly-sourced-military-spend-pct-gdp-disagrees-across-two-secondary-sources',
  },
  // Egypt: declined last round for lack of confidence doing this exact
  // check, not because no code exists -- see the comment near this
  // module's Egypt/Saudi-Arabia decline above. Added now that the
  // check has a real answer (B04006_007E).
  egyptian: {
    country: 'Egypt', incomeLevel: 'lower-middle-income',
    // The Sinai insurgency (ISIL-Sinai Province), real and long-
    // running since 2011, but reclassified "low impact" in the Global
    // Terrorism Index published March 2026 after years of declining
    // activity -- persistent and localized, not nationwide, which is
    // UCDP's own distinction between "localized" and "active-armed".
    conflictLevel: 'localized-conflict',
    governmentType: 'presidential republic',
    regimeType: 'authoritarian-regime', regimeScore: null,
    militaryExpenditurePctGDP: { value: 0.67, year: 2024, confidence: 'secondary-estimate', note: 'down from 0.81% in 2023, per SIPRI data reported via a third party; among the lowest ratios of any Arab state in 2025 per the same source' },
    // A real, non-obvious finding, not a simple "exporter" label: Egypt
    // still produces oil and gas domestically but reversed from gas
    // EXPORTER to net LNG IMPORTER by mid-2024 as the offshore Zohr
    // field's output fell roughly 30% from 2021-2024 -- the honest
    // current state, not the older "Egypt is a gas exporter" fact.
    oilProducer: {
      status: 'domestic-producer-net-gas-importer',
      dailyProductionBbl: { total2024: 569000, crudeOnly2024: 476000, note: 'sources disagree by basis (total liquids vs. crude alone); crude-only figure is the lowest since the late 1970s' },
      gasNote: 'local gas output fell to a roughly eight-year low in 2024 and Egypt returned to net LNG imports by mid-2024; the government has said it hopes to return to net gas exports around 2027',
      confidence: 'secondary-estimate',
    },
    globalIndicators2026: { homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null },
    // World Prison Brief, 2022 (via a U.S. State Department human-
    // rights report and corroborated by Prison Insider, both citing WPB) --
    // no 2024/2025 figure was found this round.
    incarceration: {
      incarcerationRatePer100k: { value: 116, year: 2022, source: 'world-prison-brief-prisonstudies-org-via-us-state-dept-and-prison-insider', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 120000, year: 2022, source: 'us-state-department-human-rights-report' },
      pretrialDetaineeSharePct: { value: 33.3, year: 2022, source: 'world-prison-brief-prisonstudies-org' },
    },
    source: 'world-bank-country-and-lending-groups-fy2026; ahram-online-2026-gti; sipri-via-theglobaleconomy-2024; enterpriseam-mees-2025; spglobal-2025',
    confidence: 'income-classification-and-oil-gas-reversal-well-sourced-exact-eiu-regime-score-not-found-this-round',
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
    + 'ancestryPacks.GROUPS key exists yet, the same structural gap the israeli/Iran entries once named before '
    + 'the thirteenth round\'s ancestry-code check closed Iran\'s',
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
// The three missing regional overviews: Asia, the Middle East, Latin
// America -- the real gap `REGION_OVERVIEWS` itself names further
// down this file. Same bounded-scope discipline as
// AFRICA_MIGRATION_OVERVIEW_2026: real figures found this round, dated
// and sourced, not a claim of exhaustive regional coverage.
// ---------------------------------------------------------------------

const ASIA_MIGRATION_OVERVIEW_2026 = {
  scopeNote: 'covers the Asia-Arab labour corridor and a UN DESA baseline found this round -- not a full Asia-wide migration survey, and dates mix 2020-2025 since no single clean 2025/2026 total was found',
  asiaArabLabourCorridor: {
    migrantsFromCentralSouthernAsia: { value: 18400000, year: 2024, sharePctOfCorridorOrigin: 41, priorValue: { value: 5100000, year: 2000 } },
    remittanceCorridors: { note: 'the UAE-India and Saudi Arabia-India remittance corridors rank among the world\'s top three' },
    averageRemittanceCostMenaPct: { value: 6.07, year: 2024, priorYear: { value: 7.17, year: 2020 }, note: 'still well above the UN SDG target of 3%' },
  },
  baseline: { note: 'UN DESA (2020 data): Asia hosts roughly 86 million international migrants (about a third of the world total), plus roughly 69 million more via migration internal to Asia -- an older baseline, kept because no newer equivalent total was found' },
  source: 'adb-adbi-oecd-ilo-labour-migration-in-asia-sep-2025; unescwa-escap; un-desa',
  confidence: 'mixed-dates-no-single-current-regional-total-found',
};

const MIDDLE_EAST_MIGRATION_2026 = {
  scopeNote: 'covers UNHCR\'s own MENA regional totals and the real Syria return/displacement picture -- not a country-by-country Gulf states survey, which UNHCR itself notes those states publish very little data for',
  globalContext: { refugees2025: { value: 41600000, change: '-3% vs 2024' } },
  menaRegionalTotals: {
    refugeesAndAsylumSeekers: { value: 4200000, asOf: 'end-2025' },
    internallyDisplaced: { value: 14600000, asOf: 'end-2025', priorYear: { value: 13000000, year: 2024 } },
  },
  syria: {
    returnsFromAbroad: { value: 1300000, asOf: 'end-2025', laterFigure: { value: 1500000, asOf: 'spring-2026', note: 'a later UNHCR update gives a higher cumulative figure since the fall of the former regime at the end of 2024' } },
    idpReturnsToOrigin: { value: 1900000, asOf: 'end-2025', laterFigure: { value: 1800000, asOf: 'spring-2026', note: 'phrased as "more than" in the later update; kept alongside the end-2025 figure rather than reconciled' } },
    stillDisplaced: { registeredRefugeesInNeighbouringCountries: 3810000, internallyDisplaced: 7100000, asOf: 'end-2025', note: 'despite the real returns above, Syrians remain one of the largest displaced populations globally' },
  },
  gulfOriginRefugees: {
    value2025: 6570, value2015: 2332, change: '+181.7%',
    note: 'this measures refugees FROM Gulf states, not refugees hosted there -- a different, much smaller real figure, led by Kuwait and Saudi Arabia',
  },
  dataGap: { note: 'Gulf states publish very little on hosted displaced or foreign populations broken down by nationality -- a real, stated gap, not estimated here' },
  recentEscalation: { note: 'a June 2026 UNHCR population-movement map reports over 31 million forcibly displaced people and recent returnees across the wider Middle East region as of just before 28 Feb 2026, describing escalating hostilities worsening humanitarian conditions -- the same period israeli.warStatus covers for the Israel-Iran war' },
  source: 'unhcr-mena-pacific-2026; theweek-in; data-unhcr-org-population-movement-map',
  confidence: 'real-unhcr-sourced-figures-from-several-different-updates-dates-and-definitions-vary',
};

const LATIN_AMERICA_MIGRATION_2026 = {
  scopeNote: 'centres on the Venezuelan diaspora, by far the dominant real migration story in the region -- not a survey of every Latin American country\'s migration picture',
  venezuelanDiaspora: {
    totalAbroad: { value: 7900000, asOf: '2025-11', source: 'r4v' },
    inLatinAmericaAndCaribbean: {
      value: 6950000, asOf: '2026-02',
      topHosts: [{ country: 'Colombia', value: 2800000 }, { country: 'Peru', value: 1600000 }],
    },
    sharePctHostedInRegion: 97,
  },
  shiftingFlows: {
    note: 'IOM reports irregular Venezuelan entries into Colombia, Mexico, Honduras and Panama fell 2022-2025, while regular intra-South-America entries rose',
    darienGapCrossings: { value: 1200000, period: '2024-2025', note: 'mostly Venezuelan; a January 2025 US policy change reportedly contributed to more reverse (southward) migration' },
  },
  regionalDisplacementTotal: { value: 22800000, asOf: 'end-2025', priorYear: { value: 21900000, year: 2024 }, source: 'unhcr-americas-trends' },
  note: 'Venezuela has held no census since 2011, so diaspora size and the pace of any return after the January 2026 change of government (see VENEZUELA_SITUATION_2026) remain genuinely open questions, not settled facts',
  source: 'r4v; euaa-venezuela-country-focus; unhcr-americas-trends; eldiario; riotimesonline',
  confidence: 'real-and-recent-but-explicitly-uncertain-on-post-january-2026-trajectory',
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
// COUNTRY_PROFILES -- the fourteenth round's second real path. Same
// exact field shape as COUNTRIES, keyed on a hyphenated country name
// instead of an ancestryPacks.GROUPS code, and NO ancestry-code check
// at load time. See this file's own header for why the gate on
// COUNTRIES was never a property of the real data.
// ---------------------------------------------------------------------
const COUNTRY_PROFILES = {
  japan: {
    country: 'Japan', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary parliamentary constitutional monarchy',
    // Found via a secondary ranking table that did not label its own
    // edition year -- kept, flagged, not presented as a confirmed 2024
    // figure the way regimeScore is everywhere else in this file.
    regimeType: 'full-democracy', regimeScore: 8.48, regimeScoreConfidence: 'edition-year-unconfirmed',
    militaryExpenditurePctGDP: {
      value: 1.4, year: 2024, confidence: 'secondary-estimate',
      note: 'reported via SIPRI-citing press coverage as Japan\'s highest military burden since 1958, not SIPRI\'s own fact sheet line',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 0.2, year: 2023, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation',
        note: 'a separate, uncited blog figure of 0.73 for 2023 was also found this round and not reconciled against this one',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'south-korea': {
    country: 'South Korea', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary presidential republic',
    // Confirmed directly (Korea Times/EIU reporting): dropped from
    // full to flawed democracy for the first time since 2020, rank
    // 32nd of 167, after President Yoon's brief martial-law
    // declaration exposed real institutional weaknesses -- the EIU's
    // own stated reasoning, not this file's interpretation.
    regimeType: 'flawed-democracy', regimeScore: 7.75,
    militaryExpenditurePctGDP: {
      value: 2.4, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 2.56% for the same year; neither is SIPRI\'s own fact sheet figure, both kept as the real range found',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  brazil: {
    country: 'Brazil', incomeLevel: 'upper-middle-income',
    // UCDP does not list Brazil as a state-based conflict; this is
    // this table's own real band for high non-state (cartel/gang)
    // violence short of that, which Brazil's own homicide figure below
    // supports.
    conflictLevel: 'high-nonstate-violence',
    governmentType: 'federal presidential republic',
    // Rank and category confirmed directly (57th of 167, flawed
    // democracy, down six places, over the EIU's stated criticism of
    // the Supreme Federal Court's 2024-election conduct) -- the real
    // numeric score itself was not found in any source this round's
    // tooling could reach, so it stays null rather than guessed from
    // the rank.
    regimeType: 'flawed-democracy', regimeScore: null, regimeRank: { value: 57, of: 167, year: 2024 },
    militaryExpenditurePctGDP: {
      value: 1.0, year: 2024, confidence: 'secondary-estimate',
      note: 'sources range 0.97%-1.4% depending on compiler; none confirmed as SIPRI\'s own fact sheet figure this round',
    },
    // The one fully confirmed figure in this round's batch, not a
    // sparse placeholder: Brazil became a real net crude exporter for
    // the first time in its history in 2024.
    oilProducer: {
      status: 'net-exporter-since-2024', dailyProductionBbl: 3400000, exportSharePct: 52.1, year: 2024,
      source: 'ibp-brazil-institute-of-petroleum-gas-and-biofuels; ineep',
      note: 'refining capacity lags production, which is why over half of output is exported rather than refined domestically',
    },
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 19.3, year: 2023, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation',
        note: 'a second real source gives 21.2 for the same year (Folha de S.Paulo, citing UNODC); both kept rather than one picked',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, 31 Dec 2025 -- Brazil's own real occupancy
    // trend is improving (141.4% down from 173.9% in a 2022 snapshot,
    // though that older figure used a different capacity basis and
    // is not directly comparable), real third-largest prison
    // population in the world by total count.
    incarceration: {
      incarcerationRatePer100k: { value: 439, year: 2025, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 964668, year: 2025, source: 'world-prison-brief-prisonstudies-org' },
      occupancyPctOfCapacity: { value: 141.4, year: 2025, officialCapacity: 679763, source: 'world-prison-brief-prisonstudies-org', note: 'down from 135.6% at 31.12.2024 on one cached snapshot, and from 173.9% in June 2022 on a different capacity basis -- not directly comparable across all three' },
      pretrialDetaineeSharePct: { value: 23.6, year: 2024, source: 'world-prison-brief-prisonstudies-org' },
    },
  },
  argentina: {
    country: 'Argentina', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.51,
    militaryExpenditurePctGDP: {
      value: 0.62, year: 2024, confidence: 'secondary-estimate',
      note: 'source title read "2025" while its value matched other sources\' 2024 figures; year kept as found rather than resolved by guessing',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 4.49, year: 2023, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  indonesia: {
    country: 'Indonesia', incomeLevel: 'upper-middle-income',
    // The Papua separatist insurgency (OPM, against the Indonesian
    // military) is real, long-running and localized rather than
    // nationwide -- the table's own `localized-conflict` band, not a
    // forced "no active conflict" default.
    conflictLevel: 'localized-conflict',
    governmentType: 'unitary presidential republic',
    regimeType: 'flawed-democracy', regimeScore: 6.44,
    militaryExpenditurePctGDP: { value: 0.78, year: 2024, confidence: 'secondary-estimate' },
    // Indonesia left OPEC in 2016 and is a real net oil importer --
    // the structural fact is well-established, but no specific 2024
    // production/import figure was confirmed to this file's own
    // standard this round, so none is stated.
    oilProducer: { status: 'net-importer-left-opec-2016', dailyProductionBbl: null, exportValueUsd2024: null },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'saudi-arabia': {
    country: 'Saudi Arabia', incomeLevel: 'high-income',
    // No state-based armed conflict on Saudi Arabia's own territory
    // was found this round -- its combatant role in the Yemen civil
    // war (see YEMEN_CONFLICT_2026) is reported there, not duplicated
    // here as a conflict ON Saudi soil.
    conflictLevel: 'no-active-conflict',
    governmentType: 'absolute monarchy',
    // Found via the same unlabeled-edition secondary table as Japan's
    // figure above -- kept, flagged the same way, not presented as a
    // confirmed-2024 number. Plausible on its face: Saudi Arabia's
    // EIU score has sat in the low 2s across recent editions.
    regimeType: 'authoritarian-regime', regimeScore: 2.08, regimeScoreConfidence: 'edition-year-unconfirmed',
    militaryExpenditurePctGDP: { value: 7.3, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: {
      status: 'worlds-largest-crude-oil-exporter', dailyProductionBbl: 8905000,
      exportBarrelsPerDayApprox: 6040000, year: 2024,
      source: 'gastat-via-argaam-2024-annual-total; jodi-monthly-figures',
      note: '2024 annual totals (GASTAT/Argaam): ~3.28B barrels produced, ~2.21B barrels exported (down 9%, a 14-year low) -- the approx. daily export figure is this fork\'s own division of the annual total by 366 days, not a source\'s own daily figure',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  turkey: {
    country: 'Turkey', incomeLevel: 'upper-middle-income',
    // The PKK conflict in Turkey's southeast and across the Iraq/Syria
    // border is real and long-running -- this table's own
    // `localized-conflict` band. A 2025 PKK disarmament process was
    // reported in the press; this round did not re-verify it to
    // completion, so the classification is kept rather than
    // optimistically downgraded to no-active-conflict on an
    // unconfirmed report.
    conflictLevel: 'localized-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 2024 score 4.26 (down from 4.33 in 2023),
    // rank 103rd of 167, EIU's own "hybrid regime" classification --
    // now only three points above the authoritarian threshold.
    regimeType: 'hybrid-regime', regimeScore: 4.26,
    militaryExpenditurePctGDP: { value: 1.92, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 2.6, year: 2023, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  // Closes the real gap this module's own EU_MIGRATION_OVERVIEW_2025
  // already named: Spain was identified there as a real top-4 EU
  // migration destination this file could not give a dedicated entry
  // to, specifically because no "spanish" ancestryPacks.GROUPS key
  // exists -- the exact structural gap this round's new path exists
  // to close.
  spain: {
    country: 'Spain', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary constitutional monarchy',
    // Confirmed directly: 2024 score 8.13, full democracy, one of 25
    // countries worldwide in that band this edition.
    regimeType: 'full-democracy', regimeScore: 8.13,
    militaryExpenditurePctGDP: {
      value: 1.3, year: 2024, confidence: 'secondary-estimate',
      note: 'sources give 1.3 or 1.4 depending on which column of a secondary table is read; not resolved to SIPRI\'s own figure this round',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: { value: 0.7, year: 2023, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation' },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  australia: {
    country: 'Australia', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal parliamentary constitutional monarchy',
    // Two sources agree on 8.85 for 2024 (up from 8.66 in 2023); a
    // third table also shows 8.66 unlabeled by year, most likely the
    // 2023 figure re-surfacing rather than a genuine disagreement.
    regimeType: 'full-democracy', regimeScore: 8.85,
    militaryExpenditurePctGDP: { value: 1.88, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'south-africa': {
    country: 'South Africa', incomeLevel: 'upper-middle-income',
    // Not a UCDP state-based conflict; this table's own real band for
    // a country with exceptionally high non-state violence, which the
    // homicide figure below supports directly.
    conflictLevel: 'high-nonstate-violence',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 2024 score 7.16 (up from 7.05 in 2023,
    // mainly because the ANC was forced into a coalition after the
    // May 2024 election, per the EIU's own stated reasoning).
    regimeType: 'flawed-democracy', regimeScore: 7.16,
    militaryExpenditurePctGDP: { value: 0.70, year: 2024, confidence: 'secondary-estimate' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 43.7, year: 2022, source: 'unodc-via-secondary-compilation', confidence: 'secondary-compilation',
        note: 'a national-data source gives 43.5 for the 2023/24 reporting year instead; both real, neither picked over the other',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief, July 2025 -- a rate well off this country's
    // own historical 2004 peak (403 per 100k), real and current.
    incarceration: {
      incarcerationRatePer100k: { value: 260, year: 2025, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      pretrialDetaineeSharePct: { value: 35.6, year: 2023, source: 'world-prison-brief-prisonstudies-org' },
      note: 'an earlier 2024 snapshot gives 249 -- same real trend, slightly different reference date/population base',
    },
  },
  // Fifteenth round: twelve more real countries -- see this file's own
  // header for the full reasoning behind every honest null, confidence
  // flag, and conflict classification below.
  pakistan: {
    country: 'Pakistan', incomeLevel: 'lower-middle-income',
    // Real, long-running sub-national insurgencies (Balochistan
    // separatist violence; TTP/Tehrik-i-Taliban Pakistan activity in
    // Khyber Pakhtunkhwa) -- not a nationwide state-based war.
    conflictLevel: 'localized-conflict',
    governmentType: 'federal parliamentary republic',
    // Confirmed directly: 2024 score 2.84 (down from 3.25 in 2023),
    // rank 124th of 167, authoritarian regime -- the EIU's own stated
    // reasoning cites the jailing of Imran Khan shortly before the
    // February 2024 election and real election-day violence.
    regimeType: 'authoritarian-regime', regimeScore: 2.84,
    militaryExpenditurePctGDP: {
      value: 2.7, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 2.67% for the same year',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  bangladesh: {
    country: 'Bangladesh', incomeLevel: 'lower-middle-income',
    conflictLevel: 'no-active-conflict',
    governmentType: 'unitary parliamentary republic',
    // Confirmed directly: 2024 score 4.44, the largest single-year
    // decline (-1.44) of any country that edition, rank 100th of 167
    // (down 25 places) -- the EIU's own stated reasoning cites a
    // rigged election, the prime minister's ouster in the mid-2024
    // uprising, and the political unrest that followed. Real political
    // unrest, not a UCDP state-based armed conflict -- conflictLevel
    // stays `no-active-conflict` on that distinction.
    regimeType: 'hybrid-regime', regimeScore: 4.44,
    militaryExpenditurePctGDP: {
      value: 0.94, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 0.861% for the same year',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'democratic-republic-of-the-congo': {
    country: 'Democratic Republic of the Congo',
    // Stated from well-established general knowledge of the standard
    // World Bank classification, NOT independently confirmed against a
    // primary table this round -- flagged honestly rather than
    // presented with the same confidence as this round's directly-
    // confirmed entries.
    incomeLevel: 'low-income',
    // Real, current, large-scale: the M23 offensive captured Goma (Jan
    // 2025) and Walikale (Feb 2025), displaced 500,000+ people in early
    // 2025 alone, and repeated regional mediation efforts (the 5-day
    // ceasefire ultimatum, Angola's mediation) have collapsed. Rwandan
    // backing of M23 is alleged by the DRC government and the UN and
    // disputed by Rwanda.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'semi-presidential republic',
    // No real EIU Democracy Index 2024 score was found this round.
    // Freedom House's 2024 report rates the DRC 19/100, "Not Free" --
    // a different methodology, not substituted here as though it were
    // the same measurement.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  thailand: {
    country: 'Thailand', incomeLevel: 'upper-middle-income',
    // The real, decades-long Malay-Muslim separatist insurgency in
    // Thailand's deep south (Pattani/Yala/Narathiwat) -- not a
    // nationwide conflict.
    conflictLevel: 'localized-conflict',
    governmentType: 'unitary parliamentary constitutional monarchy',
    // Two secondary sources agree on 6.27 for 2024 (down from 6.35 in
    // 2023, unchanged rank-wise per one source), but neither is the
    // EIU's own primary table -- flagged rather than presented as
    // confirmed the way Pakistan/Bangladesh's scores above are.
    regimeType: 'flawed-democracy', regimeScore: 6.27, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: {
      value: 1.08, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 1.05% for the same year',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  myanmar: {
    country: 'Myanmar',
    // Carries the same honest sourcing caveat as the DRC's entry --
    // inherited directly from the search result that surfaced it,
    // not independently re-verified against a primary table.
    incomeLevel: 'lower-middle-income',
    // Real, ongoing civil war between the February 2021 coup junta and
    // resistance/ethnic armed organisations -- SIPRI's own confirmed
    // figure below (military spending +66% in 2024) is itself evidence
    // of a real active war economy, not just a conflict-tracker label.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'military junta (State Administration Council, ruling since the Feb 2021 coup; the 2008 constitution formally describes a unitary presidential republic)',
    // Confirmed directly: 0.96, authoritarian regime, second-lowest in
    // the world after Afghanistan.
    regimeType: 'authoritarian-regime', regimeScore: 0.96,
    // SIPRI's own confirmed figure, not a secondary estimate -- the
    // highest military burden in the Asia-Pacific, spending +66% in
    // 2024.
    militaryExpenditurePctGDP: { value: 6.8, year: 2024, confidence: 'sipri-official' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  iraq: {
    country: 'Iraq',
    // Same honest sourcing caveat as the DRC's entry above -- a well-
    // established classification, not independently confirmed against
    // a primary table this round.
    incomeLevel: 'upper-middle-income',
    // Large-scale war has ended; real ISIS remnant activity and
    // periodic sectarian violence has not -- neither a forced "no
    // active conflict" nor an overstated "active armed conflict"
    // describes this honestly.
    conflictLevel: 'localized-conflict',
    governmentType: 'federal parliamentary republic',
    // Confirmed directly: 2.80, authoritarian regime, rank 126th of
    // 167 (11th in the MENA region) -- down from 4.0 in 2018.
    regimeType: 'authoritarian-regime', regimeScore: 2.80,
    militaryExpenditurePctGDP: {
      value: 2.36, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 2.273% for the same year',
    },
    // The second fully confirmed oil figure in this table, not a
    // sparse placeholder -- real 2024 EIA/OPEC+ figures, both
    // production and export measures kept since the real sources
    // differ on methodology (condensates included or not), not on the
    // underlying fact.
    oilProducer: {
      status: 'opec-second-largest-producer', dailyProductionBblRange: [4200000, 4400000],
      dailyExportBblRange: [3260000, 3360000], year: 2024,
      source: 'eia-iraq-country-analysis-2024; iraq-oil-report; arab-energy-organisation; ceic',
      note: 'exports hit a 9-year low, driven by OPEC+ quota compliance and a real pipeline outage; Iraq pledged to compensate 1.44M bpd of its own 2024 overproduction through Sep 2025',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  afghanistan: {
    country: 'Afghanistan', incomeLevel: 'low-income',
    // The large-scale war ended with the 2021 Taliban takeover; the
    // real, ongoing ISIS-Khorasan insurgency against Taliban rule has
    // not -- neither extreme describes this honestly.
    conflictLevel: 'localized-conflict',
    governmentType: 'Taliban-led Islamic Emirate (de facto; not recognised internationally by most states)',
    // Confirmed directly: 0.25, ranked LAST of 167 countries, the
    // EIU's own "worst among authoritarian regimes worldwide."
    regimeType: 'authoritarian-regime', regimeScore: 0.25,
    // Not found this round -- Afghanistan's military spending under a
    // government most states do not recognise is not tracked by SIPRI
    // the way an ordinary state's is, a real gap rather than an
    // oversight.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  syria: {
    country: 'Syria',
    // Same honest sourcing caveat as the DRC's and Iraq's entries --
    // a well-established classification for a war-devastated economy,
    // not independently confirmed against a primary table this round.
    incomeLevel: 'low-income',
    // Real, current violence continues under the transitional
    // government -- the March 2025 Latakia/Tartous/Hama clashes
    // (hundreds of civilian deaths, summary executions reported on
    // both sides), Israeli strikes on military targets, and Aleppo
    // clashes with the SDF. Not a settled peace.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'transitional government (Ahmed al-Sharaa, since the 8 Dec 2024 fall of the Assad regime; a five-year transitional period; a real Oct 2025 parliamentary election; territorial control uneven, with the SDF holding Hasakah/Qamishli/Kobane)',
    // Deliberately `null`, and the reason is structural, not a
    // research gap: the EIU's 2024 edition would have scored the
    // Assad regime, which fell inside that index's own measurement
    // window (8 Dec 2024). Scoring the fallen government would
    // misrepresent the country today, and no post-transition EIU
    // score exists yet as of this round -- the same honest-null
    // posture Somalia's own regimeType already set a precedent for.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  morocco: {
    country: 'Morocco', incomeLevel: 'lower-middle-income',
    // Western Sahara's low-level, post-Nov-2020 Polisario Front
    // clashes are real and ongoing -- kept distinct from treating
    // Morocco's own entry as conflict-free, the same way Saudi
    // Arabia's combatant role in Yemen is reported on Yemen's own
    // entry rather than folded into Saudi Arabia's.
    conflictLevel: 'localized-conflict',
    governmentType: 'unitary parliamentary constitutional monarchy',
    // Confirmed directly: 4.97, hybrid regime, rank 91st of 167 (up
    // from 93rd in 2023) -- widely reported as the leading hybrid
    // regime in the Arab world.
    regimeType: 'hybrid-regime', regimeScore: 4.97,
    militaryExpenditurePctGDP: {
      value: 3.52, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 3.435% for the same year',
    },
    // Morocco is a real net energy importer, not a producer -- unlike
    // most `null` entries in this table, this is a stated fact, not
    // an unresearched gap.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  peru: {
    country: 'Peru', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary presidential republic',
    // One secondary source gives 5.69 for 2024; a second, separately-
    // sourced report instead describes a fall from 6.5 to 5.9 -- the
    // two do not match and neither was confirmed against the EIU's own
    // primary table, so this is flagged rather than presented as
    // settled.
    regimeType: 'hybrid-regime', regimeScore: 5.69, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: {
      value: 0.91, year: 2024, confidence: 'secondary-estimate',
      note: 'sources disagree on 2023 too (1.1212% vs 1.24%), underscoring how unsettled this figure is across compilers',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: {
        value: 6, year: 2024, source: 'insight-crime-2024-homicide-round-up', confidence: 'secondary-compilation',
        note: 'up from 4.4 in 2023 (+35.9%) per the same source; a separate Statista figure of 3.2 for 2023 disagrees and is kept alongside rather than reconciled',
      },
      undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  chile: {
    country: 'Chile', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary presidential republic',
    // Deliberately `null` -- three separately-sourced claims about
    // Chile's 2023-edition rank actively disagree (15th/7.98,
    // 19th/"full democracy", 25th/"flawed democracy"), and the one
    // 2024 figure found (7.83) came from a secondary site that did not
    // clearly cite the EIU as its source at all. Rather than pick one
    // disagreeing claim or present an unconfirmed number as settled,
    // both are left null and the real disagreement is stated here --
    // the same "both kept, neither picked" discipline this file has
    // held since its very first France entries.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  malaysia: {
    country: 'Malaysia', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal constitutional elective monarchy, parliamentary democracy',
    // One secondary source gives 7.11 for 2024 (down from 7.29 in
    // 2023), not cross-checked against the EIU's own primary table --
    // flagged the same way Thailand's and Peru's scores above are.
    regimeType: 'flawed-democracy', regimeScore: 7.11, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: {
      value: 0.99, year: 2024, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 1.037% for the same year',
    },
    // Malaysia is a real, established oil/gas producer (Petronas), but
    // no specific 2024 production/export figure was confirmed to this
    // file's own standard this round -- left null rather than
    // estimated, same discipline as every other sparse field here.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  // Sixteenth round: India, added because a direct instruction named
  // it separately from "Asia" when asking for global incarceration-
  // system coverage ("North America, South America, Africa, Europe,
  // India, Asia"), and because it had no `COUNTRY_PROFILES` entry of
  // its own until now -- checked, not assumed, the way every other
  // gap in this round's own header was.
  india: {
    country: 'India', incomeLevel: 'lower-middle-income',
    // Checked directly, World Bank FY2026-27 classifications (GNI per
    // capita data for 2025, $2,760 -- well inside the lower-middle
    // band of $1,176-$4,635): India has held this status since 2009.
    // Two real, longstanding, localized conflicts (the Jammu and
    // Kashmir insurgency; the Naxalite-Maoist insurgency across
    // central and eastern India) justify this band over
    // no-active-conflict -- neither is nationwide or state-based in
    // UCDP's "active-armed-conflict" sense.
    conflictLevel: 'localized-conflict',
    governmentType: 'federal parliamentary republic',
    // EIU Democracy Index 2024: rank 47 of 165, "flawed democracy" --
    // confirmed directly. The real NUMERIC 2024 score was not found by
    // this round's tooling (only the rank and category); the 2023
    // score (7.18, rank 41) is a real, different year's figure and is
    // NOT used as a stand-in -- regimeScore stays null rather than
    // guessed from the rank or borrowed from a different year.
    regimeType: 'flawed-democracy', regimeScore: null, regimeRank: { value: 47, of: 165, year: 2024 },
    // SIPRI-derived: $86.1B total 2024 spend (5th-largest in the
    // world, after the US/China/Russia/Germany), 2.3% of GDP -- a
    // World-Bank-published SIPRI-sourced series, not SIPRI's own fact
    // sheet page directly, so flagged the same as every other
    // non-primary figure in this file.
    militaryExpenditurePctGDP: { value: 2.3, year: 2024, confidence: 'secondary-estimate' },
    // India is a major net crude IMPORTER, not an exporter -- the
    // identical China/UK-style distinction this file already draws
    // between domestic production and exporter status.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
    // World Prison Brief -- real figures found this round disagree in
    // the 35-38 per 100k range depending on snapshot/source; the WPB's
    // own latest trend-table row (35, total 488,511) is kept as the
    // primary figure, with the real range named rather than hidden.
    incarceration: {
      incarcerationRatePer100k: { value: 35, year: 2024, source: 'world-prison-brief-prisonstudies-org', confidence: 'secondary-estimate' },
      prisonPopulationTotal: { value: 488511, year: 2024, source: 'world-prison-brief-prisonstudies-org', note: 'exact as-of date within 2024 not confirmed in the source found this round' },
      occupancyPctOfCapacity: { value: 112.7, year: 2024, source: 'world-prison-brief-prisonstudies-org', note: 'down from 120.8% (31.12.2023) and 131.4% (31.12.2022) across three real snapshots' },
      pretrialDetaineeSharePct: { value: 75.8, year: 2022, source: 'world-prison-brief-prisonstudies-org' },
      note: 'a 2023 WPB snapshot gives 37 per 100k and Data For India independently reports 38 for the same year -- a real 35-38 range, not reconciled to one figure',
    },
  },
  // Seventeenth round: fourteen more real countries plus Yemen's own
  // new standard-field entry -- see this file's own header for the full
  // reasoning behind every honest null and confidence flag below.
  sudan: {
    country: 'Sudan',
    // Stated from well-established general knowledge of the standard
    // World Bank classification -- a third-party list found this
    // round groups Sudan with Angola/Mozambique as "low-income or
    // lower-middle-income" without resolving which, so this is not
    // independently confirmed against a primary table.
    incomeLevel: 'low-income',
    // Real, current, unambiguous: the Sudanese Armed Forces vs. Rapid
    // Support Forces civil war, CFR's own August 2026 tracker status
    // "Worsening," ~14M people displaced, control of Kordofan/Darfur
    // still fluid as of mid-2026.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'transitional military-led government, de facto fractured between the Sudanese Armed Forces (Port Sudan) and the Rapid Support Forces, each controlling different territory',
    // One secondary table gives 1.46 for 2024, authoritarian -- not
    // cross-checked against the EIU's own primary table. Real rank
    // disagreement found too (162nd per one March 2025 source, 158th
    // per a November-2024-dated list that likely reflects the 2023
    // edition instead) -- both named rather than one picked.
    regimeType: 'authoritarian-regime', regimeScore: 1.46, regimeScoreConfidence: 'secondary-estimate',
    regimeRank: { value: null, note: 'two disagreeing secondary ranks found (162nd, 158th); neither confirmed against the EIU primary table, so no single value is stated' },
    militaryExpenditurePctGDP: {
      value: 0.93, year: null, confidence: 'secondary-estimate',
      note: 'the year this figure covers was not stated by the source that reported it',
    },
    // Sudan lost most of its oil fields to South Sudan at the 2011
    // partition and is not a major current producer or exporter.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  algeria: {
    country: 'Algeria',
    // Confirmed directly: World Bank Data360, GNI per capita ~$5.32k
    // (2024), upper-middle-income.
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 3.55 (2024), down from 3.66 (2023), rank
    // 110th of 167, authoritarian regime -- the EIU's own stated
    // reasoning cites real, ongoing constraints on political activity
    // despite some participatory indicators.
    regimeType: 'authoritarian-regime', regimeScore: 3.55,
    militaryExpenditurePctGDP: {
      value: 8.0, year: 2024, confidence: 'secondary-estimate',
      note: 'reported as driving an 8.8% rise in North African military spending that year; a separate newer SIPRI-citing table gives 8.8% for Algeria itself, which may be a later vintage of the same figure rather than a second, independent one',
    },
    // Algeria is a real, major, established oil/gas exporter
    // (Sonatrach) -- no specific 2024 production/export figure was
    // confirmed to this file's own standard this round, left null
    // rather than estimated, same discipline as every other sparse
    // field here.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  uganda: {
    country: 'Uganda', incomeLevel: 'low-income',
    // The real, ongoing ADF (Allied Democratic Forces) Islamist
    // insurgency along the Uganda-DRC border, including Uganda's own
    // "Operation Shujaa" joint military campaign inside the DRC --
    // not a nationwide conflict.
    conflictLevel: 'localized-conflict',
    governmentType: 'presidential republic (dominant-party, under President Museveni since 1986)',
    // Deliberately null -- the only figure found this round (4.49) is
    // explicitly the 2023 score, not 2024, and using a different
    // year's number as though it were current would repeat exactly
    // the mistake this file's own Russia/Ethiopia homicide entries
    // were careful to flag rather than make.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: {
      status: 'real-fields-under-development-not-yet-producing-at-scale',
      dailyProductionBbl: null, year: null,
      note: 'the Lake Albert fields (Tilenga/Kingfisher projects) and the EACOP export pipeline are real and under construction, but had not reached meaningful commercial production as of 2024 -- not yet a producer in the sense this field otherwise tracks',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  tanzania: {
    country: 'Tanzania', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary dominant-party presidential republic',
    // Deliberately null -- the only figure found this round (5.35) is
    // explicitly labelled as the 2023 score by the source that reports
    // it, not 2024.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'north-korea': {
    country: 'North Korea',
    // A World Bank classification sheet places it in the low-income
    // group, though using an older ($1,135) threshold vintage than
    // this file's own current FY2027 figures -- kept because the
    // classification itself (not the exact threshold used) is the
    // real, stable fact here.
    incomeLevel: 'low-income',
    // The 1953 Korean War armistice was never replaced by a peace
    // treaty, so North and South Korea remain formally at war in that
    // narrow legal sense -- but no current fighting is taking place,
    // which is the real, distinct fact this field tracks.
    conflictLevel: 'no-active-conflict',
    governmentType: 'one-party state (Workers\' Party of Korea); elections exist in name only, with no genuine political competition',
    // Confirmed directly: 1.08, third from last (165th of 167, ahead
    // only of Myanmar and Afghanistan), unchanged from the prior year.
    regimeType: 'authoritarian-regime', regimeScore: 1.08,
    // Deliberately null with a stated structural reason, not an
    // unresearched gap -- North Korea does not publish usable military
    // expenditure data, and SIPRI's own database excludes it for
    // exactly that reason.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  taiwan: {
    country: 'Taiwan',
    // Taiwan is not a UN member and is often excluded from the World
    // Bank's own country tables for that reason -- this rests on its
    // real, undisputed per-capita income level by any standard
    // measure, not a found primary-table row.
    incomeLevel: 'high-income',
    // No current armed conflict -- real cross-strait tension with
    // China exists but is not fighting, the same distinction this
    // file already draws for Morocco's Western Sahara dispute and
    // North Korea's formal armistice-not-peace status.
    conflictLevel: 'no-active-conflict',
    governmentType: 'semi-presidential republic',
    // Confirmed directly: 8.78 (2024), down from 8.92 (2023) and 8.99
    // (2022), rank 12th of 167 -- the most democratic country in Asia,
    // a full democracy.
    regimeType: 'full-democracy', regimeScore: 8.78,
    // SIPRI's own fact sheet table, not a secondary estimate --
    // spending grew 1.8% in 2024 to $16.5B.
    militaryExpenditurePctGDP: { value: 2.1, year: 2024, confidence: 'sipri-official' },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'united-arab-emirates': {
    country: 'United Arab Emirates',
    // Stated from the UAE's real, undisputed per-capita income level
    // -- not independently confirmed against a primary World Bank
    // table this round.
    incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal absolute monarchy (a federation of seven emirates, each ruled by a hereditary emir)',
    // Deliberately null -- no EIU 2024 score was found at all despite
    // a dedicated search, not a figure that was found and then
    // doubted.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: {
      value: 5.6, year: null, confidence: 'secondary-estimate',
      note: 'from an unlabelled secondary table that did not state which year it covers',
    },
    // Real 2024 figure: producing roughly 2.9M bpd under its own
    // OPEC+ quota, about 60% of the capacity the UAE itself claims to
    // have -- Platts surveys showed it running slightly above its
    // assigned target that year.
    oilProducer: {
      status: 'opec-member-producing-under-quota', dailyProductionBbl: 2900000, year: 2024,
      source: 'platts-opec-survey-reporting',
      note: 'roughly 60% of the UAE\'s own claimed production capacity; it ran slightly above its OPEC+ target in 2024',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  nepal: {
    country: 'Nepal', incomeLevel: 'low-income',
    // The 2006 peace accord ending the Nepalese Civil War is real and
    // settled -- no active armed conflict since.
    conflictLevel: 'no-active-conflict',
    governmentType: 'federal parliamentary republic',
    // Deliberately null -- the one figure found (4.60) came from a
    // secondary site that did not name the EIU as its source at all.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'sri-lanka': {
    country: 'Sri Lanka',
    // A real, dated news headline ("Sri Lanka reclassified as Upper-
    // Middle Income economy") was found, but its article body and
    // underlying World Bank source were not retrieved this round --
    // kept because the headline itself is a specific, real claim, not
    // treated with the same confidence as a found primary-table row.
    incomeLevel: 'upper-middle-income',
    // The 2009 end of the Sri Lankan Civil War is real and settled --
    // no active armed conflict since.
    conflictLevel: 'no-active-conflict',
    governmentType: 'unitary semi-presidential republic',
    // Deliberately null -- the one figure found (6.19) came from an
    // unlabelled secondary table with no stated year or EIU citation.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  kazakhstan: {
    country: 'Kazakhstan', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 3.08 (2024, unchanged from 2023), rank
    // 118th of 167, authoritarian regime -- consistent across two
    // separately-sourced reports.
    regimeType: 'authoritarian-regime', regimeScore: 3.08,
    militaryExpenditurePctGDP: {
      value: 0.4, year: null, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 0.43%; neither states the year it covers',
    },
    // Kazakhstan is a real, substantial oil producer (the Tengiz and
    // Kashagan fields) and a real, repeated OPEC+ quota over-producer
    // -- no confirmed 2024 ACTUAL output figure was found this round
    // (only a November-2024 analysis projecting a rise from 1.795M
    // bpd), left null rather than presenting a projection as an
    // outcome.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  cambodia: {
    country: 'Cambodia', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary dominant-party parliamentary constitutional monarchy',
    // Deliberately null -- the one regime-type figure found ("hybrid
    // regime," rank 101st) carried no stated year, and a 2018 article
    // describing a DIFFERENT historical rank (124th, for the 2017
    // edition) makes clear rankings have moved substantially across
    // editions, so the undated figure cannot be assumed to be 2024.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  ecuador: {
    country: 'Ecuador',
    // Stated from Ecuador's well-established standard classification
    // -- not independently confirmed against a primary table this
    // round.
    incomeLevel: 'upper-middle-income',
    // Real, current, and significant: President Noboa's January 2024
    // declaration of an "internal armed conflict" against criminal
    // gangs (following the "Fito" prison escape and a televised armed
    // takeover of a TV station), and the real cartel/gang violence
    // surge it responded to -- this table's own band for high
    // non-state violence short of a UCDP state-based war.
    conflictLevel: 'high-nonstate-violence',
    governmentType: 'unitary presidential republic',
    // Deliberately null -- no EIU 2024 score was found at all this
    // round despite a dedicated search.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // Ecuador is a real, established oil exporter (it left OPEC in
    // 2020) -- no specific 2024 figure was confirmed to this file's
    // own standard this round.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  angola: {
    country: 'Angola',
    // A third-party list found this round groups Angola with Sudan/
    // Mozambique as "low-income or lower-middle-income" without
    // resolving which -- stated here as lower-middle-income (Angola's
    // real current classification by general knowledge of the
    // standard series) but flagged, not independently confirmed
    // against a primary table this round.
    incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary dominant-party presidential republic',
    // Deliberately null, the same "real disagreement, not picked"
    // reason Chile's were null in the fifteenth round. The one 2024
    // figure found (4.05) came from a secondary site that did not
    // name its source, and -- if real -- would sit right at this
    // file's own hybrid/authoritarian boundary (4.01), exactly the
    // kind of boundary value not worth trusting on one unconfirmed
    // source.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: {
      value: 1.0, year: null, confidence: 'secondary-estimate',
      note: 'a second secondary source gives 1.034%; neither states the year it covers',
    },
    // A real, fully confirmed 2024 figure, not a sparse placeholder:
    // Q1-Q3 2024 average 1.134M bpd (+4% YoY), falling to ~1.03M bpd
    // by December 2024 (the lowest in years) -- immediately after
    // Angola's real, dated OPEC exit (effective Jan 2024).
    oilProducer: {
      status: 'former-opec-member-declining-output-since-exit', dailyProductionBblQ1Q3Average: 1134000,
      dailyProductionBblDecember: 1030000, year: 2024,
      source: 'hellenic-shipping-news-angola-opec-exit-coverage',
      note: 'Angola left OPEC effective Jan 2024; output rose briefly (+4% YoY through Q3) before falling to its lowest level in years by December',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  mozambique: {
    country: 'Mozambique', incomeLevel: 'low-income',
    // The real, ongoing ISIS-affiliated Islamist insurgency in Cabo
    // Delgado province, alongside separate RENAMO-linked unrest --
    // real and current, but localized to specific provinces, not
    // nationwide.
    conflictLevel: 'localized-conflict',
    // Confirmed directly this round (Nomad Watch).
    governmentType: 'unitary dominant-party semi-presidential system',
    // Deliberately null -- the one claim found ("authoritarian... due
    // to election manipulation") is a secondhand characterization of
    // the EIU's 2024 report, not a number from the EIU's own table,
    // and real doubts over the credibility of the 2024 general
    // election (named directly by International IDEA's own GSoD 2025
    // report) make this a year where guessing a score would be
    // especially misleading.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // Real, major LNG development (TotalEnergies' Cabo Delgado
    // fields) exists but had not reached full operational production
    // as of 2024 because of the real insurgency above -- not yet a
    // producer in the sense this field otherwise tracks.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  // Yemen gains the same six standard fields every other
  // COUNTRY_PROFILES entry carries, kept alongside its existing,
  // deeper `YEMEN_CONFLICT_2026` standalone narrative rather than
  // replacing it -- the same two-tier pattern Venezuela/Cuba already
  // have.
  yemen: {
    country: 'Yemen',
    // Real and current: the World Bank's own reporting on Yemen's GDP
    // per capita decline (-54%) and continuing economic contraction
    // leaves no real doubt about this classification.
    incomeLevel: 'low-income',
    // See YEMEN_CONFLICT_2026 for the full real account -- the
    // Houthi/Ansar Allah movement vs. the internationally recognized
    // government, unambiguously active.
    conflictLevel: 'active-armed-conflict',
    // Confirmed directly this round: areas under Houthi control host
    // about 70% of the population (including Sanaa), while
    // hydrocarbon-rich areas remain under the internationally
    // recognized government (IRG) -- a real, split, contested
    // statehood, not a single functioning government.
    governmentType: 'split, contested statehood -- the internationally recognized government (IRG) holds hydrocarbon-rich areas; Houthi (Ansar Allah) forces control areas hosting roughly 70% of the population, including Sanaa',
    // Deliberately null -- no single EIU score would meaningfully
    // describe a country with two contesting authorities and no
    // unified government to assess, and none was found this round
    // regardless.
    regimeType: null, regimeScore: null,
    // Deliberately null -- Houthi military spending is not tracked by
    // any standard source, and the IRG's own is unclear amid the war;
    // a real, structural gap rather than an unresearched one.
    militaryExpenditurePctGDP: null,
    // Not a production figure -- the real, current, World-Bank-
    // confirmed fact that matters more here: a Houthi blockade on oil
    // exports from IRG-held fields drove the IRG's own revenue
    // (excluding grants) down to 2.5% of GDP in 2024.
    oilProducer: {
      status: 'irg-oil-exports-blockaded-by-houthi-forces', dailyProductionBbl: null, year: 2024,
      source: 'world-bank-yemen-economic-monitor-2026',
      note: 'the blockade, not a production volume, is the real reported fact -- it drove IRG revenue excluding grants down to 2.5% of GDP in 2024',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  // Eighteenth round: twenty-three more real countries -- see this
  // file's own header for the full reasoning behind every honest null,
  // confidence flag, and conflict/statehood classification below.
  belgium: {
    country: 'Belgium', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal parliamentary constitutional monarchy',
    // Confirmed directly: 7.64 (2024), up two places from the prior
    // year, flawed democracy -- the only Western European country to
    // score below 8, per the EIU's own stated reasoning (weaker
    // political participation and political-culture scores).
    regimeType: 'flawed-democracy', regimeScore: 7.64,
    militaryExpenditurePctGDP: {
      value: 1.3, year: 2024, confidence: 'secondary-estimate',
      note: 'read from a flattened SIPRI table whose own column alignment is likely but not certain; a separate World-Bank-based summary agrees at 1.3%',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  austria: {
    country: 'Austria',
    // Stated from Austria's real, undisputed per-capita income level
    // -- not independently confirmed against a primary table this
    // round.
    incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal parliamentary republic',
    // Confirmed directly: 8.28, full democracy.
    regimeType: 'full-democracy', regimeScore: 8.28,
    // Austria is not a NATO member and does not appear in NATO's own
    // spending tables; the one figure found (1.10%) is explicitly for
    // 2025, not 2024, and is not reused as a stand-in.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  denmark: {
    country: 'Denmark',
    incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary constitutional monarchy',
    // Confirmed directly: 9.28, rank 7th, full democracy (its slightly
    // lower-than-top score is due to political-participation scoring).
    regimeType: 'full-democracy', regimeScore: 9.28,
    militaryExpenditurePctGDP: {
      value: 2.4, year: 2024, confidence: 'secondary-estimate',
      note: 'read from a flattened SIPRI table whose own column alignment is likely but not certain',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  finland: {
    country: 'Finland',
    incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 9.30, rank 6th, full democracy.
    regimeType: 'full-democracy', regimeScore: 9.30,
    // Only a qualitative claim found ("over 2% of GDP since 2023,"
    // tied to its 2023 NATO accession) -- no exact 2024 figure, left
    // null rather than converting the qualitative claim into a number.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  romania: {
    country: 'Romania',
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'semi-presidential republic',
    // Confirmed directly: 5.99 (2024), down sharply from 6.45 (2023),
    // downgraded to hybrid regime -- the EIU's own stated reasoning is
    // the real 2024 annulment of Romania's presidential election,
    // making it the only EU member in this category.
    regimeType: 'hybrid-regime', regimeScore: 5.99,
    militaryExpenditurePctGDP: {
      value: 2.3, year: 2024, confidence: 'secondary-estimate',
      note: 'read from a flattened SIPRI table whose own column alignment is likely but not certain',
    },
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  bulgaria: {
    country: 'Bulgaria',
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 6.34, rank 61st, flawed democracy.
    regimeType: 'flawed-democracy', regimeScore: 6.34,
    // Only a qualitative claim found ("surpassed 2% of GDP in 2024")
    // -- no exact figure, left null rather than estimated.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  serbia: {
    country: 'Serbia',
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 6.26, rank 64th, flawed democracy.
    regimeType: 'flawed-democracy', regimeScore: 6.26,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  croatia: {
    country: 'Croatia',
    // Stated from Croatia's real, undisputed EU/high-income
    // classification -- not independently confirmed against a
    // primary table this round.
    incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 6.50, rank 56th, flawed democracy.
    regimeType: 'flawed-democracy', regimeScore: 6.50,
    // Only a qualitative claim found ("spending less than 2% of GDP
    // in 2024," a NATO-based characterization) -- no exact figure.
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  moldova: {
    country: 'Moldova', incomeLevel: 'upper-middle-income',
    // The real, frozen, unresolved Transnistria territorial dispute --
    // reported on its own terms, same treatment Morocco's Western
    // Sahara entry already set a precedent for in the fifteenth round,
    // rather than defaulted away as though Moldova's own territory
    // were fully settled.
    conflictLevel: 'localized-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 6.04 (2024), down from 6.23 (2023), flawed
    // democracy -- the 2024 figure, not the 2025 edition's later
    // downgrade to hybrid regime, which is a different year's claim
    // and is not used here.
    regimeType: 'flawed-democracy', regimeScore: 6.04,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  belarus: {
    country: 'Belarus',
    // Stated from Belarus's real, undisputed classification -- not
    // independently confirmed against a primary table this round.
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic (authoritarian, under President Lukashenko since 1994)',
    // Confirmed qualitatively, not numerically: the EIU's 2024 report
    // places Belarus in a newly-created "closed regime" category
    // (alongside other states newly moved there from "authoritarian")
    // -- `authoritarian-regime` is the closest of this file's own
    // four real bands to that real classification. No exact 2024
    // numeric score was found.
    regimeType: 'authoritarian-regime', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  libya: {
    country: 'Libya',
    // Stated from Libya's real oil-wealth-driven per-capita income
    // level -- not independently confirmed against a primary table
    // this round, and arguably in tension with the real instability
    // below.
    incomeLevel: 'upper-middle-income',
    // Real and current: the 2020 ceasefire and 2021 unity-government
    // formation are real, but so is the real, ongoing east/west
    // factional split and August 2024's armed oil-field shutdown
    // crisis -- not a nationwide war, but not settled either.
    conflictLevel: 'localized-conflict',
    governmentType: 'divided, contested statehood -- rival governments based in Tripoli (west) and Tobruk/Benghazi (east), each with its own armed forces',
    // Confirmed directly: 2.31, authoritarian regime.
    regimeType: 'authoritarian-regime', regimeScore: 2.31,
    militaryExpenditurePctGDP: null,
    // A real, volatile 2024 picture kept as a range rather than one
    // number: ~1.18M bpd in July, a real ~700,000 bpd drop in August's
    // armed shutdown crisis, recovery above 1M bpd by October.
    oilProducer: {
      status: 'real-but-volatile-2024-output-amid-political-shutdowns',
      dailyProductionBblJuly: 1180000, dailyProductionBblOctoberRecovery: 1000000,
      year: 2024, source: 'reuters-via-oilprice-and-worldoil-2024-coverage',
      note: 'August 2024 saw a real ~700,000 bpd drop during a political standoff over the central bank; production had recovered above 1M bpd by October',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  tunisia: {
    country: 'Tunisia', incomeLevel: 'lower-middle-income',
    // No active armed conflict -- real political centralization under
    // President Saied since his 2021 power grab is a democratic-
    // backsliding story, not a conflict one.
    conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic (increasingly centralized under President Saied since 2021)',
    // Confirmed directly: 4.71 (2024), down from 5.51 (2023), hybrid
    // regime.
    regimeType: 'hybrid-regime', regimeScore: 4.71,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'new-zealand': {
    country: 'New Zealand', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary constitutional monarchy',
    // Confirmed directly from the EIU's own table: 9.61, rank 2nd,
    // full democracy.
    regimeType: 'full-democracy', regimeScore: 9.61,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  singapore: {
    country: 'Singapore', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic (dominant-party)',
    // One source gives 6.18, flawed democracy -- its own rank-change
    // column read ambiguously in the search that found it, so flagged
    // rather than presented with the confidence a cleaner read would
    // carry.
    regimeType: 'flawed-democracy', regimeScore: 6.18, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: null,
    // Singapore is a major refining and trading hub, not a crude
    // producer.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  uruguay: {
    country: 'Uruguay', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // Confirmed qualitatively: the EIU's own 2024 report names Uruguay
    // as "the only full democracy in South America." The one numeric
    // score found (8.66, rank 14th) is explicitly cited from the 2023
    // edition by the source that reports it, so it is NOT used as a
    // 2024 figure -- regimeScore stays null rather than borrowed from
    // the wrong year.
    regimeType: 'full-democracy', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  paraguay: {
    country: 'Paraguay', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // A real, named EIU category list places Paraguay among 2024's
    // hybrid regimes by name (alongside Peru/Mexico/Ecuador/Honduras/
    // El Salvador/Guatemala/Bolivia, several already real entries
    // elsewhere in this file) -- confirmed. The one numeric score
    // found (5.89) carried no stated year and is NOT presented as the
    // 2024 figure on that basis alone.
    regimeType: 'hybrid-regime', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  bolivia: {
    country: 'Bolivia', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary presidential republic',
    // Same shape as Paraguay above: the same real, named 2024 EIU
    // category list places Bolivia among that year's hybrid regimes
    // by name. The one numeric score found (4.51) carried no stated
    // year and is NOT presented as the 2024 figure on that basis
    // alone.
    regimeType: 'hybrid-regime', regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  jordan: {
    country: 'Jordan',
    // The one upgrade this round actually confirmed against a
    // primary-adjacent table, not carried over from general knowledge:
    // the World Bank's own FY2027 release names Jordan explicitly as
    // one of six economies that moved from lower-middle to
    // upper-middle income this cycle.
    incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'unitary parliamentary constitutional monarchy',
    // Deliberately null -- only a qualitative claim was found ("a
    // slight improvement... reflecting incremental political reforms
    // ahead of the September 2024 parliamentary elections"), with no
    // numeric score given by the source that reported it.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // Jordan has essentially no domestic oil production and is a real
    // net energy importer.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  lebanon: {
    country: 'Lebanon',
    // Lebanon's economy has been in real, severe collapse since 2019;
    // stated here from that well-established context, not an
    // independently found primary-table row this round.
    incomeLevel: 'lower-middle-income',
    // Real and current: the Israel-Hezbollah conflict in southern
    // Lebanon and the fragile ceasefire that followed it is a real,
    // ongoing low-intensity situation, separate from Lebanon's own
    // internal political paralysis.
    conflictLevel: 'localized-conflict',
    governmentType: 'parliamentary republic (sectarian power-sharing system); the presidency sat vacant for more than two years amid political paralysis before a January 2025 election',
    // Deliberately null -- the only democracy-adjacent figure found
    // this round (V-Dem's "Closed Autocracy"/"Electoral Autocracy"
    // classifications) is a different index with a different
    // methodology, not the EIU's own, and is not substituted here.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // Lebanon has no significant domestic oil production.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  qatar: {
    country: 'Qatar', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'absolute monarchy (emirate)',
    // One source gives 3.17, authoritarian -- an older-edition source
    // found in the same search gave a different figure (3.65),
    // suggesting that older number is a prior edition rather than a
    // genuine disagreement; flagged rather than presented as fully
    // settled.
    regimeType: 'authoritarian-regime', regimeScore: 3.17, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: null,
    // Qatar's real significance is as the world's leading LNG
    // (liquefied natural gas) exporter, a different real fact than a
    // crude-oil production figure -- reported as a status rather than
    // forced into a daily-barrels number that would misrepresent a
    // gas-exporting economy as an oil one. A real 2024 development:
    // Qatar announced North Field West, the third phase of its
    // ongoing LNG expansion.
    oilProducer: {
      status: 'worlds-leading-lng-exporter-not-primarily-a-crude-producer',
      dailyProductionBbl: null, year: 2024,
      note: 'Qatar announced North Field West, the third phase of its LNG expansion, in 2024 -- its real significance is gas export capacity, not crude oil volume',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  kuwait: {
    country: 'Kuwait', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'constitutional emirate (a hereditary emir with an elected National Assembly, real authority concentrated in the emir)',
    // Confirmed directly: 2.78, authoritarian regime.
    regimeType: 'authoritarian-regime', regimeScore: 2.78,
    militaryExpenditurePctGDP: null,
    // A real, confirmed 2024 figure, not a sparse placeholder: ranked
    // 5th among OPEC members, July 2024 production 2.415M bpd,
    // December 2024 wellhead output 2.44M bpd.
    oilProducer: {
      status: 'opec-5th-largest-producer', dailyProductionBblJuly: 2415000, dailyProductionBblDecemberWellhead: 2440000,
      year: 2024, source: 'argus-media-opec-survey-coverage',
      note: 'Kuwait\'s own economy contracted roughly 4% YoY in Q3 2024, attributed to OPEC+ production cuts and non-oil-sector underperformance',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  bahrain: {
    country: 'Bahrain', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'constitutional monarchy',
    // Confirmed directly: 2.45, authoritarian regime.
    regimeType: 'authoritarian-regime', regimeScore: 2.45,
    militaryExpenditurePctGDP: null,
    // Bahrain's own domestic production is minor relative to its
    // neighbours -- no specific 2024 figure was confirmed to this
    // file's own standard this round.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  oman: {
    country: 'Oman', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'absolute monarchy (sultanate)',
    // Deliberately null -- no clean 2024 EIU score was found this
    // round despite a dedicated search.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // A real, confirmed full-year 2024 total from Oman's own National
    // Centre for Statistics, not a sparse placeholder: 363.3M barrels
    // produced, 308.4M barrels exported. November 2024's monthly rate
    // (984,800 bpd) was its lowest in nearly two years, attributed to
    // real OPEC+ compliance.
    oilProducer: {
      status: 'real-2024-total-with-opec-plus-compliance-reducing-output',
      annualProductionBbl2024: 363300000, annualExportBbl2024: 308400000,
      lowestMonthlyRateBblPerDay: 984800, lowestMonthlyRateMonth: '2024-11',
      year: 2024, source: 'oman-national-centre-for-statistics-via-muscat-daily-and-zawya',
    },
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  // Nineteenth round: eighteen more real countries -- see this file's
  // own header for the full reasoning behind every honest null,
  // confidence flag, and conflict classification below.
  switzerland: {
    country: 'Switzerland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'federal semi-direct democratic republic',
    // Confirmed directly: 9.32 (2024), rank 5th, up from 9.14 (rank
    // 8th) in 2023, full democracy.
    regimeType: 'full-democracy', regimeScore: 9.32,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  iceland: {
    country: 'Iceland', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 9.38, rank 4th, full democracy. A second
    // source gives 9.45/rank 3rd, which conflicts with the directly-
    // EIU-attributed table this entry uses -- that disagreement is
    // named rather than silently resolved by averaging.
    regimeType: 'full-democracy', regimeScore: 9.38,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  luxembourg: {
    country: 'Luxembourg', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary constitutional monarchy (grand duchy)',
    // Confirmed directly: 8.88, rank 10th, full democracy.
    regimeType: 'full-democracy', regimeScore: 8.88,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  malta: {
    country: 'Malta', incomeLevel: 'high-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 7.93, flawed democracy -- the EIU's own
    // table places it just ahead of the United States (7.85) in rank.
    regimeType: 'flawed-democracy', regimeScore: 7.93,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  cyprus: {
    country: 'Cyprus', incomeLevel: 'high-income',
    // The island has been divided along the Green Line since 1974,
    // with the self-declared Turkish Republic of Northern Cyprus
    // recognised only by Turkey -- a real, current, unresolved
    // division, the same "report the real frozen dispute on its own
    // terms" treatment Morocco's Western Sahara and Moldova's
    // Transnistria entries already carry.
    conflictLevel: 'localized-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 7.38 (2024), down three places, flawed
    // democracy, rank 40th of 167.
    regimeType: 'flawed-democracy', regimeScore: 7.38,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  botswana: {
    country: 'Botswana', incomeLevel: 'upper-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic',
    // Confirmed directly: 7.63, rank 35th, flawed democracy -- the
    // highest-ranked African democracy in this file's own EIU-sourced
    // entries.
    regimeType: 'flawed-democracy', regimeScore: 7.63,
    militaryExpenditurePctGDP: null,
    // Botswana has no oil -- its real economy is diamond-dependent
    // (up to 80% of export earnings), and that sector had a real,
    // severe 2024 shock: Debswana's own production fell 31% (driven
    // by planned cuts at Jwaneng) and rough-diamond sales fell ~52%
    // in the first nine months of the year. Not a production figure
    // this field tracks, so reported here rather than forced into it.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  namibia: {
    country: 'Namibia',
    // Confirmed directly against a real, dated World Bank
    // classification list found this round -- Namibia is specifically
    // named as the one country whose classification moved DOWNWARD
    // (from upper-middle) in the prior FY26 cycle.
    incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'parliamentary republic (semi-presidential)',
    // Confirmed directly: 6.48, rank 58th, flawed democracy.
    regimeType: 'flawed-democracy', regimeScore: 6.48,
    militaryExpenditurePctGDP: null,
    // Real 2024 diamond production figures were found (2.3M carats,
    // 5th-ranked producer globally, 3.4% of world production) but
    // Namibia is not an oil producer, and real offshore oil
    // discoveries (the Graff/Venus fields) had not reached commercial
    // production as of 2024 -- the same "real fields under
    // development, not yet producing" shape Uganda's entry already
    // uses.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  malawi: {
    country: 'Malawi', incomeLevel: 'low-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 5.85, rank 76th, hybrid regime.
    regimeType: 'hybrid-regime', regimeScore: 5.85,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  zambia: {
    country: 'Zambia',
    // Confirmed directly against a real, dated World Bank
    // classification list found this round.
    incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // Confirmed directly: 5.73, rank 77th, hybrid regime.
    regimeType: 'hybrid-regime', regimeScore: 5.73,
    militaryExpenditurePctGDP: null,
    // Zambia's real economic significance is copper mining, not oil
    // -- reported here rather than forced into this field.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  zimbabwe: {
    country: 'Zimbabwe',
    // Confirmed directly against a real, dated World Bank
    // classification list found this round.
    incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic (authoritarian, under President Mnangagwa since 2017)',
    // Deliberately null -- the only figure found (3.04, rank 127th) is
    // explicitly flagged by the source that reports it as likely
    // reflecting the 2023 edition (published under a February 2024
    // dateline), the same wrong-year discipline the seventeenth
    // round's Uganda/Tanzania entries already apply.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  rwanda: {
    country: 'Rwanda', incomeLevel: 'low-income',
    // No active armed conflict ON Rwandan territory itself -- the
    // real, disputed allegation that Rwanda backs the M23 offensive
    // in the DRC (named directly in that entry's own conflict
    // reasoning) is a real foreign-policy/military fact about
    // Rwanda's conduct, not a conflict happening within Rwanda, the
    // same distinction this file already draws for Saudi Arabia's
    // combatant role in Yemen.
    conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic (dominant-party, under President Kagame since 2000)',
    // Confirmed directly: 3.34, authoritarian regime.
    regimeType: 'authoritarian-regime', regimeScore: 3.34,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  burundi: {
    country: 'Burundi', incomeLevel: 'low-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic',
    // One source gives 2.13, authoritarian, noting the score
    // "remained unchanged 2021-2023" and recommending the EIU's own
    // report be checked before treating 2024 as fully settled --
    // flagged rather than presented with the same confidence as this
    // round's directly-confirmed entries.
    regimeType: 'authoritarian-regime', regimeScore: 2.13, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  mongolia: {
    country: 'Mongolia', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'semi-presidential republic',
    // Confirmed directly: 6.53 (2024), up from 6.48 (2023), flawed
    // democracy.
    regimeType: 'flawed-democracy', regimeScore: 6.53,
    militaryExpenditurePctGDP: null,
    // Mongolia's real economic significance is coal and copper
    // mining, not oil.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  uzbekistan: {
    country: 'Uzbekistan',
    // Confirmed directly against a real, dated World Bank
    // classification list found this round.
    incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'presidential republic (authoritarian)',
    // Confirmed directly: 2.10 (2024), down from 2.12 (2023) -- a
    // second source gives 2.12 for 2024 itself, so both real figures
    // are named rather than one silently picked; authoritarian
    // regime either way.
    regimeType: 'authoritarian-regime', regimeScore: 2.10, regimeScoreConfidence: 'secondary-estimate',
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  laos: {
    country: 'Laos', incomeLevel: 'lower-middle-income', conflictLevel: 'no-active-conflict',
    governmentType: 'single-party socialist republic (Lao People\'s Revolutionary Party)',
    // Confirmed directly: 1.71, authoritarian regime.
    regimeType: 'authoritarian-regime', regimeScore: 1.71,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  mali: {
    country: 'Mali', incomeLevel: 'low-income',
    // Real, severe, and well-evidenced: the 2025 Global Terrorism
    // Index (covering 2024 data) records 604 deaths from 201 attacks
    // in Mali, attributed mainly to JNIM and IS-Sahel -- the latter
    // reportedly having doubled its controlled territory in Mali
    // since the 2020/2021 coups.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'military junta (ruling since the 2020/2021 coups); withdrew from ECOWAS alongside Burkina Faso and Niger',
    // Deliberately null -- no EIU 2024 score was found this round;
    // BTI's own qualitative characterization ("further consolidation
    // of authoritarian rule") is not a numeric EIU figure and is not
    // substituted here.
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  'burkina-faso': {
    country: 'Burkina Faso', incomeLevel: 'low-income',
    // The clearest-evidenced conflict classification in this file:
    // the real 2025 Global Terrorism Index ranks Burkina Faso #1 in
    // the world for the second year running on 2024 data (1,532
    // deaths, a fifth of all global terrorism deaths that year), with
    // JNIM claiming nearly half the country's attacks.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'military junta (ruling since the 2022 coups); withdrew from ECOWAS alongside Mali and Niger',
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
  niger: {
    country: 'Niger', incomeLevel: 'low-income',
    // Real and severe: Niger's own ranking on the Global Terrorism
    // Index climbed from 10th to 5th-worst in the world between the
    // 2024 and 2025 editions, as the Sahel overall accounted for 51%
    // of all global terrorism deaths in 2024.
    conflictLevel: 'active-armed-conflict',
    governmentType: 'military junta (ruling since the 2023 coup); withdrew from ECOWAS alongside Mali and Burkina Faso',
    regimeType: null, regimeScore: null,
    militaryExpenditurePctGDP: null,
    // Niger's real economic significance is uranium mining (Orano/
    // Areva), not oil.
    oilProducer: null,
    globalIndicators2026: {
      homicideRatePer100k: null, undernourishmentPct: null, avgTemperatureC: null, roadTrafficDeathRatePer100k: null,
    },
  },
};

// **Checked once, at load time.** A COUNTRY_PROFILES key must not
// collide with a COUNTRIES key -- the two tables are additive, and a
// collision would mean the same real country was about to get two
// disagreeing entries under two different lookup paths.
{
  for (const key of Object.keys(COUNTRY_PROFILES)) {
    if (Object.prototype.hasOwnProperty.call(COUNTRIES, key)) {
      throw new Error(`countryPacks.js: "${key}" exists in both COUNTRIES and COUNTRY_PROFILES`);
    }
  }
}

function countryProfileFor(key) {
  return COUNTRY_PROFILES[key] ?? null;
}

function describeCountryProfile(key) {
  const entry = countryProfileFor(key);
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
  spain: 'europe',
  belgium: 'europe', austria: 'europe', denmark: 'europe', finland: 'europe',
  romania: 'europe', bulgaria: 'europe', serbia: 'europe', croatia: 'europe', moldova: 'europe', belarus: 'europe',
  switzerland: 'europe', iceland: 'europe', luxembourg: 'europe', malta: 'europe', cyprus: 'europe',
  // Middle East
  israeli: 'middle-east', yemen: 'middle-east', 'saudi-arabia': 'middle-east', turkey: 'middle-east',
  iraq: 'middle-east', afghanistan: 'middle-east', syria: 'middle-east', 'united-arab-emirates': 'middle-east',
  jordan: 'middle-east', lebanon: 'middle-east', qatar: 'middle-east', kuwait: 'middle-east',
  bahrain: 'middle-east', oman: 'middle-east',
  // Africa (UN-geoscheme Northern Africa, including Morocco/Algeria/
  // Sudan/Libya/Tunisia, is classified here for continental
  // consistency with this file's own existing Africa bucket, even
  // though MENA groupings colloquially pair North Africa with the
  // Middle East)
  somali: 'africa', nigerian: 'africa', ethiopian: 'africa', ghanaian: 'africa', kenyan: 'africa',
  'subsaharan-african': 'africa', 'cape-verde': 'africa', 'south-africa': 'africa',
  morocco: 'africa', 'democratic-republic-of-the-congo': 'africa',
  sudan: 'africa', algeria: 'africa', uganda: 'africa', tanzania: 'africa', angola: 'africa', mozambique: 'africa',
  libya: 'africa', tunisia: 'africa',
  botswana: 'africa', namibia: 'africa', malawi: 'africa', zambia: 'africa', zimbabwe: 'africa',
  rwanda: 'africa', burundi: 'africa', mali: 'africa', 'burkina-faso': 'africa', niger: 'africa',
  // Caribbean
  'west-indian': 'caribbean', jamaican: 'caribbean', haitian: 'caribbean', 'dominican-republic': 'caribbean',
  cuba: 'caribbean', 'puerto-rico': 'caribbean', 'virgin-islands': 'caribbean',
  // Asia
  vietnamese: 'asia', chinese: 'asia', filipino: 'asia', 'asian-indian': 'asia', india: 'asia',
  japan: 'asia', 'south-korea': 'asia', indonesia: 'asia',
  pakistan: 'asia', bangladesh: 'asia', thailand: 'asia', myanmar: 'asia', malaysia: 'asia',
  'north-korea': 'asia', taiwan: 'asia', nepal: 'asia', 'sri-lanka': 'asia', kazakhstan: 'asia', cambodia: 'asia',
  singapore: 'asia', mongolia: 'asia', uzbekistan: 'asia', laos: 'asia',
  // Latin America (Central/South America, excluding the Caribbean above)
  mexican: 'latin-america', guatemalan: 'latin-america', honduran: 'latin-america', salvadoran: 'latin-america',
  venezuela: 'latin-america', colombia: 'latin-america', brazil: 'latin-america', argentina: 'latin-america',
  peru: 'latin-america', chile: 'latin-america', ecuador: 'latin-america',
  uruguay: 'latin-america', paraguay: 'latin-america', bolivia: 'latin-america',
  // North America -- the explicit baseline; no "North America overview"
  // exists because the baseline itself is the dedicated entry.
  'united-states': 'north-america', canada: 'north-america',
  // Oceania -- no regional overview exists for it yet (same honest gap
  // REGION_OVERVIEWS already documents for any region with no built
  // overview), but the classification itself is still real.
  australia: 'oceania', 'new-zealand': 'oceania',
};

// Only regions with a REAL, already-built multi-country overview get
// an entry here. A region with no overview stays absent on purpose --
// `regionalContextFor` reports that honestly rather than inventing one
// just to fill the slot.
const REGION_OVERVIEWS = {
  europe: EU_MIGRATION_OVERVIEW_2025,
  africa: AFRICA_MIGRATION_OVERVIEW_2026,
  caribbean: CARIBBEAN_CRUISE_TOURISM_2026,
  asia: ASIA_MIGRATION_OVERVIEW_2026,
  'middle-east': MIDDLE_EAST_MIGRATION_2026,
  'latin-america': LATIN_AMERICA_MIGRATION_2026,
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
// dedicated `COUNTRY_PROFILES` entry (the fourteenth round's second
// real path, no ancestry code needed), a dedicated standalone
// reference, then the region's own overview -- and if none of those
// four exist, an honest, named gap rather than a silent null or an
// invented number.
function regionalContextFor(key) {
  const dedicatedEntry = countryFor(key);
  const profileEntry = countryProfileFor(key);
  const standaloneEntry = STANDALONE_REFERENCES[key] ?? null;
  const region = REGION_BY_KEY[key] ?? null;
  const regionalOverview = region ? (REGION_OVERVIEWS[region] ?? null) : null;

  let coverageNote;
  if (dedicatedEntry) coverageNote = 'a dedicated, country-specific COUNTRIES entry exists';
  else if (profileEntry) coverageNote = 'a dedicated, country-specific COUNTRY_PROFILES entry exists (no ancestryPacks.GROUPS key needed for this path)';
  else if (standaloneEntry) coverageNote = 'a dedicated, country-specific standalone reference exists (no ancestryPacks.GROUPS key for it yet)';
  else if (regionalOverview) coverageNote = `no dedicated entry for this key; falling back to its region's (${region}) real overview`;
  else if (region) coverageNote = `region (${region}) is known, but no regional overview has been built for it yet`;
  else coverageNote = 'no region classification exists for this key -- a real, undone gap, not a silent zero';

  return { key, dedicatedEntry, profileEntry, standaloneEntry, region, regionalOverview, coverageNote };
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
  COUNTRY_PROFILES,
  countryProfileFor,
  describeCountryProfile,
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
  ASIA_MIGRATION_OVERVIEW_2026,
  MIDDLE_EAST_MIGRATION_2026,
  LATIN_AMERICA_MIGRATION_2026,
  REGION_BY_KEY,
  REGION_OVERVIEWS,
  STANDALONE_REFERENCES,
  countryFor,
  describeCountry,
  regionalContextFor,
};
