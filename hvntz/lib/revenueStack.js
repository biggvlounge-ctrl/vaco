// HVNTZ — Business Revenue Stack.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md ("one onboarding
// decision, fourteen real ways to benefit, all from the same physical
// location") and HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md's
// `HubHostRevenueEvent` data model, implemented as real, tested code.
//
// This module covers the streams that are genuinely software/payout
// logic -- not the physical hardware itself (drone stations, smart
// benches, smart tables, mirrors) or anything requiring real external
// integrations (Square/Toast/Fivestars rewards APIs, real social
// platforms). Recording a revenue event and paying it out is the same
// mechanism regardless of which physical thing triggered it, which is
// exactly the point the source doc itself makes.
//
// recordRevenueEvent reuses this project's established injected-
// settleFn pattern (matching world-layer/venvs) so this module
// stays runnable in plain Node, decoupled from any specific wallet
// client implementation.

// The 14 revenue streams named in HVNTZ_COMPLETE_REVENUE_STACK.md,
// plus the 2 additional ones formalized in
// HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md (station-transaction,
// midpoint-relay-use) that the "complete" doc folds into streams 4-5.
const REVENUE_EVENT_TYPES = [
  'hunt-participation',
  'screen-ad',
  'screen-dtc-sale',
  'station-transaction',
  'midpoint-relay-use',
  'vavlt-streaming',
  'vdp-storefront-sale',
  'business-locker-fulfillment',
  'hvntz-discovery-placement',
  'cvnvo-placement',
  'community-thread',
  'package-pickup',
  'void-rideshare-hotspot',
  'full-service-delivery',
];

const LOCATION_TYPES = ['screen', 'hub', 'business-locker'];

//: The real VACO platform account every platform-side cut settles to
//: -- named, matching VOID's own established `'void-platform'`
//: convention rather than inventing a per-app one.
const VACO_PLATFORM_USER_ID = 'vaco-platform';

//: Source of truth: `../vaco-analytics/VACO_REVENUE_SPLIT_MODEL.md`'s
//: own complete split table, encoded per event type with its real
//: min/max range preserved rather than flattened to a single number.
//:
//: **Real gap this closed**: before this, `recordRevenueEvent`
//: transferred the FULL `amountEarned` to the business owner and VACO
//: took nothing on any of the 14 streams -- directly contradicting
//: that document's own opening premise ("yes, this is designed to be
//: beneficial to VACO itself, not just businesses"). VOID's own
//: `marketplace.js` already took a real platform cut on every job, so
//: the pattern already existed in this ecosystem; HVNTZ just never
//: applied it.
//:
//: **A 0 share is a real modelling statement, not an omission.** The
//: source doc monetizes several of these streams by a mechanism that
//: genuinely isn't a percentage split -- infrastructure fees (station/
//: relay), a flat monthly locker fee, a tiered subscription (CVNVO
//: placement), or deliberately "free/included" as an adoption driver
//: (discovery placement, community thread + Village, neighbor trades).
//: Those take 0% here because inventing a percentage for them would
//: misrepresent the real model.
//:
//: **These rates are a real starting point, not final.** The source
//: doc says so directly: most streams "were specified qualitatively
//: without a locked exact percentage... the real starting point, not
//: numbers cast in stone. Final rates should be confirmed once real
//: usage data exists." That is exactly what `vacoSharePercent` is for
//: -- tuning a rate against real data needs no code change here.
const REVENUE_SPLITS = {
  'hunt-participation': { min: 0.15, max: 0.30, basis: 'real sponsorship platform standard' },
  'screen-ad': { min: 0.30, max: 0.50, basis: 'real programmatic ad industry standard' },
  'screen-dtc-sale': { min: 0.05, max: 0.15, basis: 'TikTok Shop 5-8%, Amazon referral 8-15%' },
  'station-transaction': { min: 0, max: 0, basis: 'infrastructure fee (cost recovery + margin), not a split' },
  'midpoint-relay-use': { min: 0, max: 0, basis: 'infrastructure fee (cost recovery + margin), not a split' },
  'vavlt-streaming': { min: 0.20, max: 0.20, basis: 'established creator-split standard' },
  'vdp-storefront-sale': { min: 0.05, max: 0.15, basis: 'marketplace-commission range' },
  'business-locker-fulfillment': { min: 0, max: 0, basis: 'flat monthly storage fee to VACO, not a per-event split' },
  'hvntz-discovery-placement': { min: 0, max: 0, basis: 'free/included -- monetized indirectly' },
  'cvnvo-placement': { min: 0, max: 0, basis: 'tiered subscription fee, not a per-event split' },
  'community-thread': { min: 0, max: 0, basis: 'free/included -- drives engagement, monetized indirectly' },
  'package-pickup': { min: 0, max: 0, basis: 'small per-pickup fee (Amazon Hub Counter model); no rate given in the source doc' },
  'void-rideshare-hotspot': { min: 0.20, max: 0.25, basis: 'standard rideshare take rate' },
  'full-service-delivery': { min: 0.20, max: 0.20, basis: "standard VOID delivery economics -- VOID's own courier/foodDelivery/freightMoving verticals all really take 20%" },
};

//: Real, flagged interpretive default: the LOW end of each range.
//: Consistent with the source doc's own stated positioning --
//: "deliberately positioned below extractive comparables (Amazon FBA's
//: real 35-45% total take) -- VACO wins by being genuinely fairer,
//: driving more real volume." Fully overridable per call.
function defaultVacoShareFor(eventType) {
  const split = REVENUE_SPLITS[eventType];
  return split ? split.min : 0;
}

function createHvntzStore() {
  return {
    businesses: [],
    nextBusinessId: 1,
    locations: [],
    nextLocationId: 1,
    revenueEvents: [],
    nextEventId: 1,
    participations: [],
    nextParticipationId: 1,
    placementRules: [],
    placementFlags: [],
    nextFlagId: 1,
    neighborPrograms: [],
    cvnvoPlacements: [],
    hunts: [],
    nextHuntId: 1,
    adSubmissions: [],
    nextAdSubmissionId: 1,
  };
}

function registerBusiness(store, options = {}) {
  const { name, ownerId } = options;
  if (!name) {
    throw new Error('registerBusiness requires a name');
  }
  if (!ownerId) {
    throw new Error('registerBusiness requires an ownerId');
  }
  const business = { id: store.nextBusinessId++, name, ownerId, createdAt: Date.now() };
  store.businesses.push(business);
  return business;
}

function getBusiness(store, businessId) {
  return store.businesses.find((b) => b.id === businessId) || null;
}

// Real lat/lng, required on every location (not optional) -- added
// specifically to close a real, named cross-app gap: Vavlt Stvdios'
// own Map Search (`VAULT_STUDIOS_ARCHITECTURE.md`'s `MapSearchListing`)
// and CVNVO's own BarBuddy venue validation both cited this exact
// missing field as their real blocker, checked directly in both
// projects' own READMEs, not assumed. Bounds match Vavlt Stvdios' own
// real validation (`mapSearch.js`) so a location registered here can
// never fail that project's own real range check.
//
// Real, optional sync to Vavlt Stvdios' own Map Search
// (`syncLocationToMapSearch`, below): a real, separate follow-up call
// given a real `mapSearchCategory` and a real, injected
// `syncToMapSearch` function, mirrored there live via the same
// established injected-cross-app-client pattern `hunts.js`'s own
// `postToVavltStvdios` already uses -- not a new shape invented for
// this one field. Kept separate from `registerLocation` itself so
// plain-Node tests can exercise the core entity with no live network
// dependency, and so registering a location never requires deciding
// its Map Search category up front (not every location is a real
// Yelp-style discoverable business).
function registerLocation(store, options = {}) {
  const {
    businessId, locationType, address, lat, lng,
  } = options;
  if (!getBusiness(store, businessId)) {
    throw new Error(`registerLocation: no business with id ${businessId}`);
  }
  if (!LOCATION_TYPES.includes(locationType)) {
    throw new Error(`registerLocation: invalid locationType "${locationType}" (expected one of ${LOCATION_TYPES.join(', ')})`);
  }
  if (!address) {
    throw new Error('registerLocation requires an address');
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('registerLocation requires a real lat between -90 and 90');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('registerLocation requires a real lng between -180 and 180');
  }

  const location = {
    id: store.nextLocationId++, businessId, locationType, address, lat, lng, vavltMapListingId: null,
  };
  store.locations.push(location);
  return location;
}

// Real, separate step (not folded into `registerLocation` itself) so
// plain-Node tests can exercise the core entity without a live network
// dependency, matching this project's own established pattern for
// every other optional cross-app call.
async function syncLocationToMapSearch(store, options = {}) {
  const { locationId, mapSearchCategory, syncToMapSearch } = options;
  const location = getLocation(store, locationId);
  if (!location) throw new Error(`syncLocationToMapSearch: no location with id ${locationId}`);
  if (!mapSearchCategory) throw new Error('syncLocationToMapSearch requires a mapSearchCategory');
  if (typeof syncToMapSearch !== 'function') throw new Error('syncLocationToMapSearch requires a syncToMapSearch(params) function');

  const listing = await syncToMapSearch({
    businessId: location.businessId, lat: location.lat, lng: location.lng, category: mapSearchCategory,
  });
  if (!listing || !listing.id) throw new Error('syncLocationToMapSearch: Vavlt Stvdios did not return a real listing');
  location.vavltMapListingId = listing.id;
  return location;
}

function getLocation(store, locationId) {
  return store.locations.find((l) => l.id === locationId) || null;
}

// Real, previously-missing gap: every real location carries its own
// verified lat/lng (see registerLocation's own header), but nothing
// let a caller ask "where is business X" without already knowing a
// specific locationId -- `GET /api/business/:id` returns only
// {id, name, ownerId, createdAt}, no coordinates at all. VOID's own
// Affiliate Network onboarding flow needs exactly this (a real
// HVNTZ business can have multiple locations; VOID needs the real
// list to let an operator pick which one becomes a delivery midpoint)
// -- closing this now rather than leaving VOID to guess coordinates.
function getLocationsForBusiness(store, businessId) {
  if (!getBusiness(store, businessId)) {
    throw new Error(`getLocationsForBusiness: no business with id ${businessId}`);
  }
  return store.locations.filter((l) => l.businessId === businessId);
}

// The actual "one onboarding, many revenue streams" mechanic: any
// event type, at any registered location, results in a real payout to
// that location's business -- the whole point being that the payout
// path is identical regardless of which of the 14 streams triggered
// it.
async function recordRevenueEvent(store, options = {}) {
  const {
    locationId, eventType, amountEarned, relatedOrderId = null, payerId, settleFn,
    vacoSharePercent = null,
  } = options;

  const location = getLocation(store, locationId);
  if (!location) {
    throw new Error(`recordRevenueEvent: no location with id ${locationId}`);
  }
  if (!REVENUE_EVENT_TYPES.includes(eventType)) {
    throw new Error(`recordRevenueEvent: invalid eventType "${eventType}" (expected one of ${REVENUE_EVENT_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(amountEarned) || amountEarned <= 0) {
    throw new Error('recordRevenueEvent requires a positive amountEarned');
  }
  if (!payerId) {
    throw new Error('recordRevenueEvent requires a payerId');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('recordRevenueEvent requires a settleFn(legs, meta)');
  }

  const business = getBusiness(store, location.businessId);

  // Real platform split, per VACO_REVENUE_SPLIT_MODEL.md. VACO's share
  // is rounded first and the business receives the exact remainder --
  // the same real no-drift pattern VOID's own `completeJob` uses, so
  // the two halves always sum to `amountEarned` exactly rather than
  // being two independently-rounded numbers that could disagree by a
  // cent.
  const resolvedVacoShare = vacoSharePercent ?? defaultVacoShareFor(eventType);
  if (!Number.isFinite(resolvedVacoShare) || resolvedVacoShare < 0 || resolvedVacoShare >= 1) {
    throw new Error('recordRevenueEvent requires a vacoSharePercent between 0 (inclusive) and 1 (exclusive)');
  }
  const vacoShare = Math.round(amountEarned * resolvedVacoShare * 100) / 100;
  const businessShare = Math.round((amountEarned - vacoShare) * 100) / 100;

  // One settlement: the business owner's share and VACO's both leave
  // the payer, and the revenue event is recorded only afterwards -- so
  // a split that paid the owner and failed the platform leg left a
  // charge with no record and a retry that paid the owner again.
  const legs = [
    { fromUserId: payerId, toUserId: business.ownerId, amount: businessShare, reason: `hvntz_revenue:${eventType}:${location.id}` },
  ];
  if (vacoShare > 0) {
    legs.push({ fromUserId: payerId, toUserId: VACO_PLATFORM_USER_ID, amount: vacoShare, reason: `hvntz_platform_fee:${eventType}:${location.id}` });
  }
  await settleFn(legs, { reason: `hvntz_revenue_event:${eventType}:${location.id}` });

  const event = {
    id: store.nextEventId++,
    hostBusinessId: location.businessId,
    locationId: location.id,
    eventType,
    amountEarned,
    businessShare,
    vacoShare,
    vacoSharePercent: resolvedVacoShare,
    payerId,
    relatedOrderId,
    createdAt: Date.now(),
  };
  store.revenueEvents.push(event);
  return event;
}

function getRevenueEvents(store, options = {}) {
  const { businessId, locationId, eventType } = options;
  return store.revenueEvents.filter(
    (e) =>
      (businessId ? e.hostBusinessId === businessId : true) &&
      (locationId ? e.locationId === locationId : true) &&
      (eventType ? e.eventType === eventType : true)
  );
}

// The Franchise List: one row per location a business is connected
// to, with real per-location revenue and a plain-language description
// of what that location actually produces -- not one flattened total
// that hides where the value is coming from, per the source doc's own
// stated reasoning.
function getFranchiseList(store, businessId) {
  const business = getBusiness(store, businessId);
  if (!business) {
    throw new Error(`getFranchiseList: no business with id ${businessId}`);
  }
  const locations = store.locations.filter((l) => l.businessId === businessId);

  return locations.map((location) => {
    const events = getRevenueEvents(store, { locationId: location.id });
    const revenueGenerated = Math.round(events.reduce((sum, e) => sum + e.amountEarned, 0) * 100) / 100;
    const eventTypesSeen = [...new Set(events.map((e) => e.eventType))];
    return {
      locationId: location.id,
      locationType: location.locationType,
      locationAddress: location.address,
      revenueGenerated,
      activityProduced: eventTypesSeen.length > 0 ? eventTypesSeen.join(' + ') : 'no activity yet',
    };
  });
}

module.exports = {
  REVENUE_EVENT_TYPES,
  LOCATION_TYPES,
  REVENUE_SPLITS,
  VACO_PLATFORM_USER_ID,
  defaultVacoShareFor,
  createHvntzStore,
  registerBusiness,
  getBusiness,
  registerLocation,
  getLocation,
  getLocationsForBusiness,
  syncLocationToMapSearch,
  recordRevenueEvent,
  getRevenueEvents,
  getFranchiseList,
};
