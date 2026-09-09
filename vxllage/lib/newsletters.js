// VXLLAGE -- Newsletter delivery + the cross-publication recommendation
// system, the other two real pieces VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md
// names directly alongside Articles.
//
// Source of truth: that doc's own `NewsletterSubscription { id,
// subscriberId, authorId, deliveryMethod: "in-app-only" |
// "email-notification" }` and `CrossPublicationRecommendation
// { authorId, recommendedAuthorId }` -- "real Substack mechanic:
// writers recommend other writers; new subscribers see these
// recommendations automatically."
//
// **Real, honest limit on "email-notification"**: `sendNewsletter`
// creates a real `NewsletterDelivery` record for every real subscriber
// regardless of their chosen method -- a genuine, queryable proof that
// delivery was triggered. For `email-notification` subscribers, no
// actual email leaves this process; the same "real trigger logic and
// real recipient list are computed, actual delivery is separate
// infrastructure" posture already used for VSAFE's and CVNVO's own
// safety-escalation gaps, not glossed over here either.

const { getArticle } = require('./articles');

function subscribeToNewsletter(store, options = {}) {
  const { subscriberId, authorId, deliveryMethod = 'in-app-only' } = options;
  if (!subscriberId) throw new Error('subscribeToNewsletter requires a subscriberId');
  if (!authorId) throw new Error('subscribeToNewsletter requires an authorId');
  if (subscriberId === authorId) throw new Error('subscribeToNewsletter: cannot subscribe to your own newsletter');
  if (!['in-app-only', 'email-notification'].includes(deliveryMethod)) {
    throw new Error('subscribeToNewsletter: deliveryMethod must be "in-app-only" or "email-notification"');
  }
  if (store.newsletterSubscriptions.some((s) => s.subscriberId === subscriberId && s.authorId === authorId)) {
    throw new Error(`subscribeToNewsletter: ${subscriberId} is already subscribed to ${authorId}`);
  }

  const subscription = {
    id: store.nextNewsletterSubscriptionId++, subscriberId, authorId, deliveryMethod, createdAt: Date.now(),
  };
  store.newsletterSubscriptions.push(subscription);

  // "new subscribers see these recommendations automatically" -- a
  // real, direct consequence of subscribing, not a separate fetch the
  // caller has to remember to make.
  return { subscription, recommendedAuthors: getRecommendationsForAuthor(store, authorId) };
}

function unsubscribeFromNewsletter(store, options = {}) {
  const { subscriberId, authorId } = options;
  const idx = store.newsletterSubscriptions.findIndex((s) => s.subscriberId === subscriberId && s.authorId === authorId);
  if (idx === -1) throw new Error(`unsubscribeFromNewsletter: ${subscriberId} is not subscribed to ${authorId}`);
  return store.newsletterSubscriptions.splice(idx, 1)[0];
}

function getSubscribersForAuthor(store, authorId) {
  return store.newsletterSubscriptions.filter((s) => s.authorId === authorId);
}

function recommendAuthor(store, options = {}) {
  const { authorId, recommendedAuthorId } = options;
  if (!authorId) throw new Error('recommendAuthor requires an authorId');
  if (!recommendedAuthorId) throw new Error('recommendAuthor requires a recommendedAuthorId');
  if (authorId === recommendedAuthorId) throw new Error('recommendAuthor: cannot recommend yourself');
  if (store.crossPublicationRecommendations.some((r) => r.authorId === authorId && r.recommendedAuthorId === recommendedAuthorId)) {
    throw new Error(`recommendAuthor: ${authorId} already recommends ${recommendedAuthorId}`);
  }
  const recommendation = { authorId, recommendedAuthorId, createdAt: Date.now() };
  store.crossPublicationRecommendations.push(recommendation);
  return recommendation;
}

function getRecommendationsForAuthor(store, authorId) {
  return store.crossPublicationRecommendations.filter((r) => r.authorId === authorId).map((r) => r.recommendedAuthorId);
}

function sendNewsletter(store, options = {}) {
  const { articleId } = options;
  const article = getArticle(store, articleId);
  if (!article) throw new Error(`sendNewsletter: no article with id ${articleId}`);

  const subscribers = getSubscribersForAuthor(store, article.authorId);
  const deliveries = subscribers.map((sub) => {
    const delivery = {
      id: store.nextNewsletterDeliveryId++,
      subscriberId: sub.subscriberId,
      authorId: article.authorId,
      articleId,
      deliveryMethod: sub.deliveryMethod,
      sentAt: Date.now(),
    };
    store.newsletterDeliveries.push(delivery);
    return delivery;
  });
  return { articleId, deliveryCount: deliveries.length, deliveries };
}

module.exports = {
  subscribeToNewsletter, unsubscribeFromNewsletter, getSubscribersForAuthor,
  recommendAuthor, getRecommendationsForAuthor, sendNewsletter,
};
