// What is actually inside a landmark.
//
// ---------------------------------------------------------------------
// Thirty-three loot tables, written down, and read by nothing
// ---------------------------------------------------------------------
// `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` and
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` between them name a discovery
// pool for every Key building type — hospitals hold medical books,
// libraries hold knowledge books across every category, churches and
// museums hold cultural and historical artifacts, caves hold natural
// resources and lost pre-collapse technology, hardware stores hold
// tools and construction materials.
//
// **All of it was already in `landmarks.KEY_BUILDING_TYPES.discovery`,
// quoted verbatim, on all thirty-three categories.** `grep` for a
// reader returned nothing: `landmark_category` had exactly three
// readers in the engine — staffing, migration and a count statistic —
// and none of them was the loot table. The eleventh standing rule at
// full size.
//
// What the world did instead: `worldgen` scattered books onto 12% of
// people with a dice roll, so a library and a zoo were equally likely
// to hold a book, which is to say the library was not a library.
//
// ---------------------------------------------------------------------
// The dead column this woke up
// ---------------------------------------------------------------------
// `artifacts.location_id` has been in the schema since it was written
// and `missions.generateArtifact` has always accepted it. **No caller
// had ever passed one**, so no artifact in any world had ever come from
// anywhere. A relic found in a cathedral now records the cathedral.
//
// ---------------------------------------------------------------------
// And the guard found the next gap immediately
// ---------------------------------------------------------------------
// `describeDiscovery` reports four §26 categories that pools draw from
// and **no item in a generated world belongs to**: clothing, food,
// repair and transport. So searching a clothing store, a grocery or an
// auto-parts store finds nothing — the same shape as the cloth that
// made `blade` unmakeable in `salvage.js`. It is reported rather than
// patched here because those four are exactly the merchandise
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` specifies, and inventing them
// in this file would be inventing the retail system.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const discovery = require('../server/discovery.js');
const landmarks = require('../server/landmarks.js');
const knowledge = require('../server/knowledge.js');
const items = require('../server/items.js');
const inventory = require('../server/inventory.js');
const actions = require('../server/actions.js');

const YEAR = 365;

function world(options = {}) {
  const { tick = 10000 } = options;
  return {
    tick,
    seed: 'discovery-test',
    npcs: [],
    properties: [],
    historicalRecords: [],
    communities: [{ id: 1, city_id: 1 }],
    inventory: [],
    barterItems: [],
    artifacts: [],
    events: [],
    entityTraits: [],
    employmentRecords: [],
    families: [],
    familyMemberships: [],
    organizations: [],
    relationships: [],
  };
}

function person(w, id, options = {}) {
  const { age = 30, communityId = 1 } = options;
  w.npcs.push({
    id, status: 'active', communityId, education: 'secondary',
    createdTick: w.tick - age * YEAR, traits: {},
  });
  return w.npcs[w.npcs.length - 1];
}

// A landmark with a REAL significance, because capacity is computed
// from it. `significanceOf` reads `historical_records.significance`
// through `properties.history_ref`, so a fixture that set a bare number
// on the property would be testing a field nothing reads.
function landmark(w, id, category, significance = 80, communityId = 1) {
  const record = { id: 5000 + id, significance, where_location_id: id };
  w.historicalRecords.push(record);
  w.properties.push({
    id,
    type: landmarks.propertyTypeFor(category),
    landmark_category: category,
    history_ref: record.id,
    condition: 100,
    land_size: 500,
    floors: 1,
    occupants: [],
    community_id: communityId,
    operating_organization_id: null,
    discoveries_taken: 0,
  });
  return w.properties[w.properties.length - 1];
}

// ---------------------------------------------------------------------
// The pools are the documents', mapped onto real vocabularies
// ---------------------------------------------------------------------

test('every Key category has a pool entry, and nothing else does', () => {
  assert.deepEqual(
    Object.keys(discovery.POOLS).sort(),
    landmarks.ALL_CATEGORIES.slice().sort(),
  );
});

test('every pool names real knowledge fields and real §26 categories', () => {
  // Standing rule 6: a pool naming something nothing defines yields
  // nothing forever and no fixture would notice.
  const trade = new Set(items.TRADE_CATEGORIES);
  for (const [category, pool] of Object.entries(discovery.POOLS)) {
    if (pool === null) continue;
    if (Array.isArray(pool.books)) {
      for (const field of pool.books) {
        assert.ok(knowledge.FIELD_NAMES.includes(field), `${category} → field "${field}"`);
      }
    } else if (pool.books !== undefined) {
      assert.equal(pool.books, 'all', `${category}.books must be a list or "all"`);
    }
    for (const c of pool.itemCategories ?? []) {
      assert.ok(trade.has(c), `${category} → §26 category "${c}"`);
    }
    assert.ok(
      pool.books || pool.artifacts || pool.itemCategories,
      `${category} has a pool object that offers nothing`,
    );
  }
});

test('a category the documents give no pool is null, not an empty pool', () => {
  // "The document does not say" and "the document says nothing is
  // here" are different facts. `landmarks.js` already drew this line
  // for the same rows and this keeps it.
  assert.equal(discovery.POOLS.prison, null);
  assert.equal(discovery.POOLS['gun-store'], null);
  assert.equal(discovery.POOLS['department-store'], null);
  // And a poolless landmark holds nothing rather than throwing.
  const w = world();
  landmark(w, 1, 'prison', 90);
  assert.equal(discovery.findsAt(w, 1), 0);
});

test('every book source a pool maps to is one a hand can hold', () => {
  // §24 separates sources that are objects from sources that are
  // places and people — you cannot carry a university out of a
  // university. `HOLDING_SOURCES` is that line and this stays behind it.
  for (const source of Object.values(discovery.BOOK_SOURCE_BY_POOL)) {
    assert.ok(knowledge.HOLDING_SOURCES.includes(source), source);
  }
});

// ---------------------------------------------------------------------
// Capacity, and running out
// ---------------------------------------------------------------------

test('a more significant place holds more', () => {
  const w = world();
  landmark(w, 1, 'library', 90);
  landmark(w, 2, 'library', 20);
  assert.ok(discovery.findsAt(w, 1) > discovery.findsAt(w, 2));
});

test('a place with no recorded history still holds something', () => {
  const w = world();
  const p = landmark(w, 1, 'library', 0);
  p.history_ref = null;
  assert.equal(discovery.findsAt(w, 1), discovery.MINIMUM_FINDS);
});

test('an ordinary building has no pool at all — null, not zero', () => {
  // Null is "this question does not apply to a house"; zero is "this
  // landmark has been picked clean". Collapsing them would make an
  // area of houses read as an area of emptied landmarks.
  const w = world();
  w.properties.push({ id: 9, type: 'residential', community_id: 1, landmark_category: null });
  assert.equal(discovery.findsAt(w, 9), null);
  assert.equal(discovery.remainingAt(w, 9), null);
});

test('a landmark runs out, and says so rather than yielding forever', () => {
  // Standing rule 13: a mechanism with no inverse has no equilibrium.
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'library', 60);
  const held = discovery.findsAt(w, 10);
  assert.ok(held > 0);

  for (let i = 0; i < held; i += 1) discovery.search(w, p.id, 10, { tick: w.tick + i });
  assert.equal(discovery.remainingAt(w, 10), 0);
  assert.throws(() => discovery.search(w, p.id, 10), /searched out/);
});

test('searching a building that is not a landmark is refused', () => {
  const w = world();
  person(w, 1);
  w.properties.push({ id: 9, type: 'residential', community_id: 1, landmark_category: null });
  assert.throws(() => discovery.search(w, 1, 9), /not a landmark/);
});

test('searching a category the documents give no pool for is refused, not invented', () => {
  const w = world();
  person(w, 1);
  landmark(w, 10, 'prison', 90);
  assert.throws(() => discovery.search(w, 1, 10), /no discovery pool/);
});

// ---------------------------------------------------------------------
// What comes out
// ---------------------------------------------------------------------

test('a library yields a book that lands in real hands', () => {
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'library', 80);
  const result = discovery.search(w, p.id, 10);
  assert.equal(result.found.kind, 'book');
  assert.equal(inventory.quantityOf(w, p.id, result.found.itemName), 1);
  // And it is a real §24 item, not a string this file made up.
  assert.equal(items.findItem(w, result.found.itemName).category, 'knowledge');
});

test('a hospital yields medicine — its own pool, not a generic one', () => {
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'hospital', 90);
  const kinds = new Set();
  for (let i = 0; i < discovery.findsAt(w, 10); i += 1) {
    const found = discovery.search(w, p.id, 10, { tick: w.tick + i }).found;
    if (found) kinds.add(found.field ?? found.category);
  }
  for (const kind of kinds) {
    assert.ok(['medicine', 'tools'].includes(kind), `a hospital yielded ${kind}`);
  }
});

test('a cathedral yields an artifact, and the artifact remembers where', () => {
  // `artifacts.location_id` — a real column, accepted by
  // `generateArtifact` since it was written, passed by no caller ever.
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'church', 70);
  const result = discovery.search(w, p.id, 10);
  assert.equal(result.found.kind, 'artifact');
  const artifact = w.artifacts.find((a) => a.id === result.found.artifactId);
  assert.equal(artifact.location_id, 10);
  assert.equal(artifact.origin, 'church');
});

test('a pool drawing on a category no item belongs to finds nothing, and still costs a find', () => {
  // Otherwise a fruitless category is searchable forever — the same
  // infinite-supply shape the capacity limit exists to prevent. This is
  // the measured case: no item in a generated world is §26 `food`.
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'grocery-store', 50);
  const before = discovery.remainingAt(w, 10);
  const result = discovery.search(w, p.id, 10);
  assert.equal(result.found, null);
  assert.equal(discovery.remainingAt(w, 10), before - 1);
});

test('searching is deterministic for the same world, tick and place', () => {
  // §88. Two identical worlds searched identically produce the same find.
  const run = () => {
    const w = world();
    const p = person(w, 1);
    landmark(w, 10, 'library', 80);
    return discovery.search(w, p.id, 10, { tick: 12345 }).found.itemName;
  };
  assert.equal(run(), run());
});

// ---------------------------------------------------------------------
// The per-area question
// ---------------------------------------------------------------------

test('searchableIn answers for one area, and drops what is spent', () => {
  const w = world();
  const p = person(w, 1);
  landmark(w, 10, 'library', 80, 1);
  landmark(w, 11, 'church', 80, 2);
  assert.deepEqual(discovery.searchableIn(w, 1).map((x) => x.id), [10]);
  assert.deepEqual(discovery.searchableIn(w, 2).map((x) => x.id), [11]);

  for (let i = 0; i < discovery.findsAt(w, 10); i += 1) {
    discovery.search(w, p.id, 10, { tick: w.tick + i });
  }
  assert.deepEqual(discovery.searchableIn(w, 1), []);
});

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

test('runDiscovery reaches people and empties places over time', () => {
  // Standing rule 11 — without a pass, three player verbs and 33 pools
  // are reachable by exactly one person in the world.
  const w = world();
  for (let i = 1; i <= 25; i += 1) person(w, i);
  landmark(w, 100, 'library', 90);
  landmark(w, 101, 'hospital', 90);

  const before = discovery.remainingAt(w, 100) + discovery.remainingAt(w, 101);
  let events = [];
  for (let t = 0; t < 400; t += 1) events.push(...discovery.runDiscovery(w, w.tick + t));
  const after = discovery.remainingAt(w, 100) + discovery.remainingAt(w, 101);

  assert.ok(after < before, 'nobody searched anything in four hundred days');
  assert.ok(events.length > 0);
  for (const event of events) {
    assert.equal(event.type, 'discovery_made');
    // The fields `runEventPhase` actually keeps — it builds the stored
    // row from six named fields and silently drops the rest.
    assert.ok(event.note.includes(`entity ${event.affected_entity_ids[0]}`));
    assert.ok(event.global_effects.propertyId);
  }
});

test('runDiscovery stops once everything is searched out', () => {
  // The pass must not keep running on an exhausted world — and the
  // exhaustion has to be what stops it, not a coincidence of the draw.
  const w = world();
  for (let i = 1; i <= 25; i += 1) person(w, i);
  landmark(w, 100, 'library', 30);
  for (let t = 0; t < 2000; t += 1) discovery.runDiscovery(w, w.tick + t);
  assert.equal(discovery.remainingAt(w, 100), 0);
  assert.deepEqual(discovery.runDiscovery(w, w.tick + 3000), []);
});

test('runDiscovery reads communityId, not community_id', () => {
  // Standing rule 6, and `salvage.runSalvage` got this exact line wrong
  // first: an NPC is an engine object with `communityId`, a property is
  // a database row with `community_id`.
  //
  // **Sized so it does not depend on `SEARCH_CHANCE`.** The first
  // version used one person over 600 ticks, which passed at a rate of
  // 0.01 and failed the moment a playtest showed that rate stripped a
  // world bare in eighty days. A test whose subject is a field name
  // should not break when a balance constant moves, so this gives the
  // draw enough opportunity to be certain at any plausible rate.
  const w = world();
  for (let i = 1; i <= 30; i += 1) {
    const p = person(w, i, { communityId: 1 });
    delete p.community_id;
  }
  landmark(w, 100, 'library', 90, 1);
  for (let t = 0; t < 3000; t += 1) discovery.runDiscovery(w, w.tick + t);
  assert.ok(
    discovery.remainingAt(w, 100) < discovery.findsAt(w, 100),
    'nobody in thirty people searched anything in three thousand days — the lookup missed',
  );
});

// ---------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------

test('describeDiscovery names the poolless categories rather than hiding them', () => {
  const report = discovery.describeDiscovery(world());
  assert.equal(report.categories, 34);
  assert.ok(report.poolless.includes('prison'));
  assert.ok(report.poolless.length < report.categories, 'nothing is searchable at all');
});

test('every knowledge field is reachable from some pool', () => {
  // Standing rule 14's shape: a field no pool produces is a field
  // nobody can ever learn from a book they found.
  assert.deepEqual(discovery.describeDiscovery(world()).unreachableFields, []);
});

test('the guard reports item categories no item in the world belongs to', () => {
  // **This is how the merchandise gap was found.** On a bare world the
  // guard names four §26 categories that real pools draw from and
  // nothing belongs to — clothing, food, repair and transport — so
  // searching a grocery store found nothing, every time, for ever.
  const bare = discovery.describeDiscovery(world());
  assert.ok(bare.emptyCategories.length > 0, 'the guard has stopped being able to see this');
  for (const category of bare.emptyCategories) {
    assert.ok(items.TRADE_CATEGORIES.includes(category), category);
  }

  // And this is it closed. `merchandise.js` registers the goods
  // COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md names, so every pool has
  // something behind it — which is the assertion that matters, because
  // the one above only proves the guard works.
  const w = world();
  require('../server/merchandise.js').registerItems(w);
  require('../server/salvage.js').registerItems(w);
  assert.deepEqual(discovery.describeDiscovery(w).emptyCategories, []);
});

// ---------------------------------------------------------------------
// The player verb
// ---------------------------------------------------------------------

test('search-location is a dispatchable action backed by a real verb', () => {
  assert.ok(actions.listActions('citizen').map((a) => a.action).includes('search-location'));
  assert.doesNotThrow(() => actions.assertActionsAreReal());
});
