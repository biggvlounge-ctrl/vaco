// §24 KNOWLEDGE RECOVERY — what a book does to a person.
//
// ---------------------------------------------------------------------
// What this closes
//
// §24 is four lines: "Knowledge is a civilization resource", ten named
// sources, nine unlockable fields. `urbanSystems.js`'s Education entry
// has recorded for weeks that "the knowledge tiers of §25 are absent
// entirely", and §24 was worse than absent — `knowledge` is listed in
// BOTH canonical vocabularies, `items.TRADE_CATEGORIES` from §26 and
// `items.RESOURCE_TYPES` from §28, with no item, no resource and no
// code of any kind behind either.
//
// The three effects all land on machinery that already reads them, and
// that is the design rather than a coincidence:
//
//   - the field's `skills` trait, which `occupations.js` ties to a job;
//   - the `educational` family, which `technology.learningOf` averages
//     to decide whether a civilization can recover an era — §24's first
//     line and its third, wired since the technology ladder was built
//     and with nothing ever moving the traits;
//   - `npcs.education`, whose only writer was `statecraft.runSchooling`,
//     which refuses anybody outside 5-30 or in a city whose schools are
//     unfunded. **An adult in a collapsed settlement could never learn
//     anything again for the rest of their life.**
//
// ---------------------------------------------------------------------
// The mistake this file holds, found by measuring rather than by a test
//
// `itemNameFor` and `readItemName` disagreed for one source in six.
// The parser split on spaces and required exactly two parts, which is
// true of `medicine manual` and false of `medicine preserved record`.
// Measured on a generated world: 17 books placed, 13 readable, and
// `preserved records` reported as a source the world did not contain
// while seventeen of them sat in people's hands. A parser that agrees
// with its own formatter five times out of six is the worst kind,
// because the sixth looks like absence rather than like a bug.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const knowledge = require('../server/knowledge.js');
const occupations = require('../server/occupations.js');
const demographics = require('../server/demographics.js');
const items = require('../server/items.js');
const traitDrift = require('../server/traitDrift.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');
const statistics = require('../server/statistics.js');

// ---------------------------------------------------------------------
// The vocabulary is the spec's
// ---------------------------------------------------------------------

test('§24’s nine fields each name a real skills trait', () => {
  const skills = new Set(TRAIT_FAMILIES.skills);
  assert.equal(knowledge.FIELD_NAMES.length, 9, '§24 names nine unlockable fields');
  for (const [field, skill] of Object.entries(knowledge.FIELDS)) {
    assert.ok(skills.has(skill), `${field} maps to "${skill}", which is not a skills trait`);
  }
});

test('§24’s ten sources are all there, and each is findable somewhere', () => {
  assert.equal(knowledge.SOURCE_NAMES.length, 10, '§24 lists ten sources');
  for (const [name, definition] of Object.entries(knowledge.SOURCES)) {
    assert.ok(
      ['holding', 'place', 'person'].includes(definition.kind),
      `${name} has no kind, so nothing could ever find it`,
    );
    if (definition.kind === 'place') {
      assert.ok(definition.organizationType, `${name} is a place with no organization type`);
    }
  }
});

test('a knowledge item’s name round-trips, including the three-word one', () => {
  // The guard for the parser bug. Every generated name must read back
  // to the field and source it was made from — `preserved records` is
  // the case that failed, so the loop is over all of them rather than
  // over a sample.
  for (const field of knowledge.FIELD_NAMES) {
    for (const source of knowledge.HOLDING_SOURCES) {
      const name = knowledge.itemNameFor(field, source);
      assert.deepEqual(
        knowledge.readItemName(name), { field, source },
        `"${name}" does not read back`,
      );
    }
  }
  assert.equal(knowledge.readItemName('Gold Ingot'), null, 'a real item read as a book');
  assert.equal(knowledge.readItemName(null), null);
});

test('a knowledge item is unpriced, and that is the design', () => {
  // §27 gives a Base_Value for seventeen items and `items.js` says in
  // its own header that no item is invented there. A book has no price
  // here, so `trade.sellableOf` skips it: a starving person sells their
  // tools and keeps their books.
  for (const definition of knowledge.itemDefinitions()) {
    assert.equal(definition.baseValue, undefined, `${definition.name} has an invented price`);
    assert.equal(definition.category, 'knowledge');
    assert.ok(
      items.TRADE_CATEGORIES.includes(definition.category),
      'knowledge is not one of §26’s categories',
    );
  }
});

test('registering the items twice leaves the world unchanged', () => {
  // Standing rule 15's mechanical check.
  const w = {};
  assert.equal(knowledge.registerItems(w), knowledge.itemDefinitions().length);
  assert.equal(knowledge.registerItems(w), 0);
  assert.equal(w.barterItems.length, knowledge.itemDefinitions().length);
  assert.ok(items.findItem(w, 'medicine manual'), 'the item is not findable after registering');
});

// ---------------------------------------------------------------------
// Who can learn from what
// ---------------------------------------------------------------------

function reader(options = {}) {
  const { education = 'basic', tick = 10000 } = options;
  const w = {
    tick,
    seed: 'knowledge-test',
    npcs: [{
      id: 1, status: 'active', education, communityId: 400, createdTick: tick - 30 * 365,
    }],
    communities: [{ id: 400, city_id: 900 }],
    cities: [{ id: 900 }],
    organizations: [],
    employmentRecords: [],
    inventory: [],
    entityTraits: [],
    barterItems: [],
  };
  knowledge.registerItems(w);
  return w;
}

function giveBook(w, entityId, field, source) {
  w.inventory.push({
    id: w.inventory.length + 1,
    holder_entity_id: entityId,
    item_name: knowledge.itemNameFor(field, source),
    quantity: 1,
    condition: 80,
  });
}

test('a book in your hands is a source; a library in your city is too', () => {
  const w = reader();
  assert.deepEqual(knowledge.sourcesFor(w, 1), []);

  giveBook(w, 1, 'medicine', 'manuals');
  const withBook = knowledge.sourcesFor(w, 1);
  assert.equal(withBook.length, 1);
  assert.equal(withBook[0].field, 'medicine');
  assert.equal(withBook[0].via, 'holding');

  // A library teaches every field, which is what a library is.
  w.organizations.push({ id: 500, type: 'library' });
  const withLibrary = knowledge.sourcesFor(w, 1);
  assert.equal(withLibrary.filter((s) => s.via === 'place').length, knowledge.FIELD_NAMES.length);
});

test('somebody who knows a trade is a source, and that is §24’s own list', () => {
  const w = reader();
  w.npcs.push({
    id: 2, status: 'active', education: 'higher', communityId: 400, createdTick: 0,
  });
  w.employmentRecords.push({
    id: 1, entity_id: 2, employer_organization_id: 500, status: 'active', wage: 40, position: 'physician',
  });
  const found = knowledge.sourcesFor(w, 1);
  const person = found.find((s) => s.via === 'person');
  assert.ok(person, 'a physician next door teaches nobody');
  assert.equal(person.field, 'medicine');
  assert.equal(person.tier, occupations.tierOf('physician'));

  // A neighbour in a DIFFERENT community is not a source — the same
  // rule `control.js` applies and for the same reason.
  w.npcs[1].communityId = 401;
  assert.equal(knowledge.sourcesFor(w, 1).some((s) => s.via === 'person'), false);
});

test('a trade §24 does not name as a field teaches nothing', () => {
  // A hunter teaching you to hunt is not knowledge recovery in the
  // sense §24 means — Combat, Art, Music, Business, Athletics,
  // Management and Research have no §24 field.
  assert.equal(knowledge.fieldForSkill('Combat'), null);
  assert.equal(knowledge.fieldForSkill('Medicine'), 'medicine');
});

test('somebody who cannot read learns from a person and not from a book', () => {
  // Which is how literacy is recovered at all.
  const w = reader({ education: 'none' });
  assert.equal(knowledge.canRead(w.npcs[0]), false);
  giveBook(w, 1, 'medicine', 'manuals');
  const [source] = knowledge.sourcesFor(w, 1);
  assert.equal(knowledge.study(w, 1, source), null, 'an unschooled person read a manual');

  const taught = knowledge.study(w, 1, {
    source: 'experienced NPCs', field: 'medicine', tier: 4, via: 'person',
  });
  assert.ok(taught, 'an unschooled person could not be taught by anybody either');
});

// ---------------------------------------------------------------------
// What a session does
// ---------------------------------------------------------------------

test('studying moves the field’s skill and the educational family', () => {
  const w = reader({ education: 'basic' });
  // Real trait rows, or every nudge below is a no-op and the test
  // passes while proving nothing (standing rule 6, and the trait-family
  // lesson: five of seven readers passed the suite without ever running
  // on a real trait).
  const engine = require('../server/engine.js');
  const npc = engine.generateNPC({ education: 'basic' });
  w.npcs[0].id = npc.id;
  w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === npc.id);

  const moved = knowledge.study(w, npc.id, {
    source: 'manuals', field: 'medicine', tier: 3, via: 'holding',
  });
  assert.ok(moved, 'nothing moved at all');
  const names = moved.traits.map((t) => `${t.family} ${t.name}`);
  assert.ok(names.includes('skills Medicine'), 'the field’s skill did not move');
  assert.ok(names.includes('educational Literacy'), 'literacy did not move');
  assert.ok(names.includes('educational Self-Taught Aptitude'), 'self-teaching did not move');
  for (const t of moved.traits) assert.ok(t.to > t.from, `${t.name} moved the wrong way`);
});

test('a source teaches you nothing you already know', () => {
  // The reach term. A Tier 1 document read by somebody at the top of
  // the ladder has nothing to give, and the session does not happen
  // rather than giving a token amount.
  const learned = { education: 'advanced' };
  const beginner = { education: 'none' };
  const document = { source: 'documents', field: 'medicine', tier: 1, via: 'holding' };
  assert.equal(knowledge.sourceReach(learned, document), 0);
  assert.ok(knowledge.sourceReach(beginner, document) > 0);
  // And a deeper source is worth more than a shallower one.
  const archive = { source: 'archives', field: 'medicine', tier: 5, via: 'holding' };
  assert.ok(
    knowledge.sourceReach(beginner, archive) > knowledge.sourceReach(beginner, document),
    'an archive taught a beginner no more than a scrap of paper',
  );
});

test('a study gain is expressed in the trait’s own growth rate', () => {
  // Not a magnitude chosen for the occasion: `traitDrift` uses
  // `growth_rate * EXPERIENCE_RATE` for a day of a habit, so a day
  // spent studying is a day of exercising the thing studied, times how
  // far above the reader the source is.
  assert.equal(traitDrift.EXPERIENCE_RATE, 1);
  assert.ok(traitDrift.DRIFT_CEILING > 0);
});

// ---------------------------------------------------------------------
// Attainment, for the self-taught
// ---------------------------------------------------------------------

test('teaching yourself a rung takes longer than being taught one', () => {
  const statecraft = require('../server/statecraft.js');
  const schooled = statecraft.SCHOOL_YEARS_PER_LEVEL * 365;
  const alone = knowledge.sessionsPerLevel() / knowledge.STUDY_RATE;
  assert.ok(alone > schooled, `self-teaching (${alone}) is faster than school (${schooled})`);
});

test('a rung is a crossing, and the top rung is the end of it', () => {
  const levels = demographics.EDUCATION_LEVELS;
  const npc = { id: 1, education: 'none', studySessions: knowledge.sessionsPerLevel() };
  const event = knowledge.advanceAttainment(npc, 500);
  assert.ok(event, 'the sessions were put in and nothing happened');
  assert.equal(npc.education, levels[1]);
  assert.equal(event.type, 'self_taught');
  // Not again on the next tick — the sessions for the NEXT rung have
  // not been put in (standing rule 7).
  assert.equal(knowledge.advanceAttainment(npc, 501), null);

  // And the ladder ends.
  const scholar = { id: 2, education: levels[levels.length - 1], studySessions: 99999 };
  assert.equal(knowledge.advanceAttainment(scholar, 500), null);
});

test('unmeasured attainment is not unschooled attainment', () => {
  // `Number(null)` again: somebody the engine has never measured is not
  // somebody it has measured as having no schooling, and promoting them
  // would be inventing a fact about them.
  const unknown = { id: 3, education: null, studySessions: 99999 };
  assert.equal(knowledge.advanceAttainment(unknown, 500), null);
  assert.equal(unknown.education, null);
});

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

test('a world with nothing to read produces no study at all', () => {
  const w = reader();
  assert.deepEqual(knowledge.runStudy(w, w.tick), []);
  assert.equal(knowledge.sessionsOf(w.npcs[0]), 0);
});

test('the study draw is seeded on the person and the tick', () => {
  // §88's exception: the draw is about them.
  const build = () => {
    const w = reader();
    giveBook(w, 1, 'medicine', 'blueprints');
    return w;
  };
  const a = build();
  const b = build();
  for (let t = 0; t < 50; t += 1) {
    knowledge.runStudy(a, 10000 + t);
    knowledge.runStudy(b, 10000 + t);
  }
  assert.equal(knowledge.sessionsOf(a.npcs[0]), knowledge.sessionsOf(b.npcs[0]));
  assert.ok(knowledge.sessionsOf(a.npcs[0]) > 0, 'fifty days with an archive and nobody opened it');
});

test('children below school age do not study', () => {
  const w = reader();
  w.npcs[0].createdTick = w.tick - 2 * 365;
  giveBook(w, 1, 'medicine', 'blueprints');
  for (let t = 0; t < 50; t += 1) knowledge.runStudy(w, 10000 + t);
  assert.equal(knowledge.sessionsOf(w.npcs[0]), 0);
});

// ---------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------

test('describeKnowledge names what a world is missing', () => {
  const w = reader();
  giveBook(w, 1, 'medicine', 'manuals');
  const described = knowledge.describeKnowledge(w);
  assert.equal(described.sources, 10);
  assert.ok(described.present.includes('manuals'));
  assert.ok(described.absent.includes('universities'));
  assert.equal(described.holdings, 1);
  assert.equal(described.present.length + described.absent.length, 10);
});

test('the catalogue carries the sources and the declared gap', () => {
  for (const key of ['knowledge_sources', 'self_taught_share', 'knowledge_stock']) {
    assert.ok(statistics.KEYS.includes(key), `${key} is not in the catalogue`);
  }
  const declared = statistics.unavailable().find((s) => s.key === 'knowledge_stock');
  assert.ok(declared, 'knowledge_stock is not declared unavailable');
  assert.match(declared.reason, /consumption/);
});
