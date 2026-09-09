// Universal World Layer — NPC Genesis Engine.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 1
// ("NPC Genesis Engine — one creation system, not seven").
//
// One NPC creation system for survivors, employees, business founders,
// influencers, Tribe members, displaced persons, and NPC skill-holders
// — the same generated person can later be assigned any of these
// roles, rather than each role having its own generator. Connects to
// the World Layer via `locationId`.

const { getLocation } = require('./locations');

const ROLES = [
  'survivor',
  'employee',
  'business_founder',
  'influencer',
  'tribe_member',
  'displaced_person',
  'skill_holder',
];

const MIGRATION_STATUSES = ['resident', 'migrating', 'displaced', 'arrived'];

function generateNPC(worldLayer, options = {}) {
  const {
    locationId,
    demographics,
    occupation = null,
    skills = [],
    language = 'en',
    personality = {},
    goals = [],
    economicRole = null,
    migrationStatus = 'resident',
  } = options;

  if (locationId == null) {
    throw new Error('generateNPC requires a locationId');
  }
  const location = getLocation(worldLayer, locationId);
  if (!location) {
    throw new Error(`generateNPC: no location with id ${locationId}`);
  }
  if (!demographics || typeof demographics !== 'object') {
    throw new Error('generateNPC requires a demographics object');
  }
  if (!MIGRATION_STATUSES.includes(migrationStatus)) {
    throw new Error(
      `generateNPC: invalid migrationStatus "${migrationStatus}" (expected one of ${MIGRATION_STATUSES.join(', ')})`
    );
  }

  const npc = {
    id: worldLayer.nextNpcId++,
    locationId,
    demographics,
    occupation,
    skills,
    language,
    personality,
    relationships: [],
    goals,
    migrationStatus,
    economicRole,
    roles: [],
    createdTick: worldLayer.tick,
  };

  worldLayer.npcs.push(npc);
  return npc;
}

function getNPC(worldLayer, npcId) {
  return worldLayer.npcs.find((n) => n.id === npcId) || null;
}

function getNPCsAtLocation(worldLayer, locationId) {
  return worldLayer.npcs.filter((n) => n.locationId === locationId);
}

function assignRole(worldLayer, npcId, role) {
  if (!ROLES.includes(role)) {
    throw new Error(
      `assignRole: invalid role "${role}" (expected one of ${ROLES.join(', ')})`
    );
  }
  const npc = getNPC(worldLayer, npcId);
  if (!npc) {
    throw new Error(`assignRole: no npc with id ${npcId}`);
  }
  if (!npc.roles.includes(role)) {
    npc.roles.push(role);
  }
  return npc;
}

function relocateNPC(worldLayer, npcId, newLocationId) {
  const npc = getNPC(worldLayer, npcId);
  if (!npc) {
    throw new Error(`relocateNPC: no npc with id ${npcId}`);
  }
  const newLocation = getLocation(worldLayer, newLocationId);
  if (!newLocation) {
    throw new Error(`relocateNPC: no location with id ${newLocationId}`);
  }
  npc.locationId = newLocationId;
  return npc;
}

module.exports = {
  ROLES,
  MIGRATION_STATUSES,
  generateNPC,
  getNPC,
  getNPCsAtLocation,
  assignRole,
  relocateNPC,
};
