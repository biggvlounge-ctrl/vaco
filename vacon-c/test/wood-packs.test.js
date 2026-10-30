// A real University of Maryland GLAD forest-cover reading, re-centring
// and re-spreading the invented `wood` resource supply band — see
// `server/woodPacks.js`'s own header for why the canonical resource
// type is `wood`, not the stale `timber` example in `economy.js`'s
// own comment.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const woodPacks = require('../server/woodPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    plots: [{ plotId: 'p1', treeCoverPct2000: 80, status: 'intact-forest' }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.woodPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(woodPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(woodPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(woodPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a plot needs a plotId, a real treeCoverPct2000, and a real status', () => {
  const noId = woodPacks.validatePack(pack({ plots: [{ treeCoverPct2000: 50, status: 'intact-forest' }] }));
  assert.ok(noId.some((p) => p.includes('plotId')));

  const badCover = woodPacks.validatePack(pack({ plots: [{ plotId: 'p1', treeCoverPct2000: 150, status: 'intact-forest' }] }));
  assert.ok(badCover.some((p) => p.includes('treeCoverPct2000')));

  const badStatus = woodPacks.validatePack(pack({ plots: [{ plotId: 'p1', treeCoverPct2000: 50, status: 'thriving' }] }));
  assert.ok(badStatus.some((p) => p.includes('status')));
});

test('an empty plots array is refused', () => {
  const problems = woodPacks.validatePack(pack({ plots: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// plotFor / effectiveTreeCoverPct / woodSupplyRangeFor
// ---------------------------------------------------------------------

test('plotFor cycles by position, and is null with no pack', () => {
  const p = pack({ plots: [{ plotId: 'A', treeCoverPct2000: 10, status: 'non-forest' }, { plotId: 'B', treeCoverPct2000: 90, status: 'intact-forest' }] });
  assert.equal(woodPacks.plotFor(p, 0).plotId, 'A');
  assert.equal(woodPacks.plotFor(p, 1).plotId, 'B');
  assert.equal(woodPacks.plotFor(p, 2).plotId, 'A', 'position 2 should wrap');
  assert.equal(woodPacks.plotFor(null, 0), null);
});

test('effectiveTreeCoverPct reads the real baseline for intact and non forest', () => {
  assert.equal(woodPacks.effectiveTreeCoverPct({ treeCoverPct2000: 85, status: 'intact-forest' }), 85);
  assert.equal(woodPacks.effectiveTreeCoverPct({ treeCoverPct2000: 10, status: 'non-forest' }), 10);
});

test('a real lost-forest plot reads as 0 effective cover, not its stale 2000 baseline', () => {
  // The stock is gone -- using the year-2000 figure would overstate
  // what is actually standing today.
  assert.equal(woodPacks.effectiveTreeCoverPct({ treeCoverPct2000: 90, status: 'lost-forest' }), 0);
});

test('effectiveTreeCoverPct is null with no real reading, never a guessed zero', () => {
  assert.equal(woodPacks.effectiveTreeCoverPct(null), null);
  assert.equal(woodPacks.effectiveTreeCoverPct({ status: 'intact-forest' }), null);
});

test('woodSupplyRangeFor re-centres the invented band proportionally to real cover', () => {
  // ORDINARY_TREE_COVER_PCT is 50; a plot at exactly that reference
  // should reproduce the invented band's own centre and width.
  const [low, high] = woodPacks.woodSupplyRangeFor({ treeCoverPct2000: 50, status: 'intact-forest' });
  const [inventedLow, inventedHigh] = woodPacks.INVENTED_WOOD_SUPPLY_RANGE;
  assert.equal(low, inventedLow);
  assert.equal(high, inventedHigh);
});

test('a real zero effective cover produces a real zero supply range, not an invented floor', () => {
  // A literal 0% reading, and a lost-forest plot (whose stale 2000
  // baseline is forced to 0 by effectiveTreeCoverPct) -- both are real
  // zero effective cover, so both produce a real [0, 0] range.
  assert.deepEqual(woodPacks.woodSupplyRangeFor({ treeCoverPct2000: 0, status: 'non-forest' }), [0, 0]);
  assert.deepEqual(woodPacks.woodSupplyRangeFor({ treeCoverPct2000: 95, status: 'lost-forest' }), [0, 0]);
});

test('a low but non-zero non-forest reading scales proportionally, never snapped to zero', () => {
  // Only a real zero reading or a lost-forest plot forces the range
  // to [0, 0] -- an ordinary low non-forest percentage still scales
  // the invented band's own shape, the same as any other real value.
  const [low, high] = woodPacks.woodSupplyRangeFor({ treeCoverPct2000: 10, status: 'non-forest' });
  assert.ok(low > 0 && high > low);
});

test('woodSupplyRangeFor is null with no real plot', () => {
  assert.equal(woodPacks.woodSupplyRangeFor(null), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real wood pack draws wood supply from the real range', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'wood-pack-test',
      woodPack: pack({ plots: [{ plotId: 'p1', treeCoverPct2000: 0, status: 'non-forest' }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    const wood = w.resources.find((r) => r.city_id === city.id && r.resource_type === 'wood');
    assert.ok(wood, 'no real wood resource was generated for this city');
    // A real 0% reading's real range is [0, 0] -- the supply must be
    // exactly 0, not the invented [60, 140] band.
    assert.equal(wood.supply, 0);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-wood-pack',
      woodPack: { region: 'X', source: 'sample', plots: [{ plotId: 'p1', treeCoverPct2000: 200, status: 'intact-forest' }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no wood pack still draws wood from the invented [60, 140] band', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-wood-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const city = w.cities[w.cities.length - 1];
  const wood = w.resources.find((r) => r.city_id === city.id && r.resource_type === 'wood');
  assert.ok(wood);
  assert.ok(wood.supply >= 60 && wood.supply <= 140);
  cleanup();
});
