// VXLLAGE -- Communities, closing `surfaceLinks.js`'s own previously-
// flagged gap: the combined architecture doc's `VxllageSurfaceLink`
// type union names "community-thread" as a real link target, but no
// `Community` entity existed anywhere in this codebase for a thread
// to belong to.
//
// Deliberately NOT a second Village. `villages.js`'s own header
// documents the real "shrink" correction this app already went
// through -- Villages are the heavier, Discord-flavored layer
// (channels, events, rooms, membership roles). A Community here is
// the real, lighter thing the doc's own naming implies: an open,
// topic-scoped discussion space with real threads, no channels, no
// rooms, no membership roles -- closer to a subreddit or a Facebook
// Group's discussion tab than to a Village. Anyone may start a thread
// in any community; there is no join/leave state to track, matching
// the doc's own narrow naming ("community-thread," not
// "community-member" or "community-channel").

function createCommunity(store, options = {}) {
  const { name, creatorId, description = null } = options;
  if (!name) throw new Error('createCommunity requires a name');
  if (!creatorId) throw new Error('createCommunity requires a creatorId');

  const community = {
    id: store.nextCommunityId++,
    name,
    creatorId,
    description,
    createdAt: Date.now(),
  };
  store.communities.push(community);
  return community;
}

function getCommunity(store, communityId) {
  return store.communities.find((c) => c.id === communityId) || null;
}

function listCommunities(store) {
  return store.communities;
}

function createCommunityThread(store, options = {}) {
  const { communityId, authorId, title, body, now = Date.now() } = options;
  const community = getCommunity(store, communityId);
  if (!community) throw new Error(`createCommunityThread: no community with id ${communityId}`);
  if (!authorId) throw new Error('createCommunityThread requires an authorId');
  if (!title) throw new Error('createCommunityThread requires a title');
  if (!body) throw new Error('createCommunityThread requires a body');

  const thread = {
    id: store.nextCommunityThreadId++,
    communityId,
    authorId,
    title,
    body,
    createdAt: now,
  };
  store.communityThreads.push(thread);
  return thread;
}

function getCommunityThread(store, threadId) {
  return store.communityThreads.find((t) => t.id === threadId) || null;
}

function listThreadsForCommunity(store, communityId) {
  return store.communityThreads.filter((t) => t.communityId === communityId).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  createCommunity,
  getCommunity,
  listCommunities,
  createCommunityThread,
  getCommunityThread,
  listThreadsForCommunity,
};
