// VXLLAGE -- real search, closing VXLLAGE_CLAUDE.md's own named gap:
// "Search icons (Threads, Villages) -- decorative, no search executes"
// / "Real search -- Threads and Villages search icons need actual
// [search logic]." "Threads" in this app's own real data model is X-
// style reply posts (see posts.js's own header -- there is no separate
// Reddit-flavored Thread entity here), so a Threads search is a real
// search over `post.text`.
//
// Real, honest scope: case-insensitive substring matching, no ranking
// beyond recency -- no source doc specifies a real relevance-ranking
// algorithm, so none is invented. Matches this session's consistent
// "flagged, bounded, real, not fabricated precision" posture for any
// unscoped formula.

function searchVillages(store, query) {
  if (!query) throw new Error('searchVillages requires a query');
  const needle = query.toLowerCase();
  return store.villages.filter((v) => v.name.toLowerCase().includes(needle));
}

function searchPosts(store, query) {
  if (!query) throw new Error('searchPosts requires a query');
  const needle = query.toLowerCase();
  return store.posts
    .filter((p) => p.text && p.text.toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { searchVillages, searchPosts };
