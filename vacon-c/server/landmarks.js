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
};

const KEY_BUILDING_CATEGORIES = Object.keys(KEY_BUILDING_TYPES);

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
  'theater-concert-hall': 'venue',
  'notable-bridge': 'unmanned',
  'monument-memorial': 'unmanned',
  'zoo-aquarium': 'venue',
  'cave-system': 'unmanned',
  'natural-formation': 'unmanned',
  'other-distinctive-feature': 'unmanned',
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
