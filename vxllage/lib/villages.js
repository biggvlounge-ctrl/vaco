// VXLLAGE -- Villages (Discord-style), deliberately the lighter,
// secondary layer.
// Source of truth: VXLLAGE_CLAUDE.md's SS0: "Villages needs to shrink
// back down to a lighter, secondary Discord-flavored layer... rather
// than its own nested six-tab application. Don't delete
// buildVillageDetail()'s content wholesale -- the channel/event/
// member/boost concepts are worth keeping -- but it shouldn't be
// structured as a bigger, richer app than the Home feed." This module
// keeps real membership and real roles (the "Members" concept), on
// purpose scoped to owner/member only -- not the prototype's full
// owner/mod/member/procedurally-generated-leaderboard depth, matching
// the doc's own "shrink" instruction rather than porting that depth
// over.

function createVillage(store, options = {}) {
  const { name, ownerId } = options;
  if (!name) throw new Error('createVillage requires a name');
  if (!ownerId) throw new Error('createVillage requires an ownerId');

  const village = {
    id: store.nextVillageId++,
    name,
    ownerId,
    members: [{ userId: ownerId, role: 'owner', joinedAt: Date.now() }],
    createdAt: Date.now(),
  };
  store.villages.push(village);
  return village;
}

function getVillage(store, villageId) {
  return store.villages.find((v) => v.id === villageId) || null;
}

function listVillages(store) {
  return store.villages;
}

function joinVillage(store, options = {}) {
  const { villageId, userId } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`joinVillage: no village with id ${villageId}`);
  if (!userId) throw new Error('joinVillage requires a userId');
  if (village.members.some((m) => m.userId === userId)) {
    throw new Error(`joinVillage: ${userId} is already a member of village ${villageId}`);
  }
  const membership = { userId, role: 'member', joinedAt: Date.now() };
  village.members.push(membership);
  return village;
}

function leaveVillage(store, options = {}) {
  const { villageId, userId } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`leaveVillage: no village with id ${villageId}`);
  const membership = village.members.find((m) => m.userId === userId);
  if (!membership) throw new Error(`leaveVillage: ${userId} is not a member of village ${villageId}`);
  if (membership.role === 'owner') {
    throw new Error('leaveVillage: the owner cannot leave their own village');
  }
  village.members = village.members.filter((m) => m.userId !== userId);
  return village;
}

function getVillageMembers(store, villageId) {
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`getVillageMembers: no village with id ${villageId}`);
  return village.members;
}

module.exports = { createVillage, getVillage, listVillages, joinVillage, leaveVillage, getVillageMembers };
