// Every free dataset this project has identified, and what it saves.
//
// ---------------------------------------------------------------------
// Sixteen sources named across the documents, one wired
// ---------------------------------------------------------------------
// `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` §8 names six "to evaluate",
// `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` names three more,
// `OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md` names a tenth with six
// themes inside it, and the cost documents name Cesium's terrain and
// buildings. Before this, **UNESCO was the only one with an importer**
// — which is not a criticism of documents that say "evaluate", but it
// did mean the question "what can somebody building a region pull down
// for free today?" had no answer, and the answer turns out to be most
// of a world.
//
// Two more were added from the project's own lost document titles:
// `REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` was about BLS labour
// data, and Census ACS covers the demographics beside it. The documents
// are gone; the data they were about is free and still there.
//
// ---------------------------------------------------------------------
// Why this is a cost test, not a plumbing test
// ---------------------------------------------------------------------
// §7's hierarchy prices Tier 1 as "real, paid human work" and Tier 3 as
// "fully automated". `costModel.estimateBuildCost` prices tiers and knew
// nothing about DATA, so a world with every dataset wired and a world
// with none priced identically — which is why the architecture
// document's own implementation note concedes the 90%/10% automation
// target "is an aspiration with no measurement behind it".
//
// `automationCoverage` is the measurement, and these tests hold it to
// reporting SHARES rather than money. Turning "6 of 7 slices automated"
// into a percentage off would invent the one figure nobody has measured
// — the labour cost per slice.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const sources = require('../sources');
const costModel = require('../costModel');
const { LOCATION_TIERS, createWorldLayer, generateLocation, setLocationData } = require('../locations');
const overture = require('../imports/overtureImport');
const nrhp = require('../imports/nrhpImport');
const wikidata = require('../imports/wikidataImport');

// ---------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------

test('every source names a licence, an access path and a host', () => {
  // A source with no stated access path is a source nobody can use, and
  // an unnamed licence is a liability discovered by somebody else.
  for (const [key, source] of Object.entries(sources.SOURCES)) {
    assert.ok(source.name, `${key} has no name`);
    assert.ok(source.licence, `${key} has no licence`);
    assert.ok(source.access, `${key} has no access path`);
    assert.ok(source.host, `${key} has no host`);
    assert.ok(source.note, `${key} has no note saying what it is for`);
  }
});

test('every source fills real slices and serves real tiers', () => {
  // Standing rule 6's shape: a source claiming to fill a slice that
  // does not exist fills nothing, forever, and nothing would notice.
  for (const [key, source] of Object.entries(sources.SOURCES)) {
    assert.ok(source.fills.length > 0, `${key} fills nothing`);
    for (const slice of source.fills) {
      assert.ok(sources.WORLD_SLICES.includes(slice), `${key} → slice "${slice}"`);
    }
    assert.ok(source.tiers.length > 0, `${key} serves no tier`);
    for (const tier of source.tiers) {
      assert.ok(LOCATION_TIERS.includes(tier), `${key} → tier "${tier}"`);
    }
  }
});

test('a source claiming to be wired points at a file that exists', () => {
  // The difference between a source we HAVE and one we have READ ABOUT.
  // A `wired` path that does not resolve is the citation-is-not-presence
  // failure this whole repo keeps finding.
  const fs = require('node:fs');
  const path = require('node:path');
  for (const key of sources.wiredSources()) {
    const file = path.join(__dirname, '..', sources.SOURCES[key].wired);
    assert.ok(fs.existsSync(file), `${key} claims ${sources.SOURCES[key].wired}, which is not there`);
  }
});

test('every slice is covered by a source or declared uncoverable', () => {
  // "Nothing covers this" and "we forgot to look" are different facts
  // and only one is a budget line.
  const report = sources.describeSources();
  assert.deepEqual(report.uncoveredSlices, []);
  for (const slice of report.uncoveredByDesign) {
    assert.ok(sources.UNCOVERED_BY_DESIGN[slice], `${slice} is uncovered with no reason given`);
  }
});

test('licences nobody has re-checked are counted, not assumed current', () => {
  // `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`: dataset terms
  // change quietly and must be re-checked at build time rather than
  // trusted from design-phase research. This counts the trust currently
  // being extended.
  const report = sources.describeSources();
  assert.equal(report.licencesUnverified.length, sources.SOURCE_NAMES.length);
  for (const key of report.licencesUnverified) {
    assert.equal(sources.SOURCES[key].licenceCheckedAt, null);
  }
});

test('sources whose conditions reach the shipped product are named', () => {
  // ODbL share-alike and a commercial API are late-discovered costs if
  // nobody writes them down early.
  const report = sources.describeSources();
  assert.ok(report.encumbered.includes('cesiumBuildings'));
  assert.ok(report.encumbered.includes('openstreetmap'));
  assert.ok(report.encumbered.includes('openweather'));
});

// ---------------------------------------------------------------------
// Overture Places — the retail Key locations
// ---------------------------------------------------------------------

test('all ten retail Key location types are reachable from Overture categories', () => {
  // `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`'s list is closed, so the
  // map must be complete rather than a sample — a store type no
  // category reaches is a store type that never appears in an import.
  const reachable = new Set(Object.values(overture.CATEGORY_MAP));
  for (const type of [
    'hardware-store', 'clothing-store', 'grocery-store', 'pharmacy',
    'sporting-goods-store', 'electronics-store', 'auto-parts-store',
    'bookstore', 'gun-store', 'department-store',
  ]) {
    assert.ok(reachable.has(type), `nothing maps to ${type}`);
  }
});

test('a dotted Overture category matches on its prefix and its leaf', () => {
  assert.equal(overture.categoryFor('hardware').category, 'hardware-store');
  assert.equal(overture.categoryFor('hardware.paint_store').category, 'hardware-store');
  assert.equal(overture.categoryFor('retail.shopping.bookstore').category, 'bookstore');
  assert.equal(overture.categoryFor('health.hospital').category, 'hospital');
});

test('an unrecognised category is skipped and named, never defaulted', () => {
  // Overture carries every business on earth; most are legitimately not
  // Key locations. Defaulting them to `other-distinctive-feature` turns
  // a city into one category with nothing to show it happened.
  assert.equal(overture.categoryFor('eat_and_drink.restaurant.pizza'), null);
  const layer = createWorldLayer();
  const { imported, skipped } = overture.importOverturePlaces(layer, [
    { name: 'Joe\'s Pizza', category: 'eat_and_drink.restaurant.pizza', lat: 1, lng: 2 },
  ]);
  assert.equal(imported.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /not a Key location type/);
});

test('Overture places land as locations with their real names and category', () => {
  const layer = createWorldLayer();
  const { imported } = overture.importOverturePlaces(layer, [
    {
      names: { primary: 'Riverside Hardware' },
      categories: { primary: 'hardware' },
      geometry: { coordinates: [-90.19, 38.62] },
      addresses: [{ locality: 'Downtown' }],
    },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, 'Riverside Hardware');
  assert.equal(imported[0].lat, 38.62);
  assert.equal(imported[0].landmarkData.category, 'hardware-store');
  assert.equal(imported[0].landmarkData.area, 'Downtown');
  // **No significance.** Overture knows a business exists; it does not
  // know what it is worth remembering, and a made-up score here would
  // put an invented number where the consumer expects a sourced one.
  assert.equal(imported[0].landmarkData.historicalImportance, undefined);
});

// ---------------------------------------------------------------------
// NRHP — the source that answers a region
// ---------------------------------------------------------------------

test('NRHP significance comes from the Register’s own published grading', () => {
  // Sourced ordering, interpretive spacing — and anchored below
  // UNESCO's 100 so all the sources land on one scale.
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL.national > nrhp.SIGNIFICANCE_BY_LEVEL.state);
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL.state > nrhp.SIGNIFICANCE_BY_LEVEL.local);
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL['national-historic-landmark'] < 100);
  assert.equal(nrhp.significanceFor({ nationalHistoricLandmark: true }), 90);
  assert.equal(nrhp.significanceFor({ level: 'Local' }), 40);
  // Ungraded is null, not the lowest grade — different facts.
  assert.equal(nrhp.significanceFor({ name: 'X' }), null);
});

test('a listing’s category comes from its function, not its resource type', () => {
  // The Register classifies Building / Structure / Site / District,
  // which is a preservation vocabulary and does not say "this is a
  // library".
  assert.equal(nrhp.categoryFor({ historicFunction: 'Education/Library' }), 'library');
  assert.equal(nrhp.categoryFor({ currentFunction: 'Social/Meeting Hall' }), 'masonic-building');
  assert.equal(nrhp.categoryFor({ historicFunction: 'Agriculture/Farmhouse' }), null);
});

test('a National Historic Landmark is hero tier; an ordinary listing is regional', () => {
  // §7's cost hinge: hero is paid human work, regional is AI-assisted
  // refinement. Decided from the source's own grading rather than here.
  const layer = createWorldLayer();
  const { imported } = nrhp.importNrhpListings(layer, [
    { name: 'Old Courthouse', historicFunction: 'Government/Courthouse', nationalHistoricLandmark: true, lat: 38.62, lng: -90.19 },
    { name: 'Moolah Temple', historicFunction: 'Social/Meeting Hall', level: 'Local', lat: 38.63, lng: -90.23 },
  ]);
  assert.equal(imported[0].tier, 'hero');
  assert.equal(imported[1].tier, 'regional');
  assert.equal(imported[0].landmarkData.historicalImportance, 90);
});

test('a listing with withheld coordinates is flagged rather than placed at a guess', () => {
  // The Register withholds coordinates for archaeological sites, to
  // stop looting. That is deliberate and gets recorded, not papered
  // over with a plausible point.
  const layer = createWorldLayer();
  const { imported } = nrhp.importNrhpListings(layer, [
    { name: 'A Mound Site', historicFunction: 'Landscape/Natural Feature', level: 'State' },
  ]);
  assert.equal(imported[0].landmarkData.coordinatesWithheld, true);
});

test('a farmhouse is skipped with a reason — a listed property is not a hero landmark', () => {
  const layer = createWorldLayer();
  const { imported, skipped } = nrhp.importNrhpListings(layer, [
    { name: 'Smith Farmhouse', historicFunction: 'Agriculture/Farmhouse', lat: 1, lng: 2 },
  ]);
  assert.equal(imported.length, 0);
  assert.match(skipped[0].reason, /not a hero landmark/);
});

// ---------------------------------------------------------------------
// Wikidata and Commons — names and pictures
// ---------------------------------------------------------------------

test('an image carries its OWN licence, because Commons licences per file', () => {
  assert.deepEqual(wikidata.obligationsFor({ licence: 'CC-BY-SA' }), {
    licence: 'cc-by-sa', attribution: true, shareAlike: true,
  });
  assert.deepEqual(wikidata.obligationsFor({ licence: 'CC0' }), {
    licence: 'cc0', attribution: false, shareAlike: false,
  });
});

test('an image with no recognisable licence is unknown, not free', () => {
  // Shipping an unknown as if it were free is how a licence problem
  // becomes somebody else's discovery.
  assert.equal(wikidata.obligationsFor({ licence: 'probably fine' }), null);
  assert.equal(wikidata.obligationsFor({}), null);
});

test('a picture can be attached to a location imported from any source', () => {
  // Pictures arrive separately in practice: import a region's landmarks
  // from NRHP, then go looking for reference art.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Old Courthouse', lat: 38.62, lng: -90.19, tier: 'hero' });
  setLocationData(layer, place.id, 'landmarkData', { category: 'government-building' });

  wikidata.attachImage(layer, place.id, {
    file: 'Old Courthouse StL.jpg', url: 'https://example/x.jpg', licence: 'CC-BY-SA', author: 'A Photographer',
  });
  assert.equal(place.landmarkData.category, 'government-building', 'attaching an image lost the category');
  assert.equal(place.landmarkData.image.obligations.shareAlike, true);
});

test('describeImages reports the licence position, including the unknowns', () => {
  const layer = createWorldLayer();
  const a = generateLocation(layer, { name: 'A', lat: 1, lng: 2, tier: 'hero' });
  const b = generateLocation(layer, { name: 'B', lat: 3, lng: 4, tier: 'hero' });
  wikidata.attachImage(layer, a.id, { url: 'u1', licence: 'CC-BY' });
  wikidata.attachImage(layer, b.id, { url: 'u2', licence: 'unclear' });

  const report = wikidata.describeImages(layer);
  assert.equal(report.withImage, 2);
  assert.equal(report.requiringAttribution, 1);
  assert.deepEqual(report.unlicensedImages, ['B']);
});

// ---------------------------------------------------------------------
// Every fetch is honest about being blocked
// ---------------------------------------------------------------------

test('each fetch says why it cannot run and what to call instead', () => {
  // Checked directly on 18 Sep 2026: every source host returns 403
  // CONNECT at this environment's agent proxy. Per /root/.ccr/README.md
  // that is report-do-not-work-around — so each stub names the block,
  // names the real access path, and names the import function that does
  // the work once records are in hand.
  for (const fetcher of [
    overture.fetchOverturePlaces,
    nrhp.fetchNrhpListings,
    wikidata.fetchWikidataEntities,
    wikidata.fetchCommonsImages,
  ]) {
    assert.throws(fetcher, (error) => {
      assert.match(error.message, /not implemented/);
      assert.match(error.message, /proxy allowlist/);
      assert.match(error.message, /import|attachImage/i);
      return true;
    });
  }
});

// ---------------------------------------------------------------------
// The cost measurement
// ---------------------------------------------------------------------

test('automationCoverage reports a share per tier, and names what would close each gap', () => {
  const report = costModel.automationCoverage();
  for (const tier of LOCATION_TIERS) {
    const row = report.byTier[tier];
    assert.ok(row, `no coverage for ${tier}`);
    assert.ok(row.wiredShare >= 0 && row.wiredShare <= 1);
    for (const gap of row.identifiedOnly) {
      assert.ok(gap.wouldClose.length > 0, `${tier}/${gap.slice} is a gap nothing would close`);
      for (const key of gap.wouldClose) assert.ok(sources.SOURCES[key], key);
    }
  }
  // Hero is the tier §7 prices as real paid human work, and it is the
  // one fully covered by free data — which is the finding, not a
  // coincidence: UNESCO, NRHP, Wikidata and Commons all aim there.
  assert.equal(report.byTier.hero.wiredShare, 1);
});

test('automationCoverage reports shares and never money', () => {
  // Turning coverage into a percentage off would invent the one number
  // nobody has measured — labour cost per slice. `estimateBuildCost`
  // already sets the rule: a rate nobody supplied is not a rate of zero.
  const report = costModel.automationCoverage();
  const asText = JSON.stringify(report);
  assert.ok(!/\$/.test(asText), 'automationCoverage quoted a currency figure');
  for (const row of Object.values(report.byTier)) {
    assert.equal(row.cost, undefined);
    assert.equal(row.saving, undefined);
  }
});

test('the hero rate is still a per-unit rate, not a launch invoice', () => {
  // Kept beside the new coverage numbers because it is the most
  // expensive misreading available in these documents: $420K-$960K is
  // full global Tier 1 coverage over the life of the project.
  const [low, high] = costModel.HERO_RATE_ON_FILE.perLocation;
  const { tierTotal, tierScope } = costModel.HERO_RATE_ON_FILE.derivedFrom;
  assert.equal(Math.round(tierTotal[0] / tierScope), low);
  assert.equal(Math.round(tierTotal[1] / tierScope), high);
});
