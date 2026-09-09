// VOID — Station Network.
// Source of truth: VOID_STATION_NAMING_CONVENTION.md's `VoidStation`
// data model and its "Standard requirement: every Hub Station
// includes at least one Port Station" rule.
//
// Naming: **VOID Hub Stations** are the general logistics backbone
// (sorting, storage, fleet staging, driver dispatch coordination).
// **VOID Port Stations** are the drone-specific stations (landing,
// charging, package pickup/drop-off). A single physical location can
// be a Hub, a Port, or both.
//
// **Interpretive reading of the "every Hub includes a Port" rule**:
// the source doc states this as a hard baseline ("never zero") — read
// literally, that means a station can never be registered as a bare
// "hub" with no port capability. `STATION_TYPES` below is therefore
// `['port', 'hub-and-port']`, not `['hub', 'port', 'hub-and-port']` —
// a pure hub-only registration is rejected outright rather than
// silently accepted and left to violate the rule later. This is a
// flagged, deliberate reading, not something the source doc states in
// exactly these words.
//
// "Double units" (bayCount >= 2): a real, confirmed throughput
// upgrade per A2Z Drone Delivery's real multi-drone dock precedent —
// bayCount is a plain positive integer, no invented cap.
//
// `temperatureControlled` (Phase 9): per VOID_FOOD_CAPABLE_STATIONS.md
// -- a hybrid variant deployed at a subset of the general station
// network (real precedent: DRONEDEK's confirmed "hot and cold
// section" variant), not a separate food-only network. Defaults false
// -- standard stations remain the default everywhere.

const STATION_TYPES = ['port', 'hub-and-port'];

function registerStation(store, options = {}) {
  const { regionId, stationType, bayCount = 1, supportsRelay = false, temperatureControlled = false, lat, lng } = options;

  if (!regionId) {
    throw new Error('registerStation requires a regionId');
  }
  if (!STATION_TYPES.includes(stationType)) {
    throw new Error(
      `registerStation: invalid stationType "${stationType}" (expected one of ${STATION_TYPES.join(', ')} -- a bare "hub" with no port capability is not a valid standalone station per the "every Hub includes a Port" rule)`
    );
  }
  if (!Number.isInteger(bayCount) || bayCount < 1) {
    throw new Error('registerStation requires a positive integer bayCount (at least 1)');
  }
  if (typeof supportsRelay !== 'boolean') {
    throw new Error('registerStation requires a boolean supportsRelay');
  }
  if (typeof temperatureControlled !== 'boolean') {
    throw new Error('registerStation requires a boolean temperatureControlled');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('registerStation requires numeric lat and lng');
  }

  const station = {
    id: store.nextStationId++,
    regionId,
    stationType,
    bayCount,
    supportsRelay,
    temperatureControlled,
    lat,
    lng,
    createdAt: Date.now(),
  };
  store.stations.push(station);
  return station;
}

function getStation(store, stationId) {
  return store.stations.find((s) => s.id === stationId) || null;
}

function getStationsByRegion(store, regionId) {
  return store.stations.filter((s) => s.regionId === regionId);
}

module.exports = {
  STATION_TYPES,
  registerStation,
  getStation,
  getStationsByRegion,
};
