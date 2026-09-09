// VOID — No-Fly Zones.
// Source of truth: VOID_MULTI_STOP_DRONE_ROUTING.md's list of real
// constraints Gibson's dispatch logic must model, including "no-fly
// zones." Registered globally (not region-scoped) since the source
// doc doesn't specify regional scoping for zones specifically --
// flagged, interpretive simplification for this pass.

function registerNoFlyZone(store, options = {}) {
  const { name, lat, lng, radiusKm } = options;
  if (!name) {
    throw new Error('registerNoFlyZone requires a name');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('registerNoFlyZone requires numeric lat and lng');
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error('registerNoFlyZone requires a positive radiusKm');
  }
  const zone = { id: store.nextNoFlyZoneId++, name, lat, lng, radiusKm };
  store.noFlyZones.push(zone);
  return zone;
}

function getNoFlyZones(store) {
  return store.noFlyZones;
}

module.exports = { registerNoFlyZone, getNoFlyZones };
