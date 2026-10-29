// VENVM -- AI Analytics' real half: a plain, generic event log (the
// same open-`eventType` shape `cardEngagement.js` uses in VOKEN for
// view/click/comment/like/share) plus real, deterministic aggregation
// over it. Tracking what happened, and summing/dividing real numbers
// about what happened, needs no model call.
//
// What genuinely needs one -- a model reading the real numbers below
// and writing out a plain-language insight or recommendation -- is
// `generateInsights`, this module's one real generative sliver,
// stubbed via `pendingIntegration.js`.

const { pendingGenerationCall } = require('./pendingIntegration');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function recordAnalyticsEvent(store, options = {}) {
  const { brandId, campaignId = null, contentId = null, eventType, now = Date.now() } = options;
  if (!Number.isFinite(brandId)) throw new Error('recordAnalyticsEvent requires a real brandId');
  requireString(eventType, 'eventType', 'recordAnalyticsEvent');

  const event = {
    id: store.nextMarketingAnalyticsEventId++,
    brandId,
    campaignId,
    contentId,
    eventType: eventType.trim(),
    recordedAt: now,
  };
  store.marketingAnalyticsEvents.push(event);
  return event;
}

// The real summary: a count per real `eventType` on file, filtered to
// whichever real scope (`brandId`, and optionally `campaignId`) a
// caller asks about, plus one real, commonly-wanted ratio
// (clickThroughRate = clicks / views) -- honestly `null` when there
// are no real views to divide by.
function analyticsSummary(store, options = {}) {
  const { brandId, campaignId = null } = options;
  if (!Number.isFinite(brandId)) throw new Error('analyticsSummary requires a real brandId');

  const scoped = store.marketingAnalyticsEvents.filter(
    (e) => e.brandId === brandId && (campaignId === null || e.campaignId === campaignId),
  );
  const byEventType = {};
  for (const e of scoped) {
    byEventType[e.eventType] = (byEventType[e.eventType] || 0) + 1;
  }
  const views = byEventType.view || 0;
  const clicks = byEventType.click || 0;
  return {
    brandId,
    campaignId,
    totalEvents: scoped.length,
    byEventType,
    clickThroughRate: views > 0 ? Math.round((clicks / views) * 10000) / 10000 : null,
  };
}

function generateInsights() {
  return pendingGenerationCall('AI analytics insight generation');
}

module.exports = { recordAnalyticsEvent, analyticsSummary, generateInsights };
