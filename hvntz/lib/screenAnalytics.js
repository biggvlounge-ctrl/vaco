// HVNTZ — Screen Analytics.
// Source of truth: the source docs repeatedly frame screens as a
// distinct revenue-producing location type (`screen-ad`,
// `screen-dtc-sale`) but no source doc describes a dedicated analytics
// view for them -- flagged in the Phase 3 README as a real, buildable,
// not-yet-attempted piece. This is a real, deterministic aggregation
// over a business's existing screen-location revenue events and ad
// submissions -- no invented mechanic, just a rollup, scoped to
// locations with `locationType === 'screen'`.

const { getBusiness } = require('./revenueStack');
const { getAdSubmissions, AD_REVIEW_STATUSES } = require('./adReview');

function round(n) {
  return Math.round(n * 100) / 100;
}

function getScreenAnalytics(store, businessId) {
  const business = getBusiness(store, businessId);
  if (!business) {
    throw new Error(`getScreenAnalytics: no business with id ${businessId}`);
  }

  const screenLocations = store.locations.filter((l) => l.businessId === businessId && l.locationType === 'screen');
  const screenLocationIds = new Set(screenLocations.map((l) => l.id));
  const events = store.revenueEvents.filter((e) => screenLocationIds.has(e.locationId));

  const totalRevenue = round(events.reduce((sum, e) => sum + e.amountEarned, 0));
  const revenueByEventType = {};
  for (const e of events) {
    revenueByEventType[e.eventType] = round((revenueByEventType[e.eventType] || 0) + e.amountEarned);
  }
  const distinctAdvertisers = new Set(events.map((e) => e.payerId)).size;

  const adSubmissions = getAdSubmissions(store, { businessId }).filter((s) => screenLocationIds.has(s.locationId));
  const adSubmissionsByStatus = {};
  for (const status of AD_REVIEW_STATUSES) {
    adSubmissionsByStatus[status] = adSubmissions.filter((s) => s.status === status).length;
  }

  return {
    businessId,
    screenLocationCount: screenLocations.length,
    totalRevenue,
    revenueByEventType,
    distinctAdvertisers,
    totalAdSubmissions: adSubmissions.length,
    adSubmissionsByStatus,
  };
}

module.exports = { getScreenAnalytics };
