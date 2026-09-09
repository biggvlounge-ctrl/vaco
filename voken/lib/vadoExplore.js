// VOKEN — VADO's own Explore page.
// Source of truth: VOKEN_MASTER_SPEC_PROGRESS.md confirms VADO gets its
// own dedicated feed, not a filtered view bolted onto VOKEN's general
// Explore page. Real code reuse continues: same attention-ranking
// pattern as `exploreVoken.js` (Phase 3's real engagement stats feeding
// Phase 1's real `computeDigitalEngagementScore()`), scoped to
// `category === 'art'` and enriched with VADO-specific gallery signals
// (`isForSale`, real gallery `viewCount`) that general Explore has no
// concept of.

const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore } = require('./valueAlgorithm');
const { getArtCultureCard } = require('./artCultureCard');

function getVadoExplorePage(store, options = {}) {
  const { now = Date.now() } = options;

  const surfaced = store.cultureCards
    .filter((card) => card.category === 'art')
    .map((card) => {
      const stats = computeEngagementStats(store, { cardId: card.id, now });
      const { digitalEngagementScore } = computeDigitalEngagementScore({
        views: stats.views, clicks: stats.clicks, comments: stats.comments, likes: stats.likes,
        engagementVelocity: stats.engagementVelocity,
      });
      const artRecord = getArtCultureCard(store, card.id);
      return {
        contentType: 'art-culture-card',
        contentId: card.id,
        attentionScore: digitalEngagementScore,
        isForSale: artRecord ? artRecord.isForSale : false,
        galleryViewCount: artRecord ? artRecord.viewCount : 0,
      };
    });

  surfaced.sort((a, b) => b.attentionScore - a.attentionScore);
  return surfaced;
}

module.exports = { getVadoExplorePage };
