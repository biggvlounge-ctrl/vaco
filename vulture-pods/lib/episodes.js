// Vvltvre Pods -- Episodes.
// Real cross-app reuse, not a duplicated distribution model:
// `vulture-music`'s own `RELEASE_FORMATS` already includes
// `podcast-episode` (gamma.'s real, cited comparable explicitly
// extends its artist-owned, flat-fee distribution model "across
// music, video, AND podcasts, not music alone"). `publishEpisode`
// calls into that real, already-built, already-tested distribution
// economics via an injected `distributeFn` -- the real flat
// distribution fee and `ownershipRetainedPercent: 100` posture come
// from `vulture-music`'s own `submitRelease`, not reinvented here.
// This project owns the real, missing layer on top of that: Shows
// (grouping), free listening, and creator-level subscriptions.
//
// `requiresSubscription` is real and honest: an episode can only be
// gated this way if its own Show actually has at least one real
// subscription tier (`show.subscriptionTiers.length > 0`) -- an
// episode can't require a subscription that doesn't exist to buy. Any
// one of the show's real tiers unlocks a gated episode -- there's no
// per-episode minimum-tier requirement, matching this project's own
// "one subscription per show" idiom in `subscriptions.js`.
//
// **Real video cross-link (`attachEpisodeVideo`), per explicit
// instruction**: a video episode attaches to a real Vavlt Stvdios
// Reel, the same real cross-app pattern `vulture-music`'s own
// `attachMusicVideo` uses, not a duplicated video-hosting layer here.
// Flagged honestly, not silently patched around: Vavlt Stvdios' own
// Reel post type has a real, deliberate 20-minute cap
// (`REEL_MAX_DURATION_SECONDS`), and real video podcast episodes
// routinely run 30-90+ minutes -- a short episode attaches cleanly, a
// long one is rejected by Vavlt Stvdios' own real validation (passed
// straight through, not re-raised as a new error here), since this
// ecosystem has no real long-form video host today. See this
// project's own README "Not yet built" for the real, honest scope
// note.

const { getShow } = require('./shows');

const EPISODE_STATUSES = ['draft', 'published'];

function createEpisode(store, options = {}) {
  const {
    showId, title, episodeNumber, durationSeconds, requiresSubscription = false,
  } = options;

  const show = getShow(store, showId);
  if (!show) throw new Error(`createEpisode: no show with id ${showId}`);
  if (!title) throw new Error('createEpisode requires a title');
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new Error('createEpisode requires a positive integer episodeNumber');
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Error('createEpisode requires a positive integer durationSeconds');
  }
  if (typeof requiresSubscription !== 'boolean') throw new Error('createEpisode requires a boolean requiresSubscription');
  if (requiresSubscription && show.subscriptionTiers.length === 0) {
    throw new Error(`createEpisode: show ${showId} has no subscription tiers, can't gate an episode behind one`);
  }

  const episode = {
    id: store.nextEpisodeId++,
    showId,
    title,
    episodeNumber,
    durationSeconds,
    requiresSubscription,
    status: 'draft',
    vultureMusicReleaseId: null,
    vaultStvdiosPostId: null,
    vaultStvdiosContentType: null,
    createdAt: Date.now(),
    publishedAt: null,
  };
  store.episodes.push(episode);
  return episode;
}

function getEpisode(store, episodeId) {
  return store.episodes.find((e) => e.id === episodeId) || null;
}

function listEpisodesForShow(store, showId) {
  return store.episodes.filter((e) => e.showId === showId).sort((a, b) => a.episodeNumber - b.episodeNumber);
}

// The real, one-time transition into `vulture-music`'s own real
// distribution economics -- `distributeFn` is injected the same way
// `settleFn` is injected everywhere else this session, except this
// one calls into another app's real HTTP API, not V3 directly
// (`server.js` owns that real cross-app client, same separation this
// session already established for CHOPZ SHOP/VOID's own cross-app
// fetches).
async function publishEpisode(store, options = {}) {
  const { episodeId, distributeFn } = options;
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`publishEpisode: no episode with id ${episodeId}`);
  if (episode.status !== 'draft') throw new Error(`publishEpisode: episode ${episodeId} is already published`);
  if (typeof distributeFn !== 'function') throw new Error('publishEpisode requires a distributeFn(episode, show)');

  const show = getShow(store, episode.showId);
  const release = await distributeFn(episode, show);
  if (!release || !release.id) throw new Error('publishEpisode: distributeFn did not return a real release record');

  episode.status = 'published';
  episode.vultureMusicReleaseId = release.id;
  episode.publishedAt = Date.now();
  return episode;
}

// Real, later attach step -- an episode's video is optional and
// independent of its publish state, mirroring `vulture-music`'s own
// `attachMusicVideo`. One video per episode; a second attach attempt
// is rejected, not silently overwritten. `contentType` records which
// real Vavlt Stvdios entity `vaultStvdiosPostId` actually points to
// (`'reel'` or `'video'`) -- `server.js` picks the real one based on
// the episode's own real `durationSeconds` against Vavlt Stvdios' own
// real 20-minute Reel cap, so a bare id alone wouldn't say which
// collection to look the content up in later.
function attachEpisodeVideo(store, options = {}) {
  const { episodeId, vaultStvdiosPostId, contentType } = options;
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`attachEpisodeVideo: no episode with id ${episodeId}`);
  if (episode.vaultStvdiosPostId !== null) throw new Error(`attachEpisodeVideo: episode ${episodeId} already has a video attached`);
  if (!vaultStvdiosPostId) throw new Error('attachEpisodeVideo requires a vaultStvdiosPostId');
  if (contentType !== 'reel' && contentType !== 'video') throw new Error('attachEpisodeVideo requires a contentType of reel or video');

  episode.vaultStvdiosPostId = vaultStvdiosPostId;
  episode.vaultStvdiosContentType = contentType;
  return episode;
}

module.exports = {
  EPISODE_STATUSES,
  createEpisode,
  getEpisode,
  listEpisodesForShow,
  publishEpisode,
  attachEpisodeVideo,
};
