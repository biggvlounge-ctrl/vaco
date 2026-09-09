// Universal World Layer — Transportation Network.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 4
// ("Transportation Network — bundled"): airports, helipads, roads,
// gas stations, bike shops, ports, and train stations, unified.
//
// Doc's field list: locationId, vehicleTypes, fuelAvailability,
// repairDifficulty, ownership, controlStatus, operationalStatus.
// Unlike Commerce (Phase 3), owning a transport node does not
// auto-assign an NPC Genesis Engine role — none of the seven roles
// (survivor/employee/business_founder/influencer/tribe_member/
// displaced_person/skill_holder) fit "owns a gas station" any better
// than "owns a business" already does, and inventing an eighth role
// not in the architecture doc would be scope creep, not a real
// requirement.

const { getLocation } = require('./locations');
const { getNPC } = require('./npcGenesis');

const REPAIR_DIFFICULTIES = ['easy', 'moderate', 'hard', 'extreme'];
const CONTROL_STATUSES = ['uncontrolled', 'contested', 'controlled'];
const OPERATIONAL_STATUSES = ['operational', 'damaged', 'destroyed'];

function generateTransportNode(worldLayer, options = {}) {
  const {
    locationId,
    vehicleTypes = [],
    fuelAvailability = 0,
    repairDifficulty = 'moderate',
    ownerId = null,
    controlStatus = 'uncontrolled',
    operationalStatus = 'operational',
  } = options;

  if (locationId == null) {
    throw new Error('generateTransportNode requires a locationId');
  }
  const location = getLocation(worldLayer, locationId);
  if (!location) {
    throw new Error(`generateTransportNode: no location with id ${locationId}`);
  }
  if (typeof fuelAvailability !== 'number' || fuelAvailability < 0 || fuelAvailability > 100) {
    throw new Error('generateTransportNode requires fuelAvailability between 0 and 100');
  }
  if (!REPAIR_DIFFICULTIES.includes(repairDifficulty)) {
    throw new Error(
      `generateTransportNode: invalid repairDifficulty "${repairDifficulty}" (expected one of ${REPAIR_DIFFICULTIES.join(', ')})`
    );
  }
  if (!CONTROL_STATUSES.includes(controlStatus)) {
    throw new Error(
      `generateTransportNode: invalid controlStatus "${controlStatus}" (expected one of ${CONTROL_STATUSES.join(', ')})`
    );
  }
  if (!OPERATIONAL_STATUSES.includes(operationalStatus)) {
    throw new Error(
      `generateTransportNode: invalid operationalStatus "${operationalStatus}" (expected one of ${OPERATIONAL_STATUSES.join(', ')})`
    );
  }
  if (ownerId != null && !getNPC(worldLayer, ownerId)) {
    throw new Error(`generateTransportNode: no npc with id ${ownerId}`);
  }

  const node = {
    id: worldLayer.nextTransportNodeId++,
    locationId,
    vehicleTypes,
    fuelAvailability,
    repairDifficulty,
    ownerId,
    controlStatus,
    operationalStatus,
    createdTick: worldLayer.tick,
  };

  worldLayer.transportNodes.push(node);
  return node;
}

function getTransportNode(worldLayer, nodeId) {
  return worldLayer.transportNodes.find((n) => n.id === nodeId) || null;
}

function getTransportNodesAtLocation(worldLayer, locationId) {
  return worldLayer.transportNodes.filter((n) => n.locationId === locationId);
}

function setFuelAvailability(worldLayer, nodeId, value) {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new Error('setFuelAvailability requires a value between 0 and 100');
  }
  const node = getTransportNode(worldLayer, nodeId);
  if (!node) {
    throw new Error(`setFuelAvailability: no transport node with id ${nodeId}`);
  }
  node.fuelAvailability = value;
  return node;
}

function setOperationalStatus(worldLayer, nodeId, status) {
  if (!OPERATIONAL_STATUSES.includes(status)) {
    throw new Error(
      `setOperationalStatus: invalid status "${status}" (expected one of ${OPERATIONAL_STATUSES.join(', ')})`
    );
  }
  const node = getTransportNode(worldLayer, nodeId);
  if (!node) {
    throw new Error(`setOperationalStatus: no transport node with id ${nodeId}`);
  }
  node.operationalStatus = status;
  return node;
}

function setControlStatus(worldLayer, nodeId, status) {
  if (!CONTROL_STATUSES.includes(status)) {
    throw new Error(
      `setControlStatus: invalid status "${status}" (expected one of ${CONTROL_STATUSES.join(', ')})`
    );
  }
  const node = getTransportNode(worldLayer, nodeId);
  if (!node) {
    throw new Error(`setControlStatus: no transport node with id ${nodeId}`);
  }
  node.controlStatus = status;
  return node;
}

module.exports = {
  REPAIR_DIFFICULTIES,
  CONTROL_STATUSES,
  OPERATIONAL_STATUSES,
  generateTransportNode,
  getTransportNode,
  getTransportNodesAtLocation,
  setFuelAvailability,
  setOperationalStatus,
  setControlStatus,
};
