// economy_snapshots / analytics_snapshots — the history standing rule 3
// does not forbid. See server/snapshots.js's header for the shape: one
// analytics_snapshots row every tick (world-level, cheap), economy_
// snapshots rows for every living individual and family on a quarterly
// cadence, gdp always null, resource-market columns always null.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const snapshots = require('../server/snapshots.js');
const statecraft = require('../server/statecraft.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function world({ npcs = [], deceased = [] } = {}) {
  return {
    tick: 10,
    npcs,
    deceased,
    communities: [],
    families: [],
    familyMemberships: [],
    individualFinances: [],
    properties: [],
    crimeIncidents: [],
    historicalRecords: [],
    migrationEvents: [],
    civilizations: [],
    technologyEras: [],
    civilizationTechnologyProgress: [],
    economySnapshots: [],
    analyticsSnapshots: [],
  };
}

test('SNAPSHOT_INTERVAL_TICKS reuses statecraft\'s budget cadence rather than inventing a new one', () => {
  assert.equal(snapshots.SNAPSHOT_INTERVAL_TICKS, statecraft.BUDGET_INTERVAL_TICKS);
});

test('isSnapshotDay is a crossing at the interval, not before tick 0', () => {
  assert.equal(snapshots.isSnapshotDay(0), false);
  assert.equal(snapshots.isSnapshotDay(snapshots.SNAPSHOT_INTERVAL_TICKS), true);
  assert.equal(snapshots.isSnapshotDay(snapshots.SNAPSHOT_INTERVAL_TICKS - 1), false);
  assert.equal(snapshots.isSnapshotDay(snapshots.SNAPSHOT_INTERVAL_TICKS * 2), true);
});

test('an empty world snapshots to nulls, not zeros — unknown is not zero', () => {
  const w = world();
  const row = snapshots.snapshotAnalytics(w, 5);
  assert.equal(row.population, 0);
  assert.equal(row.crime_rate, null, 'no population to divide by should read null, not 0');
  assert.equal(row.birth_rate, null);
  assert.equal(row.death_rate, null);
  assert.equal(row.education_index, null, 'nobody to have an education level');
  assert.equal(row.technology_index, null, 'no civilization exists to have unlocked anything');
});

test('gdp is always null — no mechanism anywhere computes a monetary aggregate', () => {
  const w = world({ npcs: [{ id: 1, communityId: null }] });
  const row = snapshots.snapshotAnalytics(w, 5);
  assert.equal(row.gdp, null);
});

test('analytics_snapshots.tick is a real primary key — a second call on the same tick overwrites, not duplicates', () => {
  const w = world({ npcs: [{ id: 1, communityId: null }] });
  snapshots.snapshotAnalytics(w, 5);
  snapshots.snapshotAnalytics(w, 5);
  assert.equal(w.analyticsSnapshots.length, 1,
    'a repeated write to the same tick must not grow the array — standing rule 15, a write pass run twice leaves the world unchanged');
  assert.equal(w.analyticsSnapshots[0].tick, 5);
});

test('one analytics_snapshots row per tick, distinct ticks', () => {
  const w = world({ npcs: [{ id: 1, communityId: null }] });
  snapshots.snapshotAnalytics(w, 1);
  snapshots.snapshotAnalytics(w, 2);
  snapshots.snapshotAnalytics(w, 3);
  assert.equal(w.analyticsSnapshots.length, 3);
  assert.deepEqual(w.analyticsSnapshots.map((r) => r.tick), [1, 2, 3]);
});

test('economy_snapshots only writes on a snapshot day, and is empty otherwise', () => {
  const w = world({ npcs: [{ id: 1, communityId: null }] });
  const notADay = snapshots.SNAPSHOT_INTERVAL_TICKS - 1;
  const rows = snapshots.snapshotEconomy(w, notADay);
  assert.deepEqual(rows, []);
  assert.equal(w.economySnapshots.length, 0,
    'nothing should be written on a day that is not a snapshot day');
});

test('economy_snapshots on a snapshot day covers every living individual and family, and nobody else', () => {
  const w = world({
    npcs: [{ id: 1, communityId: null }, { id: 2, communityId: null }],
  });
  w.families = [{ id: 900, surname: 'Test' }];
  w.familyMemberships = [{ family_id: 900, entity_id: 1 }];
  w.individualFinances = [
    { entity_id: 1, assets: 1000, savings: 500, debt: 200, tick: 1 },
    { entity_id: 2, assets: 0, savings: 0, debt: 0, tick: 1 },
  ];

  const day = snapshots.SNAPSHOT_INTERVAL_TICKS;
  const rows = snapshots.snapshotEconomy(w, day);

  assert.equal(rows.length, 3, 'two individuals plus one family');
  const byEntity = new Map(rows.map((r) => [r.entity_id, r]));
  assert.equal(byEntity.get(1).vcoin, 1300);
  assert.equal(byEntity.get(2).vcoin, 0);
  assert.equal(byEntity.get(900).vcoin, 1300, 'family wealth sums its one member\'s net worth');
  for (const row of rows) {
    assert.equal(row.resource_type, null, 'market data is not this file\'s job — see header');
    assert.equal(row.supply, null);
    assert.equal(row.demand, null);
    assert.equal(row.price, null);
    assert.equal(row.tick, day);
  }
});

test('familyWealth sums live net worth across every member, deceased included is the caller\'s call not this one\'s', () => {
  const w = world({ npcs: [{ id: 1 }, { id: 2 }] });
  w.familyMemberships = [
    { family_id: 5, entity_id: 1 }, { family_id: 5, entity_id: 2 },
  ];
  w.individualFinances = [
    { entity_id: 1, assets: 100, savings: 0, debt: 0, tick: 1 },
    { entity_id: 2, assets: 50, savings: 0, debt: 0, tick: 1 },
  ];
  assert.equal(snapshots.familyWealth(w, 5), 150);
});

test('reseedIds derives the next economy_snapshots id from the highest existing one', () => {
  const w = world();
  w.economySnapshots = [{ id: 1 }, { id: 7 }, { id: 3 }];
  const seeded = snapshots.reseedIds(w);
  assert.equal(seeded.nextEconomySnapshotId, 8);

  snapshots.snapshotEconomy(w, snapshots.SNAPSHOT_INTERVAL_TICKS);
  // Not asserted on a specific id — only that it did not collide with
  // an existing one, which colliding would prove by duplicate ids.
  const ids = w.economySnapshots.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'no two rows share an id after reseeding');
});

// ---------------------------------------------------------------------
// On a real generated world — the sixteenth standing rule
// ---------------------------------------------------------------------

test('a generated world accumulates real history over real ticks', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'snapshots-integration' });

  const TICKS = 95;
  for (let t = 0; t < TICKS; t += 1) engine.advanceTick();

  assert.equal(w.analyticsSnapshots.length, TICKS,
    'one analytics_snapshots row per tick advanced');
  assert.deepEqual(
    w.analyticsSnapshots.map((r) => r.tick),
    Array.from({ length: TICKS }, (_, i) => i + 1),
  );
  for (const row of w.analyticsSnapshots) {
    assert.equal(row.gdp, null);
    assert.ok(Number.isFinite(row.population) && row.population > 0);
  }

  // 95 ticks crosses exactly one quarter boundary (90).
  const economyTicks = new Set(w.economySnapshots.map((r) => r.tick));
  assert.deepEqual([...economyTicks], [snapshots.SNAPSHOT_INTERVAL_TICKS]);

  const atQuarter = w.economySnapshots.filter((r) => r.tick === snapshots.SNAPSHOT_INTERVAL_TICKS);
  assert.equal(atQuarter.length, w.npcs.length + w.families.length,
    'a row for every living individual and every family, no more and no fewer');

  const validEntityIds = new Set([
    ...w.npcs.map((n) => n.id),
    ...w.families.map((f) => f.id),
  ]);
  for (const row of atQuarter) {
    assert.ok(validEntityIds.has(row.entity_id), `economy_snapshots row references entity ${row.entity_id}, which is not a living npc or a family`);
  }
});
