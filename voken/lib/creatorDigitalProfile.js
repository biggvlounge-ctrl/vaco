// VOKEN — Creator Digital Profile.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: "a creator's profile
// should aggregate the real digital engagement across every card tied
// to them into one visible, ongoing score -- not just a follower
// count, a genuine measure of how much real attention their actual
// work is generating right now."
//
// "Tied to them" read literally as `subjectPersonId` -- the cards a
// creator is actually the subject of. Aggregated as a real **average**
// across their cards, not a raw sum -- a sum would let someone with
// many mediocre cards outrank someone with one genuinely popular one,
// which isn't a fair measure of real per-work attention. Flagged,
// interpretive choice; no exact aggregation formula is given anywhere.

const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore } = require('./valueAlgorithm');

const RISING_VELOCITY_THRESHOLD = 5; // flagged: events/minute, interpretive

function computeCreatorDigitalProfile(store, options = {}) {
  const { creatorId, now = Date.now() } = options;
  if (!creatorId) throw new Error('computeCreatorDigitalProfile requires a creatorId');

  const theirCards = store.cultureCards.filter((c) => c.subjectPersonId === creatorId);
  if (theirCards.length === 0) {
    return { creatorId, aggregatedEngagementScore: 0, cardCount: 0, risingIndicator: false };
  }

  let scoreSum = 0;
  let velocitySum = 0;
  for (const card of theirCards) {
    const stats = computeEngagementStats(store, { cardId: card.id, now });
    const { digitalEngagementScore } = computeDigitalEngagementScore({
      views: stats.views, clicks: stats.clicks, comments: stats.comments, likes: stats.likes,
      engagementVelocity: stats.engagementVelocity,
    });
    scoreSum += digitalEngagementScore;
    velocitySum += stats.engagementVelocity;
  }

  const aggregatedEngagementScore = Math.round((scoreSum / theirCards.length) * 100) / 100;
  const averageVelocity = velocitySum / theirCards.length;

  return {
    creatorId,
    aggregatedEngagementScore,
    cardCount: theirCards.length,
    risingIndicator: averageVelocity > RISING_VELOCITY_THRESHOLD,
  };
}

module.exports = { RISING_VELOCITY_THRESHOLD, computeCreatorDigitalProfile };
