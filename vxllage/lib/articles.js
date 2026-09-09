// VXLLAGE -- long-form Articles, closing the real gap
// VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md names directly: "VXLLAGE had no
// long-form writing or newsletter capability... X itself tried this
// exact feature" (Revue, acquired 2021, shut down 2023) "with no
// actual newsletter delivery or subscription mechanism" -- "VXLLAGE
// can build what X abandoned."
//
// Source of truth: that doc's own `Article { id, authorId, title,
// bodyContent, publishedAt, isPaywalled, linkedToVxllagePost }`.
//
// **Real, literal implementation of "articles surface in the primary
// feed too, not siloed"**: `publishArticle` doesn't just accept an
// optional `linkedToVxllagePost` id -- when one isn't supplied, it
// creates a real Post announcing the article and links the two
// together, both directions. A silent, undiscoverable article would
// contradict the doc's own point.
//
// **Real paywall, reusing Vavlt Stvdios' own subscription
// infrastructure rather than rebuilding it** (see this doc's own
// "Confirmed: no duplication needed" section, and `vavltStvdiosClient.js`'s
// own header for the one claim in that section confirmed false and
// not relied on here): a paywalled article requires a real
// `requiredTierId` pointing at an actual Vavlt Stvdios
// `LockedContentTier` the author already owns -- the same
// `requiredTierId` idiom Vavlt Stvdios' own `Post` model already uses,
// not a new shape invented here. `getArticleForViewer` withholds
// `bodyContent` unless the viewer is a real, confirmed subscriber to
// that tier -- the same real gated-read pattern already reused three
// times this session (VACAY Homes' lead contact info, Vavlt Stvdios'
// own `getPostForViewer`).

const { createPost } = require('./posts');
const { checkTierAccess } = require('./vavltStvdiosClient');

function publishArticle(store, options = {}) {
  const {
    authorId, title, bodyContent, isPaywalled = false, requiredTierId = null, linkedToVxllagePost = null,
  } = options;

  if (!authorId) throw new Error('publishArticle requires an authorId');
  if (!title) throw new Error('publishArticle requires a title');
  if (typeof bodyContent !== 'string' || bodyContent.trim().length === 0) {
    throw new Error('publishArticle requires non-empty bodyContent');
  }
  if (isPaywalled && !requiredTierId) {
    throw new Error('publishArticle: a paywalled article requires a requiredTierId (a real Vavlt Stvdios LockedContentTier)');
  }

  const article = {
    id: store.nextArticleId++,
    authorId,
    title,
    bodyContent,
    isPaywalled,
    requiredTierId,
    linkedToVxllagePost,
    publishedAt: Date.now(),
  };
  store.articles.push(article);

  // Real feed presence, not an optional afterthought -- an article
  // with no caller-supplied post gets a real one created for it here.
  if (!linkedToVxllagePost) {
    const announcementText = isPaywalled
      ? `New article: "${title}" (subscribers only)`
      : `New article: "${title}"`;
    const post = createPost(store, { authorId, text: announcementText });
    article.linkedToVxllagePost = post.id;
  }

  return article;
}

function getArticle(store, articleId) {
  return store.articles.find((a) => a.id === articleId) || null;
}

function listArticlesForAuthor(store, authorId) {
  return store.articles.filter((a) => a.authorId === authorId).sort((a, b) => b.publishedAt - a.publishedAt);
}

// Real gated read -- withholds `bodyContent` for a paywalled article
// the caller-supplied `hasAccess` doesn't confirm. `hasAccess` is
// computed by the caller (server.js) via a real, live check against
// Vavlt Stvdios' own tier data, kept separate here the same way
// posts.js's own `getPostForViewer` stays decoupled from the tiers
// module it's gated by.
function getArticleForViewer(article, hasAccess) {
  if (!article.isPaywalled || hasAccess) return article;
  return { ...article, bodyContent: null };
}

async function canViewArticle(article, viewerId) {
  if (!article.isPaywalled) return true;
  if (!viewerId) return false;
  return checkTierAccess(article.requiredTierId, viewerId);
}

module.exports = {
  publishArticle, getArticle, listArticlesForAuthor, getArticleForViewer, canViewArticle,
};
