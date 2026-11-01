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

// Closes this project's own previously-flagged gap ("episode
// transcripts, chapters, or show notes beyond the real, minimal
// metadata fields built here"). All three are plain text/data this
// project is the real system of record for -- no external transcript
// service or chapter-parsing tool exists anywhere in this ecosystem's
// sandbox, so these are real, creator-authored fields (the same real
// RSS <podcast:transcript>/<podcast:chapters> namespaces podcast apps
// actually use, minus the literal RSS/XML this project's own README
// already deliberately skips in favor of internal cross-app calls).
const MAX_CHAPTER_TITLE_LENGTH = 200;

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
    showNotes: null,
    transcript: null,
    chapters: [],
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

// Show notes are free-form, creator-written text (episode description,
// links, credits) -- real and settable at any point in an episode's
// life, draft or published, same as a real podcast host editing their
// own show notes before or after release.
function setEpisodeShowNotes(store, options = {}) {
  const { episodeId, showNotes } = options;
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`setEpisodeShowNotes: no episode with id ${episodeId}`);
  if (typeof showNotes !== 'string' || showNotes.trim().length === 0) {
    throw new Error('setEpisodeShowNotes requires a non-empty showNotes string');
  }
  episode.showNotes = showNotes;
  return episode;
}

// A transcript is one real, whole-episode text block -- this project
// is the system of record for it (no real speech-to-text service
// exists in this ecosystem's sandbox to generate one; a creator
// pastes their own, same as show notes).
function setEpisodeTranscript(store, options = {}) {
  const { episodeId, transcript } = options;
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`setEpisodeTranscript: no episode with id ${episodeId}`);
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    throw new Error('setEpisodeTranscript requires a non-empty transcript string');
  }
  episode.transcript = transcript;
  return episode;
}

// Chapters are real timestamp markers into the episode's own real
// `durationSeconds` -- validated against it, not an arbitrary
// unbounded number, and kept genuinely sorted so a player can walk
// them in order without re-sorting itself. Two chapters cannot share
// a start time; the real, meaningful content of a chapter list is
// that each one marks a distinct moment.
function addEpisodeChapter(store, options = {}) {
  const { episodeId, title, startSeconds } = options;
  const episode = getEpisode(store, episodeId);
  if (!episode) throw new Error(`addEpisodeChapter: no episode with id ${episodeId}`);
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('addEpisodeChapter requires a non-empty title');
  }
  if (title.length > MAX_CHAPTER_TITLE_LENGTH) {
    throw new Error(`addEpisodeChapter: title exceeds ${MAX_CHAPTER_TITLE_LENGTH} characters`);
  }
  if (!Number.isInteger(startSeconds) || startSeconds < 0) {
    throw new Error('addEpisodeChapter requires a non-negative integer startSeconds');
  }
  if (startSeconds >= episode.durationSeconds) {
    throw new Error(`addEpisodeChapter: startSeconds ${startSeconds} is at or past this episode's own durationSeconds (${episode.durationSeconds})`);
  }
  if (episode.chapters.some((c) => c.startSeconds === startSeconds)) {
    throw new Error(`addEpisodeChapter: episode ${episodeId} already has a chapter starting at ${startSeconds}s`);
  }

  episode.chapters.push({ title, startSeconds });
  episode.chapters.sort((a, b) => a.startSeconds - b.startSeconds);
  return episode;
}

module.exports = {
  EPISODE_STATUSES,
  MAX_CHAPTER_TITLE_LENGTH,
  createEpisode,
  getEpisode,
  listEpisodesForShow,
  publishEpisode,
  attachEpisodeVideo,
  setEpisodeShowNotes,
  setEpisodeTranscript,
  addEpisodeChapter,
};
