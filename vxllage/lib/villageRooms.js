// VXLLAGE -- Village Rooms: real permanent, creator-owned rooms.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's `VillageRoom
// { id, roomType: "clubhouse-audio" | "discord-hangout", ownerId,
// scheduledRecurrence: string | null }`. VXLLAGE_VDP_VILLAGE_DISTRICT.md
// confirms the real model to follow: Clubhouse's actual Clubs feature
// -- a followable, persistent community space distinct from one-off
// rooms, with its own membership and creator, and real support for a
// recurring scheduled time slot ("recurring rooms at a regular time
// slot build the most loyal returning audience" -- a real, cited
// Clubhouse data point, not a guess).
//
// A room's owner must be a genuine member of the parent village --
// real cross-module validation via lib/villages.js, not a bare id
// reference trusted at face value.

const { getVillage } = require('./villages');

const ROOM_TYPES = ['clubhouse-audio', 'discord-hangout'];

function createVillageRoom(store, options = {}) {
  const { villageId, roomType, ownerId, scheduledRecurrence = null } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`createVillageRoom: no village with id ${villageId}`);
  if (!ROOM_TYPES.includes(roomType)) {
    throw new Error(`createVillageRoom: invalid roomType "${roomType}" (expected one of ${ROOM_TYPES.join(', ')})`);
  }
  if (!village.members.some((m) => m.userId === ownerId)) {
    throw new Error(`createVillageRoom: ${ownerId} is not a member of village ${villageId}, cannot own a room there`);
  }

  const room = {
    id: store.nextVillageRoomId++, villageId, roomType, ownerId, scheduledRecurrence,
    activeParticipants: [], createdAt: Date.now(),
  };
  store.villageRooms.push(room);
  return room;
}

function getVillageRoom(store, roomId) {
  return store.villageRooms.find((r) => r.id === roomId) || null;
}

function listVillageRooms(store, villageId) {
  return store.villageRooms.filter((r) => r.villageId === villageId);
}

function joinRoom(store, options = {}) {
  const { roomId, userId } = options;
  const room = getVillageRoom(store, roomId);
  if (!room) throw new Error(`joinRoom: no room with id ${roomId}`);
  if (!userId) throw new Error('joinRoom requires a userId');
  if (room.activeParticipants.includes(userId)) throw new Error(`joinRoom: ${userId} is already in room ${roomId}`);
  room.activeParticipants.push(userId);
  return room;
}

function leaveRoom(store, options = {}) {
  const { roomId, userId } = options;
  const room = getVillageRoom(store, roomId);
  if (!room) throw new Error(`leaveRoom: no room with id ${roomId}`);
  if (!room.activeParticipants.includes(userId)) throw new Error(`leaveRoom: ${userId} is not in room ${roomId}`);
  room.activeParticipants = room.activeParticipants.filter((id) => id !== userId);
  return room;
}

module.exports = { ROOM_TYPES, createVillageRoom, getVillageRoom, listVillageRooms, joinRoom, leaveRoom };
