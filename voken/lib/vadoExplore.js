// VOKEN — VADO's own Explore page.
// Source of truth: VOKEN_MASTER_SPEC_PROGRESS.md confirms VADO gets its
// own dedicated feed, not a filtered view bolted onto VOKEN's general
// Explore page. Real code reuse continues: same attention-ranking
// pattern as `exploreVoken.js` (Phase 3's real engagement stats feeding
// Phase 1's real `computeDigitalEngagementScore()`), scoped to
// `category === 'art'` and enriched with VADO-specific gallery signals
// (`isForSale`, real gallery `viewCount`) that general Explore has no
// concept of.
//
// **Instagram-Explore-style sections, by direct instruction**: "Bado
// [VADO] to have the same Instagram feel to it and explore page feel
// to it, similar to Culture Cards [the historic Explore page]." VADO
// has no subject-type taxonomy the way historic cards do (place/
// person/invention/book) -- what it does have, real and already
// tracked, is a piece's actual real market state: a real open auction
// (`lib/auctions.js`'s own `listOpenAuctions`), a real fixed-price
// gallery listing (`isForSale`), or neither (viewable in the gallery,
// not purchasable). Three real sections, not invented ones.

const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore } = require('./valueAlgorithm');
const { getArtCultureCard } = require('./artCultureCard');
const { listOpenAuctions } = require('./auctions');

const VADO_EXPLORE_SECTIONS = ['live-auction', 'for-sale', 'gallery'];

function getVadoExplorePage(store, options = {}) {
  const { now = Date.now() } = options;

  const cardIdsWithOpenAuction = new Set(listOpenAuctions(store).map((a) => a.cardId));

  const scored = store.cultureCards
    .filter((card) => card.category === 'art')
    .map((card) => {
      const stats = computeEngagementStats(store, { cardId: card.id, now });
      const { digitalEngagementScore } = computeDigitalEngagementScore({
        views: stats.views, clicks: stats.clicks, comments: stats.comments, likes: stats.likes, shares: stats.shares,
        engagementVelocity: stats.engagementVelocity,
      });
      const artRecord = getArtCultureCard(store, card.id);
      const isForSale = artRecord ? artRecord.isForSale : false;
      const section = cardIdsWithOpenAuction.has(card.id) ? 'live-auction' : (isForSale ? 'for-sale' : 'gallery');

      return {
        contentType: 'art-culture-card',
        contentId: card.id,
        section,
        attentionScore: digitalEngagementScore,
        isForSale,
        galleryViewCount: artRecord ? artRecord.viewCount : 0,
      };
    });

  const sections = VADO_EXPLORE_SECTIONS.map((section) => ({
    section,
    cards: scored.filter((c) => c.section === section).sort((a, b) => b.attentionScore - a.attentionScore),
  }));

  return { sections, totalCards: scored.length };
}

module.exports = { VADO_EXPLORE_SECTIONS, getVadoExplorePage };
