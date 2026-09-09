// CHOPZ -- shared, growing store object for the video/social app
// itself. Commerce state (products, affiliate links, orders) lives in
// `chopz-shop/lib/store.js` -- its own separate app now, not this one.

function createChopzStore() {
  return {
    videos: [],
    nextVideoId: 1,
  };
}

module.exports = { createChopzStore };
