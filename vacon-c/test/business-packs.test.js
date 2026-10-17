// Real named retail businesses, imported per region —
// `landmark-packs.test.js`'s sibling for the ten retail types rather
// than the twenty-four hero ones.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` placed retail shops per area by drawing WITHOUT
// replacement from `landmarks.RETAIL_CATEGORIES` — a real mechanism,
// but every shop it placed was anonymous. `world-layer/imports/
// overtureImport.js` already turns real Overture Places records into
// a real business name and category, written onto `landmarkData` —
// the same field the hero importers use — but `exportRegion.js`'s own
// `KEY_CATEGORIES` filter only covers the hero vocabulary, so a retail
// import was never actually exportable. This closes the other half.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const businessPacks = require('../server/businessPacks.js');
const landmarks = require('../server/landmarks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    businesses: [{ name: 'Old Town Hardware', category: 'hardware-store', area: 'Old Town' }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.businessPack;
  delete engine.WorldState.landmarkPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(businessPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(businessPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(businessPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a business needs a name — an unattributed business cannot be checked', () => {
  const problems = businessPacks.validatePack(pack({
    businesses: [{ category: 'hardware-store' }],
  }));
  assert.ok(problems.some((p) => p.includes('name')));
});

test('a non-retail category is refused, not silently placed', () => {
  // Standing rule 6: silently dropping the row would produce a world
  // that looks generated with no sign an import was asked for.
  const problems = businessPacks.validatePack(pack({
    businesses: [{ name: 'The Gateway Arch', category: 'monument-memorial' }],
  }));
  assert.ok(problems.some((p) => p.includes('monument-memorial')));
  assert.throws(() => businessPacks.assertPack(pack({
    businesses: [{ name: 'The Gateway Arch', category: 'monument-memorial' }],
  })), /not usable/);
});

test('half a coordinate pair is a mistake, not a choice', () => {
  const problems = businessPacks.validatePack(pack({
    businesses: [{ name: 'X', category: 'bookstore', lat: 38.6 }],
  }));
  assert.ok(problems.some((p) => p.includes('together')));
});

test('an empty businesses array is refused', () => {
  const problems = businessPacks.validatePack(pack({ businesses: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// byArea / businessesForArea
// ---------------------------------------------------------------------

test('byArea groups a pack the way a neighbourhood asks about it', () => {
  const p = pack({
    businesses: [
      { name: 'Old Town Hardware', category: 'hardware-store', area: 'Old Town' },
      { name: 'Old Town Pharmacy', category: 'pharmacy', area: 'Old Town' },
      { name: 'Riverside Books', category: 'bookstore', area: 'Riverside' },
    ],
  });
  const grouped = businessPacks.byArea(p);
  assert.equal(grouped.get('Old Town').length, 2);
  assert.equal(grouped.get('Riverside').length, 1);
});

test('businessesForArea is empty with no pack or no coverage for that area', () => {
  const p = pack();
  assert.deepEqual(businessPacks.businessesForArea(null, 'Old Town'), []);
  assert.deepEqual(businessPacks.businessesForArea(p, 'Nowhere'), []);
  assert.equal(businessPacks.businessesForArea(p, 'Old Town').length, 1);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a pack places a real, named business in its real area', () => {
  // A landmark pack names the community the same way
  // `landmark-packs.test.js` does; the business pack's own `area`
  // matches it, exactly like `landmarkPacks.byArea`.
  const landmarkPack = {
    region: 'Testville',
    source: 'sample',
    areas: ['Old Town'],
    locations: [{ name: 'The Old Town Clock', category: 'monument-memorial', area: 'Old Town' }],
  };
  const businessPack = pack();
  try {
    worldgen.generateWorld({
      seed: 'business-pack-test',
      landmarkPack,
      businessPack,
      communitiesPerCity: 1,
    });
    const w = engine.WorldState;
    const shop = w.properties.find((p) => p.name === 'Old Town Hardware');
    assert.ok(shop, 'the real business was not placed');
    assert.equal(shop.landmark_category, 'hardware-store');
    const area = w.communities.find((c) => c.id === shop.community_id);
    assert.equal(area.name, 'Old Town', 'the real business was not placed in its own area');
  } finally {
    cleanup();
  }
});

test('a world with no business pack still builds shops exactly as before', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.properties.length;
  worldgen.generateWorld({ seed: 'no-business-pack', communitiesPerCity: 1 });
  // Scoped to what THIS call made, never the whole accumulated world —
  // `engine.WorldState` is a shared module-level singleton other tests
  // in this file have already added properties to.
  const made = w.properties.slice(before);
  const shops = made.filter((p) => landmarks.RETAIL_CATEGORIES.includes(p.landmark_category));
  assert.ok(shops.length > 0);
  // The composed, category-derived name `landmarks.designate` has
  // always fallen back to — "a hardware store on this corner" — not a
  // real Overture business name, since there is no pack to supply one.
  assert.ok(shops.every((s) => !s.name.includes('Old Town Hardware')));
  cleanup();
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-business-pack',
      businessPack: { region: 'X', source: 'sample', businesses: [{ name: 'Y', category: 'nope' }] },
    }),
    /not usable/,
  );
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module validates against landmarks.RETAIL_CATEGORIES, not a private copy', () => {
  const problems = businessPacks.validatePack(pack({
    businesses: landmarks.RETAIL_CATEGORIES.map((category, i) => ({ name: `Shop ${i}`, category })),
  }));
  assert.deepEqual(problems, []);
});
