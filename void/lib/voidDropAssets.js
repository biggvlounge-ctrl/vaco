// VOID DROP — Mobile Space Asset inventory and lifecycle.
//
// **The real gap this fills.** Every other VOID vertical's "thing"
// lives only inside a job — a courier run, a moving job, a laundry
// order each exist once and are done. VOID DROP's whole premise (spec
// §9, "Asset Redeployment") is the opposite: ONE physical unit serves
// customer A, then B, then C, with real state (location, condition,
// maintenance) that outlives any single booking. `businessLockers.js`
// is the closest existing precedent in this codebase — a durable
// physical registration that many orders reference over time — and
// this follows the same shape: its own collection, its own id, status
// that changes independently of whatever job currently references it.
//
// **"Mobile Space Asset," not "container"** (spec §2), on purpose —
// `category` is a free key into `voidDropCategories.js`'s config table,
// and nothing here hardcodes a container's dimensions or mechanics.

const { getDropCategory } = require('./voidDropCategories');
const { getStation } = require('./stations');

const ASSET_STATUSES = [
  'available', 'reserved', 'in-transit', 'deploying', 'active-rental',
  'maintenance', 'cleaning', 'inspection', 'damaged', 'offline', 'retired',
];

// Spec §20: owner, operator, customer, and delivery provider are
// separate roles. `ownerType` names who holds title; `operatorId`
// (optional — defaults to the owner) names who actually manages the
// unit day to day, which is what third-party/business/investor
// ownership (spec §20) requires without forcing every VOID-owned unit
// through a second, pointless operator record.
const OWNER_TYPES = ['void', 'third-party', 'business', 'investor'];

// Maintenance types named directly from spec §10. Kept as one real
// enum rather than a field per type (cleaning, inspection, repair,
// electrical, plumbing, HVAC, structural, safety-equipment,
// sanitization are all "a maintenance event happened," not
// structurally different records) — `type` plus free-text `notes`
// covers what the spec actually asks to be tracked without inventing
// 10 near-identical tables.
const MAINTENANCE_TYPES = [
  'cleaning', 'inspection', 'repair', 'equipment-replacement', 'electrical',
  'plumbing', 'hvac', 'structural', 'safety-equipment', 'sanitization',
];

// Flagged interpretive: no source document sets a mileage/hours-based
// service interval (spec §10 lists "mileage," "deployment hours" as
// things to track, not a schedule for when service is due). Real,
// honest minimum instead of a fabricated interval: an asset with an
// OPEN (unresolved) maintenance issue cannot be booked, full stop. A
// time- or usage-based schedule is a real follow-up once real fleet
// data exists to set one from.
function hasOpenMaintenanceIssue(store, assetId) {
  return store.dropMaintenanceEvents.some((e) => e.assetId === assetId && e.resolvedAt === null);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// `homeStationId` ties the unit's fleet base to a real VOID Hub/Port
// station (`stations.js`) rather than a bare pair of coordinates --
// "stored at the Void Hub, the larger hubs, or different hubs in
// different areas" (founder's own words). When given, the station's
// own real `lat`/`lng` become the asset's home base unless explicit
// `homeLat`/`homeLng` are also passed (explicit wins) -- a unit
// without a home station is still valid (third-party/investor-owned
// inventory may not stage at a VOID hub at all), just without a
// station-derived home.
function registerDropAsset(store, options = {}) {
  const {
    category, sizeDescription, dimensions = null, weightKg, amenities = [],
    dailyRate, ownerId, ownerType = 'void', operatorId = null,
    homeStationId = null, homeLat = null, homeLng = null,
    hasDreamsScreen = false, now = Date.now(),
  } = options;

  if (!getDropCategory(category)) {
    throw new Error(`registerDropAsset: unknown category "${category}" (see voidDropCategories.js)`);
  }
  if (!sizeDescription) throw new Error('registerDropAsset requires a sizeDescription');
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('registerDropAsset requires a positive weightKg');
  }
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    throw new Error('registerDropAsset requires a positive dailyRate');
  }
  if (!ownerId) throw new Error('registerDropAsset requires an ownerId');
  if (!OWNER_TYPES.includes(ownerType)) {
    throw new Error(`registerDropAsset: invalid ownerType "${ownerType}" (expected one of ${OWNER_TYPES.join(', ')})`);
  }
  if (typeof hasDreamsScreen !== 'boolean') {
    throw new Error('registerDropAsset requires hasDreamsScreen to be a boolean');
  }

  let station = null;
  if (homeStationId !== null) {
    station = getStation(store, homeStationId);
    if (!station) throw new Error(`registerDropAsset: no station with id ${homeStationId}`);
  }
  const resolvedHomeLat = homeLat !== null ? homeLat : (station ? station.lat : null);
  const resolvedHomeLng = homeLng !== null ? homeLng : (station ? station.lng : null);

  const asset = {
    id: `VOID-DROP-${String(store.nextDropAssetId++).padStart(4, '0')}`,
    category,
    sizeDescription,
    dimensions,
    weightKg,
    amenities,
    dailyRate: round(dailyRate),
    ownerId,
    ownerType,
    operatorId: operatorId || ownerId,
    status: 'available',
    homeStationId,
    // Current location — where the unit physically sits right now,
    // distinct from `homeLat/homeLng` (its fleet base, used for
    // delivery-distance pricing in voidDropBooking.js).
    lat: resolvedHomeLat,
    lng: resolvedHomeLng,
    homeLat: resolvedHomeLat,
    homeLng: resolvedHomeLng,
    // DREAMS screen (founder's own follow-up: "put our screens on so
    // they're always advertising"). `dreamsScreenId` is set/cleared by
    // voidDropBooking.js's own deploy/retrieve steps, fail-soft -- a
    // DREAMS outage never blocks a real rental.
    hasDreamsScreen,
    dreamsScreenId: null,
    createdAt: now,
    retiredAt: null,
  };
  store.dropAssets.push(asset);
  return asset;
}

function getDropAsset(store, assetId) {
  return store.dropAssets.find((a) => a.id === assetId) || null;
}

function listDropAssets(store, options = {}) {
  const { category, status, ownerId } = options;
  return store.dropAssets.filter(
    (a) => (category ? a.category === category : true)
      && (status ? a.status === status : true)
      && (ownerId ? a.ownerId === ownerId : true),
  );
}

// Real, and the one rule that keeps the fleet honest: bookable means
// `available` AND no open maintenance issue. A unit stuck in
// `maintenance`/`damaged`/`offline`/`retired` is already excluded by
// status; this catches the case where status reads `available` (the
// booking that was holding it just ended) but a real issue was logged
// against it that nobody closed out yet.
function isBookable(store, assetId) {
  const asset = getDropAsset(store, assetId);
  if (!asset) return false;
  return asset.status === 'available' && !hasOpenMaintenanceIssue(store, assetId);
}

const TRANSITIONS = {
  available: ['reserved', 'maintenance', 'offline', 'retired'],
  reserved: ['in-transit', 'available'],
  // `in-transit` carries both legs of a rental: the outbound delivery
  // goes to `deploying`, the return trip lands directly in
  // `inspection` -- `voidDropBooking.js`'s own call sites decide which
  // leg a given transition means, this only enforces that both are
  // legal from here.
  'in-transit': ['deploying', 'inspection', 'available'],
  deploying: ['active-rental'],
  'active-rental': ['in-transit'],
  maintenance: ['cleaning', 'inspection', 'available', 'offline', 'retired'],
  cleaning: ['inspection', 'available', 'maintenance'],
  inspection: ['available', 'cleaning', 'maintenance', 'damaged'],
  damaged: ['maintenance', 'offline', 'retired'],
  offline: ['available', 'retired'],
  retired: [],
};

function setAssetStatus(store, options = {}) {
  const { assetId, status, now = Date.now() } = options;
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`setAssetStatus: no asset with id ${assetId}`);
  if (!ASSET_STATUSES.includes(status)) {
    throw new Error(`setAssetStatus: invalid status "${status}" (expected one of ${ASSET_STATUSES.join(', ')})`);
  }
  if (!TRANSITIONS[asset.status].includes(status)) {
    throw new Error(`setAssetStatus: asset ${assetId} cannot move from "${asset.status}" to "${status}" (legal: ${TRANSITIONS[asset.status].join(', ') || 'none'})`);
  }
  asset.status = status;
  if (status === 'retired') asset.retiredAt = now;
  return asset;
}

function moveAsset(store, options = {}) {
  const { assetId, lat, lng } = options;
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`moveAsset: no asset with id ${assetId}`);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('moveAsset requires numeric lat/lng');
  }
  asset.lat = lat;
  asset.lng = lng;
  return asset;
}

// Set once a real DREAMS screen is registered for the asset's current
// deployment (`screenId`), cleared once the unit leaves that location
// -- see voidDropBooking.js's own deploy/retrieve steps, which call
// this around a fail-soft DREAMS call rather than this module knowing
// anything about DREAMS itself.
function setAssetDreamsScreen(store, options = {}) {
  const { assetId, screenId } = options;
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`setAssetDreamsScreen: no asset with id ${assetId}`);
  asset.dreamsScreenId = screenId;
  return asset;
}

// `resolvedAt: null` is what `hasOpenMaintenanceIssue` checks — an
// unresolved event blocks booking regardless of the asset's own
// `status` field, so a cleaning crew logging "found mold" cannot be
// silently cleared by a later unrelated status change.
// `resolved` defaults to false -- a logged event is an open issue
// until something closes it out, which is the right default for "a
// cleaner found mold" or "this needs a repair." It is NOT the right
// default for a record of an activity that already finished the
// moment it was logged (a completed cleaning, a passed inspection) --
// callers logging one of those pass `resolved: true` explicitly so a
// routine completed activity never silently blocks the next booking
// the way an unresolved real issue should.
function logMaintenanceEvent(store, options = {}) {
  const {
    assetId, type, notes = '', performedBy = null, now = Date.now(), resolved = false,
  } = options;
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`logMaintenanceEvent: no asset with id ${assetId}`);
  if (!MAINTENANCE_TYPES.includes(type)) {
    throw new Error(`logMaintenanceEvent: invalid type "${type}" (expected one of ${MAINTENANCE_TYPES.join(', ')})`);
  }

  const event = {
    id: store.nextDropMaintenanceEventId++,
    assetId,
    type,
    notes,
    performedBy,
    loggedAt: now,
    resolvedAt: resolved ? now : null,
  };
  store.dropMaintenanceEvents.push(event);
  return event;
}

function resolveMaintenanceEvent(store, options = {}) {
  const { eventId, now = Date.now() } = options;
  const event = store.dropMaintenanceEvents.find((e) => e.id === eventId);
  if (!event) throw new Error(`resolveMaintenanceEvent: no maintenance event with id ${eventId}`);
  if (event.resolvedAt) throw new Error(`resolveMaintenanceEvent: event ${eventId} is already resolved`);
  event.resolvedAt = now;
  return event;
}

function getMaintenanceHistory(store, assetId) {
  return store.dropMaintenanceEvents.filter((e) => e.assetId === assetId);
}

module.exports = {
  ASSET_STATUSES,
  OWNER_TYPES,
  MAINTENANCE_TYPES,
  registerDropAsset,
  getDropAsset,
  listDropAssets,
  isBookable,
  hasOpenMaintenanceIssue,
  setAssetStatus,
  moveAsset,
  setAssetDreamsScreen,
  logMaintenanceEvent,
  resolveMaintenanceEvent,
  getMaintenanceHistory,
};
