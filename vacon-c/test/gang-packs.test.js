// A real, dated gang count and membership rate, imported per region.
//
// Read `server/gangPacks.js`'s own header before this file — it is
// the one pack reader in this registry built on a source
// (OJJDP's National Youth Gang Survey) that is not current.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gangPacks = require('../server/gangPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    jurisdictions: [{ jurisdictionName: 'Testville PD', year: 2012, gangCount: 5, membershipRate: 0.08 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.gangPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(gangPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(gangPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(gangPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a jurisdiction needs a jurisdictionName', () => {
  const problems = gangPacks.validatePack(pack({ jurisdictions: [{ gangCount: 2 }] }));
  assert.ok(problems.some((p) => p.includes('jurisdictionName')));
});

test('a year after the survey was discontinued is refused', () => {
  const problems = gangPacks.validatePack(pack({
    jurisdictions: [{ jurisdictionName: 'X', year: 2020 }],
  }));
  assert.ok(problems.some((p) => p.includes('2012')));
});

test('a negative or fractional gangCount is refused', () => {
  const problems = gangPacks.validatePack(pack({
    jurisdictions: [{ jurisdictionName: 'X', gangCount: -1 }],
  }));
  assert.ok(problems.some((p) => p.includes('gangCount')));
});

test('a membershipRate outside the sanity bound is refused', () => {
  const problems = gangPacks.validatePack(pack({
    jurisdictions: [{ jurisdictionName: 'X', membershipRate: 0.9 }],
  }));
  assert.ok(problems.some((p) => p.includes('membershipRate')));
});

test('an empty jurisdictions array is refused', () => {
  const problems = gangPacks.validatePack(pack({ jurisdictions: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// jurisdictionFor / gangCountFor / membershipRateFor
// ---------------------------------------------------------------------

test('jurisdictionFor cycles by position, and is null with no pack', () => {
  const p = pack({
    jurisdictions: [{ jurisdictionName: 'A' }, { jurisdictionName: 'B' }],
  });
  assert.equal(gangPacks.jurisdictionFor(p, 0).jurisdictionName, 'A');
  assert.equal(gangPacks.jurisdictionFor(p, 1).jurisdictionName, 'B');
  assert.equal(gangPacks.jurisdictionFor(p, 2).jurisdictionName, 'A', 'position 2 should wrap');
  assert.equal(gangPacks.jurisdictionFor(null, 0), null);
});

test('gangCountFor reads a real count, including a real zero, and null with no jurisdiction', () => {
  assert.equal(gangPacks.gangCountFor({ jurisdictionName: 'X', gangCount: 0 }), 0);
  assert.equal(gangPacks.gangCountFor({ jurisdictionName: 'X', gangCount: 5 }), 5);
  assert.equal(gangPacks.gangCountFor(null), null);
});

test('membershipRateFor reads a real rate, and null with no jurisdiction', () => {
  assert.equal(gangPacks.membershipRateFor({ membershipRate: 0.03 }), 0.03);
  assert.equal(gangPacks.membershipRateFor(null), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real gang pack uses the real gang count, including a real zero', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'gang-pack-zero',
      gangPack: pack({ jurisdictions: [{ jurisdictionName: 'Quiet Town', year: 2012, gangCount: 0 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const orgsBefore = w.organizations.length;
    worldgen.generateWorld({
      seed: 'gang-pack-count',
      gangPack: pack({ jurisdictions: [{ jurisdictionName: 'Testville PD', year: 2012, gangCount: 5 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const gangs = w.organizations.slice(orgsBefore).filter((o) => o.type === 'gang');
    assert.equal(gangs.length, 5);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-gang-pack',
      gangPack: { region: 'X', source: 'sample', jurisdictions: [{ jurisdictionName: 'Y', year: 2099 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no gang pack still builds with the invented factionsPerCity default', () => {
  cleanup();
  const w = engine.WorldState;
  const orgsBefore = w.organizations.length;
  worldgen.generateWorld({ seed: 'no-gang-pack', communitiesPerCity: 1, populationPerCommunity: 10, factionsPerCity: 2 });
  const gangs = w.organizations.slice(orgsBefore).filter((o) => o.type === 'gang');
  assert.equal(gangs.length, 2);
  cleanup();
});
