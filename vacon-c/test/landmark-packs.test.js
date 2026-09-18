// Real named places, imported per region.
//
// ---------------------------------------------------------------------
// The system this engine reinvented instead of consuming
// ---------------------------------------------------------------------
// `world-layer/UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` describes one
// shared Earth model every gameplay system reads from — a
// hero/regional/filler tier vocabulary, a `landmarkData` slice per
// location, a runnable UNESCO importer, seven modules and one store.
// Its own status section ends: "**Genuinely unbuilt**: the consumers.
// VACON-C is paused, so the world model is generated and read by
// nothing yet."
//
// **VACON-C is not paused.** `server/landmarks.js` was written here
// without anybody finding `world-layer/locations.js`, so there were two
// answers to "what landmarks are in this area": one anonymous and
// generated per city, one real and imported per region. Standing rule 3
// at the level of whole systems.
//
// ---------------------------------------------------------------------
// What was measured before this
// ---------------------------------------------------------------------
//   * `properties` had no `name` column, so every landmark in every
//     world was `id 813, landmark_category 'monument-memorial'`.
//   * `communities` had no `name` column either, so no pack could say
//     which neighbourhood a place is in.
//   * landmarks were placed per CITY — six hero and five retail, once,
//     for the whole map — so a world reached **11 of the Key's 33
//     categories** and two of five neighbourhoods had nothing in them
//     at all.
//
// After: 38 landmarks across six named St. Louis areas, all named, with
// the Gateway Arch in Downtown and the Cathedral Basilica in the
// Central West End because that is where they are.
//
// ---------------------------------------------------------------------
// The sources are blocked, and that is reported rather than worked round
// ---------------------------------------------------------------------
// `query.wikidata.org`, `whc.unesco.org` and `services1.arcgis.com`
// each return 403 CONNECT at the agent proxy, re-checked directly. So
// `data/st-louis.landmarks.json` declares `source: "sample"` — the
// honest label, not a placeholder — and a real NRHP import replaces it
// without a line of code changing here.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const landmarkPacks = require('../server/landmarkPacks.js');
const landmarks = require('../server/landmarks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

const PACK_PATH = path.join(__dirname, '..', 'data', 'st-louis.landmarks.json');
const stLouis = () => JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    areas: ['Old Town'],
    locations: [{ name: 'The Bell Tower', category: 'monument-memorial', area: 'Old Town' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(landmarkPacks.validatePack(pack()), []);
});

test('a pack with an unknown category is refused, not partly placed', () => {
  // Standing rule 6: silently dropping the row would produce a world
  // that looks generated with no sign an import was asked for.
  const problems = landmarkPacks.validatePack(pack({
    locations: [{ name: 'X', category: 'wizard-tower' }],
  }));
  assert.ok(problems.some((p) => p.includes('wizard-tower')));
  assert.throws(() => landmarkPacks.assertPack(pack({
    locations: [{ name: 'X', category: 'wizard-tower' }],
  })), /not usable/);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(landmarkPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(landmarkPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('half a coordinate pair is a mistake, not a choice', () => {
  // Coordinates are optional — a register gives them, a hand-made pack
  // may not, and a landmark with none is still a landmark. One of two
  // is somebody losing the other.
  const problems = landmarkPacks.validatePack(pack({
    locations: [{ name: 'X', category: 'library', lat: 38.6 }],
  }));
  assert.ok(problems.some((p) => p.includes('together')));
});

test('a pack’s significance stays on the engine’s own 0-100 scale', () => {
  assert.ok(landmarkPacks.validatePack(pack({
    locations: [{ name: 'X', category: 'library', significance: 400 }],
  })).some((p) => p.includes('0-100')));
});

test('a pack’s own score wins; the category’s band is the fallback', () => {
  // UNESCO inscription is 100 and that judgement belongs to the
  // importer. Where a row gives nothing, an imported place and a
  // generated one end up on one scale.
  assert.equal(landmarkPacks.significanceFor({ significance: 96 }, 40), 96);
  assert.equal(landmarkPacks.significanceFor({}, 40), 40);
  assert.equal(landmarkPacks.significanceFor(null, 40), 40);
});

// ---------------------------------------------------------------------
// The St. Louis pack — the worked example the documents point at
// ---------------------------------------------------------------------

test('the St. Louis pack is usable, and is honest about being a sample', () => {
  const p = stLouis();
  assert.deepEqual(landmarkPacks.validatePack(p), []);
  // **`source: "sample"` is the whole point.** A hand-made pack
  // claiming to be an NRHP import is exactly the dishonesty
  // AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md was written to stop.
  assert.equal(p.source, 'sample');
  assert.ok(p.note.includes('403'), 'the pack does not say why it is a sample');
});

test('the pack carries coordinates only where this repo already had them', () => {
  // Three locations appear with real coordinates in
  // `hvntz/lib/seedDemoData.js`; the rest omit them rather than invent
  // a number, which the validator permits by design.
  const withCoords = stLouis().locations.filter((l) => l.lat !== undefined);
  assert.equal(withCoords.length, 3);
  for (const l of withCoords) {
    assert.ok(Number.isFinite(l.lat) && Number.isFinite(l.lng), l.name);
  }
});

test('a real register holds no hardware stores, and the pack says so', () => {
  // The division of labour that makes this honest: heritage comes from
  // the register, ordinary commerce is generated. A pack claiming to
  // list every shop in a city would be a pack claiming too much.
  const report = landmarkPacks.describePack(stLouis());
  assert.ok(report.usable);
  for (const category of landmarks.RETAIL_CATEGORIES) {
    assert.ok(report.missingCategories.includes(category), `pack claims to know the ${category}`);
  }
});

test('byArea groups a pack the way a neighbourhood asks about it', () => {
  const grouped = landmarkPacks.byArea(stLouis());
  assert.ok(grouped.has('Downtown'));
  assert.ok(grouped.get('Downtown').some((l) => l.name === 'Gateway Arch'));
  assert.ok(grouped.get('Central West End')
    .some((l) => l.name === 'Cathedral Basilica of Saint Louis'));
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a pack places real places in real areas', () => {
  const p = stLouis();
  try {
    // Passed to `generateWorld`, not set on the world first: "assign a
    // field on WorldState, then call this" is a contract nobody
    // discovers.
    worldgen.generateWorld({
      seed: 'pack-test', landmarkPack: p, communitiesPerCity: p.areas.length,
    });
    const w = engine.WorldState;
    const marks = w.properties.filter((x) => x.landmark_category);

    assert.ok(marks.length > 0);
    assert.equal(marks.filter((m) => !m.name).length, 0, 'a landmark came out nameless');

    const arch = marks.find((m) => m.name === 'Gateway Arch');
    assert.ok(arch, 'the pack was accepted and the Arch was not built');
    const area = w.communities.find((c) => c.id === arch.community_id);
    assert.equal(area.name, 'Downtown', 'the Arch was not placed where the pack says it is');
    // And it is an ordinary property, which is the point of reading
    // `world-layer` rather than reimplementing it: the significance
    // model, the crew, the discovery pool and the maintain key all
    // apply unchanged.
    assert.equal(landmarks.significanceOf(w, arch.id), 100);
  } finally {
    delete engine.WorldState.landmarkPack;
  }
});

test('every area gets landmarks — the per-area key, not a per-city one', () => {
  // The measured failure: six hero and five retail placed once for a
  // whole map left two of five neighbourhoods with nothing in them.
  worldgen.generateWorld({ seed: 'per-area' });
  const w = engine.WorldState;
  const withLandmarks = new Set(
    w.properties.filter((p) => p.landmark_category).map((p) => p.community_id),
  );
  for (const community of w.communities) {
    assert.ok(withLandmarks.has(community.id), `community ${community.id} has nothing in it`);
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  // A world that looks generated with no sign an import was asked for
  // and dropped is the worst of the three outcomes.
  delete engine.WorldState.landmarkPack;
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-pack',
      landmarkPack: { region: 'X', source: 'sample', locations: [{ name: 'Y', category: 'nope' }] },
    }),
    /not usable/,
  );
  delete engine.WorldState.landmarkPack;
});

test('a world with no pack still builds, and its landmarks are still named', () => {
  // A pack is an enrichment, never a requirement.
  delete engine.WorldState.landmarkPack;
  worldgen.generateWorld({ seed: 'no-pack' });
  const marks = engine.WorldState.properties.filter((p) => p.landmark_category);
  assert.ok(marks.length > 0);
  assert.equal(marks.filter((m) => !m.name).length, 0);
  // And an ordinary house is still nameless, because a house has no name.
  assert.ok(engine.WorldState.properties.some((p) => !p.landmark_category && !p.name));
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('world-layer’s exported Key matches this engine’s Key, exactly', () => {
  // `world-layer/exportRegion.js` duplicates the category list rather
  // than importing it, because no app may import across that directory
  // boundary (the per-app Docker build context). Duplication is the
  // cost of that rule; this assertion is what stops it becoming drift —
  // and drift here means an importer that silently drops every row of a
  // category the consumer knows.
  //
  // Read from disk rather than required, for the same boundary reason.
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'exportRegion.js'), 'utf8',
  );
  const block = source.match(/const KEY_CATEGORIES = \[([\s\S]*?)\];/);
  assert.ok(block, 'world-layer/exportRegion.js no longer declares KEY_CATEGORIES');
  const theirs = [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(theirs.slice().sort(), landmarks.KEY_BUILDING_CATEGORIES.slice().sort());
});
