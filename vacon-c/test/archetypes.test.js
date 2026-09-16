// What a person's traits add up to, and what they happen to like.
//
// Two tables empty in every world, and the source package is unusually
// specific about both — including about the thing that would have been
// easiest to get wrong.
//
// **Archetypes are a read.** The trait document says so twice: "derived,
// not source data ... never stored independently", and "they are a read,
// not a write". So `tagsFor` computes them live and the table is a
// HISTORY of when somebody became something, written on a crossing.
// Storing the tag every tick would duplicate a computable rollup
// (standing rule 3) and bury the tick it happened on under a hundred
// identical rows — exactly the failure `behavior.js` had with habits.
//
// One defect in this file's own checking, worth recording because it is
// a trap anybody writing a predicate table falls into: the first version
// of `citedTraits` called each predicate with a probe that returned a
// neutral 50 and recorded every lookup. `&&` short-circuits, so for
// `t(a) >= 70 && t(b) >= 70` the probe failed at `a` and `b` was never
// evaluated. It reported 23 citations for 23 tags that read 44 traits,
// and would have passed an invented trait name in any second position —
// producing a tag nobody could ever earn, silently, forever.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const archetypes = require('../server/archetypes.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

const TRAIT_DOC = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_TRAIT_DATABASE_ATTACHMENT.md'), 'utf8',
);
const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_POSTGRESQL_SCHEMA.sql'), 'utf8',
);

let nextId = 500000;

function world(extra = {}) {
  const w = {
    tick: 10,
    npcs: [], organizations: [], families: [], entityTraits: [],
    preferences: [], archetypes: [],
    ...extra,
  };
  archetypes.reseedIds(w);
  return w;
}

// A person whose traits are all `value` except the named overrides, so
// a tag's threshold can be crossed deliberately rather than hoped for —
// the eighth standing rule.
function person(w, value = 50, overrides = {}) {
  const id = nextId += 1;
  w.entityTraits.push(...generateEntityTraits(
    id, w.tick, INDIVIDUAL_DEFINITIONS,
    (def) => overrides[`${def.family}.${def.name}`] ?? value,
  ));
  w.npcs.push({ id, status: 'active', traits: {}, createdTick: 0 });
  return id;
}

// -- the vocabularies are the document's --------------------------------

test('every archetype name is one the trait document lists', () => {
  for (const archetype of archetypes.INDIVIDUAL_ARCHETYPES) {
    assert.ok(TRAIT_DOC.includes(archetype.name),
      `"${archetype.name}" is not in VACANCY_TRAIT_DATABASE_ATTACHMENT.md's own list`);
  }
  assert.equal(archetypes.INDIVIDUAL_ARCHETYPES.length, 23);

  // And no duplicates, which would give somebody the same tag twice.
  const names = archetypes.INDIVIDUAL_ARCHETYPES.map((a) => a.name);
  assert.equal(new Set(names).size, names.length);
});

test('every preference category is the schema\'s own', () => {
  for (const category of archetypes.PREFERENCE_CATEGORIES) {
    assert.ok(SCHEMA.includes(category), `preferences has no "${category}" in its enumeration`);
    assert.ok(TRAIT_DOC.includes(category), `the trait document has no "${category}"`);
  }
  assert.equal(archetypes.PREFERENCE_CATEGORIES.length, 6);
  for (const category of archetypes.PREFERENCE_CATEGORIES) {
    assert.ok((archetypes.PREFERENCE_OPTIONS[category] || []).length > 1,
      `${category} has nothing to choose between`);
  }
});

test('every trait an archetype reads actually exists', () => {
  // **The check the short-circuit bug defeated.** Read out of the
  // predicate source rather than by calling it, so every citation is
  // seen regardless of which branch a particular input reaches.
  const cited = archetypes.citedTraits();
  assert.ok(cited.length > archetypes.INDIVIDUAL_ARCHETYPES.length,
    `only ${cited.length} citations for ${archetypes.INDIVIDUAL_ARCHETYPES.length} tags — `
    + 'the scan is missing the second half of every `&&`');

  const bad = cited.filter(([family, name]) => !(TRAIT_FAMILIES[family] || []).includes(name));
  assert.deepEqual(bad, [],
    `invented trait citations: ${bad.map((b) => b.join('.')).join(', ')}`);
});

test('every archetype is reachable by somebody', () => {
  // A tag whose thresholds cannot all be met at once is a name in a
  // list, not a thing anybody can be.
  for (const archetype of archetypes.INDIVIDUAL_ARCHETYPES) {
    const overrides = {};
    for (const [family, name] of archetypes.citedTraits()) {
      overrides[`${family}.${name}`] = 50;
    }
    const w = world();
    // Set every trait this tag reads to whichever extreme satisfies it.
    const high = {};
    const source = archetype.when.toString();
    for (const m of source.matchAll(/t\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)\s*(>=|<=)\s*(HIGH|LOW)/g)) {
      high[`${m[1]}.${m[2]}`] = m[3] === '>=' ? 95 : 5;
    }
    const id = person(w, 50, high);
    const tags = archetypes.tagsFor(w, id).map((t) => t.name);
    assert.ok(tags.includes(archetype.name),
      `"${archetype.name}" cannot be earned by anybody — its thresholds never line up`);
  }
});

// -- archetypes are derived ----------------------------------------------

test('a tag is computed from traits, with the values that produced it', () => {
  const w = world();
  const id = person(w, 50, {
    'behavioral.Discipline': 90, 'behavioral.Recklessness': 10,
  });
  const tags = archetypes.tagsFor(w, id);
  const disciplined = tags.find((t) => t.name === 'Disciplined');

  assert.ok(disciplined, 'a disciplined person is not Disciplined');
  assert.deepEqual(disciplined.derivedFrom, [
    { family: 'behavioral', name: 'Discipline', value: 90 },
    { family: 'behavioral', name: 'Recklessness', value: 10 },
  ]);
});

test('an ordinary person is not everything at once', () => {
  const w = world();
  const id = person(w, 50);
  const tags = archetypes.tagsFor(w, id);
  assert.equal(tags.length, 0,
    `somebody at 50 across the board earned ${tags.map((t) => t.name).join(', ')}`);
});

test('nobody with no traits gets a tag rather than an empty list', () => {
  // Unknown is not "no archetypes" — the difference matters to a caller
  // deciding whether to show anything at all.
  const w = world();
  assert.equal(archetypes.tagsFor(w, 999999), null);
  assert.equal(archetypes.describeArchetypes(w, 999999), null);
});

// -- the table is a history ---------------------------------------------

test('a tag is recorded once, on the tick it appeared', () => {
  // **Standing rule 7.** A version that wrote on a condition would give
  // somebody Disciplined for a year 365 identical rows and bury the one
  // tick it actually happened on.
  const w = world();
  const id = person(w, 50, {
    'behavioral.Discipline': 90, 'behavioral.Recklessness': 10,
  });

  assert.equal(archetypes.syncArchetypes(w, id, 5).length, 1);
  for (let t = 6; t < 100; t += 1) archetypes.syncArchetypes(w, id, t);

  const rows = archetypes.archetypesOf(w, id);
  assert.equal(rows.length, 1, `${rows.length} rows for one unchanging tag`);
  assert.equal(rows[0].tick, 5, 'the row does not name the tick it happened on');
  assert.equal(rows[0].archetype_name, 'Disciplined');
});

test('the history keeps what somebody stopped being', () => {
  // `archetypes` has no status column and a row is a record of a moment
  // that really happened. `tagsFor` is the live answer; the table is the
  // history of it, and deleting from a history is how you lose it.
  const w = world();
  const id = person(w, 50, {
    'behavioral.Discipline': 90, 'behavioral.Recklessness': 10,
  });
  archetypes.syncArchetypes(w, id, 5);

  // They let themselves go.
  for (const row of w.entityTraits) {
    if (row.entity_id !== id) continue;
    row.current_value = 50;
  }

  archetypes.syncArchetypes(w, id, 50);
  assert.equal(archetypes.archetypesOf(w, id).length, 1, 'the record of the moment was erased');
  assert.deepEqual(archetypes.tagsFor(w, id), [], 'they are still Disciplined');

  const described = archetypes.describeArchetypes(w, id);
  assert.deepEqual(described.is, [], 'what they ARE is computed');
  assert.equal(described.since.length, 1, 'what they BECAME is remembered');
});

// -- preferences ---------------------------------------------------------

test('a preference cannot be drawn from chance or defaulted', () => {
  // Both would be silent: Math.random breaks §88 determinism, and a
  // default gives every person in the world identical taste in the one
  // table whose entire purpose is that people differ.
  const w = world();
  const id = person(w);
  assert.throws(() => archetypes.generatePreferences(w, id, {}), /requires options\.chooseFor/);
});

test('one row per category, and setting it again replaces rather than duplicates', () => {
  const w = world();
  const id = person(w);
  archetypes.generatePreferences(w, id, { chooseFor: (c, choices) => choices[0] });
  assert.equal(archetypes.preferencesOf(w, id).length, 6);

  archetypes.setPreference(w, { entityId: id, category: 'music', value: 'choral', tick: 9 });
  assert.equal(archetypes.preferencesOf(w, id).length, 6);
  assert.equal(archetypes.preferenceOf(w, id, 'music').value, 'choral');
  assert.equal(archetypes.preferenceOf(w, id, 'music').tick, 9);
});

test('a preference needs an entity and a real category', () => {
  const w = world();
  assert.throws(() => archetypes.setPreference(w, { category: 'music' }), /requires an entityId/);
  assert.throws(() => archetypes.setPreference(w, { entityId: 1, category: 'weather' }),
    /is not a category/);
});

// -- the real pipeline ---------------------------------------------------

test('a running world gives people tags and taste', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 15, seed: 'arch' });
  assert.ok(w.preferences.length > 0, 'a generated world has nobody with any taste');

  for (let t = 0; t < 60; t += 1) engine.advanceTick();

  assert.ok(w.archetypes.length > 0, 'a world ran for 60 ticks and nobody became anything');
  const distinct = new Set(w.archetypes.map((a) => a.archetype_name));
  assert.ok(distinct.size > 3,
    `only ${distinct.size} distinct tags in the whole world — the thresholds are too narrow`);

  // Every stored row carries the provenance the column exists for.
  for (const row of w.archetypes) {
    assert.ok(Array.isArray(row.derived_from_traits) && row.derived_from_traits.length > 0,
      `archetype ${row.id} records no trait that produced it`);
    assert.ok(Number.isFinite(row.tick));
  }

  // And not everybody is everything: a world where half the population
  // carries every tag would mean the thresholds say nothing.
  const perPerson = w.archetypes.length / w.npcs.length;
  assert.ok(perPerson < archetypes.INDIVIDUAL_ARCHETYPES.length / 2,
    `${perPerson.toFixed(1)} tags per person — the thresholds are not discriminating`);
});

test('ids survive a reseed', () => {
  const w = world();
  w.archetypes.push({ id: 12, entity_id: 1, archetype_name: 'Creative', tick: 1 });
  assert.deepEqual(archetypes.reseedIds(w), { nextArchetypeId: 13 });
});
