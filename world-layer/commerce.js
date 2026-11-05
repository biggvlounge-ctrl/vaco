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

// **`supplyNeeds`/`suppliesResources` real shape, decided here.**
// `supplyNeeds` existed as a bare `[]` default with no validation and,
// checked directly, no caller anywhere in this repo ever passed it —
// free to give it a real shape without breaking anything. Each entry
// is `{ resourceType, quantity }`: `resourceType` is the same
// open-ended, no-closed-enum string `vacon-c/server/economy.js`'s own
// `generateResource` already uses for `resources.resource_type` (its
// own comment names `timber` as one real example) — reused as a
// vocabulary convention, never imported, since apps don't `require`
// across the directory boundary. `suppliesResources` is a new,
// necessary, symmetric field: resolving a supply chain means knowing
// what a business can actually provide, not only what it needs, and
// no such field existed anywhere. `{ resourceType, capacity }` mirrors
// `supplyNeeds`'s own shape rather than inventing a different one.
// See `supplyChain.js` for the real resolution logic built on top of
// both.
function validateResourceList(list, fieldName, amountField) {
  if (!Array.isArray(list)) {
    throw new Error(`generateBusiness: ${fieldName} must be an array`);
  }
  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || typeof entry.resourceType !== 'string' || !entry.resourceType) {
      throw new Error(`generateBusiness: every ${fieldName} entry requires a string resourceType`);
    }
    if (typeof entry[amountField] !== 'number' || entry[amountField] < 0) {
      throw new Error(`generateBusiness: every ${fieldName} entry requires a non-negative numeric ${amountField}`);
    }
  }
}

function generateBusiness(worldLayer, options = {}) {
  const {
    locationId,
    industry,
    ownerId = null,
    building = null,
    economicValue = 0,
    supplyNeeds = [],
    suppliesResources = [],
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
  validateResourceList(supplyNeeds, 'supplyNeeds', 'quantity');
  validateResourceList(suppliesResources, 'suppliesResources', 'capacity');
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
    suppliesResources,
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
