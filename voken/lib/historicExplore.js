// VOKEN — the Historic Explore Page.
// By direct instruction: an Instagram-Explore-style browsing surface
// specifically for historic Cvltvre Cards, grouped into sections by
// `historicSubjectType` (place/monument/home/person/invention/book) —
// the grid-of-sections pattern Instagram's own Explore page uses,
// rather than one flat, undifferentiated feed.
//
// **Reuses, rather than reinvents, two real signals that already
// exist**:
//   - `attentionScore` is `getVokenExplorePage`'s own real,
//     live-engagement ranking signal (`computeDigitalEngagementScore`,
//     Phase 1) — the same "rank real content by a real computed
//     score" pattern this app already established, scoped per section
//     here instead of across every category at once.
//   - `genuineSignificanceScore` is computed synchronously, straight
//     from the historic register via `genuineSignificanceInputsFor()`
//     — no VACA round-trip, no authenticity grade involved, because
//     significance for a historic card is a fact about history, not
//     about any one minted card's condition. This is the real,
//     concrete answer to "how do people see what it's worth": two
//     real numbers shown side by side on every card in the feed,
//     rather than one blended figure a viewer can't take apart. The
//     *full* `combinedRealValueScore` (which does need the live VACA
//     grade) stays its own deliberate, single-card action through the
//     existing `POST /api/card/:id/value-score` route — the same
//     "quote first, then act" shape `sell-back-quote` already has.
//
// Sorting and section order are both real and deterministic:
// sections follow `HISTORIC_SUBJECT_TYPES`' own fixed order, and cards
// within a section rank by `attentionScore` -- a tie keeps the real,
// stable insertion order from `store.cultureCards` rather than
// reshuffling arbitrarily on every call.

const { computeEngagementStats } = require('./cardEngagement');
const { computeDigitalEngagementScore, computeGenuineSignificanceScore } = require('./valueAlgorithm');
const { HISTORIC_SUBJECT_TYPES, genuineSignificanceInputsFor } = require('./historicRegistry');

function getHistoricExplorePage(store, options = {}) {
  const { now = Date.now() } = options;

  const historicCards = store.cultureCards.filter((c) => c.category === 'historic' && c.historicSlug);

  const scored = historicCards.map((card) => {
    const stats = computeEngagementStats(store, { cardId: card.id, now });
    const { digitalEngagementScore: attentionScore } = computeDigitalEngagementScore({
      views: stats.views, clicks: stats.clicks, comments: stats.comments, likes: stats.likes, shares: stats.shares,
      engagementVelocity: stats.engagementVelocity,
    });
    const { genuineSignificanceScore } = computeGenuineSignificanceScore(
      genuineSignificanceInputsFor(card.historicSlug, { now }),
    );

    return {
      contentType: 'culture-card',
      contentId: card.id,
      historicSubjectType: card.historicSubjectType,
      historicSlug: card.historicSlug,
      historicFact: card.historicFact,
      attentionScore,
      genuineSignificanceScore,
    };
  });

  const sections = HISTORIC_SUBJECT_TYPES.map((subjectType) => {
    const cards = scored
      .filter((c) => c.historicSubjectType === subjectType)
      .sort((a, b) => b.attentionScore - a.attentionScore);
    return { subjectType, cards };
  });

  return { sections, totalCards: scored.length };
}

module.exports = { getHistoricExplorePage };
