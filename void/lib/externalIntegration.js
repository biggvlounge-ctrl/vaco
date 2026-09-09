// VOID — VOID Direct (external business delivery API) + Affiliate
// Network.
// Source of truth: VOID_MASTER_FREEZE.md's "EXTERNAL BUSINESS
// INTEGRATION" section (real comparable: DoorDash Drive / Uber
// Direct -- a white-label delivery API any outside business can call)
// and "AFFILIATE NETWORK REFINEMENT" (real Affiliate Network roles --
// pickup, dropoff, locker-host, relay, verification, drone-support --
// with the refinement to preferentially recruit already-onboarded
// HVNTZ businesses first).
//
// submitDeliveryManifest() is real code reuse, not a stub: it creates
// an actual courier job through Phase 3's marketplace loop
// (`requestJob` with the `courier` vertical), proving VOID Direct is
// really wired to the same real dispatch/payout mechanism regular
// VOID users go through, not a separate parallel system.

const crypto = require('crypto');
const { requestJob } = require('./marketplace');

const AFFILIATE_ROLES = ['pickup', 'dropoff', 'locker-host', 'relay', 'verification', 'drone-support'];

function registerExternalBusiness(store, options = {}) {
  const { businessName } = options;
  if (!businessName) {
    throw new Error('registerExternalBusiness requires a businessName');
  }
  const apiKey = crypto.randomBytes(16).toString('hex');
  const business = { id: store.nextExternalBusinessId++, businessName, apiKey, createdAt: Date.now() };
  store.externalBusinesses.push(business);
  return business;
}

function getExternalBusinessByApiKey(store, apiKey) {
  return store.externalBusinesses.find((b) => b.apiKey === apiKey) || null;
}

// The real mechanic: a business submits a delivery manifest via API,
// and it becomes an actual courier job in VOID's own real dispatch
// loop -- the same "call the shared service, don't rebuild it"
// principle this whole session's ecosystem already uses for V3/V4/
// DREAMS, now applied to external businesses calling into VOID.
function submitDeliveryManifest(store, options = {}) {
  const { apiKey, pickupLocation, dropoffLocation, packageDescription, deliveryFee } = options;

  const business = getExternalBusinessByApiKey(store, apiKey);
  if (!business) {
    throw new Error('submitDeliveryManifest: invalid apiKey');
  }
  if (!pickupLocation) throw new Error('submitDeliveryManifest requires a pickupLocation');
  if (!dropoffLocation) throw new Error('submitDeliveryManifest requires a dropoffLocation');
  if (!packageDescription) throw new Error('submitDeliveryManifest requires a packageDescription');
  if (!Number.isFinite(deliveryFee) || deliveryFee <= 0) {
    throw new Error('submitDeliveryManifest requires a positive deliveryFee');
  }

  const job = requestJob(store, {
    verticalId: 'courier',
    customerId: `external-business:${business.id}`,
    quantity: 1,
    unitPrice: deliveryFee,
  });

  const manifest = {
    id: store.nextManifestId++,
    externalBusinessId: business.id,
    pickupLocation,
    dropoffLocation,
    packageDescription,
    jobId: job.id,
    createdAt: Date.now(),
  };
  store.deliveryManifests.push(manifest);
  return manifest;
}

function getManifestStatus(store, manifestId) {
  const manifest = store.deliveryManifests.find((m) => m.id === manifestId);
  if (!manifest) {
    throw new Error(`getManifestStatus: no manifest with id ${manifestId}`);
  }
  const job = store.jobs.find((j) => j.id === manifest.jobId);
  return { manifest, jobStatus: job ? job.status : null };
}

// Affiliate Network: real roles per the doc's own list, with the
// refinement to preferentially recruit already-onboarded HVNTZ
// businesses -- now a real, live cross-service HVNTZ lookup, closing
// the gap this file's own header once flagged as caller-declared.
// HVNTZ gained a real `GET /api/business/:id` lookup route in this
// same session (see `hvntz/README.md`'s own Phase 6 entry); a real,
// optional `hvntzBusinessId` + injected `hvntzFetchFn` replaces the
// old bare `isHvntzOnboarded` boolean entirely -- there's no
// legitimate case for an affiliate station claiming HVNTZ-onboarded
// status without a real business id to prove it, unlike CVNVO's
// BarBuddy (where a synthetic, non-HVNTZ venueId is a real, separate
// use case that still needs to work unverified). Omitting
// `hvntzBusinessId` here just means `isHvntzOnboarded: false` --
// honest by default, never a trusted claim.
//
// **Real bug fixed here (MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_
// INVENTORY.md)**: `stationId` used to be mandatory, which silently
// contradicted the doc's own real, stated purpose -- "an HVNTZ
// business can opt in as a real midpoint -- not just a VOID Hub, but
// any qualified HVNTZ location -- expanding real physical coverage
// without VOID needing to own or lease every node." A mandatory
// `stationId` meant VOID had to already own a station at a location
// before an HVNTZ business there could ever become an affiliate --
// the exact opposite of "without VOID needing to own... every node."
// `stationId` is now optional; an affiliate with no `stationId` must
// instead carry real coordinates, either a caller-supplied `lat`/`lng`
// (self-reported -- honest, unverified) or -- when `hvntzBusinessId`
// is given together with a real `hvntzLocationId` and an injected
// `hvntzLocationFetchFn` -- the real, verified coordinates from
// HVNTZ's own `Location` record (see `hvntz/lib/revenueStack.js`'s
// `getLocationsForBusiness`, added the same session as this fix).
// Verified HVNTZ coordinates always win over self-reported ones when
// both are present -- the same "real, verified data over a caller's
// own claim" posture `isHvntzOnboarded` already used.
async function registerAffiliateStation(store, options = {}) {
  const {
    stationId = null, businessId, role, lat = null, lng = null, regionId = null,
    hvntzBusinessId = null, hvntzLocationId = null, hvntzFetchFn, hvntzLocationFetchFn,
  } = options;
  if (!businessId) throw new Error('registerAffiliateStation requires a businessId');
  if (!AFFILIATE_ROLES.includes(role)) {
    throw new Error(`registerAffiliateStation: invalid role "${role}" (expected one of ${AFFILIATE_ROLES.join(', ')})`);
  }

  let isHvntzOnboarded = false;
  let hvntzBusinessName = null;
  if (hvntzBusinessId != null) {
    if (typeof hvntzFetchFn !== 'function') throw new Error('registerAffiliateStation: hvntzBusinessId requires an hvntzFetchFn(hvntzBusinessId)');
    const business = await hvntzFetchFn(hvntzBusinessId);
    if (!business) throw new Error(`registerAffiliateStation: HVNTZ has no real business with id ${hvntzBusinessId}`);
    isHvntzOnboarded = true;
    hvntzBusinessName = business.name;
  }

  let resolvedLat = lat;
  let resolvedLng = lng;
  let coordinatesVerified = false;
  if (hvntzBusinessId != null && hvntzLocationId != null) {
    if (typeof hvntzLocationFetchFn !== 'function') {
      throw new Error('registerAffiliateStation: hvntzLocationId requires an hvntzLocationFetchFn(hvntzBusinessId)');
    }
    const locations = await hvntzLocationFetchFn(hvntzBusinessId);
    const location = (locations || []).find((l) => l.id === hvntzLocationId);
    if (!location) {
      throw new Error(`registerAffiliateStation: HVNTZ business ${hvntzBusinessId} has no real location with id ${hvntzLocationId}`);
    }
    // Real, verified coordinates always win over anything self-reported.
    resolvedLat = location.lat;
    resolvedLng = location.lng;
    coordinatesVerified = true;
  }

  if (!stationId && (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng))) {
    throw new Error(
      'registerAffiliateStation: an affiliate with no stationId requires real coordinates -- either lat/lng directly, or hvntzBusinessId + hvntzLocationId to pull them from a real, verified HVNTZ location'
    );
  }
  if (!stationId && !regionId) {
    throw new Error('registerAffiliateStation: an affiliate with no stationId requires a regionId (real stations already carry one; a standalone HVNTZ midpoint has no other source for it)');
  }

  const affiliate = {
    id: store.nextAffiliateStationId++,
    stationId,
    businessId,
    role,
    regionId: stationId ? null : regionId,
    lat: resolvedLat,
    lng: resolvedLng,
    coordinatesVerified,
    isHvntzOnboarded,
    hvntzBusinessId,
    hvntzBusinessName,
    hvntzLocationId,
    registeredAt: Date.now(),
  };
  store.affiliateStations.push(affiliate);
  return affiliate;
}

// HVNTZ-onboarded affiliates surfaced first, per the doc's own
// recruitment-priority refinement.
function listAffiliateStations(store, options = {}) {
  const { role } = options;
  const filtered = store.affiliateStations.filter((a) => (role ? a.role === role : true));
  return [...filtered].sort((a, b) => Number(b.isHvntzOnboarded) - Number(a.isHvntzOnboarded));
}

module.exports = {
  AFFILIATE_ROLES,
  registerExternalBusiness,
  getExternalBusinessByApiKey,
  submitDeliveryManifest,
  getManifestStatus,
  registerAffiliateStation,
  listAffiliateStations,
};
