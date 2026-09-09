// Universal World Layer — Real World Commerce Layer.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 3
// ("Real World Commerce Layer — bundled"): Overture Places + Cesium
// OSM Buildings + business data + the property system, unified.
//
// No Overture/Cesium import is wired in yet (Phase 1's gap still
// applies) — this is the shape that import will populate. What this
// phase does add is the real connection to the NPC Genesis Engine:
// a business's owner becomes a 'business_founder', its staff become
// 'employee's, through the same role-assignment mechanism from
// Phase 2, not a separate one.

const { getLocation } = require('./locations');
const { getNPC, assignRole } = require('./npcGenesis');

const SECURITY_LEVELS = ['none', 'low', 'medium', 'high'];

function generateBusiness(worldLayer, options = {}) {
  const {
    locationId,
    industry,
    ownerId = null,
    building = null,
    economicValue = 0,
    supplyNeeds = [],
    securityRequirement = 'none',
  } = options;

  if (locationId == null) {
    throw new Error('generateBusiness requires a locationId');
  }
  const location = getLocation(worldLayer, locationId);
  if (!location) {
    throw new Error(`generateBusiness: no location with id ${locationId}`);
  }
  if (!industry) {
    throw new Error('generateBusiness requires an industry');
  }
  if (typeof economicValue !== 'number' || economicValue < 0) {
    throw new Error('generateBusiness requires a non-negative numeric economicValue');
  }
  if (!SECURITY_LEVELS.includes(securityRequirement)) {
    throw new Error(
      `generateBusiness: invalid securityRequirement "${securityRequirement}" (expected one of ${SECURITY_LEVELS.join(', ')})`
    );
  }
  if (ownerId != null && !getNPC(worldLayer, ownerId)) {
    throw new Error(`generateBusiness: no npc with id ${ownerId}`);
  }

  const business = {
    id: worldLayer.nextBusinessId++,
    locationId,
    building,
    ownerId,
    industry,
    employees: [],
    economicValue,
    supplyNeeds,
    securityRequirement,
    createdTick: worldLayer.tick,
  };

  worldLayer.businesses.push(business);

  if (ownerId != null) {
    assignRole(worldLayer, ownerId, 'business_founder');
  }

  return business;
}

function getBusiness(worldLayer, businessId) {
  return worldLayer.businesses.find((b) => b.id === businessId) || null;
}

function getBusinessesAtLocation(worldLayer, locationId) {
  return worldLayer.businesses.filter((b) => b.locationId === locationId);
}

function addEmployee(worldLayer, businessId, npcId) {
  const business = getBusiness(worldLayer, businessId);
  if (!business) {
    throw new Error(`addEmployee: no business with id ${businessId}`);
  }
  if (!getNPC(worldLayer, npcId)) {
    throw new Error(`addEmployee: no npc with id ${npcId}`);
  }
  if (!business.employees.includes(npcId)) {
    business.employees.push(npcId);
  }
  assignRole(worldLayer, npcId, 'employee');
  return business;
}

function setBusinessEconomicValue(worldLayer, businessId, value) {
  if (typeof value !== 'number' || value < 0) {
    throw new Error('setBusinessEconomicValue requires a non-negative number');
  }
  const business = getBusiness(worldLayer, businessId);
  if (!business) {
    throw new Error(`setBusinessEconomicValue: no business with id ${businessId}`);
  }
  business.economicValue = value;
  return business;
}

module.exports = {
  SECURITY_LEVELS,
  generateBusiness,
  getBusiness,
  getBusinessesAtLocation,
  addEmployee,
  setBusinessEconomicValue,
};
