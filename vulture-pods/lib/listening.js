// Vvltvre Pods -- Listening.
// The real, default Spotify/Apple Podcasts economics, genuinely
// different from Vvltvre Flix's own `watchTitle`: listening is free
// by default -- no subscription check, no money moves -- matching the
// real fact that the overwhelming majority of real podcast listening
// is free/ad-supported, not gated. Only an episode explicitly marked
// `requiresSubscription` (a real bonus/exclusive episode) checks the
// listener's own real subscription to that specific show.

const { getEpisode, listEpisodesForShow } = require('./episodes');
const { isSubscribedToShow } = require('./subscriptions');
const { listShowsForCreator } = require('./shows');

function recordListen(store, options = {}) {
  const { episodeId, userId, now = Date.now() } = options;
  if (!userId) throw new Error('recordListen requires a userId');
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`recordListen: no episode with id ${episodeId}`);
  if (episode.status !== 'published') throw new Error(`recordListen: episode ${episodeId} is not published`);

  if (episode.requiresSubscription && !isSubscribedToShow(store, { userId, showId: episode.showId, now })) {
    throw new Error(`recordListen: episode ${episodeId} requires a subscription to show ${episode.showId}`);
  }

  const listenEvent = {
    id: store.nextListenEventId++, episodeId, userId, listenedAt: now,
  };
  store.listenEvents.push(listenEvent);
  return listenEvent;
}

function getListenHistory(store, userId) {
  return store.listenEvents.filter((l) => l.userId === userId).sort((a, b) => b.listenedAt - a.listenedAt);
}

function getListenCount(store, episodeId) {
  return store.listenEvents.filter((l) => l.episodeId === episodeId).length;
}

// The real, cross-episode total for one creator -- by direct
// instruction: "check all their social media platforms... get all the
// information from everything we can," generalized across every
// connected app. Every real show the creator owns, every real
// published episode of each, summed from the same real `listenEvents`
// log `getListenCount` already reads -- no separate running counter to
// let drift from reality.
function getTotalListensForCreator(store, creatorId) {
  const shows = listShowsForCreator(store, creatorId);
  let total = 0;
  for (const show of shows) {
    for (const episode of listEpisodesForShow(store, show.id)) {
      total += getListenCount(store, episode.id);
    }
  }
  return total;
}

module.exports = {
  recordListen,
  getListenHistory,
  getListenCount,
  getTotalListensForCreator,
};
