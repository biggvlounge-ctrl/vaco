// VACANCY — a world survives a restart.
//
// This is the half of step 9 that was missing. `migrate.js` exported
// the world to Postgres and nothing ever read it back, so the database
// was a copy of the simulation and never a source for it — which is
// what `dev-docs/COMPLETION_BY_APP.md` reported as vacon-c's one
// shortfall, "missing: persists to disk".
//
// **These tests need a real Postgres and say so when they do not have
// one.** Every structural check in `migrate.test.js` was written
// because this environment could not reach a database; that stopped
// being true on 10 Sep 2026, and the difference showed immediately.
// Four defects were sitting behind the structural checks:
//
//   * four mission columns and one market column silently unwritten;
//   * two FK ordering violations that rolled the whole migration back
//     the moment a world had a city with a resource in it;
//   * a circular FK between properties and historical_records;
//   * `trait_id` coming back from Postgres as the string "1", which
//     matched no trait definition, so every restored entity had an
//     empty trait sheet — restored with no error at all.
//
// The last one is the shape to keep in mind here. Postgres returns
// BIGINT and NUMERIC as strings. A missed conversion does not throw;
// it produces a world that looks restored and is wrong. Hence the
// type assertions below, which are not pedantry.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const db = require('../server/db.js');
const { migrateWorldStateToPostgres } = require('../server/migrate.js');
const { restoreWorldStateFromPostgres } = require('../server/restore.js');
const worldStore = require('../server/worldStore.js');

// Arrays deliberately not carried by the migration, so deliberately not
// restored. Same list and same reasons as migrate.test.js's NOT_CARRIED
// — repeated here rather than imported because this file asserts a
// different thing about them: that they come back EMPTY, not that they
// are skipped.
const NOT_RESTORED = ['activeConditions', 'migrationRisk', 'pendingObservations'];

let available = false;
let reason = '';

// **A Postgres advisory lock, held for the whole file.**
//
// `node --test` runs test FILES concurrently, and every database-backed
// file here truncates and rewrites the same database. Run together they
// destroy each other's fixtures: the symptom was a round-trip that
// restored 0 of everything while passing perfectly on its own.
//
// Isolating by database or schema would be the heavier fix. These are
// integration tests against one shared resource and the honest thing is
// to serialise them, which an advisory lock does without depending on
// how the runner happens to be invoked. The key is arbitrary and shared
// by every file that takes it.
const DB_LOCK_KEY = 8809_0910;
let lockClient = null;

async function takeDbLock() {
  lockClient = await db.pool.connect();
  await lockClient.query('SELECT pg_advisory_lock($1)', [DB_LOCK_KEY]);
}

async function releaseDbLock() {
  if (!lockClient) return;
  await lockClient.query('SELECT pg_advisory_unlock($1)', [DB_LOCK_KEY]);
  lockClient.release();
  lockClient = null;
}

test.before(async () => {
  try {
    await takeDbLock();
    await db.query('SELECT 1');
    // Refuse to run against a database that has no schema in it — the
    // round-trip would "pass" by finding nothing and restoring nothing.
    const t = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    if (t.rows[0].n < 50) {
      reason = `connected, but only ${t.rows[0].n} tables — load VACANCY_POSTGRESQL_SCHEMA.sql `
        + 'and server/schema-extensions.sql first';
      return;
    }
    const ext = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.columns "
      + "WHERE table_name='npcs' AND column_name='name'");
    if (ext.rows[0].n === 0) {
      reason = 'schema loaded but server/schema-extensions.sql has not been applied '
        + '(npcs.name is missing), so npc names cannot round-trip';
      return;
    }
    available = true;
  } catch (err) {
    reason = `no Postgres at ${process.env.DATABASE_URL || 'the default local URL'}: ${err.message}`;
  }
});

test.after(async () => {
  await releaseDbLock();
  if (available) await db.close();
});

// Build a world with something in every array the migration carries,
// through the engine's own API. A hand-built fixture would only prove
// that my objects round-trip.
function buildWorld() {
  const W = engine.WorldState;
  for (const k of Object.keys(W)) if (Array.isArray(W[k])) W[k] = [];
  W.tick = 0;
  W.nextEntityId = 1;

  const npcs = [];
  for (let i = 0; i < 6; i++) npcs.push(engine.generateNPC());
  engine.generateOrganization({ type: 'corporation' });
  const faction = engine.generateFaction({ type: 'gang', name: 'The Reach' });
  const family = engine.generateFamily({ surname: 'Vasquez' });
  engine.addFamilyMember(family.id, npcs[0].id, 'head');

  const city = engine.generateCity({ name: 'Vacancy City' });
  const community = engine.generateCommunity({ cityId: city.id, name: 'East Block' });
  engine.generateTerritoryBlock({ cityId: city.id, communityId: community.id, factionId: faction.id });
  const property = engine.generateProperty({ type: 'residential', communityId: community.id, value: 25000, landSize: 400 });
  engine.recordOwnership({
    propertyId: property.id, entityId: property.id, ownerEntityId: npcs[0].id,
    ownerType: 'individual', acquiredMethod: 'purchased', tick: 0,
  });

  engine.generateResource({ resourceType: 'grain', name: 'Grain' });
  engine.generateMarketListing({ cityId: city.id, productName: 'Bread', price: 5, resourceType: 'grain' });
  engine.generateIndividualFinances(npcs[0].id);
  engine.generatePlayer({ linkedEntityId: npcs[1].id });

  const artifact = engine.generateArtifact({ name: 'The Key', origin: 'pre-collapse', era: 'old', rarity: 'rare' });
  const mission = engine.generateMission({ artifactId: artifact.id, objective: 'recover it', reward: 100 });

  const culture = engine.generateCulture({ name: 'Riverside', era: 'modern' });
  engine.attachCulture({ cultureId: culture.id, entityId: family.id, tier: 'family' });

  worldStore.addMemory(W, {
    entityId: npcs[0].id, memoryType: 'event', category: 'conflict', description: 'saw a fight',
    importance: 60, emotionLevel: 40, relatedEntityIds: [npcs[1].id], tick: 0,
  });
  worldStore.adjustRelationship(W, npcs[0].id, npcs[1].id, 'rival', { trust: -10, conflict: 5 });
  worldStore.addKnowledge(W, {
    entityId: npcs[0].id, subjectEntityId: npcs[1].id, factType: 'rumor',
    factContent: 'owes money', confidenceLevel: 40, sourceEntityId: npcs[2].id, tick: 0,
  });

  engine.applyStress(npcs[0].id, 20);
  engine.reinforceHabit(npcs[0].id, 'gambling', { harmful: true });
  engine.addScheduleEvent(npcs[0].id, { eventType: 'work', frequency: 'daily', timeSlot: 'morning' });

  engine.advanceTick();
  engine.acceptMission(mission.id, npcs[0].id);
  for (let t = 0; t < 4; t++) engine.advanceTick();

  return { W, npcs, faction, family, mission, city, property };
}

async function roundTrip() {
  const built = buildWorld();
  const before = JSON.parse(JSON.stringify(built.W));

  const tables = await db.query(
    "SELECT string_agg(tablename, ', ') AS t FROM pg_tables WHERE schemaname='public'");
  await db.query(`TRUNCATE ${tables.rows[0].t} CASCADE`);
  await migrateWorldStateToPostgres(built.W);

  // What a restart does: the process is gone and memory with it.
  for (const k of Object.keys(built.W)) if (Array.isArray(built.W[k])) built.W[k] = [];
  built.W.tick = 0;
  built.W.nextEntityId = 1;

  const summary = await restoreWorldStateFromPostgres(built.W);
  return { ...built, before, after: built.W, summary };
}

test('a migrated world comes back with every array intact', async (t) => {
  if (!available) return t.skip(reason);
  const { before, after } = await roundTrip();

  const changed = [];
  for (const key of Object.keys(before)) {
    if (!Array.isArray(before[key])) continue;
    if (NOT_RESTORED.includes(key)) continue;
    if (before[key].length !== after[key].length) {
      changed.push(`${key}: ${before[key].length} -> ${after[key].length}`);
    }
  }

  assert.deepEqual(changed, [],
    `these arrays did not survive the round-trip:\n    ${changed.join('\n    ')}`);

  // A guard: a world where everything is empty would pass the above by
  // being 0 -> 0 everywhere.
  assert.ok(after.npcs.length >= 6, 'the fixture world is empty, so this proves nothing');
  assert.ok(after.entityTraits.length > 500, 'no trait rows restored');
  assert.equal(after.tick, before.tick);
});

test('the arrays that are deliberately not carried come back empty', async (t) => {
  if (!available) return t.skip(reason);
  const { after } = await roundTrip();

  for (const key of NOT_RESTORED) {
    assert.deepEqual(after[key], [],
      `${key} is in NOT_CARRIED, so the restore has nothing to read — if it came back `
      + 'populated, something is inventing it');
  }
});

test('an NPC keeps their name across a restart', async (t) => {
  if (!available) return t.skip(reason);
  const { before, after } = await roundTrip();

  const names = after.npcs.map((n) => n.name);
  assert.deepEqual(names, before.npcs.map((n) => n.name));
  for (const name of names) {
    assert.ok(typeof name === 'string' && name.length > 0,
      'an NPC came back nameless — server/schema-extensions.sql adds npcs.name precisely '
      + 'because generateName() is Math.random() and a lost name cannot be regenerated');
  }
});

test('trait sheets are rebuilt, with numbers in them', async (t) => {
  if (!available) return t.skip(reason);
  const { before, after } = await roundTrip();

  const first = after.npcs[0];

  // **Not compared against `before.npcs[0].traits`, deliberately.** That
  // sheet is a denormalisation built once in generateNPC() and never
  // refreshed, so after five ticks it is the NPC's birth values, not
  // their current ones. This test originally asserted equality with it
  // and failed on a single trait — Trust Threshold, 45 restored against
  // 50 in the sheet — which is how the staleness was found. It is now
  // recorded in flows.js and covered by test/flows.test.js.
  //
  // The restore rebuilds from `entity_traits`, which is the live truth,
  // so the right comparison is against that: a restored world's sheets
  // must match what getLiveEntity() would have said before the restart.
  const live = {};
  for (const row of before.entityTraits) {
    if (row.entity_id !== before.npcs[0].id) continue;
    const def = require('../server/traitDefinitions.js').TRAIT_DEFINITIONS
      .find((d) => d.trait_id === row.trait_id);
    if (!def) continue;
    live[def.family] = live[def.family] || {};
    live[def.family][def.name] = row.current_value;
  }
  assert.deepEqual(first.traits, live,
    'the rebuilt trait sheet does not match the live entity_traits rows it was built from');

  // The specific failure this catches: `trait_id` came back as the
  // string "1", matched no definition, every row was skipped, and every
  // sheet was `{}` — with no error anywhere.
  assert.ok(Object.keys(first.traits).length > 0,
    'the trait sheet is empty. traitsToSheet() skips any row whose trait_id does not match a '
    + 'definition, and Postgres returns integer columns as strings, so a missed conversion '
    + 'empties every sheet silently');
  assert.equal(typeof first.traits.physical.Strength, 'number');

  // Organizations and families carry sheets too, from their own tiers.
  assert.ok(Object.keys(after.organizations[0].traits).length > 0);
  assert.ok(Object.keys(after.families[0].traits).length > 0);
});

test('numeric columns come back as numbers, not strings', async (t) => {
  if (!available) return t.skip(reason);
  const { after } = await roundTrip();

  // `'50' + 1` is `'501'`. An engine that does arithmetic on a value
  // Postgres handed back as text produces garbage rather than an error,
  // so this is checked across every array rather than spot-checked.
  const SAMPLES = [
    ['npcs', 'generation'], ['organizations', 'reputation'], ['families', 'unity'],
    ['entityTraits', 'current_value'], ['memories', 'importance'],
    ['relationships', 'trust'], ['entityKnowledge', 'confidence_level'],
    ['resources', 'supply'], ['marketListings', 'price'],
    ['individualFinances', 'income'], ['events', 'tick'],
    ['cities', 'population'], ['communities', 'population'],
    ['properties', 'value'], ['ownershipRecords', 'acquired_tick'],
    ['missions', 'reward'], ['players', 'linked_entity_id'],
    ['entityState', 'stress_level'], ['habits', 'strength'],
  ];

  const wrong = [];
  for (const [array, field] of SAMPLES) {
    const rows = after[array];
    assert.ok(rows?.length, `${array} is empty, so this check is vacuous`);
    for (const row of rows) {
      if (row[field] === null || row[field] === undefined) continue;
      if (typeof row[field] !== 'number') {
        wrong.push(`${array}[].${field} is a ${typeof row[field]} (${JSON.stringify(row[field])})`);
        break;
      }
    }
  }

  assert.deepEqual(wrong, [],
    `these came back as text and the engine does arithmetic on them:\n    ${wrong.join('\n    ')}`);
});

test('mission acceptance survives, not just the mission', async (t) => {
  if (!available) return t.skip(reason);
  const { before, after } = await roundTrip();

  const restored = after.missions[0];
  const original = before.missions[0];

  // The four columns that were silently unwritten until 10 Sep 2026.
  // A mission recorded as 'accepted' with no holder is worse than one
  // that failed to migrate: it looks complete and is not.
  assert.equal(restored.status, original.status);
  assert.equal(restored.assigned_entity_id, original.assigned_entity_id);
  assert.equal(restored.tick_accepted, original.tick_accepted);
  assert.ok(restored.assigned_entity_id != null,
    'the mission came back with no holder, so nothing records who accepted it');
});

test('a faction is still a faction', async (t) => {
  if (!available) return t.skip(reason);
  const { after } = await roundTrip();

  // `isFaction` is not a column and should not become one — a row in
  // `factions` is what makes an organization a faction, so the restore
  // derives it rather than storing it twice (standing rule 3).
  const factions = after.organizations.filter((o) => o.isFaction);
  assert.equal(factions.length, 1);
  assert.equal(factions[0].factionStatus, 'controlled');
  assert.equal(typeof factions[0].morale, 'number');

  const plain = after.organizations.filter((o) => !o.isFaction);
  assert.equal(plain.length, 1);
  assert.equal(plain[0].factionStatus, undefined,
    'a non-faction organization came back with faction fields');
});

test('nothing the world creates after a restore reuses an id', async (t) => {
  if (!available) return t.skip(reason);
  const { after, summary } = await roundTrip();

  // The defect this exists for: sixteen id counters live as
  // module-level `let`s and all start at 1. Restore 500 memories and
  // add one, and the new memory is id 1 — two rows sharing a primary
  // key, with nothing thrown and every lookup-by-id now ambiguous.
  const maxBefore = {};
  for (const [array, field] of [['memories', 'id'], ['events', 'id'], ['missions', 'id'],
    ['artifacts', 'id'], ['cities', 'id'], ['players', 'id'], ['resources', 'id']]) {
    maxBefore[array] = Math.max(0, ...after[array].map((r) => Number(r[field])));
  }

  const memory = worldStore.addMemory(after, {
    entityId: after.npcs[0].id, memoryType: 'event', category: 'test',
    description: 'after the restore', importance: 1, emotionLevel: 1,
    relatedEntityIds: [], tick: after.tick,
  });
  assert.ok(memory.id > maxBefore.memories,
    `new memory got id ${memory.id}, but the restored world already uses up to `
    + `${maxBefore.memories}`);

  const artifact = engine.generateArtifact({ name: 'Another', origin: 'x', era: 'y', rarity: 'common' });
  assert.ok(artifact.id > maxBefore.artifacts, `new artifact reused id ${artifact.id}`);

  const city = engine.generateCity({ name: 'Second City' });
  assert.ok(city.id > maxBefore.cities, `new city reused id ${city.id}`);

  // And an entity, whose counter lives on WorldState rather than in a
  // module — a different mechanism, the same failure if it is missed.
  const npc = engine.generateNPC();
  const others = after.npcs.filter((n) => n.id === npc.id && n !== npc);
  assert.equal(others.length, 0, `new NPC took id ${npc.id}, which already exists`);

  assert.ok(Object.keys(summary.sequences).length >= 16,
    `only ${Object.keys(summary.sequences).length} sequences reseeded; there are sixteen`);
});

test('the simulation keeps running after a restore', async (t) => {
  if (!available) return t.skip(reason);
  const { after } = await roundTrip();

  // The point of all of it. A world that loads but cannot tick is not
  // restored, it is displayed.
  const tickBefore = after.tick;
  const eventsBefore = after.events.length;

  for (let i = 0; i < 3; i++) engine.advanceTick();

  assert.equal(after.tick, tickBefore + 3);
  assert.ok(after.events.length >= eventsBefore,
    'ticking a restored world lost events');

  // Every event id is still unique after three ticks on top of a
  // restored log — the reseed holding under real use rather than just
  // at the moment it ran.
  const ids = after.events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length,
    'two events share an id after ticking a restored world');
});

test('the fields that deliberately do not survive are named, and still deliberate', async (t) => {
  if (!available) return t.skip(reason);
  const { before, after } = await roundTrip();

  // A property's community_id/city_id have no column in the schema —
  // `properties` models no location at all — and nothing in server/
  // reads either one. server/schema-extensions.sql records why they
  // are not added: the bar for extending the schema is a field the
  // engine READS, and closing this gap properly is a design decision
  // about the Property/Territory relationship.
  //
  // This exemption re-earns itself. The moment something starts
  // reading a property's community, "nothing reads it" stops being
  // true and this fails.
  const fs = require('node:fs');
  const path = require('node:path');
  const serverDir = path.join(__dirname, '..', 'server');
  const readers = [];
  for (const file of fs.readdirSync(serverDir)) {
    if (!file.endsWith('.js')) continue;
    // property.js SETS them; migrate.js names territory_blocks' own
    // columns of the same name. Neither is a read of a property's
    // location.
    if (file === 'property.js' || file === 'migrate.js' || file === 'restore.js') continue;
    const src = fs.readFileSync(path.join(serverDir, file), 'utf8');
    if (/\bproperty\.community_id\b|\bp\.community_id\b/.test(src)) readers.push(file);
  }

  assert.deepEqual(readers, [],
    `${readers.join(', ')} now reads a property's community_id. The exemption in `
    + 'server/schema-extensions.sql says nothing does, which is why no column was added. '
    + 'Add the column and migrate it, or the restored world is wrong for a reason that '
    + 'is no longer written down anywhere.');

  assert.ok(before.properties[0].community_id != null, 'the fixture property has no community');
  assert.equal(after.properties[0].community_id, undefined,
    'community_id came back, which means a column was added without updating this exemption');
});
