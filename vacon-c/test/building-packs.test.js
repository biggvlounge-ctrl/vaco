// A real Overture Maps building footprint, re-centring the invented
// `landSize`/`floors` a generated home has drawn since Phase 1 — the
// one join assigned by a running count of homes actually built, not
// by city or community like every other pack here. Read
// server/buildingPacks.js's own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const buildingPacks = require('../server/buildingPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    propertyType: 'residential',
    buildings: [{ buildingId: 'b1', propertyType: 'residential', footprintArea: 180, numFloors: 2 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.buildingPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(buildingPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(buildingPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(buildingPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a pack must declare one real property type from the real vocabulary', () => {
  assert.ok(buildingPacks.validatePack(pack({ propertyType: 'spaceship' })).some((p) => p.includes('propertyType')));
});

test('a building needs a buildingId', () => {
  const problems = buildingPacks.validatePack(pack({ buildings: [{ footprintArea: 100 }] }));
  assert.ok(problems.some((p) => p.includes('buildingId')));
});

test('a building of a known, disagreeing type is refused, not silently used', () => {
  const problems = buildingPacks.validatePack(
    pack({ buildings: [{ buildingId: 'b1', propertyType: 'commercial', footprintArea: 100 }] }),
  );
  assert.ok(problems.some((p) => p.includes('disagrees')));
});

test('a building of unknown type is tolerated', () => {
  assert.deepEqual(
    buildingPacks.validatePack(pack({ buildings: [{ buildingId: 'b1', footprintArea: 100 }] })),
    [],
  );
});

test('footprintArea, heightMetres and numFloors are checked when present', () => {
  assert.ok(buildingPacks.validatePack(
    pack({ buildings: [{ buildingId: 'b1', footprintArea: -1 }] }),
  ).some((p) => p.includes('footprintArea')));
  assert.ok(buildingPacks.validatePack(
    pack({ buildings: [{ buildingId: 'b1', heightMetres: 0 }] }),
  ).some((p) => p.includes('heightMetres')));
  assert.ok(buildingPacks.validatePack(
    pack({ buildings: [{ buildingId: 'b1', numFloors: 2.5 }] }),
  ).some((p) => p.includes('numFloors')));
});

test('an empty buildings array is refused', () => {
  const problems = buildingPacks.validatePack(pack({ buildings: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real property type validates as its own pack', () => {
  for (const propertyType of buildingPacks.PROPERTY_TYPES) {
    assert.deepEqual(
      buildingPacks.validatePack(pack({ propertyType, buildings: [{ buildingId: 'b1', footprintArea: 100 }] })),
      [],
    );
  }
});

// ---------------------------------------------------------------------
// buildingFor / landSizeFor / floorsFor / heightMetresFor
// ---------------------------------------------------------------------

test('buildingFor cycles by position, and is null with no pack', () => {
  const p = pack({
    buildings: [
      { buildingId: 'A', footprintArea: 100 },
      { buildingId: 'B', footprintArea: 200 },
    ],
  });
  assert.equal(buildingPacks.buildingFor(p, 0).buildingId, 'A');
  assert.equal(buildingPacks.buildingFor(p, 1).buildingId, 'B');
  assert.equal(buildingPacks.buildingFor(p, 2).buildingId, 'A', 'position 2 should wrap');
  assert.equal(buildingPacks.buildingFor(null, 0), null);
});

test('landSizeFor reads a real footprintArea, rounded, and null with no real measurement', () => {
  assert.equal(buildingPacks.landSizeFor({ footprintArea: 123.6 }), 124);
  assert.equal(buildingPacks.landSizeFor({}), null);
  assert.equal(buildingPacks.landSizeFor(null), null);
});

test('floorsFor reads a real integer floor count, and null otherwise — never derived from height', () => {
  assert.equal(buildingPacks.floorsFor({ numFloors: 3 }), 3);
  assert.equal(buildingPacks.floorsFor({ heightMetres: 30 }), null,
    'a height with no real floor count should not be converted into one');
  assert.equal(buildingPacks.floorsFor(null), null);
});

test('heightMetresFor reads a real height, and null otherwise', () => {
  assert.equal(buildingPacks.heightMetresFor({ heightMetres: 12.5 }), 12.5);
  assert.equal(buildingPacks.heightMetresFor({}), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real building pack draws land size and floors from the real building', () => {
  const w = engine.WorldState;
  const before = w.properties.length;
  try {
    worldgen.generateWorld({
      seed: 'building-pack-test',
      buildingPack: pack({ buildings: [{ buildingId: 'b1', footprintArea: 250, numFloors: 4 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 5,
    });
    const made = w.properties.slice(before).filter((p) => p.type === 'residential');
    assert.ok(made.length > 0);
    assert.ok(made.every((h) => h.land_size === 250), 'every home should draw the real footprint');
    assert.ok(made.every((h) => h.floors === 4), 'every home should draw the real floor count');
  } finally {
    cleanup();
  }
});

test('a building pack with fewer buildings than homes cycles rather than running out', () => {
  const w = engine.WorldState;
  const before = w.properties.length;
  try {
    worldgen.generateWorld({
      seed: 'building-pack-cycle-test',
      buildingPack: pack({
        buildings: [
          { buildingId: 'A', footprintArea: 100, numFloors: 1 },
          { buildingId: 'B', footprintArea: 200, numFloors: 2 },
        ],
      }),
      communitiesPerCity: 2,
      populationPerCommunity: 5,
    });
    const made = w.properties.slice(before).filter((p) => p.type === 'residential');
    assert.ok(made.length > 2, 'this world should build more homes than the pack has real buildings');
    assert.ok(made.every((h) => h.land_size === 100 || h.land_size === 200));
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-building-pack',
      buildingPack: { region: 'X', source: 'sample', propertyType: 'residential', buildings: [{ footprintArea: -1 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no building pack still draws homes from the invented bands', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.properties.length;
  worldgen.generateWorld({ seed: 'no-building-pack', communitiesPerCity: 1, populationPerCommunity: 5 });
  const made = w.properties.slice(before).filter((p) => p.type === 'residential');
  assert.ok(made.length > 0);
  assert.ok(made.every((h) => h.land_size >= 120 && h.land_size <= 900));
  assert.ok(made.every((h) => h.floors >= 1 && h.floors <= 4));
  cleanup();
});
