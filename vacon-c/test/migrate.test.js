// VACANCY — the Postgres migration carries the whole world.
//
// **A migration that loses half the world and exits 0 is worse than one
// that fails.** That is exactly what `server/migrate.js` did until
// 29 Aug 2026: written at step 9, before Territory/Community,
// Artifact/Mission, Citizen-mode binding, Property and Culture existed,
// and never updated as each landed. It carried 13 of WorldState's 26
// arrays, reported a clean summary, and silently left every property,
// deed, city, ward, artifact, mission and player behind.
//
// Nothing caught it because nothing looked. The migration has no test
// that runs it — Postgres is not reachable from this environment — so
// the checks here are STRUCTURAL, and that turns out to be the more
// useful kind anyway:
//
//   1. every WorldState array is either carried or named as
//      deliberately not carried, so "not carried" stays a decision
//      rather than decaying back into a gap;
//   2. every table migrate.js writes to exists in the schema;
//   3. every COLUMN it names exists in that table.
//
// (3) is the one that would have caught a typo'd column without a
// database, and it is the reason this file can be trusted in an
// environment that cannot run the thing it tests.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = require('../server/engine.js');

const MIGRATE = fs.readFileSync(path.join(__dirname, '..', 'server', 'migrate.js'), 'utf8');
const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_POSTGRESQL_SCHEMA.sql'), 'utf8',
);

// Arrays that are deliberately not migrated, each with the reason.
// An unmigrated array with no entry here is indistinguishable from one
// somebody forgot — which is the whole failure this file exists for.
const NOT_CARRIED = {
  activeConditions: 'a minimal in-memory mechanism with no schema table of its own — '
    + 'environment_state is city-scoped and this is not (see tick.js\'s header)',
  migrationRisk: 'an explicitly flagged stand-in, overwritten every tick rather than '
    + 'accumulated as history',
  pendingObservations: 'behavior observations in flight for at most one tick before the '
    + 'Event phase turns them into real `events` rows, which ARE carried — migrating both '
    + 'would record every one of them twice',
};

function schemaColumns() {
  const tables = {};
  for (const m of SCHEMA.matchAll(/CREATE TABLE (\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, name, body] = m;
    const cols = new Set();
    for (const line of body.split('\n')) {
      const stripped = line.replace(/--.*$/, '').trim();
      if (!stripped) continue;
      const col = stripped.match(/^(\w+)\s+/);
      // Skip table-level constraints, which are not columns.
      if (col && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(col[1])) {
        cols.add(col[1].toLowerCase());
      }
    }
    tables[name.toLowerCase()] = cols;
  }
  return tables;
}

// Every `INSERT INTO table (a, b, c)` in migrate.js.
function migrateInserts() {
  return [...MIGRATE.matchAll(/INSERT INTO (\w+)\s*\(([^)]*)\)/g)].map((m) => ({
    table: m[1].toLowerCase(),
    columns: m[2].split(',').map((c) => c.trim().toLowerCase()).filter(Boolean),
  }));
}

// ---------------------------------------------------------------------------

test('the schema parser finds real tables and columns', () => {
  // A guard on the parser: one that matched nothing would make every
  // assertion below vacuously pass.
  const tables = schemaColumns();
  assert.ok(Object.keys(tables).length > 55, `parsed only ${Object.keys(tables).length} tables`);
  assert.ok(tables.properties.has('lifecycle_stage'));
  assert.ok(tables.cultures.has('leadership_style'));
  assert.ok(tables.ownership_records.has('acquired_tick'));
});

test('every WorldState array is either migrated or named as deliberately not', () => {
  const arrays = Object.keys(engine.WorldState)
    .filter((k) => Array.isArray(engine.WorldState[k]));

  const missed = arrays.filter((name) => {
    if (NOT_CARRIED[name]) return false;
    // `worldState.<name>` appearing in a for-loop is what carrying looks
    // like here.
    return !MIGRATE.includes(`worldState.${name}`);
  });

  assert.deepEqual(
    missed, [],
    'These WorldState arrays are not migrated and not listed as deliberately skipped:\n    '
    + `${missed.join(', ')}\n`
    + 'Either add them to server/migrate.js or add them to NOT_CARRIED with the reason. '
    + 'A migration that silently drops an array still reports success.',
  );
});

test('every deliberate omission carries a real reason', () => {
  for (const [name, reason] of Object.entries(NOT_CARRIED)) {
    assert.ok(reason.trim().length > 30, `${name}'s reason is too thin to be one`);
    assert.ok(
      Object.keys(engine.WorldState).includes(name),
      `NOT_CARRIED names "${name}", which is not on WorldState any more — stale entry`,
    );
  }
});

test('every table the migration writes to exists in the schema', () => {
  const tables = schemaColumns();
  const unknown = [...new Set(migrateInserts().map((i) => i.table))]
    .filter((t) => !tables[t]);

  assert.deepEqual(unknown, [], `migrate.js inserts into tables the schema does not define: ${unknown.join(', ')}`);
});

// The check that does not need a database.
test('every column the migration names exists in the table it names', () => {
  const tables = schemaColumns();
  const bad = [];

  for (const insert of migrateInserts()) {
    const known = tables[insert.table];
    if (!known) continue; // covered by the previous test
    for (const column of insert.columns) {
      if (!known.has(column)) bad.push(`${insert.table}.${column}`);
    }
  }

  assert.deepEqual(
    bad, [],
    'migrate.js inserts these columns and the schema has no such column:\n    '
    + `${bad.join('\n    ')}\n`
    + 'This would fail at runtime against a real database, and this environment cannot '
    + 'run one — so the mismatch has to be caught structurally or not at all.',
  );
});

// ---------------------------------------------------------------------------
// The Phase 2 systems specifically
// ---------------------------------------------------------------------------

test('Property, Culture and Flows all reach Postgres', () => {
  // Named individually rather than left to the sweep above, so a
  // regression points at the system rather than at a list. These are
  // the three built most recently and the likeliest to be forgotten
  // again.
  for (const table of ['properties', 'ownership_records', 'cultures',
    'culture_memberships', 'flow_templates']) {
    assert.ok(
      MIGRATE.includes(`INTO ${table}`),
      `${table} is never written by the migration`,
    );
  }
});

test('the Behavior Engine reaches Postgres, and its derived mood does not', () => {
  // The three tables architecture §4.5 named as genuinely new. They sat
  // in the schema with no code at all until 29 Aug 2026, so the failure
  // to guard against is not drift — it is a system that exists in the
  // database and nowhere else.
  for (const table of ['entity_state', 'habits', 'schedule_events']) {
    assert.ok(MIGRATE.includes(`INTO ${table}`), `${table} is never written by the migration`);
  }

  // Standing rule 3 again, at the second place it could be broken.
  // stress_level is path-dependent state and belongs in the row; mood
  // is a band over it and storing it is the drift the rule forbids.
  const stateInsert = migrateInserts().find((i) => i.table === 'entity_state');
  assert.ok(stateInsert.columns.includes('stress_level'), 'stress IS stored');
  assert.ok(
    !stateInsert.columns.includes('current_mood'),
    'mood is derived on read and must never be written back',
  );
  // Comments stripped first, for the same reason as the property test
  // below: the blunt version matched the comment explaining that mood
  // is NOT written, and a test that fails on prose describing correct
  // behaviour teaches people to delete the prose.
  const code = MIGRATE.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(code, /moodFor|current_mood/);
});

test('the derived property value is never written to the database', () => {
  // Standing rule 3, at the last place it could be broken. `value` is
  // the assessed number and belongs in the row; `currentValue` is
  // computed on read and storing it is precisely the drift the rule
  // forbids.
  const propertyInsert = migrateInserts().find((i) => i.table === 'properties');
  assert.ok(propertyInsert, 'properties are migrated');
  assert.ok(propertyInsert.columns.includes('value'), 'the assessed value IS stored');
  assert.ok(
    !propertyInsert.columns.some((c) => c.includes('currentvalue') || c === 'current_value'),
    'the derived value must not be written back',
  );
  // Comments stripped first. The blunt version of this matched the
  // comment in migrate.js that explains currentValue is NOT written —
  // a test that fails on prose describing correct behaviour teaches
  // people to delete the prose.
  const code = MIGRATE.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(code, /currentValue/, 'nothing in the migration computes a derived value');
});

test('the built-in flow templates are not written as if they were a world\'s own', () => {
  // The engine ships ten templates as code. Inserting them would turn
  // every default world into ten rows that then read as deliberate
  // overrides of themselves.
  assert.doesNotMatch(MIGRATE, /FLOW_TEMPLATES/,
    'migrate.js should carry worldState.flowTemplates only — the built-in ten are code');
  assert.ok(MIGRATE.includes('worldState.flowTemplates'));
});

test('culture columns match how culture.js actually stores the sixteen families', () => {
  const tables = schemaColumns();
  const cultures = tables.cultures;

  // Eight scored, three styles, five lists — the split culture.js makes.
  for (const scored of ['trust_level', 'tradition', 'innovation', 'competition',
    'cooperation', 'education', 'art', 'religion']) {
    assert.ok(cultures.has(scored), `cultures.${scored} is missing`);
  }
  for (const style of ['communication_style', 'leadership_style', 'conflict_resolution']) {
    assert.ok(cultures.has(style), `cultures.${style} is missing`);
  }
  // `values` is reserved in SQL, so the column is values_held.
  for (const list of ['values_held', 'customs', 'language', 'cuisine', 'fashion']) {
    assert.ok(cultures.has(list), `cultures.${list} is missing`);
  }
});

test('culture membership has no individual tier, in the database as well as the engine', () => {
  // The rule the whole Culture system exists to enforce — individuals
  // belong to a culture, they do not carry one — has to survive the
  // trip to Postgres.
  const block = SCHEMA.match(/CREATE TABLE culture_memberships[\s\S]*?\n\);/)[0];
  assert.match(block, /family\|community\|organization\|city\|civilization/);
  assert.doesNotMatch(block, /individual/);
});

// ---------------------------------------------------------------------------
// The direction nothing was checking
// ---------------------------------------------------------------------------
//
// Every test above this point asks "does every column migrate.js NAMES
// exist in the schema?" — it catches a typo. None of them asked the
// other direction: "is every schema column the engine actually fills
// being WRITTEN?" That gap let four real mission columns go unmigrated
// from the day missions landed.
//
// Proven against a live Postgres on 10 Sep 2026, not argued: a mission
// an NPC accepted and completed migrated with status 'completed' and
// NULL in assigned_entity_id, tick_accepted, tick_resolved and
// outcome_note. The database said the mission was done; nothing said
// who did it, when, or how it turned out. `market_listings.resource_type`
// went the same way, and that one silently unhooks a listing's price
// from its input resource's scarcity.
//
// This is the array-level failure in the header of this file, one level
// down. The fix there was to name every array; the fix here is to name
// every column.

// A schema column that the engine genuinely never fills, with the
// reason. Same contract as NOT_CARRIED: an unwritten column with no
// entry here is indistinguishable from one somebody forgot.
const NOT_WRITTEN = {
  'entity_state.current_mood': 'derived from stress at read time by behavior.js#getEntityState '
    + 'rather than stored — test 7 above asserts it stays that way, so writing it here would '
    + 'persist a value the engine recomputes and never reads back',
};

test('every schema column the engine fills is actually written', () => {
  const tables = schemaColumns();
  const written = {};
  for (const ins of migrateInserts()) {
    written[ins.table] = written[ins.table] || new Set();
    for (const c of ins.columns) written[ins.table].add(c);
  }

  // Build a world through the engine's own API and see which columns
  // its objects actually carry values for. Fixtures would only prove
  // what I typed; this proves what the engine does.
  const W = engine.WorldState;
  const npcs = [];
  for (let i = 0; i < 3; i++) npcs.push(engine.generateNPC());
  const art = engine.generateArtifact({
    name: 'The Key', origin: 'pre-collapse', era: 'old', rarity: 'rare',
  });
  const mission = engine.generateMission({ artifactId: art.id, objective: 'recover it', reward: 100 });
  engine.advanceTick();
  engine.acceptMission(mission.id, npcs[0].id);
  engine.advanceTick();
  engine.resolveMission(mission.id, {
    outcome: 'completed', entityId: npcs[0].id, note: 'found in the flooded wing',
  });

  const city = engine.generateCity({ name: 'Vacancy City' });
  engine.generateResource({ resourceType: 'grain', name: 'Grain' });
  const listing = engine.generateMarketListing({
    cityId: city.id, productName: 'Bread', price: 5, resourceType: 'grain',
  });

  // The engine object -> the table it lands in. Only tables whose rows
  // map one-to-one onto a single engine object; the entity subtypes
  // (npcs/organizations/families) are split across two tables and are
  // covered by the array-level tests above.
  const SUBJECTS = [
    ['missions', mission],
    ['market_listings', listing],
  ];

  const gaps = [];
  for (const [table, row] of SUBJECTS) {
    const cols = tables[table];
    assert.ok(cols, `no CREATE TABLE ${table} in the schema`);
    for (const col of cols) {
      if (written[table]?.has(col)) continue;
      if (NOT_WRITTEN[`${table}.${col}`]) continue;
      // The engine fills it if the row carries a non-null value under
      // that column's own name.
      if (row[col] !== undefined && row[col] !== null) {
        gaps.push(`${table}.${col} = ${JSON.stringify(row[col])} is never written`);
      }
    }
  }

  assert.deepEqual(gaps, [],
    `the engine fills these columns and the migration drops them:\n    ${gaps.join('\n    ')}`);
});

test('every deliberately-unwritten column carries a real reason', () => {
  // Same self-checking contract NOT_CARRIED has: an entry that no
  // longer describes a real unwritten column is a stale excuse, and a
  // stale excuse is how a real gap hides.
  const tables = schemaColumns();
  const written = {};
  for (const ins of migrateInserts()) {
    written[ins.table] = written[ins.table] || new Set();
    for (const c of ins.columns) written[ins.table].add(c);
  }

  for (const [key, reason] of Object.entries(NOT_WRITTEN)) {
    const [table, column] = key.split('.');
    assert.ok(tables[table]?.has(column),
      `NOT_WRITTEN names ${key}, which is not a column in the schema`);
    assert.equal(written[table]?.has(column) ?? false, false,
      `NOT_WRITTEN says ${key} is not written, but the migration writes it — stale entry`);
    assert.ok(reason.length > 40, `${key}'s reason is too short to be one`);
  }
});
