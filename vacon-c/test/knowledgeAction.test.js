// §24, the player-facing half — `study` as a real action verb.
//
// ---------------------------------------------------------------------
// What this closes
//
// `server/knowledge.js` has moved real traits (a field's skill,
// Literacy, Self-Taught Aptitude) since the pass that built it, and
// nothing let a player trigger it — `grep -n study server/actions.js`
// found nothing before this file. The mission state machine, the
// routine/habit verbs, meetings and contests all went through the same
// step already; this is knowledge's turn, following the exact shape
// `meetings.test.js`'s own "the player verb, and the measurement"
// section holds to: generate a real NPC, dispatch the real action,
// assert the real trait moved.
//
// **Validated against `knowledge.sourcesFor`, not trusted as a bare
// pair** — the same posture `generateMission` already holds for an
// artifact or a location. `studySource`'s own test below checks that a
// source this entity cannot actually reach is refused rather than
// silently attempted.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const knowledge = require('../server/knowledge.js');
const inventory = require('../server/inventory.js');
const actions = require('../server/actions.js');

test('the action list offers study', () => {
  assert.ok(actions.listActions('citizen').map((a) => a.action).includes('study'));
});

test('studying a real held book moves the field’s skill and the educational family', () => {
  const npc = engine.generateNPC({ education: 'basic' });
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  knowledge.registerItems(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: 'agriculture book' });

  const { result, actorEntityId } = engine.dispatchAction(player.id, {
    action: 'study', source: 'books', field: 'agriculture',
  });
  assert.equal(actorEntityId, npc.id, 'the dispatch says who studied');
  assert.equal(result.source, 'books');
  assert.equal(result.field, 'agriculture');

  const names = result.traits.map((t) => `${t.family} ${t.name}`);
  assert.ok(names.includes('skills Agriculture'), 'the field’s skill did not move');
  assert.ok(names.includes('educational Literacy'), 'literacy did not move');
  assert.ok(names.includes('educational Self-Taught Aptitude'), 'self-teaching did not move — this was read from a holding');
  for (const t of result.traits) assert.ok(t.to > t.from, `${t.name} moved the wrong way`);
});

test('a source the entity cannot actually reach is refused, not silently attempted', () => {
  // No university anywhere in this NPC's city, and nothing given to
  // carry — `sourcesFor` finds nothing, so the dispatch has to refuse
  // before ever calling `knowledge.study`.
  const npc = engine.generateNPC({ education: 'basic' });
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'study', source: 'universities', field: 'science',
    }),
    /no real way to study/,
  );
});

test('somebody who cannot read is refused a book, not handed a token gain', () => {
  const npc = engine.generateNPC({ education: 'none' });
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  knowledge.registerItems(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: 'medicine book' });

  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'study', source: 'books', field: 'medicine',
    }),
    /could not learn anything/,
  );
});

test('studySourcesFor answers the same real candidates study would validate against', () => {
  const npc = engine.generateNPC({ education: 'basic' });
  knowledge.registerItems(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: 'engineering manual' });

  const sources = engine.studySourcesFor(npc.id);
  assert.ok(
    sources.some((s) => s.source === 'manuals' && s.field === 'engineering' && s.via === 'holding'),
    'the held manual did not show up as a real, offerable source',
  );

  const { result } = engine.dispatchAction(
    engine.generatePlayer({ linkedEntityId: npc.id }).id,
    { action: 'study', source: 'manuals', field: 'engineering' },
  );
  assert.equal(result.field, 'engineering');
});

test('studySourcesFor is refused for an entity that does not exist', () => {
  assert.throws(() => engine.studySourcesFor(999999), /no entity with id/);
});
