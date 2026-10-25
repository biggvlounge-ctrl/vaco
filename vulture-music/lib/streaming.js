// Vvltvre Music/Distribution -- real raw stream counts.
//
// **The real gap this closes.** This app already tracks real
// streaming *revenue* (`reportStreamingRevenue` in `lib/releases.js`
// — a dollar amount, reported in aggregate per platform payout) but
// never a raw play/stream *count* anywhere, unlike `vulture-pods`'
// own `listenEvents` or `vulture-flix`'s own `watchEvents`. Added by
// direct instruction so a creator's real cross-platform footprint
// ("streams for music... check everything we can") has an actual
// number to read here too, not just a revenue figure.
//
// Deliberately free to record, the same real default economics
// `vulture-pods`' own `recordListen` already established: an
// individual stream is not a billable event (that happens in
// aggregate, separately, via `reportStreamingRevenue`) — this is a
// real event log of raw play counts, not a second payment path.
// Scoped to a `live` release only, the same real gate
// `reportStreamingRevenue` already uses: there is nothing real to
// have streamed before a release has actually gone out.

const { getRelease, listReleasesForArtist } = require('./releases');

function recordStream(store, options = {}) {
  const { releaseId, userId, now = Date.now() } = options;
  if (!userId) throw new Error('recordStream requires a userId');
  const release = getRelease(store, releaseId);
  if (!release) throw new Error(`recordStream: no release with id ${releaseId}`);
  if (release.status !== 'live') {
    throw new Error(`recordStream: release ${releaseId} is "${release.status}", must be "live"`);
  }

  const streamEvent = {
    id: store.nextStreamEventId++, releaseId, userId, streamedAt: now,
  };
  store.streamEvents.push(streamEvent);
  return streamEvent;
}

function getStreamCount(store, releaseId) {
  return store.streamEvents.filter((s) => s.releaseId === releaseId).length;
}

// The real, cross-release total for one artist -- added by direct
// instruction so VOKEN's cross-platform achievement score can read a
// real total stream count live, the same shape `vulture-pods`'
// `getTotalListensForCreator` and `vulture-flix`'s
// `getTotalViewsForCreator` already take.
function getTotalStreamCountForArtist(store, artistId) {
  const releaseIds = new Set(listReleasesForArtist(store, artistId).map((r) => r.id));
  return store.streamEvents.filter((s) => releaseIds.has(s.releaseId)).length;
}

module.exports = {
  recordStream,
  getStreamCount,
  getTotalStreamCountForArtist,
};
