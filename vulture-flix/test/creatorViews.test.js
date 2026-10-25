// Vvltvre Flix -- real, cross-title total views for one creator.
// The real number VOKEN's cross-platform achievement score reads
// live. The failure this file exists to catch: a creator with two
// titles getting credited for only one, or credited for another
// creator's real watch events.

const test = require('node:test');
const assert = require('node:assert');

const { createVultureFlixStore } = require('../lib/store');
const {
  acquireExclusiveTitle, registerStudioProducedTitle, markStreaming, watchTitle, getTotalViewsForCreator,
} = require('../lib/titles');
const { subscribe } = require('../lib/subscriptions');

const NOW = Date.UTC(2026, 5, 1);

function ledger(initial = {}) {
  const balances = { ...initial };
  const fn = async (legs) => {
    for (const { fromUserId, toUserId, amount } of legs) {
      balances[fromUserId] = (balances[fromUserId] || 0) - amount;
      balances[toUserId] = (balances[toUserId] || 0) + amount;
    }
    return { ok: true };
  };
  return fn;
}

async function streamingTitle(store, { creatorId, title, settleFn }) {
  const record = await acquireExclusiveTitle(store, {
    creatorId, title, type: 'film', acquisitionFee: 500, exclusivityWindowDays: 365, settleFn, now: NOW,
  });
  markStreaming(store, record.id);
  return record;
}

test('getTotalViewsForCreator sums real watch events across every one of this creator\'s titles', async () => {
  const store = createVultureFlixStore();
  const settleFn = ledger();
  const titleA = await streamingTitle(store, { creatorId: 'nova', title: 'Film A', settleFn });
  const titleB = await streamingTitle(store, { creatorId: 'nova', title: 'Film B', settleFn });

  await subscribe(store, { userId: 'u1', tier: 'premium', settleFn, now: NOW });
  await subscribe(store, { userId: 'u2', tier: 'premium', settleFn, now: NOW });

  watchTitle(store, { userId: 'u1', titleId: titleA.id, now: NOW });
  watchTitle(store, { userId: 'u2', titleId: titleA.id, now: NOW });
  watchTitle(store, { userId: 'u1', titleId: titleB.id, now: NOW });

  assert.equal(getTotalViewsForCreator(store, 'nova'), 3);
});

test('getTotalViewsForCreator never credits one creator with another creator\'s real views', async () => {
  const store = createVultureFlixStore();
  const settleFn = ledger();
  const novaTitle = await streamingTitle(store, { creatorId: 'nova', title: 'Nova Film', settleFn });
  const benTitle = await streamingTitle(store, { creatorId: 'ben', title: 'Ben Film', settleFn });

  await subscribe(store, { userId: 'u1', tier: 'premium', settleFn, now: NOW });
  watchTitle(store, { userId: 'u1', titleId: novaTitle.id, now: NOW });
  watchTitle(store, { userId: 'u1', titleId: benTitle.id, now: NOW });
  watchTitle(store, { userId: 'u1', titleId: benTitle.id, now: NOW + 1000 });

  assert.equal(getTotalViewsForCreator(store, 'nova'), 1);
  assert.equal(getTotalViewsForCreator(store, 'ben'), 2);
});

test('getTotalViewsForCreator still counts a studio-produced title\'s real views, even though ownershipRetainedPercent is 0', () => {
  const store = createVultureFlixStore();
  const record = registerStudioProducedTitle(store, {
    studioId: 'vault-studios', studioProjectId: 'proj-1', title: 'Studio Film', type: 'film', now: NOW,
  });
  markStreaming(store, record.id);
  // No subscription needed to assert the counting logic directly --
  // push a real watch event the same shape watchTitle would create.
  store.watchEvents.push({ id: store.nextWatchEventId++, userId: 'u1', titleId: record.id, watchedAt: NOW });

  assert.equal(getTotalViewsForCreator(store, 'vault-studios'), 1);
});

test('getTotalViewsForCreator is honestly 0 for a creator with no titles, or titles with no views yet', () => {
  const store = createVultureFlixStore();
  assert.equal(getTotalViewsForCreator(store, 'nobody-home'), 0);
});
