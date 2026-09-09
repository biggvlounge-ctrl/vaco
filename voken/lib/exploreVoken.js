// VOKEN — the Explore Page.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: "the Explore page's
// existing location-and-attention-based ranking already established
// for HVNTZ generalizes directly here -- Cvltvre Cards and creator
// profiles surface based on real, live engagement signals, the same
// 'attention-based' ranking logic already proven, applied to
// collectibles specifically."
//
// What actually generalizes is the *pattern* -- rank real content by
// a real computed score into one sorted feed -- not HVNTZ's location
// half specifically, since Cvltvre Cards (unlike HVNTZ's physical
// hunt checkpoints) aren't tied to real-world coordinates. This is a
// deliberate, flagged reading: VOKEN's Explore reuses
// `valueAlgorithm.js`'s own `computeDigitalEngagementScore()` (Phase
// 1) as the real, live "attention" ranking signal -- genuine code
// reuse across two of this project's own phases, not a rebuilt
// formula.

const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore } = require('./valueAlgorithm');

function getVokenExplorePage(store, options = {}) {
  const { now = Date.now() } = options;

  const surfaced = store.cultureCards.map((card) => {
    const stats = computeEngagementStats(store, { cardId: card.id, now });
    const { digitalEngagementScore } = computeDigitalEngagementScore({
      views: stats.views, clicks: stats.clicks, comments: stats.comments, likes: stats.likes,
      engagementVelocity: stats.engagementVelocity,
    });
    return { contentType: 'culture-card', contentId: card.id, category: card.category, attentionScore: digitalEngagementScore };
  });

  surfaced.sort((a, b) => b.attentionScore - a.attentionScore);
  return surfaced;
}

module.exports = { getVokenExplorePage };
