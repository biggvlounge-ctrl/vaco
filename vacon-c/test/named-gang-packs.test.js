// A real, named, documented street-gang roster, for the two real
// cities this registry's own sources cover at this detail.
//
// Read `server/namedGangPacks.js`'s own header before this file — it
// explains why this is a two-city exception (Los Angeles, New York),
// why disagreement between real sources is carried rather than
// smoothed over, and why the East Coast and West Coast "Bloods" are
// kept as two separate, organizationally distinct entries.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const namedGangPacks = require('../server/namedGangPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    city: 'los-angeles',
    gangs: [
      { name: 'Alpha', originCity: 'Testville', originEra: '1990s', confidence: 'well-sourced' },
      { name: 'Beta', originCity: 'Testville', originEra: '1980s', confidence: 'disputed-era' },
    ],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.namedGangPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(namedGangPacks.validatePack(pack()), []);
});

test('a pack must say where it came from and which real city it covers', () => {
  assert.ok(namedGangPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(namedGangPacks.validatePack(pack({ city: 'nowhere' })).some((p) => p.includes('city')));
  assert.ok(namedGangPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a gang needs a name, a real origin city, and a real origin era', () => {
  const noName = namedGangPacks.validatePack(pack({
    gangs: [{ originCity: 'X', originEra: '1990s' }],
  }));
  assert.ok(noName.some((p) => p.includes('name')));

  const noCity = namedGangPacks.validatePack(pack({
    gangs: [{ name: 'X', originEra: '1990s' }],
  }));
  assert.ok(noCity.some((p) => p.includes('originCity')));

  const noEra = namedGangPacks.validatePack(pack({
    gangs: [{ name: 'X', originCity: 'Y' }],
  }));
  assert.ok(noEra.some((p) => p.includes('originEra')));
});

test('an unrecognized confidence level is refused', () => {
  const problems = namedGangPacks.validatePack(pack({
    gangs: [{ name: 'X', originCity: 'Y', originEra: '1990s', confidence: 'vibes' }],
  }));
  assert.ok(problems.some((p) => p.includes('confidence')));
});

test('an empty gangs array is refused', () => {
  const problems = namedGangPacks.validatePack(pack({ gangs: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('assertPack throws on a bad pack and returns a good one unchanged', () => {
  assert.throws(() => namedGangPacks.assertPack(pack({ city: 'nowhere' })));
  const good = pack();
  assert.equal(namedGangPacks.assertPack(good), good);
});

// ---------------------------------------------------------------------
// gangFor
// ---------------------------------------------------------------------

test('gangFor cycles by position, and is null with no pack', () => {
  const p = pack();
  assert.equal(namedGangPacks.gangFor(p, 0).name, 'Alpha');
  assert.equal(namedGangPacks.gangFor(p, 1).name, 'Beta');
  assert.equal(namedGangPacks.gangFor(p, 2).name, 'Alpha', 'position 2 should wrap');
  assert.equal(namedGangPacks.gangFor(null, 0), null);
});

// ---------------------------------------------------------------------
// The two real packs this file actually carries
// ---------------------------------------------------------------------

test('the Los Angeles pack validates and is honestly scoped to Los Angeles', () => {
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.LOS_ANGELES_PACK), []);
  assert.equal(namedGangPacks.LOS_ANGELES_PACK.city, 'los-angeles');
  const names = namedGangPacks.LOS_ANGELES_PACK.gangs.map((g) => g.name);
  assert.ok(names.includes('Crips'));
  assert.ok(names.includes('Bloods'));
});

test('the New York pack validates and keeps its Bloods lineage organizationally distinct from Los Angeles\'s', () => {
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.NEW_YORK_PACK), []);
  assert.equal(namedGangPacks.NEW_YORK_PACK.city, 'new-york');
  const ubn = namedGangPacks.NEW_YORK_PACK.gangs.find((g) => g.name === 'United Blood Nation (UBN)');
  assert.ok(ubn, 'United Blood Nation should be a real, named entry');
  assert.ok(ubn.note.includes('DISTINCT'),
    'the real, separate East Coast lineage must be stated, not left implicit');
});

test('every real gang entry in both packs carries a real confidence level', () => {
  for (const realPack of [namedGangPacks.LOS_ANGELES_PACK, namedGangPacks.NEW_YORK_PACK]) {
    for (const gang of realPack.gangs) {
      assert.ok(namedGangPacks.CONFIDENCE_LEVELS.includes(gang.confidence),
        `${gang.name} carries no real confidence level`);
    }
  }
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world with no named-gang pack still names factions exactly as before', () => {
  const w = engine.WorldState;
  try {
    const before = w.organizations.length;
    worldgen.generateWorld({
      seed: 'no-named-gang', communitiesPerCity: 1, populationPerCommunity: 10,
    });
    const added = w.organizations.slice(before);
    const gangs = added.filter((o) => o.type === 'gang');
    assert.ok(gangs.length > 0, 'a world should still generate gangs');
    for (const gang of gangs) {
      assert.ok(gang.name.endsWith('Crew'), `${gang.name} should still use the invented naming`);
      assert.equal(gang.realGangOrigin, undefined);
    }
  } finally {
    cleanup();
  }
});

test('a world with a real named-gang pack uses the real name and carries its real provenance', () => {
  const w = engine.WorldState;
  try {
    const before = w.organizations.length;
    worldgen.generateWorld({
      seed: 'named-gang-la',
      namedGangPack: namedGangPacks.LOS_ANGELES_PACK,
      factionsPerCity: 2,
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const added = w.organizations.slice(before);
    const gangs = added.filter((o) => o.type === 'gang');
    assert.equal(gangs.length, 2);
    const names = gangs.map((g) => g.name);
    assert.ok(names.includes('Crips'));
    assert.ok(names.includes('Bloods'));
    for (const gang of gangs) {
      assert.ok(gang.realGangOrigin, `${gang.name} should carry its real provenance`);
      assert.ok(gang.realGangOrigin.originCity.includes('Los Angeles'));
    }
  } finally {
    cleanup();
  }
});

test('a bad named-gang pack is refused at generation, not half-applied', () => {
  assert.throws(() => worldgen.generateWorld({
    seed: 'named-gang-bad',
    namedGangPack: { region: 'X', source: 'sample', city: 'nowhere', gangs: [] },
    communitiesPerCity: 1,
    populationPerCommunity: 5,
  }));
  cleanup();
});

test('this module validates against its own real CITIES list, not a private copy elsewhere', () => {
  assert.deepEqual(
    namedGangPacks.CITIES,
    ['los-angeles', 'new-york', 'chicago', 'st-louis', 'miami', 'philadelphia'],
  );
});

test('Philadelphia carries the real Black Mafia / Nation of Islam overlap, and explicitly not the Black Guerrilla Family', () => {
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.PHILADELPHIA_PACK), []);
  const names = namedGangPacks.PHILADELPHIA_PACK.gangs.map((g) => g.name);
  assert.ok(names.includes('Black Mafia (Philadelphia)'));
  assert.ok(!names.some((n) => /guerrilla/i.test(n)),
    'BGF is real but San Quentin-origin and Marxist-political, not Philadelphia-origin and not religious -- it must not appear here');
  const entry = namedGangPacks.PHILADELPHIA_PACK.gangs[0];
  assert.ok(typeof entry.religiousAffiliationNote === 'string'
    && /nation of islam/i.test(entry.religiousAffiliationNote));
});

test('Chicago, St. Louis and Miami packs are each valid', () => {
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.CHICAGO_PACK), []);
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.ST_LOUIS_PACK), []);
  assert.deepEqual(namedGangPacks.validatePack(namedGangPacks.MIAMI_PACK), []);
});

test('St. Louis replaces the unverifiable "62 Hoover Crips" claim with two real, DOJ-documented gangs', () => {
  const names = namedGangPacks.ST_LOUIS_PACK.gangs.map((g) => g.name);
  assert.ok(names.includes('Cochran Crips'));
  assert.ok(names.includes('55 Boyz'));
  assert.ok(!names.some((n) => /hoover|62|six.?deuce|six.?o/i.test(n)),
    'this pack must not carry the gang this round\'s research could not verify');
  for (const g of namedGangPacks.ST_LOUIS_PACK.gangs) {
    assert.equal(g.confidence, 'current-activity-only',
      'no founding era was confirmed for either St. Louis entry -- the honest tier, not a guess');
  }
});

test('Miami carries Zoe Pound and its real documented offshoot, and Cuban organized crime as context only, never as a named gang entry', () => {
  const names = namedGangPacks.MIAMI_PACK.gangs.map((g) => g.name);
  assert.ok(names.includes('Zoe Pound'));
  assert.ok(names.includes('Zoe Mafia Family (ZMF)'));
  assert.ok(!names.some((n) => /cuban/i.test(n)),
    'Cuban organized crime is not law-enforcement-tracked as a structured org -- it must not appear as a roster entry');
  assert.ok(typeof namedGangPacks.MIAMI_PACK.historicalContext === 'string'
    && namedGangPacks.MIAMI_PACK.historicalContext.length > 0);
});

test('Chicago carries the real Vice Lords/Gangster Disciples/Black Disciples/Mickey Cobras roster, with no invented territory map', () => {
  const names = namedGangPacks.CHICAGO_PACK.gangs.map((g) => g.name);
  assert.deepEqual(names, ['Vice Lords', 'Gangster Disciples', 'Black Disciples', 'Mickey Cobras']);
  assert.ok(typeof namedGangPacks.CHICAGO_PACK.territoryNote === 'string'
    && /no live, official/i.test(namedGangPacks.CHICAGO_PACK.territoryNote));
  assert.ok(typeof namedGangPacks.CHICAGO_PACK.culturalContext === 'string'
    && namedGangPacks.CHICAGO_PACK.culturalContext.length > 0);
});

test('a world generated with the Chicago pack carries the real gang onto its factions, same mechanism as Los Angeles/New York', () => {
  const w = engine.WorldState;
  try {
    const before = w.organizations.length;
    worldgen.generateWorld({
      seed: 'named-gang-chicago',
      namedGangPack: namedGangPacks.CHICAGO_PACK,
      factionsPerCity: 2,
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const added = w.organizations.slice(before);
    const gangs = added.filter((o) => o.type === 'gang');
    assert.equal(gangs.length, 2);
    const names = gangs.map((g) => g.name);
    assert.ok(names.includes('Vice Lords'));
    assert.ok(names.includes('Gangster Disciples'));
    for (const gang of gangs) {
      assert.ok(gang.realGangOrigin, `${gang.name} should carry its real provenance`);
    }
  } finally {
    cleanup();
  }
});
