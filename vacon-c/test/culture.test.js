// VACANCY — Culture DNA.
//
// The rule this suite defends is the one the trait attachment states
// outright: **tier-level, not individual — "individuals *belong to* a
// culture, they don't each carry their own."** A Culture DNA system
// that let an NPC hold a culture would be the same system with its
// central claim removed, so that refusal is tested directly.
//
// The second thing held down here is the three-way split of the
// sixteen named families. Flattening them into sixteen 0-100 scores
// would produce a number for `cuisine`, which means nothing. The split
// follows the precedent familyTraits.js already set for `traditions`:
// a dimension earns a scored trait row only if it is genuinely scored.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const culture = require('../server/culture.js');
const engine = require('../server/engine.js');

function freshWorld() {
  return {
    cultures: [], cultureMemberships: [], communities: [], nextEntityId: 1,
  };
}

// ---------------------------------------------------------------------------
// The sixteen, and how they are stored
// ---------------------------------------------------------------------------

test('all sixteen named families from the attachment are recorded', () => {
  const named = [
    'trustLevel', 'tradition', 'innovation', 'competition', 'cooperation',
    'communicationStyle', 'leadershipStyle', 'conflictResolution', 'education',
    'art', 'religion', 'values', 'customs', 'language', 'cuisine', 'fashion',
  ];
  assert.deepEqual(culture.CULTURE_TRAIT_FAMILIES, named);
});

test('the sixteen split three ways, and every one is accounted for exactly once', () => {
  const scored = culture.CULTURE_SCORED_FAMILIES;
  const styles = Object.keys(culture.CULTURE_STYLES);
  const descriptive = culture.CULTURE_DESCRIPTIVE;

  const all = [...scored, ...styles, ...descriptive].sort();
  assert.deepEqual(all, [...culture.CULTURE_TRAIT_FAMILIES].sort(),
    'no family is dropped, duplicated, or invented');
  assert.equal(scored.length, 8);
  assert.equal(styles.length, 3);
  assert.equal(descriptive.length, 5);
});

test('a culture needs a name, because a culture is referenced by name', () => {
  const world = freshWorld();
  assert.throws(() => culture.generateCulture(world, {}), /name/);
  assert.equal(world.cultures.length, 0);
});

test('scored dimensions default to 50 — the schema default, not a number chosen here', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, { name: 'Riverside' });

  for (const family of culture.CULTURE_SCORED_FAMILIES) {
    assert.equal(c.traits[family], 50, `${family} should default to 50`);
  }
});

test('scored dimensions clamp to 0-100', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, {
    name: 'Extreme', traits: { trustLevel: 250, tradition: -80 },
  });
  assert.equal(c.traits.trustLevel, 100);
  assert.equal(c.traits.tradition, 0);
});

test('a style must be one of its named set, not a number and not anything', () => {
  const world = freshWorld();
  assert.throws(() => culture.generateCulture(world, {
    name: 'Bad', leadershipStyle: 'excellent',
  }), /is not a leadershipStyle/);

  const c = culture.generateCulture(world, {
    name: 'Council', leadershipStyle: 'consensus', communicationStyle: 'indirect',
  });
  assert.equal(c.leadershipStyle, 'consensus');
  assert.equal(c.communicationStyle, 'indirect');
  assert.equal(c.conflictResolution, null, 'an unstated style is null, not invented');
});

test('descriptive dimensions are lists and start empty rather than fabricated', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, { name: 'Quiet', cuisine: ['river fish', 'flatbread'] });

  assert.deepEqual(c.cuisine, ['river fish', 'flatbread']);
  assert.deepEqual(c.customs, [], 'a culture nobody has written customs for has none recorded');
  assert.deepEqual(c.language, []);
  assert.equal(c.traits.cuisine, undefined, 'cuisine is not a score and gets no trait row');
});

// The property.js id lesson, applied before it can bite.
test('a culture takes an id from the shared entity counter as well as its own', () => {
  const world = freshWorld();
  world.nextEntityId = 60;
  const a = culture.generateCulture(world, { name: 'A' });
  const b = culture.generateCulture(world, { name: 'B' });

  assert.equal(a.entity_id, 60);
  assert.equal(b.entity_id, 61);
  assert.notEqual(a.id, b.id);
});

// ---------------------------------------------------------------------------
// Tier-level, not individual — the rule the system exists for
// ---------------------------------------------------------------------------

test('an individual cannot carry a culture', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, { name: 'Riverside' });

  assert.throws(
    () => culture.attachCulture(world, { cultureId: c.id, tier: 'individual', entityId: 1 }),
    /not a tier a culture attaches to/,
  );
  assert.throws(
    () => culture.attachCulture(world, { cultureId: c.id, tier: 'npc', entityId: 1 }),
    /not a tier/,
  );
  assert.equal(world.cultureMemberships.length, 0);
});

test('the five tiers the attachment names all work', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, { name: 'Riverside' });

  let id = 100;
  for (const tier of culture.CULTURE_TIERS) {
    id += 1;
    const attached = culture.attachCulture(world, { cultureId: c.id, tier, entityId: id });
    assert.equal(attached.tier, tier);
  }
  assert.equal(world.cultureMemberships.length, 5);
});

test('attaching requires a culture that exists', () => {
  const world = freshWorld();
  assert.throws(
    () => culture.attachCulture(world, { cultureId: 999, tier: 'community', entityId: 1 }),
    /no culture with id 999/,
  );
});

test('re-attaching moves an entity between cultures rather than duplicating it', () => {
  const world = freshWorld();
  const a = culture.generateCulture(world, { name: 'Riverside' });
  const b = culture.generateCulture(world, { name: 'Hill' });

  culture.attachCulture(world, { cultureId: a.id, tier: 'community', entityId: 7 });
  culture.attachCulture(world, { cultureId: b.id, tier: 'community', entityId: 7 });

  assert.equal(world.cultureMemberships.length, 1, 'an entity belongs to one culture at a tier');
  assert.equal(culture.getCultureFor(world, 7).culture.name, 'Hill');
});

// The schema's own TEXT column has to stay truthful, or a plain SELECT
// on communities reads the wrong culture forever.
test('attaching a community writes the culture name into communities.culture', () => {
  const world = freshWorld();
  world.communities.push({ id: 7, culture: null });
  const c = culture.generateCulture(world, { name: 'Riverside' });

  culture.attachCulture(world, { cultureId: c.id, tier: 'community', entityId: 7 });

  assert.equal(world.communities[0].culture, 'Riverside');
});

test('moving a community to another culture updates the column too', () => {
  const world = freshWorld();
  world.communities.push({ id: 7, culture: null });
  const a = culture.generateCulture(world, { name: 'Riverside' });
  const b = culture.generateCulture(world, { name: 'Hill' });

  culture.attachCulture(world, { cultureId: a.id, tier: 'community', entityId: 7 });
  culture.attachCulture(world, { cultureId: b.id, tier: 'community', entityId: 7 });

  assert.equal(world.communities[0].culture, 'Hill', 'the column must not go stale');
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

test('the map\'s own route shape: a culture sheet from a tier entity id', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, {
    name: 'Riverside', traits: { tradition: 80, innovation: 20 },
  });
  culture.attachCulture(world, { cultureId: c.id, tier: 'family', entityId: 42 });

  const found = culture.getCultureFor(world, 42);
  assert.equal(found.entityId, 42);
  assert.equal(found.tier, 'family');
  assert.equal(found.culture.traits.tradition, 80);
});

test('an entity with no culture returns null rather than an empty sheet', () => {
  const world = freshWorld();
  culture.generateCulture(world, { name: 'Riverside' });
  assert.equal(culture.getCultureFor(world, 999), null);
});

test('members are listed by tier', () => {
  const world = freshWorld();
  const c = culture.generateCulture(world, { name: 'Riverside' });
  culture.attachCulture(world, { cultureId: c.id, tier: 'community', entityId: 1 });
  culture.attachCulture(world, { cultureId: c.id, tier: 'community', entityId: 2 });
  culture.attachCulture(world, { cultureId: c.id, tier: 'city', entityId: 3 });

  const members = culture.getCultureMembers(world, c.id);
  assert.equal(members.total, 3);
  assert.deepEqual(members.byTier.community, [1, 2]);
  assert.deepEqual(members.byTier.city, [3]);
  assert.equal(members.byTier.family, undefined, 'tiers with nobody in them are absent, not empty');
});

// ---------------------------------------------------------------------------
// Bound to the engine
// ---------------------------------------------------------------------------

test('the engine exposes culture bound to its own WorldState', () => {
  const before = engine.WorldState.cultures.length;
  const c = engine.generateCulture({ name: 'Engine Test', traits: { art: 70 } });

  assert.equal(engine.WorldState.cultures.length, before + 1);
  assert.equal(engine.getCulture(c.id).traits.art, 70);
  assert.ok(engine.listCultures().some((x) => x.id === c.id));

  const family = engine.generateFamily({ surname: 'Bound' });
  engine.attachCulture({ cultureId: c.id, tier: 'family', entityId: family.id });
  assert.equal(engine.getCultureFor(family.id).culture.id, c.id);
});

// Culture education feeds the Education Flow, so the two systems have
// to actually meet — a signal reading a field nothing writes is the
// "starved, not unwired" failure again.
test('culture education is readable by the flow that depends on it', () => {
  engine.WorldState.cultures.length = 0;
  engine.generateCulture({ name: 'Unlettered', traits: { education: 10 } });

  const educationFlow = engine.describeFlows().find((f) => f.id === 'education-flow');
  assert.equal(educationFlow.readable, true, 'the signal has something to read');
  assert.equal(educationFlow.value, 10);
  assert.equal(educationFlow.firing, true);

  engine.WorldState.cultures.length = 0;
});
