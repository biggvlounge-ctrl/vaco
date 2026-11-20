// Gossip/word-of-mouth player-facing "ask around" verb — by direct
// instruction. Read `server/gossip.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const gossip = require('../server/gossip.js');
const worldStore = require('../server/worldStore.js');

let nextId = 990000;

function world() {
  return {
    tick: 10,
    npcs: [],
    entityKnowledge: [],
  };
}

function person(w, { communityId = null } = {}) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active', communityId });
  return id;
}

function knows(w, { entityId, subjectEntityId, confidence, content = 'something' }) {
  worldStore.addKnowledge(w, {
    entityId, subjectEntityId, factType: 'rumor', factContent: content,
    confidenceLevel: confidence, sourceEntityId: null, tick: w.tick,
  });
}

// ---------------------------------------------------------------------
// askAround
// ---------------------------------------------------------------------

test('a neighbour\'s real knowledge about the subject is surfaced', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  const neighbour = person(w, { communityId });
  const subject = person(w, { communityId: 2 });
  knows(w, { entityId: neighbour, subjectEntityId: subject, confidence: 60, content: 'seen downtown' });

  const result = gossip.askAround(w, asker, subject);
  assert.ok(result);
  assert.equal(result.fact_content, 'seen downtown');
  assert.equal(result.confidence_level, 60);
});

test('nobody around knowing anything real is a real null, never a fabricated answer', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  person(w, { communityId });
  const subject = person(w, { communityId: 2 });

  assert.equal(gossip.askAround(w, asker, subject), null);
});

test('the single MOST confident real rumor wins among several neighbours', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  const a = person(w, { communityId });
  const b = person(w, { communityId });
  const subject = person(w, { communityId: 2 });
  knows(w, { entityId: a, subjectEntityId: subject, confidence: 20, content: 'weak rumor' });
  knows(w, { entityId: b, subjectEntityId: subject, confidence: 80, content: 'strong rumor' });

  const result = gossip.askAround(w, asker, subject);
  assert.equal(result.fact_content, 'strong rumor');
  assert.equal(result.confidence_level, 80);
});

test('an asker with no real community cannot ask anyone around', () => {
  const w = world();
  const asker = person(w, { communityId: null });
  const subject = person(w, { communityId: 1 });
  assert.equal(gossip.askAround(w, asker, subject), null);
});

test('a resident of a different real community is never asked', () => {
  const w = world();
  const asker = person(w, { communityId: 1 });
  const elsewhere = person(w, { communityId: 2 });
  const subject = person(w, { communityId: 3 });
  knows(w, { entityId: elsewhere, subjectEntityId: subject, confidence: 99 });

  assert.equal(gossip.askAround(w, asker, subject), null);
});

test('the subject\'s own real self-knowledge is never surfaced as something a neighbour said', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  const subject = person(w, { communityId });
  knows(w, { entityId: subject, subjectEntityId: subject, confidence: 100, content: 'my own secret' });

  assert.equal(gossip.askAround(w, asker, subject), null);
});

test('the asker is never asked themselves', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  const subject = person(w, { communityId: 2 });
  knows(w, { entityId: asker, subjectEntityId: subject, confidence: 100, content: 'what I myself heard' });

  // The asker's own real knowledge is not surfaced as "asking around" --
  // `residentsToAsk` excludes them, so this reaches null rather than
  // their own held fact.
  assert.equal(gossip.askAround(w, asker, subject), null);
});

test('askAround throws on a real entity that does not exist, never answers for a ghost', () => {
  const w = world();
  const subject = person(w, { communityId: 1 });
  assert.throws(() => gossip.askAround(w, 999999, subject), /no entity/);
});

test('askAround requires a real subjectEntityId', () => {
  const w = world();
  const asker = person(w, { communityId: 1 });
  assert.throws(() => gossip.askAround(w, asker, null), /subjectEntityId/);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the highest-confidence comparison is the real reason the strong rumor wins, not resident order', () => {
  const w = world();
  const communityId = 1;
  const asker = person(w, { communityId });
  // `askAround` iterates residents in `worldState.npcs` ARRAY order --
  // i.e. the order they were created here, not the order `knows()` is
  // called below. `a` is created FIRST (so it is processed first) and
  // holds the STRONG rumor; `b` is created SECOND (processed LAST) and
  // holds the WEAK one. A "last resident processed wins" mutation would
  // then surface the weak rumor -- visibly wrong -- while the real
  // highest-confidence comparison still correctly surfaces the strong
  // one, regardless of which resident is processed last.
  const a = person(w, { communityId });
  const b = person(w, { communityId });
  const subject = person(w, { communityId: 2 });
  knows(w, { entityId: a, subjectEntityId: subject, confidence: 80, content: 'strong rumor' });
  knows(w, { entityId: b, subjectEntityId: subject, confidence: 20, content: 'weak rumor' });

  const result = gossip.askAround(w, asker, subject);
  assert.equal(result.fact_content, 'strong rumor');
});

test('mutation check: residentsToAsk\'s real community filter is what keeps a different community out, not an accident of fixture size', () => {
  const w = world();
  const asker = person(w, { communityId: 1 });
  const elsewhere = person(w, { communityId: 2 });
  const names = gossip.residentsToAsk(w, 1, asker, null).map((n) => n.id);
  assert.ok(!names.includes(elsewhere));
});
