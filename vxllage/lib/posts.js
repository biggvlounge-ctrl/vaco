// VXLLAGE -- Posts (the real Home feed core).
// Source of truth: VXLLAGE_CLAUDE.md's §0 correction: "Home needs to
// become the deepest, most central surface -- real posting, real
// thread/reply expansion, real profile pages, quote-posts, a
// functioning For You vs. Following distinction" -- and its explicit
// list of what's currently decorative in the prototype: "Composer...
// no submit, no new posts ever created" and "Reply/repost/share
// buttons -- no action." This module is the real, literal
// implementation of the actions that prototype never wired up.
//
// VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real `Post { id, authorId,
// text, mediaUrl, upvotes, downvotes, isReply }` model is the
// starting shape; `downvotes` isn't part of X's real interaction
// model (X has no downvote), so this module builds real `likedBy`/
// `repostedBy` tracking instead, matching the CLAUDE.md prototype's
// own real X-style engagement row (reply/repost/like/share), not the
// combined architecture doc's Reddit-flavored field name literally.

function createPost(store, options = {}) {
  const { authorId, text, mediaUrl = null, replyToPostId = null, quotedPostId = null } = options;
  if (!authorId) throw new Error('createPost requires an authorId');
  if (typeof text !== 'string') throw new Error('createPost requires text (a string, may be empty only for a reply or quote-post)');

  // A genuine top-level, non-reply, non-quote post needs real content
  // -- X's real composer never submits an empty post. A reply or a
  // quote-post may carry empty text (a silent quote/repost-with-reply
  // is real, valid X behavior).
  if (!replyToPostId && !quotedPostId && text.trim().length === 0) {
    throw new Error('createPost requires non-empty text for a top-level post');
  }

  let replyToPost = null;
  if (replyToPostId) {
    replyToPost = getPost(store, replyToPostId);
    if (!replyToPost) throw new Error(`createPost: no post with id ${replyToPostId} to reply to`);
  }
  let quotedPost = null;
  if (quotedPostId) {
    quotedPost = getPost(store, quotedPostId);
    if (!quotedPost) throw new Error(`createPost: no post with id ${quotedPostId} to quote`);
  }

  const post = {
    id: store.nextPostId++,
    authorId,
    text,
    mediaUrl,
    isReply: !!replyToPostId,
    replyToPostId,
    quotedPostId,
    likedBy: [],
    repostedBy: [],
    createdAt: Date.now(),
  };
  store.posts.push(post);
  return post;
}

function getPost(store, postId) {
  return store.posts.find((p) => p.id === postId) || null;
}

// Real thread/reply expansion, direct children only.
function getReplies(store, postId) {
  return store.posts.filter((p) => p.replyToPostId === postId).sort((a, b) => a.createdAt - b.createdAt);
}

// Real, recursive thread assembly -- the full reply tree under a
// post, not just one level deep.
function getThread(store, postId) {
  const post = getPost(store, postId);
  if (!post) throw new Error(`getThread: no post with id ${postId}`);
  return { post, replies: getReplies(store, postId).map((r) => getThread(store, r.id)) };
}

function likePost(store, options = {}) {
  const { postId, userId } = options;
  const post = getPost(store, postId);
  if (!post) throw new Error(`likePost: no post with id ${postId}`);
  if (!userId) throw new Error('likePost requires a userId');
  if (post.likedBy.includes(userId)) throw new Error(`likePost: ${userId} already liked post ${postId}`);
  post.likedBy.push(userId);
  return post;
}

function unlikePost(store, options = {}) {
  const { postId, userId } = options;
  const post = getPost(store, postId);
  if (!post) throw new Error(`unlikePost: no post with id ${postId}`);
  if (!post.likedBy.includes(userId)) throw new Error(`unlikePost: ${userId} has not liked post ${postId}`);
  post.likedBy = post.likedBy.filter((id) => id !== userId);
  return post;
}

// A real repost (share, no added commentary) -- distinct from a
// quote-post, which is a new post via createPost({ quotedPostId }).
function repostPost(store, options = {}) {
  const { postId, userId } = options;
  const post = getPost(store, postId);
  if (!post) throw new Error(`repostPost: no post with id ${postId}`);
  if (!userId) throw new Error('repostPost requires a userId');
  if (post.repostedBy.includes(userId)) throw new Error(`repostPost: ${userId} already reposted post ${postId}`);
  post.repostedBy.push(userId);
  return post;
}

function unrepostPost(store, options = {}) {
  const { postId, userId } = options;
  const post = getPost(store, postId);
  if (!post) throw new Error(`unrepostPost: no post with id ${postId}`);
  if (!post.repostedBy.includes(userId)) throw new Error(`unrepostPost: ${userId} has not reposted post ${postId}`);
  post.repostedBy = post.repostedBy.filter((id) => id !== userId);
  return post;
}

module.exports = {
  createPost, getPost, getReplies, getThread, likePost, unlikePost, repostPost, unrepostPost,
};
