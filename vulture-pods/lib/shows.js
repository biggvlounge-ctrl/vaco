// Vvltvre Pods -- Shows, the real grouping entity neither
// `vulture-music` nor any other project in this ecosystem has: a
// `podcast-episode` release there is a standalone item, same as a
// single or an album, with no concept of a running series. A real
// Show is exactly that missing grouping -- multiple Episodes under
// one creator, one title, one optional subscription tier.
//
// `subscriptionTiers`, if given, are this show's own real, creator-set
// optional subscription tiers -- the real Spotify "Fans"/Patreon
// pattern of creator-level, per-show subscriptions, genuinely
// different from Vvltvre Flix's mandatory, platform-wide subscription.
// An empty array (the default) means this show has no paid tier at
// all -- the real, most common case, since most real podcasts are
// entirely free/ad-supported.
//
// Real, named comparable for multiple tiers specifically: both
// Spotify's own real "Fans" subscriptions and Patreon's own real
// product let one creator offer more than one price point on the same
// show/page (e.g. a cheap "Supporter" tier and a pricier "Superfan"
// tier with more perks) -- closes this project's own previously-
// flagged gap ("one real tier per show is modeled").

const SHOW_CATEGORIES = [
  'news', 'comedy', 'true-crime', 'business', 'technology', 'sports', 'culture', 'education', 'fiction', 'other',
];

function createShow(store, options = {}) {
  const {
    creatorId, title, description, category, subscriptionTiers = [],
  } = options;

  if (!creatorId) throw new Error('createShow requires a creatorId');
  if (!title) throw new Error('createShow requires a title');
  if (!description) throw new Error('createShow requires a description');
  if (!SHOW_CATEGORIES.includes(category)) {
    throw new Error(`createShow requires a category of ${SHOW_CATEGORIES.join(', ')}`);
  }
  if (!Array.isArray(subscriptionTiers)) {
    throw new Error('createShow: subscriptionTiers must be an array');
  }
  const validatedTiers = subscriptionTiers.map((tier, index) => {
    if (!tier || !tier.name) throw new Error(`createShow: subscriptionTiers[${index}] requires a name`);
    if (typeof tier.priceVCoin !== 'number' || tier.priceVCoin <= 0) {
      throw new Error(`createShow: subscriptionTiers[${index}] requires a positive priceVCoin`);
    }
    return { id: index + 1, name: tier.name, priceVCoin: tier.priceVCoin };
  });

  const show = {
    id: store.nextShowId++,
    creatorId,
    title,
    description,
    category,
    subscriptionTiers: validatedTiers,
    createdAt: Date.now(),
  };
  store.shows.push(show);
  return show;
}

function getShow(store, showId) {
  return store.shows.find((s) => s.id === showId) || null;
}

function getSubscriptionTier(show, tierId) {
  return show.subscriptionTiers.find((t) => t.id === tierId) || null;
}

function listShowsForCreator(store, creatorId) {
  return store.shows.filter((s) => s.creatorId === creatorId).sort((a, b) => b.createdAt - a.createdAt);
}

function listShowsByCategory(store, category) {
  return store.shows.filter((s) => s.category === category);
}

module.exports = {
  SHOW_CATEGORIES,
  createShow,
  getShow,
  getSubscriptionTier,
  listShowsForCreator,
  listShowsByCategory,
};
