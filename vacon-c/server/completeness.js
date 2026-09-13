// server/completeness.js
//
// **What percentage of a complete game actually exists.**
//
// The number has to be measured, not declared, and this whole session
// is the reason why. `CLAUDE.md`'s own "foundation already running"
// list was wrong in three places. `urbanSystems.js` exists because a
// spec section said "roughly 25 of the 40" and "roughly" was an
// estimate from memory. `statistics.js` carried 67 statistics and a
// real world answered 36. Seven trait families were generated on every
// NPC and read by nothing. Every one of those was a confident claim
// that a measurement contradicted.
//
// So there is no checklist in this file that a person ticks. Every
// axis below is computed from either the source tree or a world that
// was actually generated and ticked, and the ones that need a world
// take one as an argument rather than building their own — so the
// report and the tests measure the same thing.
//
// ---------------------------------------------------------------------
// Why these axes, and why they are weighted by item count
//
// Six axes, each answering a different question that "is the game
// done?" decomposes into:
//
//   systems    Do the forty urban systems the spec names have
//              mechanics? (`urbanSystems.js`, already test-verified)
//   tables     Does a real world put rows in the tables the schema
//              declares, or are they empty shapes?
//   statistics Can a world answer what it is supposed to be able to
//              answer about itself? (`statistics.js`)
//   traits     Does anything read the traits every entity carries?
//   traitDepth Do traits ever CHANGE, or is everyone frozen at birth?
//   habits     Do habits and routines carry information, or does
//              everybody have the same three at the same strength?
//
// **The total is weighted by item count, deliberately.** Any other
// weighting is a judgement about which half of a game matters more,
// and there is no document here that makes that judgement — so
// inventing one would put a made-up number at the top of a report
// whose entire purpose is that its numbers are not made up. One
// statistic counts the same as one table counts as one trait. The
// per-axis percentages are reported beside the total precisely so a
// reader can disagree with that and weight them differently.
//
// ---------------------------------------------------------------------
// Partial credit, and the one place it is allowed
//
// A thing is scored 1 or 0 wherever a yes/no question can be asked of
// it. Partial credit exists only for the two axes whose own source
// already grades — `urbanSystems.js`'s four levels, and a table that
// code writes but a generated world leaves empty. That second case is
// the eleventh standing rule's exact shape and it is worth half rather
// than nothing or everything: the mechanism is real and tested, and no
// world has ever used it.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const urbanSystems = require('./urbanSystems.js');
const statistics = require('./statistics.js');
const { TRAIT_FAMILIES } = require('./traits.js');

const SERVER_DIR = __dirname;
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------
// Axis 1 — the forty urban systems
// ---------------------------------------------------------------------

//: What each of `urbanSystems.js`'s own four levels is worth. Its
//: header defines them and says a `slot` "is closer to absent than to
//: built", which is what 0.15 encodes. `partial` is "the mechanism
//: exists but is thin", so half.
//:
//: These are the only invented numbers in this file and they are
//: confined to one axis. Flagged interpretive.
const LEVEL_CREDIT = {
  modelled: 1,
  partial: 0.5,
  slot: 0.15,
  absent: 0,
};

function measureSystems() {
  const items = [];
  for (const system of urbanSystems.SYSTEMS) {
    // A system deferred by a scope decision still is not in the game.
    // It is counted at its level and listed apart, so the headline
    // number stays honest and the gap list says why it is open.
    items.push({
      name: `${system.n}. ${system.name}`,
      credit: LEVEL_CREDIT[system.level] ?? 0,
      state: system.level,
      deferred: Boolean(system.deferred),
    });
  }
  return { axis: 'systems', label: 'urban systems with mechanics', items };
}

// ---------------------------------------------------------------------
// Axis 2 — the tables the schema declares
// ---------------------------------------------------------------------

// Every `CREATE TABLE` in the schema and its extensions. The schema is
// the design's own statement of what a world is made of, which makes it
// the one denominator here nobody had to choose.
function schemaTables() {
  const sources = [
    path.join(ROOT, 'VACANCY_POSTGRESQL_SCHEMA.sql'),
    path.join(SERVER_DIR, 'schema-extensions.sql'),
  ];
  const names = [];
  for (const file of sources) {
    const sql = fs.readFileSync(file, 'utf8');
    for (const m of sql.matchAll(/^CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gm)) names.push(m[1]);
  }
  return [...new Set(names)];
}

//: Tables that are deliberately not a `WorldState` array, each with the
//: reason and the file that proves it. **This list is the one place
//: this file could lie**, so `test/completeness.test.js` checks every
//: entry against the code it cites — an excuse that stops being true
//: fails the suite rather than quietly inflating the score.
const BY_DESIGN = {
  entities: 'derived at migration — migrate.js writes one row per npc/organization/family',
  trait_definitions: 'a module constant (traitDefinitions.js), not per-world state',
  key_definitions: 'a module constant (keys.js), not per-world state',
  factions: 'a subtype of organizations — standing rule 4, stored as isFaction',
  businesses: 'a subtype of organizations — standing rule 4, stored on the organization',
};

const TABLE_TO_ARRAY = (table) => table.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function measureTables(worldState) {
  const items = [];
  for (const table of schemaTables()) {
    const key = TABLE_TO_ARRAY(table);
    const array = worldState[key];

    if (BY_DESIGN[table]) {
      items.push({ name: table, credit: 1, state: 'by design', note: BY_DESIGN[table] });
      continue;
    }
    if (!Array.isArray(array)) {
      items.push({ name: table, credit: 0, state: 'no store' });
      continue;
    }
    if (array.length === 0) {
      // The eleventh standing rule exactly: built, tested, and no world
      // has ever put a row in it.
      items.push({ name: table, credit: 0.5, state: 'empty in a built world' });
      continue;
    }
    items.push({ name: table, credit: 1, state: 'live', rows: array.length });
  }
  return { axis: 'tables', label: 'schema tables a built world fills', items };
}

// ---------------------------------------------------------------------
// Axis 3 — what a world can say about itself
// ---------------------------------------------------------------------

// **Answered ANYWHERE, not answered everywhere.** `profileAll` returns
// one profile per community, and a statistic that is null for one
// block because that block happens to have no businesses is not a gap
// in the engine. The question this axis asks is whether the world can
// produce the number at all, so a statistic counts once it comes back
// from any area — which is also the only reading under which the
// denominator is the catalogue (67) rather than the catalogue times
// however many communities a seed happened to make.
function measureStatistics(worldState) {
  const profiles = statistics.profileAll(worldState);
  const answered = new Map();

  for (const profile of profiles) {
    // `profileFor` returns { communityId, tick, population, statistics }
    // — the catalogue is the fourth field, not the object itself.
    for (const [name, result] of Object.entries(profile.statistics || {})) {
      const known = result && result.value !== null && result.value !== undefined;
      const prior = answered.get(name);
      if (!prior || (known && !prior.known)) {
        answered.set(name, { known, declared: Boolean(result?.reason) });
      }
    }
  }

  const items = [...answered.entries()].map(([name, r]) => ({
    name,
    credit: r.known ? 1 : 0,
    // A declared gap names its own missing substrate, which is a
    // better state to be in than a silent null, but it is still a
    // number the world cannot produce.
    state: r.known ? 'answered' : (r.declared ? 'declared gap' : 'silent'),
  }));
  return { axis: 'statistics', label: 'statistics a world can answer', items };
}

// ---------------------------------------------------------------------
// Axis 4 — traits anything reads
// ---------------------------------------------------------------------

function serverSource() {
  return fs.readdirSync(SERVER_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'completeness.js')
    .map((f) => fs.readFileSync(path.join(SERVER_DIR, f), 'utf8'))
    .join('\n');
}

function measureTraits() {
  const source = serverSource();
  const items = [];
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    // A reader that takes the whole family counts for every trait in
    // it — `perception.js` averaging all of `special` really does read
    // Artifact Sensitivity.
    const familyRead = new RegExp(`traits\\??\\.${family}\\b`).test(source);
    for (const name of names) {
      const named = source.includes(`'${name}'`) || source.includes(`\`${name}\``);
      items.push({
        name: `${family}.${name}`,
        credit: named || familyRead ? 1 : 0,
        state: named ? 'read by name' : familyRead ? 'read with its family' : 'read by nothing',
      });
    }
  }
  return { axis: 'traits', label: 'traits something reads', items };
}

// ---------------------------------------------------------------------
// Axis 5 — whether traits ever change
// ---------------------------------------------------------------------

// `entity_traits` carries seven contributing columns. A person whose
// six non-Key columns never move is frozen at birth: they cannot learn,
// cannot be shaped by where they live, and cannot be changed by who
// they know. Measured over a real run rather than asserted, because
// every one of these columns EXISTS and is migrated and restored — the
// question is only whether anything writes them.
const TRAIT_COLUMNS = [
  'base_value',
  'temporary_modifier',
  'permanent_modifier',
  'experience_modifier',
  'environmental_modifier',
  'relationship_modifier',
  'key_modifier',
];

function snapshotTraits(worldState) {
  const snap = new Map();
  for (const row of worldState.entityTraits || []) {
    snap.set(`${row.entity_id}:${row.trait_id}`, { ...row });
  }
  return snap;
}

function measureTraitDepth(worldState, snapshot) {
  const moved = Object.fromEntries(TRAIT_COLUMNS.map((c) => [c, 0]));
  let compared = 0;
  for (const row of worldState.entityTraits || []) {
    const before = snapshot.get(`${row.entity_id}:${row.trait_id}`);
    if (!before) continue;
    compared += 1;
    for (const column of TRAIT_COLUMNS) {
      if (Number(row[column]) !== Number(before[column])) moved[column] += 1;
    }
  }
  const items = TRAIT_COLUMNS.map((column) => ({
    name: `entity_traits.${column}`,
    credit: moved[column] > 0 ? 1 : 0,
    state: moved[column] > 0
      ? `moved on ${moved[column]} of ${compared} rows`
      : 'never moves — nothing writes it',
  }));
  return { axis: 'traitDepth', label: 'trait columns a life actually changes', items };
}

// ---------------------------------------------------------------------
// Axis 6 — whether habits and routines carry information
// ---------------------------------------------------------------------

// Each facet is a yes/no question about a real world, and each one was
// a real "no" when this file was written: three habit names, every
// strength at exactly 100, no harmful habit ever formed, only `daily`
// used, no routine with a time or a place, and no mood ever recorded
// against the 185 properties and 150 people in the world.
function measureHabits(worldState) {
  const habits = worldState.habits || [];
  const schedule = worldState.scheduleEvents || [];
  const states = worldState.entityState || [];

  const strengths = habits.map((h) => Number(h.strength)).filter(Number.isFinite);
  const spread = strengths.length > 1
    ? Math.max(...strengths) - Math.min(...strengths)
    : 0;
  const distinctHabits = new Set(habits.map((h) => h.habit_name)).size;
  const frequencies = new Set(schedule.map((e) => e.frequency)).size;

  const items = [
    {
      name: 'more than one habit strength in the world',
      credit: spread > 1 ? 1 : 0,
      state: spread > 1 ? `spread of ${spread.toFixed(1)}` : 'every habit at the same strength',
    },
    {
      name: 'habits beyond the three a routine seeds',
      credit: distinctHabits > 3 ? 1 : 0,
      state: `${distinctHabits} distinct habit names`,
    },
    {
      name: 'harmful habits can form',
      credit: habits.some((h) => h.harmful) ? 1 : 0,
      state: habits.some((h) => h.harmful) ? 'present' : 'the addiction half of the table is dead',
    },
    {
      name: 'more than one schedule frequency',
      credit: frequencies > 1 ? 1 : 0,
      state: `${frequencies} of 4 used`,
    },
    {
      name: 'routines happen at a time',
      credit: schedule.some((e) => e.time_slot !== null && e.time_slot !== undefined) ? 1 : 0,
      state: `${schedule.filter((e) => e.time_slot != null).length} of ${schedule.length} have a slot`,
    },
    {
      name: 'routines happen somewhere',
      credit: schedule.some((e) => e.location_property_id != null) ? 1 : 0,
      state: `${schedule.filter((e) => e.location_property_id != null).length} of ${schedule.length} have a place`,
    },
    {
      name: 'a mood is recorded, not only computed',
      credit: states.some((s) => s.current_mood != null) ? 1 : 0,
      state: `${states.filter((s) => s.current_mood != null).length} of ${states.length} rows carry one`,
    },
  ];
  return { axis: 'habits', label: 'habit and routine depth', items };
}

// ---------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------

function scoreAxis(axis) {
  const earned = axis.items.reduce((sum, i) => sum + i.credit, 0);
  const total = axis.items.length;
  return {
    ...axis,
    earned: Math.round(earned * 100) / 100,
    total,
    percent: total === 0 ? null : Math.round((earned / total) * 1000) / 10,
    gaps: axis.items.filter((i) => i.credit < 1),
  };
}

// Everything, measured against one world. The world is passed in
// rather than built here so a caller can measure the world they care
// about — and so the test and the report cannot disagree about which
// world was measured.
//
// `snapshot` is `snapshotTraits(worldState)` taken BEFORE the ticks,
// which is the only axis that needs a before-and-after.
function measure(worldState, snapshot = new Map()) {
  const axes = [
    measureSystems(),
    measureTables(worldState),
    measureStatistics(worldState),
    measureTraits(),
    measureTraitDepth(worldState, snapshot),
    measureHabits(worldState),
  ].map(scoreAxis);

  const earned = axes.reduce((sum, a) => sum + a.earned, 0);
  const total = axes.reduce((sum, a) => sum + a.total, 0);

  return {
    axes,
    earned: Math.round(earned * 100) / 100,
    total,
    percent: Math.round((earned / total) * 1000) / 10,
  };
}

module.exports = {
  LEVEL_CREDIT,
  BY_DESIGN,
  TRAIT_COLUMNS,
  schemaTables,
  snapshotTraits,
  measureSystems,
  measureTables,
  measureStatistics,
  measureTraits,
  measureTraitDepth,
  measureHabits,
  measure,
};
