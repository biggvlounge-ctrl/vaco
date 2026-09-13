// The running percent, and the things that could make it lie.
//
// A completeness score is the easiest number in a codebase to fake, and
// this project has the receipts: `CLAUDE.md`'s "foundation already
// running" list was wrong in three places, a spec section said "roughly
// 25 of the 40" from memory, `statistics.js` carried 67 statistics that
// a real world answered 36 of, and seven trait families were generated
// on every NPC and read by nothing. Every one of those was a confident
// claim a measurement contradicted.
//
// So the tests here are not about the arithmetic. They are about the
// three ways the measurement could quietly stop being a measurement:
//
//   1. An axis stops reading reality and starts reading a list.
//   2. `BY_DESIGN` — the one hand-written list in the whole file —
//      grows an excuse that is not true any more.
//   3. The committed report drifts from what the code produces.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const completeness = require('../server/completeness.js');
const urbanSystems = require('../server/urbanSystems.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

const SERVER = path.join(__dirname, '..', 'server');

// One world, measured once — building it is the expensive part and
// every test below asks a different question of the same measurement.
//
// **Smaller and shorter than the report's canonical world, on purpose.**
// The tests here ask whether each axis reads reality; they do not need
// the exact percent, and reproducing the report's own 200-tick full-size
// run inside the unit suite pushed vacon-c past the 120-second per-suite
// timeout in `scripts/run-all-tests.mjs` — which failed the whole suite
// rather than any assertion, and reported "no TAP summary" instead of a
// message anybody could act on.
//
// The canonical measurement is verified exactly once, by
// `scripts/completeness.mjs --check`, from the `scripts` suite — the
// same place `completion-report.mjs` is checked, and for the same
// reason.
let measured = null;
function measurement() {
  if (measured) return measured;
  const world = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 20, seed: 'complete' });
  const snapshot = completeness.snapshotTraits(world);
  for (let t = 0; t < 60; t += 1) engine.advanceTick();
  measured = { world, report: completeness.measure(world, snapshot) };
  return measured;
}

// -- the score is a measurement ----------------------------------------

test('the percent is computed from a real world, not from a stored number', () => {
  // The claim that matters. If `measure` ever starts returning a
  // constant, this is what notices: the same code against a world with
  // nothing in it must score lower than against a world that was built
  // and run.
  const { report } = measurement();

  const empty = {
    tick: 0, npcs: [], organizations: [], families: [], entityTraits: [],
    communities: [], habits: [], scheduleEvents: [], entityState: [],
  };
  const bare = completeness.measure(empty, new Map());

  assert.ok(bare.percent < report.percent,
    `an empty world scored ${bare.percent}% and a built one ${report.percent}%`);
  assert.ok(report.percent > 0 && report.percent < 100);
});

test('every axis reports a score out of a real denominator', () => {
  const { report } = measurement();
  const axes = report.axes.map((a) => a.axis);
  assert.deepEqual(axes, [
    'systems', 'tables', 'statistics', 'traits', 'traitDepth', 'habits',
  ]);
  for (const axis of report.axes) {
    assert.ok(axis.total > 0, `${axis.axis} has no items`);
    assert.ok(axis.earned <= axis.total, `${axis.axis} scored more than its total`);
    assert.equal(axis.gaps.length, axis.items.filter((i) => i.credit < 1).length);
  }
  assert.equal(report.total, report.axes.reduce((s, a) => s + a.total, 0));
});

test('the denominators come from the schema and the spec, not from this file', () => {
  // Each axis's size has to be traceable to something outside the
  // measurement, or the score can be improved by shortening the list.
  const { report } = measurement();
  const byAxis = Object.fromEntries(report.axes.map((a) => [a.axis, a]));

  assert.equal(byAxis.systems.total, urbanSystems.SYSTEMS.length);
  assert.equal(byAxis.tables.total, completeness.schemaTables().length);
  assert.equal(byAxis.traitDepth.total, completeness.TRAIT_COLUMNS.length);

  // And the schema really is the source for tables — a name only it has.
  assert.ok(completeness.schemaTables().includes('public_opinion'));
});

// -- the one hand-written list -----------------------------------------

test('every BY_DESIGN excuse is still true of the code it cites', () => {
  // **The only place this file could lie.** Each entry says a table is
  // deliberately not a WorldState array; if the engine grows into one,
  // the excuse becomes a free point and nothing else would catch it.
  const source = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(SERVER, f), 'utf8'))
    .join('\n');

  for (const table of Object.keys(completeness.BY_DESIGN)) {
    const key = table.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    assert.equal(Array.isArray(engine.WorldState[key]), false,
      `${table} is excused as "by design" but WorldState.${key} is a real array now — `
      + 'score it like every other table');
  }

  // The two subtype claims name standing rule 4, so check the engine
  // really does store them as flags on an organization rather than
  // separately.
  assert.ok(source.includes('isFaction'),
    'factions is excused as a subtype of organizations and nothing sets isFaction');
});

test('every CORRECTLY_EMPTY excuse names a store that really exists', () => {
  // **The opposite claim to BY_DESIGN, and it needs the opposite
  // check.** These tables DO have an array and it is right for a
  // generated world to leave it empty. Asserting the array is absent —
  // which is what the BY_DESIGN check does — is exactly wrong here, and
  // running both against one list is what failed the suite when they
  // were one list.
  const declared = new Set(completeness.schemaTables());
  for (const [table, reason] of Object.entries(completeness.CORRECTLY_EMPTY)) {
    assert.ok(declared.has(table), `CORRECTLY_EMPTY excuses "${table}", which is not a table`);
    const key = table.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    assert.ok(Array.isArray(engine.WorldState[key]),
      `${table} is excused as correctly empty and WorldState.${key} is not an array at all — `
      + 'that is a "no store", which scores zero');
    assert.ok(reason.length > 20, `${table}'s excuse does not say why`);
  }

  // And no table may appear in both lists, which would be two
  // contradictory claims about the same thing.
  for (const table of Object.keys(completeness.CORRECTLY_EMPTY)) {
    assert.equal(completeness.BY_DESIGN[table], undefined,
      `${table} is excused twice, as both "no store" and "correctly empty"`);
  }
});

test('a correctly-empty store loses its excuse once a world fills it', () => {
  // The excuse is about a world leaving it empty, not about the table.
  // If a world ever does put a row in one, it should be scored like any
  // other live table rather than keeping free credit.
  const table = Object.keys(completeness.CORRECTLY_EMPTY)[0];
  const key = table.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const filled = completeness.measureTables({ ...engine.WorldState, [key]: [{ id: 1 }] });
  const row = filled.items.find((i) => i.name === table);
  assert.equal(row.state, 'live', `${table} kept its by-design credit while holding a row`);
});

test('BY_DESIGN names only tables the schema actually declares', () => {
  const declared = new Set(completeness.schemaTables());
  for (const table of Object.keys(completeness.BY_DESIGN)) {
    assert.ok(declared.has(table), `BY_DESIGN excuses "${table}", which is not a table`);
  }
});

// -- the axes read reality ---------------------------------------------

test('the tables axis separates a table with no store from one a world left empty', () => {
  // The distinction the report is built on, and the reason a gap list
  // is useful rather than a wall of names: one needs a system built,
  // the other needs worldgen to call something that already exists.
  const { report } = measurement();
  const tables = report.axes.find((a) => a.axis === 'tables');
  const states = new Set(tables.items.map((i) => i.state));

  assert.ok(states.has('live'));
  assert.ok(states.has('no store') || states.has('empty in a built world'),
    'every table scored full marks, which has never been true');
  for (const item of tables.items) {
    if (item.state === 'live') assert.ok(item.rows > 0, `${item.name} is "live" with no rows`);
  }
});

test('the habits axis asks about a world, not about whether code exists', () => {
  // `behavior.js` was complete and green while every habit in every
  // world sat at exactly 100 and no mood was ever recorded. An axis
  // that checked for functions would have called that done.
  const { world } = measurement();
  const axis = completeness.measureHabits(world);
  assert.ok(axis.items.length >= 7);

  // The world habits looked like before this axis existed: three
  // routines, every strength identical, nothing harmful, no time, no
  // place. Only the two facets that are correct by design score.
  const flat = completeness.measureHabits({
    habits: [
      { habit_name: 'rest', strength: 100, harmful: false },
      { habit_name: 'eat', strength: 100, harmful: false },
      { habit_name: 'work', strength: 100, harmful: false },
    ],
    scheduleEvents: [{ frequency: 'daily', time_slot: null, location_property_id: null }],
    entityState: [{ current_mood: null, stress_level: 10 }],
  });
  const earned = flat.items.filter((i) => i.credit === 1).map((i) => i.name);
  assert.deepEqual(earned, ['mood is derived rather than stored'],
    `a flat world scored: ${earned.join(', ')}`);
});

test('the trait-depth axis needs a before and an after', () => {
  // Without a snapshot every column reads as unmoved, which would be a
  // measurement that always says the same thing.
  const { world } = measurement();
  const noSnapshot = completeness.measureTraitDepth(world, new Map());
  assert.equal(noSnapshot.items.length, completeness.TRAIT_COLUMNS.length);

  // With no before-and-after, nothing can read as moved — so the only
  // columns scoring are the ones that are correct never to move.
  const earned = noSnapshot.items.filter((i) => i.credit === 1).map((i) => i.name);
  assert.deepEqual(earned,
    Object.keys(completeness.TRAIT_COLUMN_BY_DESIGN).map((c) => `entity_traits.${c}`));
});

// -- the committed report ----------------------------------------------

test('the committed report exists and is internally consistent', () => {
  // Cheap structural checks only — that the report is present, that its
  // headline matches its own axis table, and that the master record
  // agrees with it. Whether the numbers still match the CODE is
  // `scripts/completeness.mjs --check`'s job, because answering it
  // means rebuilding the canonical world.
  const report = path.join(__dirname, '..', 'dev-docs', 'GAME_COMPLETENESS.md');
  assert.ok(fs.existsSync(report), 'dev-docs/GAME_COMPLETENESS.md has never been generated');
  const committed = fs.readFileSync(report, 'utf8');

  const headline = committed.match(/^## ([\d.]+)% complete$/m);
  assert.ok(headline, 'the report has no headline percent');

  const rows = [...committed.matchAll(/^\| (\w+) \| \*\*([\d.]+)%\*\* \| ([\d.]+)\/(\d+) \|/gm)];
  assert.equal(rows.length, 6, 'the report should carry one row per axis');

  const earned = rows.reduce((sum, r) => sum + Number(r[3]), 0);
  const total = rows.reduce((sum, r) => sum + Number(r[4]), 0);
  const recomputed = Math.round((earned / total) * 1000) / 10;
  assert.equal(Number(headline[1]), recomputed,
    `the headline says ${headline[1]}% and its own axis rows sum to ${recomputed}%`);

  // Every axis the code produces has a row, so an axis cannot be added
  // and left out of the report.
  const named = rows.map((r) => r[1]).sort();
  const { report: fresh } = measurement();
  assert.deepEqual(named, fresh.axes.map((a) => a.axis).sort());
});

test('the master record carries the percent the report does', () => {
  // The point of the whole exercise: the number lives in the master
  // file, and a master file that disagrees is the failure this project
  // keeps having.
  const committed = fs.readFileSync(
    path.join(__dirname, '..', 'dev-docs', 'GAME_COMPLETENESS.md'), 'utf8',
  );
  const record = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SYSTEM_OF_RECORD.md'), 'utf8',
  );
  const percent = committed.match(/^## ([\d.]+)% complete$/m)[1];
  assert.ok(record.includes(`**${percent}%**`),
    `SYSTEM_OF_RECORD.md does not carry the reported ${percent}%. `
    + 'Re-run `node vacon-c/scripts/completeness.mjs` and update §11a.');

  for (const [, axis, axisPercent] of committed.matchAll(
    /^\| (\w+) \| \*\*([\d.]+)%\*\* \|/gm,
  )) {
    assert.ok(record.includes(`| ${axis} | ${axisPercent}% |`),
      `SYSTEM_OF_RECORD.md's ${axis} row disagrees with the report (${axisPercent}%)`);
  }
});
