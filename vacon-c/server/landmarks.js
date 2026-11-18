// server/landmarks.js
//
// **The things worth taking, and what makes one different from another.**
//
// ---------------------------------------------------------------------
// What this closes, measured
// ---------------------------------------------------------------------
// `properties.type` enumerates ten kinds in the schema's own comment.
// `worldgen` has only ever generated two of them — `residential` and
// `commercial` — so **no world this engine has ever built contained a
// monument, a historic site, a farm, a government building or an
// industrial one.** Seven of the ten have never existed.
//
// Four more columns were in the same state, and they are exactly the
// facts somebody asks about a building:
//
//   `history_ref`     hard-coded `null` in `generateProperty`, with no
//                     way for a caller to set it. `historical_records`
//                     is a real table with a `significance` NUMERIC and
//                     a `where_location_id` pointing back at a
//                     property, and the two had never been connected.
//                     **Historical value had a column, a table, a score
//                     and no link between them.**
//   `units`           `1` on every residential property ever generated.
//   `density_tier`    null on every property ever generated.
//   `lifecycle_stage` `historical_legacy` is one of the seven stages and
//                     carries a 1.25x value multiplier in
//                     `property.STAGE_MULTIPLIER`. Nothing has ever
//                     been in it.
//
// And one fact the schema genuinely does not carry: **bedrooms.**
// `units` is how many dwellings a building contains, which is a
// different question from how many rooms one dwelling has, and "a
// one-bedroom apartment" is the smallest thing anybody names. That is
// a column in `schema-extensions.sql` with the reason beside it, not a
// number squeezed into `units`.
//
// ---------------------------------------------------------------------
// The two vocabularies are the package's, not invented here
// ---------------------------------------------------------------------
// `THE_KEY_BUILDING_TYPES.md` gives twenty-three hero-tier categories
// verbatim and calls them "the definitive, standard list... applied
// consistently across every future region worldwide", with
// `alwaysHeroTier: true`. `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` gives
// ten retail types, each "tied directly to an existing skill or
// resource system rather than generic loot", and a
// `chaosEraState: "emptied"` that is this setting's whole premise.
//
// Both are reproduced below in the documents' own order and spelling.
// What this file ADDS to each entry is stated per field, because the
// difference between "the spec said this" and "we decided this" is the
// thing that evaporates first.
//
// ---------------------------------------------------------------------
// Significance is the axis the maintain key turns on
// ---------------------------------------------------------------------
// The request this file answers put it plainly: the White House is not
// a hardware store, and the difference is "the size of it, the
// importance". Size is already in the schema — `land_size`, `floors`,
// `units`. Importance was not anywhere, and `significance` is it: a
// 0-100 reading, written onto the `historical_records` row the property
// points at, so it lives in the column the schema already provides for
// exactly this and is not a second opinion invented here.
//
// **A landmark's past does not fix its future.** `repurpose` changes
// what a building IS while keeping what it WAS — the history row and
// its significance survive, because taking the Arch and making it a
// fortress does not make it stop having been the Arch. That is the
// whole reason significance lives on the history row rather than on the
// property.

'use strict';

const worldStore = require('./worldStore.js');

// ---------------------------------------------------------------------
// THE_KEY_BUILDING_TYPES.md — twenty-three categories, verbatim
// ---------------------------------------------------------------------
//: `category` is the document's own string, to the hyphen.
//:
//: `significance` is a band, and it is this file's judgement rather
//: than the document's — the document says only that every one of them
//: is `alwaysHeroTier: true`, which is a floor and not an ordering. The
//: bands are anchored on one another rather than felt: a government
//: building and a university outrank a bridge because more of a city's
//: functioning runs through them, and a monument outranks both on
//: meaning while carrying almost nobody. Where two categories do the
//: same kind of work they get the same band rather than a spurious
//: difference.
//:
//: `propertyType` maps each onto one of the schema's ten
//: `properties.type` values, which is what makes these real rows rather
//: than a parallel taxonomy. Several collapse onto `historical_site`,
//: and that is the schema being coarser than the document rather than
//: information being lost — the category is kept on the row.
//:
//: `staff` is the occupation that runs the place, read from
//: `occupations.DEFINING_POST` where the org type exists and named
//: here where it does not. `null` means nobody runs it: a monument
//: needs keeping, not operating.
const KEY_BUILDING_TYPES = {
  skyscraper: {
    form: 'tower',
    significance: [55, 80], propertyType: 'commercial', staff: 'manager',
    discovery: 'technology, blueprints, business records',
  },
  university: {
    significance: [65, 90], propertyType: 'government', staff: 'researcher',
    discovery: 'knowledge books across every category',
  },
  'government-building': {
    significance: [70, 95], propertyType: 'government', staff: 'diplomat',
    discovery: 'laws, records, weapons/security equipment',
  },
  prison: {
    significance: [55, 80], propertyType: 'government', staff: 'officer',
    discovery: null,
  },
  'art-museum': {
    significance: [60, 85], propertyType: 'historical_site', staff: 'curator',
    discovery: 'cultural/historical artifacts',
  },
  church: {
    significance: [50, 80], propertyType: 'historical_site', staff: 'preacher',
    discovery: 'cultural/historical artifacts',
  },
  mosque: {
    significance: [50, 80], propertyType: 'historical_site', staff: 'preacher',
    discovery: 'cultural/historical artifacts',
  },
  synagogue: {
    significance: [50, 80], propertyType: 'historical_site', staff: 'preacher',
    discovery: 'cultural/historical artifacts',
  },
  temple: {
    significance: [50, 80], propertyType: 'historical_site', staff: 'preacher',
    discovery: 'cultural/historical artifacts',
  },
  'masonic-building': {
    significance: [45, 70], propertyType: 'historical_site', staff: null,
    discovery: 'cultural/historical artifacts',
  },
  'historic-site': {
    form: 'site',
    significance: [60, 90], propertyType: 'historical_site', staff: null,
    discovery: 'cultural/historical artifacts',
  },
  airport: {
    significance: [60, 85], propertyType: 'commercial', staff: 'navigator',
    discovery: 'technology, blueprints',
  },
  'train-station': {
    significance: [50, 75], propertyType: 'commercial', staff: 'navigator',
    discovery: 'technology, blueprints',
  },
  hospital: {
    significance: [70, 95], propertyType: 'government', staff: 'physician',
    discovery: 'medical books, medicine, surgical equipment',
  },
  'stadium-arena': {
    significance: [45, 70], propertyType: 'commercial', staff: 'athlete',
    discovery: null,
  },
  library: {
    significance: [60, 85], propertyType: 'government', staff: 'librarian',
    discovery: 'knowledge books across every category',
  },
  //: **A twenty-fourth, and it comes from a disagreement between two
  //: documents this repository HAS.**
  //:
  //: `THE_KEY_BUILDING_TYPES.md` lists twenty-three categories and no
  //: school. `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` names
  //: schools as a Key building type twice, in its own words: "the Key
  //: building types (skyscrapers, churches, **schools**, hospitals,
  //: caves) should be the primary source of high-tier discoveries",
  //: and "**Schools**/Libraries → knowledge books across every
  //: category".
  //:
  //: Both are present, both are the owner's, and they cannot both be
  //: complete. The tie is broken toward including it for two reasons:
  //: the Key's own last entry is "any other genuinely distinctive
  //: feature not covered above", so the list is explicitly open; and
  //: `PRISON_POPULATION_CENTERS_BREAKS_SCHOOLS.md` — a document the
  //: manifest records as written and lost — is named for schools, so
  //: the omission reads as a document that went missing rather than a
  //: decision that schools do not count.
  //:
  //: Everything else about it is taken rather than invented: the
  //: discovery pool is the discovery document's own clause, and
  //: `occupations.DEFINING_POST.school` has said `teacher` since the
  //: occupation taxonomy was built. Significance sits below the
  //: university's band because a neighbourhood school is a local
  //: landmark and a university is a regional one.
  school: {
    significance: [40, 70], propertyType: 'government', staff: 'teacher',
    discovery: 'knowledge books across every category',
  },
  'theater-concert-hall': {
    significance: [40, 65], propertyType: 'commercial', staff: 'curator',
    discovery: 'cultural/historical artifacts',
  },
  'notable-bridge': {
    form: 'site',
    significance: [45, 70], propertyType: 'historical_site', staff: null,
    discovery: null,
  },
  'monument-memorial': {
    form: 'site',
    significance: [70, 100], propertyType: 'historical_site', staff: null,
    discovery: 'cultural/historical artifacts',
  },
  'zoo-aquarium': {
    significance: [40, 65], propertyType: 'commercial', staff: 'curator',
    discovery: null,
  },
  'cave-system': {
    form: 'site',
    significance: [35, 65], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources, lost pre-collapse technology artifacts',
  },
  'natural-formation': {
    form: 'site',
    significance: [35, 65], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources',
  },
  'other-distinctive-feature': {
    significance: [30, 60], propertyType: 'historical_site', staff: null,
    discovery: null,
  },

  // **Five more, the same way `school` became the 24th real category:
  // this document's own list ends "any other genuinely distinctive
  // feature not covered above", explicitly open, and these five are
  // named by direct instruction rather than by a second document
  // disagreeing with this one.** `port-terminal` also has real textual
  // support of its own — `VACANCY_CONSOLIDATED_MASTER_SPEC.md`'s §49
  // CITY DNA names "port" among its nine city identities, and no
  // landmark had ever existed for a port city to actually have.
  casino: {
    // By direct instruction, overriding this project's own standing
    // gambling/casino compliance gate — see CLAUDE.md's "Explicitly
    // deferred" list and its own standing-rule entry recording the
    // override. Significance alongside `stadium-arena`/`art-museum`:
    // a real casino resort is a major commercial landmark, not a
    // corner shop. `dealer` as the defining post, the same "most
    // numerous, most visible real role" reasoning `physician`/
    // `teacher`/`librarian` already use for their own buildings.
    significance: [50, 80], propertyType: 'commercial', staff: 'dealer',
    discovery: 'cash, gaming chips, gaming equipment',
  },
  'fire-station': {
    significance: [35, 60], propertyType: 'government', staff: 'firefighter',
    discovery: 'firefighting equipment, rescue vehicles, medical supplies',
  },
  'ems-station': {
    significance: [35, 60], propertyType: 'government', staff: 'paramedic',
    discovery: 'medical supplies, ambulances',
  },
  'ranger-station': {
    significance: [35, 60], propertyType: 'government', staff: 'ranger',
    discovery: 'natural resources, firefighting/rescue equipment',
  },
  'port-terminal': {
    // Significance alongside `airport`/`train-station`: major transit
    // infrastructure, the real place cargo this engine's own
    // `trade.js`/`barter.js` already model actually arrives through.
    significance: [55, 85], propertyType: 'commercial', staff: 'dockworker',
    discovery: 'cargo, trade goods',
  },

  // **Two more, closing a real gap a direct question found: "schools,
  // malls, universities, hospitals, libraries, museums, parks... city
  // halls, skyscrapers" named two categories that did not exist at
  // all.** Checked directly before adding either — neither
  // `THE_KEY_BUILDING_TYPES.md` nor `COMPREHENSIVE_RETAIL_KEY_LOCATIONS
  // .md` nor any other project document names a mall or a park, so
  // these are the same "any other genuinely distinctive feature not
  // covered above" extension `school`/`casino`/etc. already used.
  mall: {
    // A shopping-mall COMPLEX, not a second copy of any one
    // `RETAIL_TYPES` store — significance alongside `department-store`/
    // `stadium-arena`: a real anchor commercial landmark. **Explicitly
    // NOT modelled**: the individual stores a real mall contains.
    // Building "a mall full of real, separately-salvageable shops" is
    // real, separate, future work, named here rather than silently
    // implied by giving a mall a discovery pool that pretends to be
    // every store inside it at once.
    significance: [25, 55], propertyType: 'commercial', staff: 'manager',
    discovery: 'clothing, luxury goods',
  },
  park: {
    // Real, ordinary public green space — genuinely unstaffed in this
    // engine's own model (a STAFFED park facility is `ranger-station`,
    // already real; an ordinary park is the honest "nobody runs this,
    // somebody watches it" shape `monument-memorial`/`cave-system`
    // already hold). `propertyType: 'agricultural'`, the same real
    // schema type those open-land categories already use.
    significance: [15, 45], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources',
  },

  // **Two more, by direct instruction: "the trucking market... large
  // corporations, warehouses... St. Louis as an example" and "plants...
  // car plants, food warehouses... chemical plants."** Checked rather
  // than invented — real NAICS/BLS substance for both is in
  // `REPEATABLE_DENSITY_PER_1K` and the `distribution`/`plant` crews
  // below, and St. Louis's own real Gateway Commerce Center/Earth City
  // Business Park/Hazelwood Logistics Center/Sauget Business Park are
  // the worked example in `data/st-louis.landmarks.json`.
  'distribution-center': {
    // A warehouse/distribution-center mega-employer — the real, generic
    // substrate for "UPS/FedEx/Amazon/Walmart-style" named directly,
    // one category rather than four invented brand-specific ones, the
    // same "one grain, real source, generic name" posture
    // `casino`/`port-terminal` already hold. `staff: 'manager'`, the
    // same "whoever runs the building" role `skyscraper`/`mall` use —
    // the real occupational DEPTH is in the `distribution` crew below,
    // not this one post.
    significance: [40, 70], propertyType: 'commercial', staff: 'manager',
    discovery: 'materials, tools, clothing',
  },
  'industrial-plant': {
    // A manufacturing mega-employer — auto, food/beverage, chemical,
    // the categories named directly, generalised to one real grain the
    // same way `entertainer` generalises singers/actors/movie stars.
    // `staff: 'manager'` for the same reason `distribution-center`
    // takes it; the real production-floor depth is the `plant` crew.
    significance: [45, 75], propertyType: 'commercial', staff: 'manager',
    discovery: 'materials, metals, technology components',
  },

  // **Four more, by direct instruction — and three of them close a real
  // gap `VACANCY_CONSOLIDATED_MASTER_SPEC.md` itself has named since
  // before this engine existed.** §30's own category list reads, in
  // full: "*Strategic:* airports, ports, military sites, power plants,
  // communication centers" and "*Natural:* caves, forests, mountains,
  // rivers, lakes, underground areas." Only `cave-system` and the
  // generic `natural-formation` catch-all were ever built from either
  // line — `military-base`, `forest`, `river`, `lake` are the rest of
  // it, the same "named in a real document, never built" shape
  // `school`/`mall`/`park` already closed.
  'military-base': {
    // `propertyType: 'government'` on purpose, not a new org archetype
    // — `worldgen.js`'s own "every OTHER real hero landmark gets a
    // real operator" pass already assigns every `government`-type
    // landmark the region's (or civilization's) real government as
    // operator, with zero new code. `staff: 'officer'` (real SOC major
    // group 33, already `military`/`government`-employable) is the
    // defining post; the real occupational depth — mechanic, engineer,
    // logistician, physician, all already real and already
    // `military`-employable — is the `garrison` crew below.
    significance: [50, 80], propertyType: 'government', staff: 'officer',
    discovery: 'protection, tools, vehicles',
  },
  forest: {
    // An ordinary generated wooded area — genuinely unstaffed, the
    // same honest `staff: null` `park`/`cave-system` already hold; a
    // forest with real on-site staff is a separate real thing
    // (`ranger-station`, already built) rather than a property of
    // every forest. No clean real national per-capita figure was
    // found for this one (checked, not skipped — national forest
    // acreage and count exist, but nothing ties either to a per-city
    // rate the way NRPA's own park-agency figure does), so this stays
    // a singleton draw, the same honest gap `skyscraper`/
    // `government-building` already declare in `REPEATABLE_
    // DENSITY_PER_1K`'s own header.
    significance: [25, 55], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources',
  },
  river: {
    form: 'site',
    significance: [40, 70], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources',
  },
  lake: {
    form: 'site',
    significance: [35, 65], propertyType: 'agricultural', staff: null,
    discovery: 'natural resources',
  },

  // **A thirty-eighth, by direct instruction ("big apartment
  // complexes... Cochran... O'Fallon Place... Peabodys... Streets of
  // St. Charles... Windham Chase"): a real, named multi-family housing
  // development is a genuinely distinctive feature not covered
  // above, the same "any other" extension `school`/`mall`/`park`
  // already used.** `propertyType: 'residential'` is new among hero
  // categories — every other one is government/commercial/
  // historical_site/agricultural — because this is the one hero
  // category that is actually occupied housing rather than an
  // institution or a monument. `staff: 'manager'` is the real,
  // smallest-honest defining post (a large residential development
  // has an on-site property manager; it does not have a curator or a
  // dealer). `discovery: null` is the same honest gap `car-wash`/
  // `gun-store` already hold — this is occupied housing, not an
  // institution with an inventory to find.
  'apartment-complex': {
    significance: [15, 40], propertyType: 'residential', staff: 'manager',
    discovery: null,
  },
};

const KEY_BUILDING_CATEGORIES = Object.keys(KEY_BUILDING_TYPES);

// ---------------------------------------------------------------------
// Real density: some categories genuinely repeat per city, by direct
// instruction and checked against real national counts rather than
// guessed
// ---------------------------------------------------------------------
// A direct question found a real structural limit: every hero-tier
// category above is drawn WITHOUT REPLACEMENT per city (see
// `worldgen.js`'s own landmark-placement comment, "a settlement does
// not get four airports") — so no city, however large, can ever have
// a second hospital or a second school. That is a reasonable design
// for a handful of categories (a city plausibly has one notable
// airport), and simply wrong for the ones named directly: "schools,
// malls, universities, hospitals, libraries, museums, parks."
//
// Each real rate below is national COUNT ÷ a ~335,000,000 U.S.
// population estimate (U.S. Census Bureau), cited per entry rather
// than asserted. **Checked and left OUT on purpose where no clean
// real figure was found**, named here rather than silently guessed:
// `skyscraper` (CTBUH counts ~900-940 total in the U.S., concentrated
// in ~56 cities — a flat per-capita rate would misrepresent a real
// distribution this skewed, and no real per-city-size-tier curve was
// found to key it on instead); `government-building`/"city hall"
// (the only national figure found, ~19,500 incorporated
// municipalities, counts how many separate CITIES the country has,
// not how many government buildings exist WITHIN one — a different
// question); `mosque`/`synagogue`/`temple` (Hartford Institute's own
// combined "~15,000 other-faith congregations" figure has no further
// real breakdown by tradition at hand); and this session's own
// `casino`/`fire-station`/`ems-station`/`ranger-station`/
// `port-terminal` additions, left for their own future round rather
// than retrofitted with an unresearched number.
const REPEATABLE_DENSITY_PER_1K = {
  // NCES, 2023-24 school year: 99,297 operating public K-12 schools.
  school: 0.2964,
  // AHA "Fast Facts on U.S. Hospitals," 2025 edition: 6,093 total
  // hospitals.
  hospital: 0.0182,
  // IMLS Public Libraries Survey (reported Sept. 2025): over 17,000
  // library outlets (central, branch, bookmobile).
  library: 0.0507,
  // IMLS: ~35,000 active museums (more than double the 1990s-era AAM
  // estimate of 17,500).
  'art-museum': 0.1045,
  // NCES, academic year 2021-22: 3,542 degree-granting postsecondary
  // institutions.
  university: 0.0106,
  // Hartford Institute "Fast Facts on American Religion": ~355,000
  // Christian congregations (Protestant/other Christian + Catholic/
  // Orthodox) of its ~370,000-congregation, all-faiths estimate —
  // `church` covers all Christian denominations in this engine, the
  // same single-grain posture `athlete`/`entertainer` already hold.
  church: 1.0597,
  // NRPA "2026 Agency Performance Review": the typical (median) park
  // and recreation agency serves 2,437 residents per park — a real,
  // directly-reported rate, not derived from a separate count/
  // population division the way every other entry here is.
  park: 0.4103,
  // ICSC-sourced estimates of U.S. ENCLOSED malls range roughly
  // 700-1,200 as of the mid-2020s (down from a mid-2000s peak near
  // 1,500); 900 is this range's own midpoint, flagged for the real
  // uncertainty rather than presented as a precise count the way the
  // others above are.
  mall: 0.0027,
  // Census County Business Patterns (NAICS 493110, "General
  // Warehousing and Storage"), most recent (2023) file: secondary
  // sources disagree on the exact national establishment count
  // (16,753 vs. 18,983 found, a direct fetch of the Census CBP file
  // itself was not reachable from this environment) — 17,868, this
  // range's own midpoint, is used the same flagged-uncertain way
  // `mall` above is.
  'distribution-center': 0.0533,
  // Census County Business Patterns (NAICS 31-33, "Manufacturing"),
  // 2023 national file: a third-party calculation over the real CBP
  // size-class breakdown found 3,384 establishments nationally with
  // 500 or more employees (2,347 at 500-999, 1,037 at 1,000+) —
  // employing 3.80 million people, out of ~285,500 manufacturing
  // establishments of every size the Census Bureau itself confirms for
  // 2022. This engine's `industrial-plant` models the MEGA-employer
  // end of manufacturing specifically (the "car plants, food
  // warehouses... chemical plants" named directly), not an ordinary
  // small machine shop — the 500+-employee subset is the honest match
  // for that, not the 285,500 total.
  'industrial-plant': 0.0101,
};

const REPEATABLE_CATEGORIES = Object.keys(REPEATABLE_DENSITY_PER_1K);
//: Everything else in the Key still draws at most once per city, the
//: original behaviour, completely unaffected by any of the above.
const SINGLETON_CATEGORIES = KEY_BUILDING_CATEGORIES.filter(
  (category) => !REPEATABLE_CATEGORIES.includes(category),
);

function densityPer1kFor(category) {
  return REPEATABLE_DENSITY_PER_1K[category] ?? null;
}

// ---------------------------------------------------------------------
// COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md — ten types, verbatim
// ---------------------------------------------------------------------
//: `discovery` is the document's own merchandise pool, quoted where it
//: gives one. `gun-store` and `department-store` appear in the
//: `RetailKeyLocationType` union and NOT in the prose list, so they
//: have no pool from the document and say so with `null` rather than
//: getting one invented.
//:
//: Every one of these is `commercial` and none is hero-tier: the
//: document calls them "Retail Key Locations", a separate list from
//: THE KEY's hero-tier categories, and their significance band reflects
//: that — a hardware store matters, and it does not matter the way a
//: hospital does.
//:
//: `chaosEraState: "emptied"` is the document's, and it is why
//: `worldgen` places these with a low condition: this is a world after
//: a collapse, and the shelves were cleared long before the player
//: arrived.
const RETAIL_TYPES = {
  'hardware-store': { significance: [20, 45], discovery: 'tools, construction materials' },
  'clothing-store': { significance: [12, 32], discovery: 'clothing, fabric, protective gear' },
  'grocery-store': { significance: [25, 50], discovery: 'food' },
  pharmacy: { significance: [30, 55], discovery: 'medicine, medical supplies' },
  'sporting-goods-store': { significance: [20, 45], discovery: 'hunting/fishing equipment' },
  'electronics-store': { significance: [18, 42], discovery: 'technology components' },
  'auto-parts-store': { significance: [15, 40], discovery: 'vehicle repair components' },
  bookstore: { significance: [20, 45], discovery: 'additional book source' },
  'gun-store': { significance: [25, 50], discovery: null },
  'department-store': { significance: [20, 45], discovery: null },

  // **Two more, by direct instruction: "Family Dollars, Dollar
  // Generals... even if you don't use that exact name, just like a
  // dollar store" and "grocery stores, restaurants, hardware stores."**
  // `hardware-store`/`grocery-store` already existed above;
  // `discount-store`/`restaurant` close the other two named directly.
  // Generic category names over real brand names, the same precedent
  // this whole table already holds.
  'discount-store': {
    // Generic stand-in for the real dollar-store format named
    // directly, never the brand itself — this project's own standing
    // "generic over brand" rule. Significance alongside
    // `department-store`: a real retail anchor, smaller than one.
    significance: [15, 38], discovery: 'clothing, tools, food',
  },
  restaurant: {
    significance: [12, 32], discovery: 'food',
  },
  'big-box-store': {
    // Generic stand-in for the large-format general-merchandise/
    // warehouse-club cluster named directly, as one phrase, in the
    // same breath: "Walmart's, Targets, Sam's, Costco's." Checked via
    // WebSearch rather than assumed: roughly 4,593 Walmart + 1,995
    // Target + ~600 Sam's Club + ~634 Costco US locations (2026,
    // third-party trackers — ScrapeHero/Statista/OpenCapital, no
    // single company filing gives all four at once) is ~7,822
    // combined. Generic category name over any one brand, the same
    // precedent this whole table already holds.
    significance: [25, 55], discovery: 'clothing, tools, food',
  },

  // **Two more, named directly ("inventory and car lots, car
  // washes"), both reusing this engine's own real vehicle substrate
  // (`vehicles.js`, `salvage.js`'s real `transport` TRADE_CATEGORY)
  // rather than inventing a second one.**
  'car-lot': {
    // NADA's own 2025 annual profile: 16,990 franchised new-car
    // dealerships nationally (used-only/independent lots are real and
    // not counted in that figure, so the true total is higher — named
    // rather than silently treated as complete). `discovery.js`'s own
    // pool reads the real `transport` category (car/motorcycle/
    // scooter) `salvage.js` already registers — a lot full of real
    // vehicles is, if anything, a MORE honest source of one than
    // `auto-parts-store`'s existing pool, which already draws from
    // the same category.
    significance: [18, 42], discovery: 'vehicles, vehicle parts',
  },
  'car-wash': {
    // IBISWorld's own 2025 industry-business count: 16,576 (combines
    // car washes with auto detailing, no cleaner national split
    // found). Genuinely no real loot — a wash bay is a service, not
    // an inventory — the same honest `null` `stadium-arena`/
    // `notable-bridge` already hold.
    significance: [10, 28], discovery: null,
  },

  // **Four more, by direct instruction ("franchise banks... gas
  // stations... QuikTrip, BP, Shell, Exxon, Amoco... liquor stores...
  // elderly homes, nursing homes") — generic category over real
  // brand name, the same precedent this whole table already holds
  // for `discount-store`/`big-box-store`/`car-lot`.**
  bank: {
    // No real §26 trade category backs currency or vault contents —
    // this engine is barter-based with no cash item at all (the same
    // real gap `casino`'s own header names for chips). Genuinely no
    // clean fit, so `discovery: null`, the honest gap rather than
    // stretching `protection`/`luxury goods` a second time.
    significance: [20, 45], discovery: null,
  },
  'gas-station': {
    // `fuel` is a real registered item (`items.RESOURCE_TYPES`,
    // `vehicles.FUEL_ITEM_NAME`) but is NOT a §26 trade category —
    // two separate vocabularies, and `discovery.js`'s pools draw only
    // from the latter. `repair`/`transport` are the closest real fit,
    // the same ones `auto-parts-store`/`car-lot` already draw from.
    significance: [12, 30], discovery: 'vehicle repair components, fuel',
  },
  'liquor-store': {
    // No §26 category for alcohol specifically exists; `food` is the
    // closest real backed category, same "closest real fit, stated"
    // posture `mall`/`distribution-center` already hold.
    significance: [15, 35], discovery: 'food',
  },
  'nursing-home': {
    // CMS Nursing Home Compare (data.cms.gov): roughly 15,000
    // Medicare/Medicaid-certified facilities nationally — real and
    // structured, though not wired as a per-capita density figure
    // this round (see `landmarkPacks.js`'s own note on this pass).
    // `medicine` is the real, directly-backed category a nursing
    // home plausibly holds, same as `pharmacy`.
    significance: [25, 50], discovery: 'medicine, medical supplies',
  },
};

const RETAIL_CATEGORIES = Object.keys(RETAIL_TYPES);

//: The document's own word for what a collapse left behind. Applied as
//: a condition ceiling rather than a flag: an emptied store is a
//: building somebody stripped, and `properties.condition` is where that
//: lives.
const CHAOS_ERA_CONDITION = [15, 55];

// =====================================================================
// CREWS — it is not the amount of people, it is the type of people
// =====================================================================
//
// **The first version of the maintain key asked for one specialist.**
// A hospital needed "1 physician" and everything else was a headcount
// split by the generic 5:10:1 role ratio, which is the "make it easy"
// failure exactly: a place is not kept by thirty-one interchangeable
// bodies, it is kept by ten cooks, twenty on security and an engineer.
//
// `REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` is the document that
// would settle these numbers — "real BLS labor data methodology" — and
// it is one of the forty-odd listed in `VACANCY_DOCUMENT_MANIFEST.md`
// as MISSING. So the crews below are new design, and they are marked
// as such rather than presented as recovered. If that document ever
// turns up, this table is the one place to reconcile.
//
// ---------------------------------------------------------------------
// Nine crews for thirty-three categories, not thirty-three tables
// ---------------------------------------------------------------------
// Each crew is a statement about what KIND of place something is, and
// categories point at one. That is the same move `FORMS` makes for
// height: thirty-three tuned tables would be thirty-three inventions,
// and nine kinds is a claim a reader can check.
//
// **The counts are a RATIO, not a headcount** — read exactly the way
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md`'s 5:10:1 is read. The
// magnitude comes from `control.maintenanceFor`'s measured size and
// significance; this says how it divides. So a small government office
// and a large one have the same shape of staff and different numbers of
// them, which is the thing that was missing.
//
// `state` is the request's own worked example — "10 cooks, 20 security,
// an engineer" — used as the anchor the way the document's 5:10:1 was.
// Every other crew is anchored against it rather than felt: a shop is
// two people because a shop is two people, and a monument is a guard
// because a monument needs keeping rather than operating.
const CREWS = {
  //: The request's own numbers, verbatim, plus the one post it implies
  //: without naming: somebody runs the place.
  state: [
    { occupation: 'cook', count: 10 },
    { occupation: 'officer', count: 20 },
    { occupation: 'engineer', count: 1 },
    { occupation: 'manager', count: 2 },
  ],
  care: [
    { occupation: 'physician', count: 4 },
    { occupation: 'orderly', count: 10 },
    { occupation: 'cook', count: 3 },
    { occupation: 'manager', count: 1 },
  ],
  learning: [
    { occupation: 'librarian', count: 4 },
    { occupation: 'teacher', count: 3 },
    { occupation: 'manager', count: 1 },
  ],
  transit: [
    { occupation: 'navigator', count: 3 },
    { occupation: 'mechanic', count: 6 },
    { occupation: 'labourer', count: 8 },
    { occupation: 'officer', count: 6 },
  ],
  worship: [
    { occupation: 'preacher', count: 2 },
    { occupation: 'cook', count: 2 },
    { occupation: 'labourer', count: 2 },
  ],
  venue: [
    { occupation: 'curator', count: 2 },
    { occupation: 'labourer', count: 6 },
    { occupation: 'cook', count: 3 },
    { occupation: 'officer', count: 5 },
  ],
  tower: [
    { occupation: 'manager', count: 3 },
    { occupation: 'engineer', count: 2 },
    { occupation: 'officer', count: 4 },
    { occupation: 'labourer', count: 4 },
  ],
  shop: [
    { occupation: 'trader', count: 2 },
    { occupation: 'labourer', count: 1 },
  ],
  //: A monument, a bridge, a cave, a rock. Nobody operates it and
  //: somebody watches it — which is why `staff` is null for all of
  //: these and this crew is a single guard. Holding a monument is
  //: still not free, and that is the point.
  unmanned: [
    { occupation: 'officer', count: 1 },
  ],
  //: The real, smallest-honest shape of a large residential
  //: development's on-site staff -- a property manager, not an
  //: institution's full crew.
  'apartment-manager': [
    { occupation: 'manager', count: 1 },
  ],
  //: The casino's real occupational shape: the gaming floor (`dealer`)
  //: is overwhelmingly the largest category at any real casino, with
  //: `pitboss` supervising it, `cashier` at the cage, `bookmaker` at
  //: the sportsbook, and `manager` running the property — flagged
  //: interpretive the same way every other ratio in this table is;
  //: the ABSOLUTE count still comes from `control.maintenanceFor`'s
  //: own measured size and significance, this only says how it
  //: divides.
  casino: [
    { occupation: 'dealer', count: 20 },
    { occupation: 'pitboss', count: 4 },
    { occupation: 'cashier', count: 6 },
    { occupation: 'bookmaker', count: 3 },
    { occupation: 'manager', count: 2 },
    // Found while measuring this crew's own `control.maintenanceFor`
    // composition: zero Combat-skilled posts reported `security: 0`
    // for an undefended casino floor. Real casinos are notably not
    // undefended -- `surveillance` (occupations.js's own real SOC
    // 33-9031) closes it.
    { occupation: 'surveillance', count: 4 },
  ],
  firehouse: [
    { occupation: 'firefighter', count: 10 },
    { occupation: 'manager', count: 1 },
  ],
  ems: [
    { occupation: 'paramedic', count: 8 },
    { occupation: 'manager', count: 1 },
  ],
  ranger: [
    { occupation: 'ranger', count: 6 },
    { occupation: 'manager', count: 1 },
  ],
  //: Real dock labour (`dockworker`) as the bulk of the crew, with
  //: `officer` for port security/customs (the same role `transit`'s
  //: own crew already uses for airport/train-station security) and
  //: `manager` running the terminal.
  port: [
    { occupation: 'dockworker', count: 15 },
    { occupation: 'officer', count: 3 },
    { occupation: 'manager', count: 2 },
  ],
  //: `school` (the 24th category, added when `KEY_LOCATION_DISCOVERY_
  //: WORD_OF_MOUTH_SYSTEM.md` named it) had never been given a crew at
  //: all — `crewFor('school')` returned null since the day the
  //: category existed, the eleventh standing rule's own shape, found
  //: while wiring real multi-role institution staffing. `teacher` as
  //: the bulk of it, `custodian` (real SOC 37, already in this
  //: taxonomy) for upkeep, `manager` running the building — the same
  //: "manager as whoever runs the place" shape `care`/`learning`/
  //: `tower` already hold.
  schoolhouse: [
    { occupation: 'teacher', count: 6 },
    { occupation: 'custodian', count: 2 },
    { occupation: 'manager', count: 1 },
  ],
  //: A mall's own real occupational shape: `salesperson` (SOC 41) for
  //: the mall's own general-merchandise operations, `custodian` (SOC
  //: 37) for common-area upkeep, `manager` running the property --
  //: never a second copy of any individual store's own `RETAIL_TYPES`
  //: crew, which this file's own `mall` comment above declares out of
  //: scope.
  mall: [
    { occupation: 'salesperson', count: 8 },
    { occupation: 'custodian', count: 3 },
    { occupation: 'manager', count: 2 },
  ],
  //: A distribution center's real occupational shape: `dockworker`
  //: (warehouse floor labour) as the bulk of it, `trucker` for the
  //: real fleet a mega-employer the size of a UPS/FedEx/Amazon-style
  //: facility runs, `dispatcher` coordinating loads, `logistician`
  //: (already real, SOC major group 11, tier 5) for the real
  //: supply-chain specialist a facility this size employs, and
  //: `manager` running the building.
  distribution: [
    { occupation: 'dockworker', count: 20 },
    { occupation: 'trucker', count: 12 },
    { occupation: 'dispatcher', count: 3 },
    { occupation: 'logistician', count: 2 },
    { occupation: 'manager', count: 2 },
  ],
  //: A manufacturing plant's real occupational shape: `assembler`
  //: (the production-floor bulk, SOC 51-2092) with `mechanic` (real
  //: equipment upkeep) and `engineer` (real process/industrial
  //: engineering a plant this size employs), `manager` running it.
  plant: [
    { occupation: 'assembler', count: 25 },
    { occupation: 'mechanic', count: 4 },
    { occupation: 'engineer', count: 3 },
    { occupation: 'manager', count: 2 },
  ],
  //: A military installation's real occupational shape: `officer`
  //: (real SOC 55-xxxx/33, the actual garrisoned presence) as the
  //: bulk of it, with `mechanic`/`engineer` for real vehicle/facility
  //: upkeep, `logistician` for real supply, and `physician` for real
  //: base medical — every one of these five already a real occupation
  //: in this taxonomy, already `military`- or `government`-employable,
  //: none invented for this crew.
  garrison: [
    { occupation: 'officer', count: 25 },
    { occupation: 'mechanic', count: 5 },
    { occupation: 'engineer', count: 3 },
    { occupation: 'logistician', count: 2 },
    { occupation: 'physician', count: 2 },
    { occupation: 'manager', count: 1 },
  ],
};

const CREW_NAMES = Object.keys(CREWS);

// Which crew a category takes. Stated per category rather than inferred
// from `propertyType`, because two categories can share a type and take
// completely different staffs — a prison and a library are both
// `government` and are not the same job.
const CREW_BY_CATEGORY = {
  skyscraper: 'tower',
  university: 'learning',
  'government-building': 'state',
  prison: 'state',
  'art-museum': 'venue',
  church: 'worship',
  mosque: 'worship',
  synagogue: 'worship',
  temple: 'worship',
  'masonic-building': 'worship',
  'historic-site': 'unmanned',
  airport: 'transit',
  'train-station': 'transit',
  hospital: 'care',
  'stadium-arena': 'venue',
  library: 'learning',
  school: 'schoolhouse',
  'theater-concert-hall': 'venue',
  'notable-bridge': 'unmanned',
  'monument-memorial': 'unmanned',
  'zoo-aquarium': 'venue',
  'cave-system': 'unmanned',
  'natural-formation': 'unmanned',
  'other-distinctive-feature': 'unmanned',
  casino: 'casino',
  'fire-station': 'firehouse',
  'ems-station': 'ems',
  'ranger-station': 'ranger',
  'port-terminal': 'port',
  mall: 'mall',
  park: 'unmanned',
  'distribution-center': 'distribution',
  'industrial-plant': 'plant',
  'military-base': 'garrison',
  forest: 'unmanned',
  river: 'unmanned',
  lake: 'unmanned',
  'apartment-complex': 'apartment-manager',
};

// Retail is one kind of place, so it is one entry rather than ten.
for (const category of Object.keys(RETAIL_TYPES)) CREW_BY_CATEGORY[category] = 'shop';

function crewNameFor(category) {
  return CREW_BY_CATEGORY[category] ?? null;
}

// The crew ratio for a category, or null where the category has none —
// which is every ordinary house, and is why `control.maintenanceFor`
// still falls back to the generic role composition.
function crewFor(category) {
  const name = crewNameFor(category);
  return name ? CREWS[name] : null;
}

// The crew's own total, which is what a share of it is measured
// against. The `state` crew comes to 33.
function crewTotalFor(category) {
  const crew = crewFor(category);
  return crew === null ? null : crew.reduce((sum, post) => sum + post.count, 0);
}

// ---------------------------------------------------------------------
// staffingFor
// ---------------------------------------------------------------------
// The crew ratio scaled to a real number of people. `total` is what
// `control.maintenanceFor` measured from size and significance; this
// divides it by the crew's own proportions.
//
// **Every post rounds UP to at least one.** A building that needs an
// engineer needs an engineer, and rounding 0.4 of one down to zero is
// how "don't make it easy" quietly becomes "no specialist required" —
// which is the bug this table exists to fix. The consequence is that a
// small place of a demanding kind costs more than its headcount
// suggests, and that is correct: you cannot run a hospital with half a
// physician.
function staffingFor(category, total) {
  const crew = crewFor(category);
  if (crew === null) return null;
  const crewTotal = crewTotalFor(category);
  return crew.map((post) => ({
    occupation: post.occupation,
    count: Math.max(1, Math.round((total * post.count) / crewTotal)),
  }));
}

// ---------------------------------------------------------------------
// How tall a thing is, as three shapes rather than thirty-three numbers
// ---------------------------------------------------------------------
// **Measured, from the first generated world: a cave system with 23
// floors**, tagged `dense`. `worldgen` drew `floors` from one band for
// everything, which was harmless while every property was a house or a
// shop and became nonsense the moment the list included a bridge and a
// rock formation.
//
// The fix is not a floors band per category — that would be thirty-three
// invented numbers where the documents give none. It is three FORMS,
// each a statement about what the category IS rather than a tuned
// figure, and every category says which one it is:
//
//   tower     purpose-built to be tall. One category is.
//   building  a building. Most of them.
//   site      not storeyed at all — a cave, a bridge, a monument, a
//             rock. `floors` of 1 is the honest reading: the question
//             does not really apply, and null would lose the fact that
//             it is a single level.
const FORMS = {
  tower: [12, 60],
  building: [1, 6],
  site: [1, 1],
};

function formOf(category) {
  const definition = definitionOf(category);
  if (!definition) return null;
  return definition.form ?? 'building';
}

function floorsBandFor(category) {
  return FORMS[formOf(category)] ?? FORMS.building;
}

// ---------------------------------------------------------------------
// Reading a category
// ---------------------------------------------------------------------

function definitionOf(category) {
  return KEY_BUILDING_TYPES[category] ?? RETAIL_TYPES[category] ?? null;
}

function isHeroTier(category) {
  // `THE_KEY_BUILDING_TYPES.md`: `alwaysHeroTier: true` for all
  // twenty-three, and the retail list is explicitly a different list.
  return Object.prototype.hasOwnProperty.call(KEY_BUILDING_TYPES, category);
}

const ALL_CATEGORIES = [...KEY_BUILDING_CATEGORIES, ...RETAIL_CATEGORIES];

// The schema's `properties.type` for this category. Retail is all
// `commercial`; hero-tier says which.
function propertyTypeFor(category) {
  if (RETAIL_TYPES[category]) return 'commercial';
  return KEY_BUILDING_TYPES[category]?.propertyType ?? null;
}

function staffPostFor(category) {
  return KEY_BUILDING_TYPES[category]?.staff ?? null;
}

function discoveryPoolFor(category) {
  return definitionOf(category)?.discovery ?? null;
}

// ---------------------------------------------------------------------
// significanceOf
// ---------------------------------------------------------------------
// **The one number the maintain key turns on**, 0-100, read from the
// `historical_records` row a property points at through `history_ref`.
//
// It is NOT stored on the property, and that is the design: a building
// can be repurposed — a monument becomes a fortress — and what it WAS
// has to survive what it BECOMES. `historical_records` is the schema's
// own home for "this happened here and it mattered this much", and
// `significance` is its own column.
//
// Returns 0 rather than null for an ordinary building, and the
// distinction is deliberate: a house with no history has a significance
// of zero, which is a real reading, whereas a property that does not
// exist has none. `null` is reserved for the second.
function significanceOf(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) return null;
  if (property.history_ref === null || property.history_ref === undefined) return 0;
  const record = (worldState.historicalRecords || [])
    .find((r) => r.id === property.history_ref);
  if (!record) return 0;
  const value = Number(record.significance);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

// What kind of landmark this is, or null for an ordinary building.
// Kept on the row because `properties.type` is coarser than the
// documents' categories — five hero categories collapse onto
// `historical_site` — and losing which one it was would be losing the
// thing that makes a mosque different from a bridge.
function categoryOf(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  return property?.landmark_category ?? null;
}

// ---------------------------------------------------------------------
// designate
// ---------------------------------------------------------------------
// Turns an existing property into a landmark of a named category: sets
// the category on the row, writes the `historical_records` row that
// carries its significance, and links the two through `history_ref` —
// the column that has been null on every property this engine ever
// built.
//
// `significance` is drawn by the caller from the category's band rather
// than here, because the draw has to be seeded on the world and this
// module has no seed of its own. Passing it in keeps §88 with the
// caller that knows the seed.
function designate(worldState, options = {}) {
  const {
    propertyId, category, significance, tick = worldState.tick ?? 0,
    what = null, why = null, name = null,
  } = options;

  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) throw new Error(`landmarks.designate: no property ${propertyId}`);
  if (!definitionOf(category)) {
    throw new Error(
      `landmarks.designate: "${category}" is not a Key building or retail category.`,
    );
  }
  if (!Number.isFinite(Number(significance))) {
    throw new Error('landmarks.designate requires a numeric significance (0-100).');
  }

  const record = worldStore.addHistoricalRecord(worldState, {
    who: [],
    what: what ?? `${category} stood here`,
    when_tick: tick,
    // **This is the FK the schema added `properties` for**, and the
    // pairing it has never had: the history points at the place and the
    // place points back.
    where_location_id: property.id,
    why,
    result: null,
    consequences: null,
    future_effects: null,
    significance: Math.max(0, Math.min(100, Number(significance))),
  });

  property.history_ref = record.id;
  property.landmark_category = category;
  // **A landmark with no name is not a landmark.** `properties` had no
  // `name` column at all, so every monument in every world was
  // `id 813, landmark_category 'monument-memorial'` — anonymous, and
  // indistinguishable from the next one. The St. Louis demo this
  // project's own documents point at names every checkpoint
  // (Cahokia Mounds, the Gateway Arch, Confluence Point); nothing here
  // named anything.
  //
  // A caller-supplied name wins, which is how an imported real place
  // keeps the name it actually has. Otherwise this composes one from
  // the category — which is honest rather than good, and the whole
  // point of `landmarkPacks.js` is that a world can do better.
  if (name !== null) property.name = name;
  else if (!property.name) property.name = what ?? `the ${category.replace(/-/g, ' ')}`;
  // **`facilityType`, prison only, and deliberately one honest default
  // rather than an invented distribution.** The real counterpart this
  // engine would need to assign a believable state-prison/federal-
  // prison/county-jail/juvenile-detention/women's-facility/camp split
  // at GENERATION time is a real national count of facilities by kind
  // (BJS's own Census of State and Federal Adult Correctional
  // Facilities, plus OJJDP's juvenile facility census) — checked this
  // round and not found at a confidence this file would stand behind;
  // see `server/prisonPacks.js`'s own header for what WAS found and
  // wired (real demographic composition BY facility type, as data).
  // So every real prison this engine designates reads as the one kind
  // it has always implicitly been — `'state-or-federal-prison'`, an
  // adult facility — rather than silently inventing county-jail or
  // women's-facility counts with no source behind them. `null` would
  // be the honest alternative; a named default is chosen instead
  // because `justice.prisonFor`'s juvenile-safety check (see its own
  // header) needs a concrete value to compare against, and declaring
  // "every real prison is presently typed as an adult facility" is the
  // plain truth about what this pipeline generates today.
  //
  // Left open for a real import: a region pack naming a real facility
  // kind can set this directly. `landmarkPacks.js` carries no such
  // field yet (checked before writing this) — a declared hook, not a
  // claim that one is wired.
  if (category === 'prison' && !property.facilityType) {
    property.facilityType = 'state-or-federal-prison';
  }
  // **`hero_tier` is NOT stored**, and an earlier version of this line
  // stored it. It is `isHeroTier(landmark_category)` and nothing else —
  // standing rule 3, never duplicate a computable rollup. Storing it
  // would also have meant a fifth column in `schema-extensions.sql`
  // carrying a fact the fourth already determines, and the two could
  // then disagree.
  return { property, record };
}

// ---------------------------------------------------------------------
// repurpose
// ---------------------------------------------------------------------
// **A building's past does not fix its future.** Change what it is;
// keep what it was.
//
// `properties.type` moves to the new use and `lifecycle_stage` goes to
// `renovation`, which is a stage the schema already defines and which
// `property.STAGE_MULTIPLIER` already prices at 0.8 — a building mid-
// conversion is worth less than a finished one, and that was true
// before this function existed.
//
// What does NOT move: `history_ref`, the historical record and its
// significance, and `landmarkCategory`. A cathedral turned into a
// granary is a granary that used to be a cathedral, and every one of
// those three facts is still true of it. `formerType` records the
// change on the row so the sequence is readable rather than inferred.
//
// The significance is the point: it is what the maintain key reads, so
// a repurposed monument STILL costs what a monument costs to hold. You
// do not get the Arch's presence and a shed's upkeep.
function repurpose(worldState, options = {}) {
  const {
    propertyId, toType, tick = worldState.tick ?? 0, note = null,
  } = options;

  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) throw new Error(`landmarks.repurpose: no property ${propertyId}`);
  // eslint-disable-next-line global-require
  const { PROPERTY_TYPES } = require('./property.js');
  if (!PROPERTY_TYPES.includes(toType)) {
    throw new Error(
      `landmarks.repurpose: "${toType}" is not a properties.type `
      + `(one of: ${PROPERTY_TYPES.join(', ')}).`,
    );
  }
  if (property.type === toType) return null;

  const from = property.type;
  property.former_type = from;
  property.type = toType;
  property.lifecycle_stage = 'renovation';
  property.repurposed_tick = tick;

  // The conversion is itself a thing that happened here. Written at the
  // significance the place already had rather than at a figure of its
  // own — turning the Arch into a barracks is exactly as notable as the
  // Arch was.
  const record = worldStore.addHistoricalRecord(worldState, {
    who: [],
    what: note ?? `converted from ${from} to ${toType}`,
    when_tick: tick,
    where_location_id: property.id,
    why: null,
    result: null,
    consequences: null,
    future_effects: null,
    significance: significanceOf(worldState, propertyId),
  });

  return {
    property, from, to: toType, record,
  };
}

// ---------------------------------------------------------------------
// densityTierFor
// ---------------------------------------------------------------------
// `properties.density_tier` is a real TEXT column that has been null on
// every property in every world. The schema gives it no vocabulary, so
// these four names are this file's, and they are derived rather than
// drawn: dwellings per unit of land is what density means, and a
// building's floors are how it gets there.
//
// Returns null for a property with no land size, because density over
// unknown land is not a low density — it is not a number at all.
const DENSITY_TIERS = ['rural', 'suburban', 'urban', 'dense'];

//: Dwellings per 1,000 square units of land. The boundaries are round
//: numbers chosen to split a generated world's own spread rather than
//: to match any real planning standard, and `describeLandmarks` reports
//: the distribution so a world that lands entirely in one tier is
//: visible rather than assumed.
const DENSITY_BOUNDARIES = [2, 8, 25];

function densityTierFor(property) {
  if (!property) return null;
  const land = Number(property.land_size);
  if (!Number.isFinite(land) || land <= 0) return null;
  const dwellings = Math.max(1, Number(property.units) || 1)
    * Math.max(1, Number(property.floors) || 1);
  const perThousand = (dwellings / land) * 1000;
  let tier = 0;
  for (const boundary of DENSITY_BOUNDARIES) {
    if (perThousand >= boundary) tier += 1;
  }
  return DENSITY_TIERS[tier];
}

// ---------------------------------------------------------------------
// describeLandmarks
// ---------------------------------------------------------------------
// The measurement. How many of the two documents' categories a world
// actually contains, and how many properties carry the four facts that
// were null on every property ever generated.
function describeLandmarks(worldState) {
  const properties = worldState.properties || [];
  const present = new Set();
  let withHistory = 0;
  let withBedrooms = 0;
  let withDensity = 0;
  let heroTier = 0;
  const byType = {};
  const densities = {};

  for (const property of properties) {
    if (property.landmark_category) present.add(property.landmark_category);
    if (isHeroTier(property.landmark_category)) heroTier += 1;
    if (property.history_ref !== null && property.history_ref !== undefined) withHistory += 1;
    // **`Number(null)` is 0 and 0 is finite**, so a bare
    // `Number.isFinite(Number(x))` counted every monument and every
    // shop as having a measured bedroom count of zero — 196 of 196 on
    // the first generated world, when 175 homes carry one and nothing
    // else does. CLAUDE.md's own corollary, in the function written to
    // measure whether the column got filled.
    if (property.bedrooms !== null && property.bedrooms !== undefined
      && Number.isFinite(Number(property.bedrooms))) withBedrooms += 1;
    if (property.density_tier) {
      withDensity += 1;
      densities[property.density_tier] = (densities[property.density_tier] ?? 0) + 1;
    }
    byType[property.type] = (byType[property.type] ?? 0) + 1;
  }

  const significances = properties
    .map((p) => significanceOf(worldState, p.id))
    .filter((s) => s !== null && s > 0);

  return {
    properties: properties.length,
    categories: ALL_CATEGORIES.length,
    present: [...present].sort(),
    absent: ALL_CATEGORIES.filter((c) => !present.has(c)).sort(),
    heroTier,
    withHistory,
    withBedrooms,
    withDensity,
    byPropertyType: byType,
    byDensityTier: densities,
    meanSignificance: significances.length === 0
      ? null
      : Math.round((significances.reduce((a, b) => a + b, 0) / significances.length) * 100) / 100,
  };
}

module.exports = {
  KEY_BUILDING_TYPES,
  KEY_BUILDING_CATEGORIES,
  REPEATABLE_DENSITY_PER_1K,
  REPEATABLE_CATEGORIES,
  SINGLETON_CATEGORIES,
  densityPer1kFor,
  RETAIL_TYPES,
  RETAIL_CATEGORIES,
  ALL_CATEGORIES,
  CHAOS_ERA_CONDITION,
  DENSITY_TIERS,
  DENSITY_BOUNDARIES,
  CREWS,
  CREW_NAMES,
  CREW_BY_CATEGORY,
  crewNameFor,
  crewFor,
  crewTotalFor,
  staffingFor,
  FORMS,
  formOf,
  floorsBandFor,
  definitionOf,
  isHeroTier,
  propertyTypeFor,
  staffPostFor,
  discoveryPoolFor,
  significanceOf,
  categoryOf,
  designate,
  repurpose,
  densityTierFor,
  describeLandmarks,
};
