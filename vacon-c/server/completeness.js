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
const politics = require('./politics.js');
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

//: A different claim from `BY_DESIGN`, and **separating them was forced
//: by the test rather than foreseen**: these tables DO have a WorldState
//: array, and it is correct for a generated world to leave it empty.
//: Lumping them in with the not-a-store list made
//: `test/completeness.test.js` fail, because that check asserts the
//: array does not exist — which is exactly the check the not-a-store
//: excuses need and precisely the wrong one here. Two claims, two
//: checks.
const CORRECTLY_EMPTY = {
  // An OVERRIDE list, not a store. `flows.listFlowTemplates` returns the
  // built-in FLOW_TEMPLATES when this array is empty and merges over
  // them when it is not — so empty means "the world runs the ten named
  // flows", which is the normal case, not a missing one.
  flow_templates: 'an override list — flows.listFlowTemplates falls back to the built-ins',
  // A player is a human account bound to an entity. Generating one into
  // every world would fabricate a user who does not exist, and the
  // binding is what `players.generatePlayer` is for when somebody
  // actually joins.
  players: 'a human joining, not a feature of a world — worldgen has nobody to bind',
};

//: Tables a real mechanism writes that this particular world never
//: triggers. **Scored the same half-credit as any other empty table** —
//: the mechanism is built and tested, and no world has used it, which
//: is exactly what half means here. What this list adds is the reason,
//: so the gap list says "no world has been unstable enough" rather than
//: "nothing writes it", which are different pieces of work.
//:
//: The floor is read from `politics.js` rather than repeated, so the
//: note cannot drift from the constant it describes.
const TABLE_UNREACHED = {
  revolutions: 'assessRevolutions runs every tick; no generated world has fallen below '
    + `approval ${politics.REVOLUTION_APPROVAL_FLOOR} with `
    + `${Math.round(politics.REVOLUTION_SPREAD_FLOOR * 100)}% of the population informed`,
};

//: Tables with no store, where that is a DECISION rather than an
//: omission. **Credit stays 0 and that is the point** — the comment on
//: `measureSystems` says a system deferred by scope "still is not in the
//: game", and the same holds here: this list changes what the gap SAYS,
//: never what it is worth. A deferral that raised the score would be a
//: way to finish a project by declaring things out of it.
//:
//: Added 23 Sep 2026, after finding `vault_studios_links` and
//: `analytics_snapshots` scored as open with no reason recorded anywhere
//: in `server/` or `dev-docs/` — two points of gap that nobody could
//: act on or dismiss, because nothing said which they were. An
//: undeclared gap is the thirteenth rule's corollary upside down: a
//: stated gap is a decision somebody can make, and an unstated one is
//: just a number going down.
const TABLE_NO_STORE_REASON = {
  vault_studios_links: {
    deferred: true,
    note: 'CLAUDE.md defers this twice — the fifth standing rule says ecosystem apps '
      + '(Vavlt Stvdios among them) are linked to, never rebuilt, and the explicit '
      + 'do-not-touch list names subscription tiers and ecosystem link-outs. Its three '
      + 'columns are a creator id and a tier, which is the link-out and the tier verbatim. '
      + 'Building it would break scope in two places at once.',
  },
  trade_routes: {
    deferred: true,
    note: 'Transportation is on CLAUDE.md\'s explicit do-not-touch list, and economy.js '
      + 'records this table as closed scope rather than a gap for that reason.',
  },
  economy_snapshots: {
    note: 'A TIME SERIES, which is not the same thing as a rollup, and the distinction is '
      + 'the open question. The third standing rule forbids storing what is computable — '
      + 'but supply, demand and price at tick 300 are NOT computable at tick 900, because '
      + 'the past is gone. So this is a real design decision nobody has made rather than a '
      + 'rule-3 violation: either the engine keeps a history or it accepts that only the '
      + 'present is answerable. `urbanSystems.js` marks it schemaOnly, which records the '
      + 'state without deciding it.',
  },
  analytics_snapshots: {
    note: 'The same open question as economy_snapshots, one tier up: population, gdp, '
      + 'crime, birth and death rates and two indices, per tick. Every column is answerable '
      + 'about the present by `statistics.js` and none is answerable about the past. '
      + '`scripts/playtest.mjs` samples its own arc precisely because nothing persists one.',
  },
  investments: {
    note: 'Genuinely unbuilt rather than deferred — economy.js names it alongside '
      + 'trade_routes and is explicit that only trade_routes is closed by the '
      + 'Transportation deferral. No mechanism anywhere creates, values or settles one.',
  },
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
      // The reason, where there is one. Credit is 0 either way — see the
      // note on TABLE_NO_STORE_REASON.
      const reason = TABLE_NO_STORE_REASON[table];
      items.push({
        name: table,
        credit: 0,
        state: 'no store',
        ...(reason ? { note: reason.note, deferred: Boolean(reason.deferred) } : {}),
      });
      continue;
    }
    if (CORRECTLY_EMPTY[table] && array.length === 0) {
      items.push({
        name: table, credit: 1, state: 'by design', note: CORRECTLY_EMPTY[table],
      });
      continue;
    }
    if (array.length === 0) {
      if (TABLE_UNREACHED[table]) {
        items.push({
          name: table, credit: 0.5, state: 'written, but unreached', note: TABLE_UNREACHED[table],
        });
        continue;
      }
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

//: Columns it is CORRECT never to write, with the reason. Checked by
//: `test/completeness.test.js` the same way `BY_DESIGN` is.
const TRAIT_COLUMN_BY_DESIGN = {
  base_value: 'base is the value you were born with; change belongs in a modifier',
};

//: Columns a real mechanism writes that this particular world never
//: triggers. **Still scored zero** — the point of measuring a built
//: world is that an unreached mechanism and an unwritten one look the
//: same from inside it, and the honest thing is to say which this is
//: rather than to award the point.
//:
//: `temporary_modifier` is the live example, and it names a second
//: finding: stress in a generated world tops out around 55, so the
//: `distressed` and `crisis` bands of `behavior.MOOD_BANDS` are
//: unreachable and nobody is ever acutely strained. Lowering the
//: threshold to make this column move would be turning a real gap into
//: a green tick.
const TRAIT_COLUMN_UNREACHED = {
  temporary_modifier: 'no generated world has yet put anybody under acute strain '
    + '(stress peaks near 55 against a threshold of 60)',
  permanent_modifier: 'nothing distinguishes an event somebody walks away from '
    + 'unchanged from one that marks them — see server/traitDrift.js',
};

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
  const items = TRAIT_COLUMNS.map((column) => {
    if (moved[column] > 0) {
      return {
        name: `entity_traits.${column}`,
        credit: 1,
        state: `moved on ${moved[column]} of ${compared} rows`,
      };
    }
    if (TRAIT_COLUMN_BY_DESIGN[column]) {
      // Same call as `current_mood` in the habits axis: a column that
      // is CORRECT to leave alone is not missing work, and scoring it
      // as a gap would be an accuracy failure in the direction that
      // looks like rigour.
      return {
        name: `entity_traits.${column}`,
        credit: 1,
        state: `by design — ${TRAIT_COLUMN_BY_DESIGN[column]}`,
      };
    }
    return {
      name: `entity_traits.${column}`,
      credit: 0,
      state: TRAIT_COLUMN_UNREACHED[column]
        ? `written, but ${TRAIT_COLUMN_UNREACHED[column]}`
        : 'never moves — nothing writes it',
    };
  });
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
      // **Scored as complete because NULL is the correct value**, and
      // getting this wrong is the exact mistake this file exists to
      // avoid. `entity_state.current_mood` is null on purpose: mood is
      // a band label over stress shifted by Optimism, so storing it
      // would break standing rule 3, and `behavior.js` says so at
      // length while `test/migrate.test.js` asserts it. The first
      // version of this axis counted it as a gap and would have scored
      // a correct decision as missing work — an accuracy failure in
      // the direction that looks like rigour.
      name: 'mood is derived rather than stored',
      credit: states.length > 0 && states.every((s) => s.current_mood == null) ? 1 : 0,
      state: states.length === 0
        ? 'no entity_state rows at all'
        : 'by design — a computable rollup, standing rule 3',
    },
    {
      name: 'stress spreads people out rather than pinning them',
      credit: (() => {
        const levels = states.map((s) => Number(s.stress_level)).filter(Number.isFinite);
        if (levels.length < 2) return 0;
        return new Set(levels.map((l) => Math.round(l / 10))).size > 2 ? 1 : 0;
      })(),
      state: `${new Set(states.map((s) => Math.round(Number(s.stress_level) / 10))).size} distinct bands`,
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
  CORRECTLY_EMPTY,
  TABLE_UNREACHED,
  TRAIT_COLUMN_BY_DESIGN,
  TRAIT_COLUMN_UNREACHED,
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
