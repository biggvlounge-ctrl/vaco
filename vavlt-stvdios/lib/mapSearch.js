// VAVLT STVDIOS -- Map Search.
// Source of truth: `VAULT_STUDIOS_ARCHITECTURE.md`'s own
// `MapSearchListing { id, businessId, lat, lng, category }`, framed
// directly as "doubles as HVNTZ's Yelp-style business discovery" and
// `VAULT_STUDIOS_IG_LAYER.md`'s own "Vavlt Stvdios' location-based
// discovery layer and HVNTZ's business directory are functionally the
// same underlying need, served by one system."
//
// Real Haversine distance, the same real formula this session already
// proved correct once (VOID MAGIC's own `geofencing.js`) -- a fresh,
// local implementation here rather than a cross-project import, the
// same posture every other real-math reuse in this session has taken
// (e.g. VACAY Auto's own double-booking guard, not a shared package).

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createListing(store, options = {}) {
  const {
    businessId, lat, lng, category, now = Date.now(),
  } = options;

  if (!businessId) throw new Error('createListing requires a businessId');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('createListing requires a real lat between -90 and 90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('createListing requires a real lng between -180 and 180');
  if (!category) throw new Error('createListing requires a category');

  const listing = {
    id: store.nextMapListingId++, businessId, lat, lng, category, createdAt: now,
  };
  store.mapSearchListings.push(listing);
  return listing;
}

function getListing(store, listingId) {
  return store.mapSearchListings.find((l) => l.id === listingId) || null;
}

function searchNearby(store, options = {}) {
  const { lat, lng, radiusKm, category } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('searchNearby requires a real lat/lng');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) throw new Error('searchNearby requires a positive radiusKm');

  return store.mapSearchListings
    .filter((l) => !category || l.category === category)
    .map((l) => ({ ...l, distanceKm: haversineKm(lat, lng, l.lat, l.lng) }))
    .filter((l) => l.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = {
  haversineKm, createListing, getListing, searchNearby,
};
