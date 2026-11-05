// CHOPZ -- shared, growing store object for the video/social app
// itself. Commerce state (products, affiliate links, orders) lives in
// `chopz-shop/lib/store.js` -- its own separate app now, not this one.

function createChopzStore() {
  return {
    videos: [],
    nextVideoId: 1,
    likes: [],
    comments: [],
    nextCommentId: 1,
    shares: [],
    // Real play events -- recorded only when a viewer was actually
    // handed a real, ready playback credential (see server.js's own
    // `/play` route), never on a bare click. See lib/forYou.js's own
    // header for the one real signal this unlocks: TikTok's own public
    // "plays" count, which this app had no record of until now.
    plays: [],
  };
}

module.exports = { createChopzStore };
