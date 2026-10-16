// VOID DROP — Drop Zones: several real units, co-located.
//
// Spec §18, previously flagged as deliberately not built: "A vacant
// commercial property could temporarily host DROP FOOD, DROP SHOP,
// DROP SPA, DROP GAME, DROP EVENT — creating a temporary commercial
// village." Built now, directly against the founder's own follow-up
// ("if we have enough different setups, we could piece all these
// things together and have a small village or a small shopping
// center").
//
// **A zone is a real, registered location with a real capacity**,
// not a label applied after the fact — `maxUnits` is a real ceiling
// `voidDropBooking.js`'s own `isZoneAvailable` enforces before a
// booking against it is ever created, the same "refuse before
// accepting" posture `isAssetAvailable` already holds for a single
// asset's own date-range overlap. No category restriction: the spec's
// own example zone mixes five different categories, so nothing here
// narrows what may book into one.
//
// **A zone implies an already-known-good site.** Registering one is
// the real-world act of an operator (or, per spec §17, a property
// owner) establishing that this location genuinely supports drop
// deliveries — multiple units will share it. `createDropBooking`
// treats a zone's own `locationType`/`roadAccessConfirmed: true` as
// already established, rather than asking the same two questions
// again for every unit dropped at an already-proven site.

const { haversineDistanceKm } = require('./geo');

const ZONE_STATUSES = ['active', 'inactive'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function registerDropZone(store, options = {}) {
  const {
    name, locationType, lat, lng, siteAddress = null, maxUnits, ownerId, now = Date.now(),
  } = options;

  if (!name) throw new Error('registerDropZone requires a name');
  if (!locationType) throw new Error('registerDropZone requires a locationType');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('registerDropZone requires numeric lat/lng');
  }
  if (!Number.isInteger(maxUnits) || maxUnits < 1) {
    throw new Error('registerDropZone requires a positive integer maxUnits');
  }
  if (!ownerId) throw new Error('registerDropZone requires an ownerId');

  const zone = {
    id: `VOID-ZONE-${String(store.nextDropZoneId++).padStart(4, '0')}`,
    name,
    locationType,
    lat,
    lng,
    siteAddress,
    maxUnits,
    ownerId,
    status: 'active',
    createdAt: now,
  };
  store.dropZones.push(zone);
  return zone;
}

function getDropZone(store, zoneId) {
  return store.dropZones.find((z) => z.id === zoneId) || null;
}

function listDropZones(store, options = {}) {
  const { status = null } = options;
  return store.dropZones.filter((z) => (status ? z.status === status : true));
}

function setZoneStatus(store, options = {}) {
  const { zoneId, status } = options;
  const zone = getDropZone(store, zoneId);
  if (!zone) throw new Error(`setZoneStatus: no zone with id ${zoneId}`);
  if (!ZONE_STATUSES.includes(status)) {
    throw new Error(`setZoneStatus: invalid status "${status}" (expected one of ${ZONE_STATUSES.join(', ')})`);
  }
  zone.status = status;
  return zone;
}

// How many real slots are already claimed for a date range that
// overlaps the one being requested -- counted against real, non-
// cancelled/non-rejected bookings, the same overlap rule
// `isAssetAvailable` already uses for a single asset.
function countOccupiedSlots(store, options = {}) {
  const { zoneId, startDate, endDate, excludeBookingId = null } = options;
  return store.dropBookings.filter((b) => b.zoneId === zoneId
    && b.id !== excludeBookingId
    && !['cancelled', 'rejected'].includes(b.status)
    && startDate < b.endDate && b.startDate < endDate).length;
}

function isZoneAvailable(store, options = {}) {
  const { zoneId, startDate, endDate } = options;
  const zone = getDropZone(store, zoneId);
  if (!zone) throw new Error(`isZoneAvailable: no zone with id ${zoneId}`);
  if (zone.status !== 'active') return false;
  return countOccupiedSlots(store, { zoneId, startDate, endDate }) < zone.maxUnits;
}

// The real "what does this little village look like right now" view
// -- every unit physically on site at this zone at `now`, with its
// own real category, not a stand-in list. "On site" means deployed
// through the point retrieval is scheduled but not yet dispatched
// (`deployed`, `active`, `retrieval-scheduled`) -- a unit still
// `in-transit` either way has already left or has not yet arrived.
const ON_SITE_STATUSES = ['deployed', 'active', 'retrieval-scheduled'];

function getZoneOccupancy(store, zoneId, options = {}) {
  const { now = Date.now() } = options;
  const zone = getDropZone(store, zoneId);
  if (!zone) throw new Error(`getZoneOccupancy: no zone with id ${zoneId}`);

  const onSite = store.dropBookings.filter((b) => b.zoneId === zoneId
    && ON_SITE_STATUSES.includes(b.status)
    && b.startDate <= now && now < b.endDate);

  return {
    zone,
    units: onSite.map((b) => ({
      bookingId: b.id, assetId: b.assetId, category: b.category, status: b.status,
    })),
    occupiedCount: onSite.length,
    capacity: zone.maxUnits,
  };
}

function distanceToZoneKm(zone, lat, lng) {
  return round(haversineDistanceKm(zone.lat, zone.lng, lat, lng));
}

module.exports = {
  ZONE_STATUSES,
  ON_SITE_STATUSES,
  registerDropZone,
  getDropZone,
  listDropZones,
  setZoneStatus,
  countOccupiedSlots,
  isZoneAvailable,
  getZoneOccupancy,
  distanceToZoneKm,
};
