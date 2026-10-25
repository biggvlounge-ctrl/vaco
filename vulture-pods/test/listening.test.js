// Vvltvre Pods -- real listen tracking, focused on
// `getTotalListensForCreator`, the real cross-show aggregate VOKEN's
// cross-platform achievement score reads live. The failure this file
// exists to catch: a creator with two shows getting credited for only
// one of them, or getting credited for another creator's listens.

const test = require('node:test');
const assert = require('node:assert');

const { createVulturePodsStore } = require('../lib/store');
const { createShow } = require('../lib/shows');
const { createEpisode, publishEpisode } = require('../lib/episodes');
const { recordListen, getTotalListensForCreator } = require('../lib/listening');

async function publishedEpisode(store, { creatorId, showTitle, episodeNumber }) {
  const show = createShow(store, {
    creatorId, title: showTitle, description: 'd', category: 'culture',
  });
  const episode = createEpisode(store, {
    showId: show.id, title: `${showTitle} ep ${episodeNumber}`, episodeNumber, durationSeconds: 600,
  });
  await publishEpisode(store, {
    episodeId: episode.id,
    distributeFn: async () => ({ id: 999 }),
  });
  return { show, episode };
}

test('getTotalListensForCreator sums real listens across every episode of every one of this creator\'s shows', async () => {
  const store = createVulturePodsStore();
  const { episode: ep1 } = await publishedEpisode(store, { creatorId: 'ada', showTitle: 'Show A', episodeNumber: 1 });
  const { episode: ep2 } = await publishedEpisode(store, { creatorId: 'ada', showTitle: 'Show B', episodeNumber: 1 });

  recordListen(store, { episodeId: ep1.id, userId: 'u1' });
  recordListen(store, { episodeId: ep1.id, userId: 'u2' });
  recordListen(store, { episodeId: ep2.id, userId: 'u3' });

  assert.equal(getTotalListensForCreator(store, 'ada'), 3);
});

test('getTotalListensForCreator never credits one creator with another creator\'s real listens', async () => {
  const store = createVulturePodsStore();
  const { episode: adaEp } = await publishedEpisode(store, { creatorId: 'ada', showTitle: 'Ada Show', episodeNumber: 1 });
  const { episode: benEp } = await publishedEpisode(store, { creatorId: 'ben', showTitle: 'Ben Show', episodeNumber: 1 });

  recordListen(store, { episodeId: adaEp.id, userId: 'u1' });
  for (let i = 0; i < 5; i += 1) recordListen(store, { episodeId: benEp.id, userId: `u${i}` });

  assert.equal(getTotalListensForCreator(store, 'ada'), 1);
  assert.equal(getTotalListensForCreator(store, 'ben'), 5);
});

test('getTotalListensForCreator is honestly 0 for a creator with no shows, or shows with no listens yet', () => {
  const store = createVulturePodsStore();
  assert.equal(getTotalListensForCreator(store, 'nobody-home'), 0);
});
