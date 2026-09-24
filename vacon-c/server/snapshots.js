// server/snapshots.js
//
// `economy_snapshots` and `analytics_snapshots` — the history the
// third standing rule does not forbid. Rule 3 says never duplicate a
// computable rollup; it says nothing about never remembering what a
// computable rollup WAS. Supply, demand and price at tick 300 are not
// computable at tick 900, because the past is gone — so this is a real
// capability (a time series) rather than a cache of something already
// available, which is exactly the distinction `completeness.js`'s
// `TABLE_NO_STORE_REASON` entries for both tables left open.
//
// ---------------------------------------------------------------------
// Two tables, two shapes, because the schema gives them two shapes
// ---------------------------------------------------------------------
//
// `analytics_snapshots` has `tick` as its own primary key: one row,
// world-level, every tick. Genuinely cheap — there is exactly one of
// it — so it runs on every tick rather than on an interval.
//
// `economy_snapshots` is tier-scoped: `entity_id REFERENCES
// entities(id)`. That rules out city and civilization even though the
// schema's own comment lists them — `migrate.js` writes an `entities`
// row for `npc`/`organization`/`family` only (see
// `completeness.js`'s `BY_DESIGN.entities`), never for a city or a
// civilization, so there is no id an FK to `entities` could hold for
// either tier. This scopes to individual and family: both are real
// entities with a real, LIVE wealth figure already wired
// (`economy.getNetWorth`, and the same sum `engine.js#getFamilyWealth`
// already does). Business is left out on purpose —
// `businesses.revenue`/`.profit` are schema-only columns nothing has
// ever written (system #28 Business stays `partial` for exactly this
// reason), so a business's `vcoin` would snapshot a constant zero
// forever, which is worse than not snapshotting it: the same call
// `computeApproval` makes returning `null` over a fabricated zero.
// Resource-market columns (`resource_type`/`supply`/`demand`/`price`)
// stay null on every row this file writes, for the same reason —
// `market_listings` is generated once at worldgen and never refreshed,
// so a price snapshotted from it would repeat one frozen number
// forever and look like a moving market.
//
// Population-sized, so it needs a bounded cadence rather than every
// tick. Reuses `statecraft.BUDGET_INTERVAL_TICKS` (90 — a quarter,
// already measured against the 200-tick default completeness window
// rather than picked because it sounds right, per that file's own
// header) instead of inventing a second "how often does the state
// check in" number for the same kind of question.
//
// ---------------------------------------------------------------------
// `analytics_snapshots.gdp` stays null
// ---------------------------------------------------------------------
// No mechanism anywhere in this engine computes a monetary output
// aggregate, and the columns a real GDP would sum
// (`businesses.revenue`/`.profit`) are unwritten. Substituting
// something else — total wages paid, say — would silently redefine
// GDP as a different quantity and call it GDP, which is a worse
// mistake than an honest gap: `unknown is not zero`, and it is not a
// different number either.
//
// ---------------------------------------------------------------------
// Everything else reuses an existing formula rather than inventing one
// ---------------------------------------------------------------------
// `crime_rate` and `birth_rate` are the exact `per1k(count, population)`
// shape `statistics.js` already uses at community scope, applied to the
// world's own totals instead of one area's — a lifetime cumulative
// rate, same convention, not a new one. `death_rate` is
// `areaStats.statsFor`'s own share-of-everyone-who-ever-lived-here
// formula, applied world-wide. `migration` counts moves in the last
// `migration.RATE_WINDOW_TICKS` (a year), reusing that window rather
// than a new one, and is a COUNT (matching the column's `INTEGER`
// type) rather than a net rate, because a net *within* one world nets
// toward zero by conservation and would read as inactivity that is
// actually redistribution. `education_index` is the exact
// `educational_attainment` formula from `statistics.js`, applied to
// every living resident instead of one community's. `technology_index`
// is how many eras the world's (first) civilization has unlocked —
// `technology.unlockedEras`'s own count, not a new ladder.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const economy = require('./economy.js');
const births = require('./births.js');
const crime = require('./crime.js');
const migration = require('./migration.js');
const demographics = require('./demographics.js');
const technology = require('./technology.js');
const statecraft = require('./statecraft.js');

const SNAPSHOT_INTERVAL_TICKS = statecraft.BUDGET_INTERVAL_TICKS;

function isSnapshotDay(tick) {
  return Number.isFinite(tick) && tick > 0 && tick % SNAPSHOT_INTERVAL_TICKS === 0;
}

function per1k(count, population) {
  if (!population) return null;
  return Math.round((count / population) * 1000 * 100) / 100;
}

// -- analytics_snapshots --------------------------------------------------

function worldBirthCount(worldState) {
  let total = 0;
  for (const community of worldState.communities || []) {
    total += births.birthsIn(worldState, community.id).length;
  }
  return total;
}

function worldCrimeCount(worldState) {
  let total = 0;
  for (const community of worldState.communities || []) {
    total += crime.incidentsIn(worldState, community.id).length;
  }
  return total;
}

function worldMigrationCount(worldState, tick) {
  const window = migration.RATE_WINDOW_TICKS;
  return (worldState.migrationEvents || []).filter(
    (m) => m.tick >= tick - window,
  ).length;
}

function educationIndexOf(worldState) {
  const mean = demographics.compositionOf(worldState, worldState.npcs).education.meanLevel;
  if (mean === null) return null;
  return Math.round((mean / (demographics.EDUCATION_LEVELS.length - 1)) * 100 * 100) / 100;
}

function technologyIndexOf(worldState) {
  const civilization = (worldState.civilizations || [])[0];
  if (!civilization) return null;
  return technology.unlockedEras(worldState, civilization.id).length;
}

// A crossing check would be wrong here — unlike a condition that stays
// true for many ticks (standing rule 7), "it is tick T" is true for
// exactly one tick, so calling this every tick is itself the guard.
// Idempotent all the same: `analytics_snapshots.tick` is a primary key,
// and re-running the same tick overwrites its row rather than
// duplicating it, so a restart mid-tick cannot double a reading —
// standing rule 15's "run twice, same result" held for a write pass
// rather than a delivery pass.
function snapshotAnalytics(worldState, tick) {
  const population = worldState.npcs.length;
  const dead = (worldState.deceased || []).length;

  const row = {
    tick,
    population,
    gdp: null,
    crime_rate: per1k(worldCrimeCount(worldState), population),
    birth_rate: per1k(worldBirthCount(worldState), population),
    death_rate: population + dead === 0 ? null
      : Math.round((dead / (population + dead)) * 10000) / 10000,
    migration: worldMigrationCount(worldState, tick),
    education_index: educationIndexOf(worldState),
    technology_index: technologyIndexOf(worldState),
  };

  const store = worldState.analyticsSnapshots || (worldState.analyticsSnapshots = []);
  const existing = store.find((r) => r.tick === tick);
  if (existing) {
    Object.assign(existing, row);
    return existing;
  }
  store.push(row);
  return row;
}

// -- economy_snapshots ------------------------------------------------

let nextEconomySnapshotId = 1;

function reseedIds(worldState) {
  nextEconomySnapshotId = nextAfter(worldState.economySnapshots || []);
  return { nextEconomySnapshotId };
}

function pushEconomySnapshot(worldState, entityId, tick, vcoin) {
  const row = {
    id: nextEconomySnapshotId++,
    entity_id: entityId,
    tick,
    vcoin,
    resource_type: null,
    supply: null,
    demand: null,
    price: null,
  };
  (worldState.economySnapshots || (worldState.economySnapshots = [])).push(row);
  return row;
}

function familyWealth(worldState, familyId) {
  const memberIds = (worldState.familyMemberships || [])
    .filter((m) => m.family_id === familyId)
    .map((m) => m.entity_id);
  let total = 0;
  for (const entityId of memberIds) total += economy.getNetWorth(worldState, entityId);
  return total;
}

// One row per living individual and one per family, on the quarterly
// cadence above. Not a crossing — a budget-style periodic check
// (standing rule 7's condition/crossing distinction is about firing on
// a state that HOLDS for many ticks; a specific multiple of
// `SNAPSHOT_INTERVAL_TICKS` is true for exactly one tick in every
// interval, the same shape `statecraft.isBudgetDay` already uses).
function snapshotEconomy(worldState, tick) {
  if (!isSnapshotDay(tick)) return [];
  const written = [];
  for (const npc of worldState.npcs) {
    written.push(pushEconomySnapshot(worldState, npc.id, tick, economy.getNetWorth(worldState, npc.id)));
  }
  for (const family of worldState.families || []) {
    written.push(pushEconomySnapshot(worldState, family.id, tick, familyWealth(worldState, family.id)));
  }
  return written;
}

// -- the pass -----------------------------------------------------------

function runSnapshots(worldState, tick) {
  const analytics = snapshotAnalytics(worldState, tick);
  const economyRows = snapshotEconomy(worldState, tick);
  return { analytics, economyRows };
}

module.exports = {
  SNAPSHOT_INTERVAL_TICKS,
  isSnapshotDay,
  snapshotAnalytics,
  snapshotEconomy,
  familyWealth,
  reseedIds,
  runSnapshots,
};
