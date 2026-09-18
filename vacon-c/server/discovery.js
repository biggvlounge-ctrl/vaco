// server/discovery.js
//
// **What is actually inside a landmark.**
//
// `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` is unusually
// concrete: "the Key building types should be the primary source of
// high-tier discoveries — books, weapons, technology, artifacts", with
// a pool per type. Hospitals hold medical books and medicine.
// Schools and libraries hold knowledge books across every category.
// Churches and museums hold cultural and historical artifacts.
// Skyscrapers hold technology, blueprints and business records. Caves
// hold natural resources and lost pre-collapse technology. Government
// buildings hold laws, records and security equipment.
//
// ---------------------------------------------------------------------
// It was all there already, as a string
// ---------------------------------------------------------------------
// `landmarks.KEY_BUILDING_TYPES` carries a `discovery` field on all
// twenty-three hero categories and all ten retail ones, quoted verbatim
// from those two documents. **`grep` for a reader returns nothing.**
// Thirty-three loot tables, written down, correct, and decorative —
// `landmark_category` has exactly three readers in the whole engine
// (staffing, migration, and a count statistic) and none of them is
// this. The eleventh standing rule in its purest form.
//
// What the world did instead: `worldgen` scattered books onto 12% of
// people with a dice roll (`survivingBookRate`). So a library and a
// zoo were equally likely to hold a book, which is to say the library
// was not a library.
//
// ---------------------------------------------------------------------
// Three kinds of find, because the documents name three
// ---------------------------------------------------------------------
// No fourth vocabulary. Every find is a thing some other module already
// defines, and this file is the map from a category to which of them:
//
//   **books**     `knowledge.js`'s §24 items — a field and a source.
//                 This is what makes a library a library.
//   **artifacts** `missions.generateArtifact`, which has always taken a
//                 `location_id` that **no caller has ever passed**. A
//                 relic found in a cathedral now records the cathedral.
//   **items**     a §26 trade category, resolved against the live
//                 catalogue — so a hardware store yields whatever tools
//                 that world actually defines, including anything
//                 `salvage.js` registered.
//
// ---------------------------------------------------------------------
// A place runs out
// ---------------------------------------------------------------------
// Standing rule 13: a mechanism with no inverse has no equilibrium, and
// a landmark that can be searched forever is an infinite supply of
// books. `properties.discoveries_taken` counts what has been carried
// out, `findsAt` is what the place held to begin with, and the
// difference is what is left. The capacity comes from
// `landmarks.significanceOf` rather than a per-category number, because
// a place worth remembering is a place with more in it, and that is one
// constant instead of thirty-three.

'use strict';

const landmarks = require('./landmarks.js');
const items = require('./items.js');

// ---------------------------------------------------------------------
// POOLS — the prose, turned into references
// ---------------------------------------------------------------------
//: Keyed on the same category vocabulary `landmarks.js` carries, and
//: the test asserts every category has an entry and every entry names a
//: real knowledge field or a real §26 category. A category the
//: documents give no pool for is `null` here — NOT an empty pool —
//: because "the document does not say" and "the document says nothing
//: is here" are different facts, and `landmarks.js` already made that
//: distinction for these same rows.
//:
//: `books: 'all'` is the two documents' own "knowledge books across
//: every category", kept as a word rather than expanded into the field
//: list so it stays true if §24 ever gains a field.
const POOLS = {
  // -- hero tier ------------------------------------------------------
  skyscraper: { books: ['technology', 'manufacturing', 'government'] },
  university: { books: 'all' },
  'government-building': { books: ['government'], itemCategories: ['protection'] },
  prison: null,
  'art-museum': { artifacts: true },
  church: { artifacts: true },
  mosque: { artifacts: true },
  synagogue: { artifacts: true },
  temple: { artifacts: true },
  'masonic-building': { artifacts: true },
  'historic-site': { artifacts: true },
  airport: { books: ['technology', 'engineering'] },
  'train-station': { books: ['technology', 'engineering'] },
  hospital: { books: ['medicine'], itemCategories: ['medicine', 'tools'] },
  'stadium-arena': null,
  library: { books: 'all' },
  // The discovery document's own "Schools/Libraries → knowledge books
  // across every category" — one clause, two categories, and until
  // `landmarks.js` gained a `school` there was only one to attach it to.
  school: { books: 'all' },
  'theater-concert-hall': { artifacts: true },
  'notable-bridge': null,
  'monument-memorial': { artifacts: true },
  'zoo-aquarium': null,
  // The document gives caves both halves, and they are the only
  // category that yields a resource AND a relic.
  'cave-system': { itemCategories: ['materials', 'metals'], artifacts: true },
  'natural-formation': { itemCategories: ['materials', 'metals'] },
  'other-distinctive-feature': null,

  // -- retail ---------------------------------------------------------
  //: COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md's merchandise pools, which
  //: are §26 categories almost word for word — "tools, construction
  //: materials", "clothing, fabric, protective gear", "medicine,
  //: medical supplies". `gun-store` and `department-store` appear in
  //: the type union and not in the prose list, so the document gives
  //: them no pool; `landmarks.js` recorded that with a null and this
  //: does the same rather than inventing one.
  'hardware-store': { itemCategories: ['tools', 'materials'] },
  'clothing-store': { itemCategories: ['clothing', 'textiles', 'protection'] },
  'grocery-store': { itemCategories: ['food'] },
  pharmacy: { itemCategories: ['medicine'] },
  'sporting-goods-store': { itemCategories: ['tools', 'protection'] },
  'electronics-store': { itemCategories: ['tools'], books: ['technology'] },
  'auto-parts-store': { itemCategories: ['repair', 'transport'] },
  bookstore: { books: 'all' },
  'gun-store': null,
  'department-store': null,
};

//: How much a place holds, per point of historical significance.
//: `significanceOf` is 0-100, so at 0.1 a monument at 90 holds nine
//: finds and a hardware store at 25 holds two. One constant instead of
//: thirty-three, and it makes the maintain key, the takeover key and
//: this system all read the same number about the same building.
const FINDS_PER_SIGNIFICANCE = 0.1;

//: What a place with no recorded history holds. Not zero — an ordinary
//: shop still has something on its shelves — but the floor, so that
//: significance is what separates a cathedral from a corner store.
const MINIMUM_FINDS = 1;

// Which source a found book is. §24's `HOLDING_SOURCES` are the ones
// that can sit in a hand; `libraries`, `universities` and
// `experienced NPCs` are places and people, not objects, and
// `knowledge.js` already draws that line.
const BOOK_SOURCE_BY_POOL = {
  'technology': 'blueprints',
  'engineering': 'blueprints',
  'medicine': 'manuals',
  'government': 'preserved records',
  'manufacturing': 'manuals',
};

function poolFor(category) {
  return POOLS[category] ?? null;
}

// ---------------------------------------------------------------------
// How much is left
// ---------------------------------------------------------------------

// What this place held before anybody searched it. Null for a building
// that is not a landmark at all — an ordinary house has no pool, which
// is `salvage.js`'s business rather than this file's.
function findsAt(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property || !property.landmark_category) return null;
  if (poolFor(property.landmark_category) === null) return 0;
  const significance = landmarks.significanceOf(worldState, propertyId) ?? 0;
  return Math.max(MINIMUM_FINDS, Math.round(significance * FINDS_PER_SIGNIFICANCE));
}

function takenAt(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  const taken = Number(property?.discoveries_taken);
  return Number.isFinite(taken) ? taken : 0;
}

function remainingAt(worldState, propertyId) {
  const total = findsAt(worldState, propertyId);
  if (total === null) return null;
  return Math.max(0, total - takenAt(worldState, propertyId));
}

// Everywhere in this area still worth searching. The per-area question,
// which is the one a player standing in a neighbourhood actually asks.
function searchableIn(worldState, communityId) {
  return (worldState.properties || [])
    .filter((p) => p.community_id === communityId
      && p.landmark_category
      && remainingAt(worldState, p.id) > 0);
}

// ---------------------------------------------------------------------
// search — carry one thing out
// ---------------------------------------------------------------------
// Deterministic from position and tick (§88): the same world searched
// the same way twice produces the same find.
function search(worldState, entityId, propertyId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  // eslint-disable-next-line global-require
  const seeded = require('./seeded.js');
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  // eslint-disable-next-line global-require
  const knowledge = require('./knowledge.js');
  // eslint-disable-next-line global-require
  const missions = require('./missions.js');

  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) throw new Error(`no property ${propertyId}`);
  if (!property.landmark_category) {
    throw new Error(`property ${propertyId} is not a landmark — there is no pool to search`);
  }
  const pool = poolFor(property.landmark_category);
  if (pool === null) {
    throw new Error(
      `the documents give ${property.landmark_category} no discovery pool, `
      + 'and one is not invented here',
    );
  }
  if (remainingAt(worldState, propertyId) <= 0) {
    throw new Error(`property ${propertyId} has been searched out`);
  }

  // Which KIND of find, among the kinds this pool actually offers.
  const kinds = [];
  if (pool.books) kinds.push('book');
  if (pool.artifacts) kinds.push('artifact');
  if (pool.itemCategories) kinds.push('item');
  const kind = kinds[Math.floor(seeded.seededDraw(['find-kind', tick, propertyId, entityId]) * kinds.length)];

  let found = null;
  if (kind === 'book') {
    knowledge.registerItems(worldState);
    const fields = pool.books === 'all' ? knowledge.FIELD_NAMES : pool.books;
    const field = fields[Math.floor(seeded.seededDraw(['find-field', tick, propertyId]) * fields.length)];
    const source = BOOK_SOURCE_BY_POOL[field] ?? 'books';
    const itemName = knowledge.itemNameFor(field, source);
    inventory.give(worldState, { entityId, itemName, quantity: 1, tick });
    found = { kind: 'book', itemName, field, source };
  } else if (kind === 'artifact') {
    // **`location_id` is the point.** `artifacts.location_id` has been
    // a real column since the schema was written and `generateArtifact`
    // has always accepted it; no caller ever passed one, so no artifact
    // in any world had ever come from anywhere.
    const artifact = missions.generateArtifact(worldState, {
      name: `relic of ${property.landmark_category.replace(/-/g, ' ')} ${property.id}`,
      origin: property.landmark_category,
      locationId: property.id,
      condition: Math.round(Number(property.condition ?? 100)),
    });
    found = { kind: 'artifact', artifactId: artifact.id, name: artifact.name };
  } else {
    const categories = pool.itemCategories;
    const category = categories[
      Math.floor(seeded.seededDraw(['find-cat', tick, propertyId]) * categories.length)
    ];
    // Against the LIVE catalogue, so a world that registered salvage's
    // materials finds them and one that did not does not — rather than
    // this file holding a second opinion about what exists.
    const candidates = items.itemsFor(worldState).filter((i) => i.category === category);
    if (candidates.length === 0) {
      // Nothing of that kind exists in this world. Honest, and not an
      // error: the search happened and turned up nothing, which is a
      // real outcome and must still cost the place a find, or a
      // fruitless category would be searchable forever.
      property.discoveries_taken = takenAt(worldState, propertyId) + 1;
      return { propertyId, found: null, category, remaining: remainingAt(worldState, propertyId) };
    }
    const item = candidates[
      Math.floor(seeded.seededDraw(['find-item', tick, propertyId, entityId]) * candidates.length)
    ];
    inventory.give(worldState, { entityId, itemName: item.name, quantity: 1, tick });
    found = { kind: 'item', itemName: item.name, category };
  }

  property.discoveries_taken = takenAt(worldState, propertyId) + 1;
  return { propertyId, found, remaining: remainingAt(worldState, propertyId) };
}

// ---------------------------------------------------------------------
// runDiscovery — the pass
// ---------------------------------------------------------------------
// Same shape and the same reasoning as `salvage.runSalvage`, and
// deliberately a separate pass rather than a branch inside it: salvage
// is what you do to an empty building, searching is what you do to a
// landmark, and folding them together would make the rate of one
// depend on the supply of the other.
//
// Who searches: anybody, employed or not. Searching a cathedral is not
// a job — this is the correction `runSalvage` needed after measuring,
// applied first time here rather than after.
const SEARCH_CHANCE = 0.01;
const SEARCH_AGE = 16;

function runDiscovery(worldState, tick = worldState.tick ?? 0) {
  // eslint-disable-next-line global-require
  const mortality = require('./mortality.js');
  // eslint-disable-next-line global-require
  const seeded = require('./seeded.js');

  // Worked out once per pass, not per person — the quadratic
  // `control.noteRecruitment` had to be rewritten to avoid.
  const open = new Map();
  for (const p of worldState.properties || []) {
    if (!p.landmark_category) continue;
    if (remainingAt(worldState, p.id) <= 0) continue;
    if (poolFor(p.landmark_category) === null) continue;
    if (!open.has(p.community_id)) open.set(p.community_id, []);
    open.get(p.community_id).push(p);
  }
  if (open.size === 0) return [];

  const events = [];
  const people = (worldState.npcs || []).filter((n) => n.status === 'active');
  people.forEach((npc, index) => {
    const age = mortality.ageInYears(worldState, npc, tick);
    if (age === null || age < SEARCH_AGE) return;
    if (seeded.seededDraw(['discover', tick, index]) > SEARCH_CHANCE) return;

    // `communityId` on a person, `community_id` on a property —
    // standing rule 6, and `runSalvage` got this wrong first.
    const nearby = open.get(npc.communityId);
    if (!nearby || nearby.length === 0) return;
    const pick = nearby[
      Math.floor(seeded.seededDraw(['discover-site', tick, index]) * nearby.length)
    ];
    if (!pick || remainingAt(worldState, pick.id) <= 0) return;

    const result = search(worldState, npc.id, pick.id, { tick });
    if (result.found === null) return;
    events.push({
      type: 'discovery_made',
      severity: 'low',
      note: `entity ${npc.id} found ${result.found.itemName ?? result.found.name} `
        + `in ${pick.landmark_category.replace(/-/g, ' ')} ${pick.id}`,
      tick,
      affected_entity_ids: [npc.id],
      global_effects: { kind: result.found.kind, propertyId: pick.id },
    });
  });
  return events;
}

// ---------------------------------------------------------------------
// describeDiscovery — the guard
// ---------------------------------------------------------------------
// The claim is that hero locations are the primary source of high-tier
// finds. That is false if a pool names something the world cannot
// produce, so this reports the three ways it could be:
//
//   poolless        categories the documents give no pool for. Expected
//                   and named, not a defect — but if it ever covers
//                   every category in a world, nothing is searchable.
//   emptyCategories a §26 category some pool draws from that NO item in
//                   this world belongs to. The `blade`-and-cloth gap
//                   from `salvage.js`, pointed at loot.
//   unreachable     a knowledge field no pool can produce a book for.
function describeDiscovery(worldState) {
  const categories = Object.keys(POOLS);
  const poolless = categories.filter((c) => POOLS[c] === null);

  const drawn = new Set();
  const fields = new Set();
  for (const category of categories) {
    const pool = POOLS[category];
    if (!pool) continue;
    for (const c of pool.itemCategories ?? []) drawn.add(c);
    if (pool.books === 'all') {
      // eslint-disable-next-line global-require
      for (const f of require('./knowledge.js').FIELD_NAMES) fields.add(f);
    } else for (const f of pool.books ?? []) fields.add(f);
  }

  const catalogue = items.itemsFor(worldState);
  const emptyCategories = [...drawn].filter(
    (c) => !catalogue.some((i) => i.category === c),
  );
  // eslint-disable-next-line global-require
  const allFields = require('./knowledge.js').FIELD_NAMES;
  const unreachable = allFields.filter((f) => !fields.has(f));

  const marks = (worldState.properties || []).filter((p) => p.landmark_category);
  let held = 0;
  let left = 0;
  for (const p of marks) {
    held += findsAt(worldState, p.id) ?? 0;
    left += remainingAt(worldState, p.id) ?? 0;
  }

  return {
    categories: categories.length,
    poolless,
    emptyCategories,
    unreachableFields: unreachable,
    landmarksInWorld: marks.length,
    categoriesInWorld: [...new Set(marks.map((p) => p.landmark_category))].length,
    findsHeld: held,
    findsRemaining: left,
  };
}

module.exports = {
  POOLS,
  FINDS_PER_SIGNIFICANCE,
  MINIMUM_FINDS,
  BOOK_SOURCE_BY_POOL,
  SEARCH_CHANCE,
  SEARCH_AGE,
  poolFor,
  findsAt,
  takenAt,
  remainingAt,
  searchableIn,
  search,
  runDiscovery,
  describeDiscovery,
};
