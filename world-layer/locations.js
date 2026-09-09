// Universal World Layer — Location record.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section
// "The core confirmation" + section 2 (Hero Location Tier).
//
// One record per real-world location, holding the nine data slices
// every consuming app (VACON-C, VENVS, HVNTZ) reads instead of each
// generating its own. No external data source (Cesium/UNESCO/NRHP/
// Overture) is wired in yet — this is the shape those imports will
// write into.

const LOCATION_TIERS = ['hero', 'regional', 'filler'];

const DATA_FIELDS = [
  'geographyData',
  'buildingData',
  'businessData',
  'landmarkData',
  'populationData',
  'transportationData',
  'economicData',
  'ownershipData',
];

function createWorldLayer() {
  return {
    tick: 0,
    locations: [],
    nextLocationId: 1,
    npcs: [],
    nextNpcId: 1,
    businesses: [],
    nextBusinessId: 1,
    transportNodes: [],
    nextTransportNodeId: 1,
    informationEvents: [],
    nextInformationEventId: 1,
    assets: [],
    nextAssetId: 1,
  };
}

function generateLocation(worldLayer, options = {}) {
  const { name, lat, lng, tier = 'filler', terrainType = null } = options;

  if (!name) {
    throw new Error('generateLocation requires a name');
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('generateLocation requires numeric lat and lng');
  }
  if (!LOCATION_TIERS.includes(tier)) {
    throw new Error(
      `generateLocation: invalid tier "${tier}" (expected one of ${LOCATION_TIERS.join(', ')})`
    );
  }

  const location = {
    id: worldLayer.nextLocationId++,
    name,
    lat,
    lng,
    tier,
    terrainType,
    geographyData: null,
    buildingData: null,
    businessData: null,
    landmarkData: null,
    populationData: null,
    transportationData: null,
    economicData: null,
    ownershipData: null,
    eventHistoryData: [],
    createdTick: worldLayer.tick,
  };

  worldLayer.locations.push(location);
  return location;
}

function getLocation(worldLayer, locationId) {
  return worldLayer.locations.find((l) => l.id === locationId) || null;
}

function setLocationData(worldLayer, locationId, field, value) {
  if (!DATA_FIELDS.includes(field)) {
    throw new Error(
      `setLocationData: invalid field "${field}" (expected one of ${DATA_FIELDS.join(', ')})`
    );
  }
  const location = getLocation(worldLayer, locationId);
  if (!location) {
    throw new Error(`setLocationData: no location with id ${locationId}`);
  }
  location[field] = value;
  return location;
}

function addLocationEvent(worldLayer, locationId, event) {
  const location = getLocation(worldLayer, locationId);
  if (!location) {
    throw new Error(`addLocationEvent: no location with id ${locationId}`);
  }
  location.eventHistoryData.push({ ...event, tick: worldLayer.tick });
  return location;
}

module.exports = {
  LOCATION_TIERS,
  DATA_FIELDS,
  createWorldLayer,
  generateLocation,
  getLocation,
  setLocationData,
  addLocationEvent,
};
