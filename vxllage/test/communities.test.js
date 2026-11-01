// VXLLAGE -- Communities, closing surfaceLinks.js's own previously-
// flagged "no Community entity for community-thread to point at" gap.

const test = require('node:test');
const assert = require('node:assert');

const { createVxllageStore } = require('../lib/store');
const {
  createCommunity, getCommunity, listCommunities, createCommunityThread, getCommunityThread, listThreadsForCommunity,
} = require('../lib/communities');
const { SURFACE_TYPES, createSurfaceLink, getLinksForSurface } = require('../lib/surfaceLinks');

test('createCommunity requires a name and creatorId', () => {
  const store = createVxllageStore();
  assert.throws(() => createCommunity(store, { creatorId: 'ada' }), /requires a name/);
  assert.throws(() => createCommunity(store, { name: 'Gardeners' }), /requires a creatorId/);
});

test('a created community is real and retrievable', () => {
  const store = createVxllageStore();
  const community = createCommunity(store, { name: 'Gardeners', creatorId: 'ada', description: 'for plant people' });
  assert.equal(getCommunity(store, community.id).name, 'Gardeners');
  assert.ok(listCommunities(store).some((c) => c.id === community.id));
});

test('createCommunityThread refuses an unknown community', () => {
  const store = createVxllageStore();
  assert.throws(
    () => createCommunityThread(store, { communityId: 999, authorId: 'ada', title: 'Hi', body: 'hello' }),
    /no community with id/,
  );
});

test('createCommunityThread requires an authorId, title, and body', () => {
  const store = createVxllageStore();
  const community = createCommunity(store, { name: 'Gardeners', creatorId: 'ada' });
  assert.throws(() => createCommunityThread(store, { communityId: community.id, title: 'Hi', body: 'hello' }), /requires an authorId/);
  assert.throws(() => createCommunityThread(store, { communityId: community.id, authorId: 'bob', body: 'hello' }), /requires a title/);
  assert.throws(() => createCommunityThread(store, { communityId: community.id, authorId: 'bob', title: 'Hi' }), /requires a body/);
});

test('any real user may start a thread, not just the community creator', () => {
  const store = createVxllageStore();
  const community = createCommunity(store, { name: 'Gardeners', creatorId: 'ada' });
  const thread = createCommunityThread(store, {
    communityId: community.id, authorId: 'bob', title: 'Best soil?', body: 'What works for tomatoes?',
  });
  assert.equal(thread.authorId, 'bob');
  assert.equal(getCommunityThread(store, thread.id).title, 'Best soil?');
});

test('listThreadsForCommunity scopes to the real community, newest first', () => {
  const store = createVxllageStore();
  const now = Date.now();
  const a = createCommunity(store, { name: 'Gardeners', creatorId: 'ada' });
  const b = createCommunity(store, { name: 'Bakers', creatorId: 'ada' });
  const t1 = createCommunityThread(store, { communityId: a.id, authorId: 'bob', title: 'First', body: 'x', now });
  createCommunityThread(store, { communityId: b.id, authorId: 'bob', title: 'Wrong community', body: 'x', now: now + 1 });
  const t3 = createCommunityThread(store, { communityId: a.id, authorId: 'cara', title: 'Second', body: 'x', now: now + 2 });

  const threads = listThreadsForCommunity(store, a.id);
  assert.equal(threads.length, 2);
  assert.deepEqual(threads.map((t) => t.id), [t3.id, t1.id]);
});

// -- surfaceLinks.js integration: "community-thread" is a real,
// linkable surface type now ---------------------------------------------

test('SURFACE_TYPES includes community-thread', () => {
  assert.ok(SURFACE_TYPES.includes('community-thread'));
});

test('a community thread can be the target of a real surface link', () => {
  const store = createVxllageStore();
  const community = createCommunity(store, { name: 'Gardeners', creatorId: 'ada' });
  const thread = createCommunityThread(store, {
    communityId: community.id, authorId: 'bob', title: 'Best soil?', body: 'x',
  });

  const link = createSurfaceLink(store, {
    sourceType: 'post', sourceId: 42, linkedSurfaceType: 'community-thread', linkedSurfaceId: thread.id,
  });
  assert.equal(link.linkedSurfaceType, 'community-thread');

  const found = getLinksForSurface(store, { sourceType: 'post', sourceId: 42 });
  assert.equal(found.length, 1);
  assert.equal(found[0].linkedSurfaceId, String(thread.id));
});
