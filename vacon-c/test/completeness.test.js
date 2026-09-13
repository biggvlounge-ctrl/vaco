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
let measured = null;
function measurement() {
  if (measured) return measured;
  const world = engine.WorldState;
  worldgen.generateWorld({ seed: 'complete' });
  const snapshot = completeness.snapshotTraits(world);
  for (let t = 0; t < 200; t += 1) engine.advanceTick();
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
  assert.equal(axis.items.length, 7);

  const flat = completeness.measureHabits({
    habits: [{ habit_name: 'rest', strength: 100, harmful: false }],
    scheduleEvents: [{ frequency: 'daily', time_slot: null, location_property_id: null }],
    entityState: [{ current_mood: null }],
  });
  assert.equal(flat.items.filter((i) => i.credit === 1).length, 0,
    'a world with one habit at one strength in one place scored something');
});

test('the trait-depth axis needs a before and an after', () => {
  // Without a snapshot every column reads as unmoved, which would be a
  // measurement that always says the same thing.
  const { world } = measurement();
  const noSnapshot = completeness.measureTraitDepth(world, new Map());
  assert.equal(noSnapshot.items.filter((i) => i.credit === 1).length, 0);
  assert.equal(noSnapshot.items.length, completeness.TRAIT_COLUMNS.length);
});

// -- the committed report ----------------------------------------------

test('the committed report matches what the script produces', () => {
  // Same guard as `scripts/completion-report.mjs` at the ecosystem
  // level: a generated document that nobody regenerates is a stale
  // document that looks current.
  const report = path.join(__dirname, '..', 'dev-docs', 'GAME_COMPLETENESS.md');
  assert.ok(fs.existsSync(report), 'dev-docs/GAME_COMPLETENESS.md has never been generated');

  const committed = fs.readFileSync(report, 'utf8');
  const { report: fresh } = measurement();
  assert.ok(committed.includes(`## ${fresh.percent}% complete`),
    `the report claims a different percent than the code measures (${fresh.percent}%). `
    + 'Re-run `node vacon-c/scripts/completeness.mjs`.');

  for (const axis of fresh.axes) {
    assert.ok(committed.includes(`| ${axis.axis} | **${axis.percent}%** |`),
      `the report's ${axis.axis} row is stale (${axis.percent}%)`);
  }
});

test('the master record carries the same percent the code measures', () => {
  // The point of the whole exercise: the number lives in the master
  // file, and a master file that disagrees with the engine is the
  // failure this project keeps having.
  const record = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SYSTEM_OF_RECORD.md'), 'utf8',
  );
  const { report } = measurement();
  assert.ok(record.includes(`${report.percent}%`),
    `SYSTEM_OF_RECORD.md does not carry the measured ${report.percent}%. `
    + 'Re-run `node vacon-c/scripts/completeness.mjs` and update §VACON-C completeness.');
});
