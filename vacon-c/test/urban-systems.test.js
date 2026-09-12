// The 40 urban systems (§7) — every citation checked against the thing
// that defines it.
//
// **Why a data file needs a test this strict.** `urbanSystems.js`
// replaced the phrase "roughly 25 of the 40" in the implementation map.
// A more precise-looking guess is worse than an admitted one, so
// nothing in that file is allowed to cite something that does not
// exist: a table must be in `VACANCY_POSTGRESQL_SCHEMA.sql`, a phase
// must be in `tick.js`, a trait family must be in `traits.js`, a
// function must be defined under `server/`, and an
// `infrastructure.type` value must appear in that column's own
// enumeration.
//
// The inverse matters just as much: a system marked `absent` must cite
// NOTHING, so "absent" cannot be a lazy label on something that is
// actually there. Prison was checked that way — `imprisoned` appears
// nowhere, despite §17 listing it as an NPC status.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SYSTEMS, LEVELS, summarise, byLevel, getSystem, citations,
} = require('../server/urbanSystems.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_POSTGRESQL_SCHEMA.sql'), 'utf8',
);
const TICK = fs.readFileSync(path.join(SERVER_DIR, 'tick.js'), 'utf8');

// Every `function name(` defined anywhere under server/, so a cited
// function is checked against the whole engine rather than one file.
const ALL_FUNCTIONS = (() => {
  const names = new Set();
  for (const file of fs.readdirSync(SERVER_DIR).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(SERVER_DIR, file), 'utf8');
    for (const m of source.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\s*\(/gm)) {
      names.add(m[1]);
    }
  }
  return names;
})();

// -- the list itself ----------------------------------------------------

test('there are exactly 40 systems, numbered 1 to 40 in order', () => {
  // §7 is a numbered list of forty. A 39th or 41st entry means the
  // spec was transcribed wrong, and every count below would be off.
  assert.equal(SYSTEMS.length, 40);
  assert.deepEqual(SYSTEMS.map((s) => s.n), Array.from({ length: 40 }, (_, i) => i + 1));

  const names = SYSTEMS.map((s) => s.name);
  assert.equal(new Set(names).size, 40, 'two systems share a name');
  for (const s of SYSTEMS) {
    assert.ok(LEVELS.includes(s.level), `system ${s.n} has level "${s.level}"`);
  }
});

test('the spec order is preserved, spot-checked at both ends and the middle', () => {
  // Against §7 as written. Chosen at the boundaries and either side of
  // the midpoint, because an off-by-one in transcription shows up
  // there first.
  assert.equal(getSystem(1).name, 'Population');
  assert.equal(getSystem(20).name, 'Government Services');
  assert.equal(getSystem(21).name, 'Fire & Emergency');
  assert.equal(getSystem(40).name, 'AI Decision');
});

// -- no fictional citations --------------------------------------------

test('every table a system cites exists in the schema', () => {
  const cited = citations().tables;
  assert.ok(cited.length > 20, `only ${cited.length} tables cited; the file looks empty`);
  const missing = cited.filter(
    (t) => !new RegExp(`^CREATE TABLE (IF NOT EXISTS )?${t}\\b`, 'm').test(SCHEMA),
  );
  assert.deepEqual(missing, [], `cited tables that do not exist: ${missing.join(', ')}`);
});

test('every tick phase a system cites exists in tick.js', () => {
  const missing = citations().phases.filter(
    (p) => !new RegExp(`^function ${p}\\s*\\(`, 'm').test(TICK),
  );
  assert.deepEqual(missing, [], `cited phases that do not exist: ${missing.join(', ')}`);
});

test('every trait family a system cites exists in traits.js', () => {
  const missing = citations().traitFamilies.filter((f) => !(f in TRAIT_FAMILIES));
  assert.deepEqual(missing, [], `cited trait families that do not exist: ${missing.join(', ')}`);
});

test('every function a system cites is defined under server/', () => {
  const missing = citations().functions.filter((f) => !ALL_FUNCTIONS.has(f));
  assert.deepEqual(missing, [], `cited functions that do not exist: ${missing.join(', ')}`);
});

test('every infrastructure type a system cites appears in that column\'s enumeration', () => {
  // **This is the citation most likely to be wrong**, because the
  // enumeration is a comment on a TEXT column rather than a CHECK
  // constraint or an enum type — nothing in the database enforces it,
  // so nothing but this test would catch an invented value.
  const line = SCHEMA.split('\n').find((l) => /^\s*type\s+TEXT NOT NULL, -- roads/.test(l));
  assert.ok(line, 'infrastructure.type no longer carries its enumeration comment');
  const allowed = line.split('--')[1].trim().split('|').map((v) => v.trim());
  assert.ok(allowed.length >= 10, `parsed only ${allowed.length} infrastructure types`);

  const missing = citations().infrastructureTypes.filter((t) => !allowed.includes(t));
  assert.deepEqual(missing, [],
    `cited infrastructure types that are not in the column's own list: ${missing.join(', ')}`);
});

// -- and the inverse ---------------------------------------------------

test('an absent system cites nothing, and everything else cites something', () => {
  // Both directions, because each protects against a different lie.
  // A citation on an `absent` system means the label is wrong. No
  // citation on a `modelled` one means the label is unsupported.
  for (const s of SYSTEMS) {
    const evidence = [
      ...(s.tables || []), ...(s.phases || []), ...(s.traitFamilies || []),
      ...(s.functions || []), ...(s.infrastructureTypes || []),
    ];
    if (s.level === 'absent') {
      assert.deepEqual(evidence, [],
        `${s.n} ${s.name} is marked absent but cites ${evidence.join(', ')}`);
    } else {
      assert.ok(evidence.length > 0,
        `${s.n} ${s.name} is marked ${s.level} with nothing to show for it`);
    }
  }
});

test('a slot-level system cites an infrastructure type and no mechanics', () => {
  // `slot` means "a place to put data, and nothing reads it". If a
  // slot system ever gains a phase or a function it is no longer a
  // slot, and this fails rather than letting the level go stale.
  for (const s of byLevel('slot')) {
    assert.ok((s.infrastructureTypes || []).length > 0,
      `${s.name} is a slot with no infrastructure type`);
    assert.deepEqual([...(s.phases || []), ...(s.functions || [])], [],
      `${s.name} is marked slot but cites mechanics — it has outgrown the level`);
  }
});

test('Prison stays absent while nothing incarcerates anybody', () => {
  // The one absent system with a specific, checkable reason: §17 lists
  // `imprisoned` as an NPC status, so this is a named gap rather than
  // an unmentioned one. If the string ever appears, the level is wrong.
  assert.equal(getSystem(18).name, 'Prison');
  assert.equal(getSystem(18).level, 'absent');

  // **`urbanSystems.js` is excluded, and it has to be.** That file
  // says "nothing incarcerates anybody" in system 18's own note, so
  // including it made this test fail on its own documentation — a
  // search that matches the thing describing the absence rather than
  // an implementation of it.
  const haystack = [SCHEMA, ...fs.readdirSync(SERVER_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'urbanSystems.js')
    .map((f) => fs.readFileSync(path.join(SERVER_DIR, f), 'utf8'))].join('\n');
  assert.equal(/imprison/i.test(haystack), false,
    'something now models imprisonment; system 18 is no longer absent');
});

// -- the number the map quotes -----------------------------------------

test('the summary is derived, and the implementation map is not stale', () => {
  const summary = summarise();
  assert.equal(summary.total, 40);
  assert.equal(
    summary.modelled + summary.partial + summary.slot + summary.absent, 40,
    'the levels do not add up to 40',
  );

  // **The map quotes these numbers, so the map is checked here.**
  // Otherwise §7 goes straight back to being a figure nothing
  // verifies, which is the exact problem this file was written for.
  const map = fs.readFileSync(
    path.join(__dirname, '..', '..', 'dev-docs', 'VACANCY_SPEC_IMPLEMENTATION_MAP.md'), 'utf8',
  );
  const quoted = map.match(
    /\*\*(\d+) modelled, (\d+) partial, (\d+) slot-only, (\d+) absent\*\*/,
  );
  assert.ok(quoted, 'the implementation map no longer quotes the §7 breakdown');
  assert.deepEqual(
    quoted.slice(1, 5).map(Number),
    [summary.modelled, summary.partial, summary.slot, summary.absent],
    'dev-docs/VACANCY_SPEC_IMPLEMENTATION_MAP.md quotes a stale §7 breakdown',
  );
});
