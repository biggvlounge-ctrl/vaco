// VDP — households: who actually lives together.
//
// Mirrors VACON-C's own `server/households.js` shape at VDP's scale --
// `{id, propertyId, memberIds}` rather than its full
// `property_id`/`member_entity_ids`/`community_id` machinery, the same
// "borrow the shape, not the scale" discipline this session's other
// VACON-C-derived modules (`npcs.js`, `skills.js`, `property.js`)
// already apply. A household exists once a player owns or rents a
// home (`property.js`); who else lives there -- today, only other
// real players, since VDP's NPCs have no home of their own to move
// out of -- is a membership list a resident invites someone onto.
//
// VACON-C's own household is "derived, and stored anyway" (its file's
// own words) because an id lets other rows point at it. The same
// argument applies here one for one: a household here is also an
// identity other things can reference (a shared VCoin pool, a
// cohabitation-based relationship nudge), not just a recomputed
// `home_property_id` grouping.

export function createHouseholdsStore() {
  return { households: [], nextHouseholdId: 1 };
}

export function householdFor(store, propertyId) {
  return store.households.find((h) => h.propertyId === propertyId) || null;
}

export function householdOf(store, memberId) {
  return store.households.find((h) => h.memberIds.includes(memberId)) || null;
}

// Called once a property is purchased or rented -- the household
// starts with just its resident, the same way a lease starts with
// its tenant. Idempotent: a second call for the same property returns
// the existing household rather than creating a duplicate.
export function ensureHousehold(store, { propertyId, ownerId }) {
  if (!propertyId) throw new Error('ensureHousehold requires a propertyId');
  if (!ownerId) throw new Error('ensureHousehold requires an ownerId');
  const existing = householdFor(store, propertyId);
  if (existing) return existing;

  const household = { id: store.nextHouseholdId++, propertyId, memberIds: [ownerId] };
  store.households.push(household);
  return household;
}

// Invites another resident onto a property's household. Refuses if
// the invitee already lives somewhere else -- a person belongs to
// exactly one household, matching VACON-C's own `householdOf` (a
// single `find`, so no entity is ever double-counted).
export function addMember(store, { propertyId, memberId }) {
  if (!memberId) throw new Error('addMember requires a memberId');
  const household = householdFor(store, propertyId);
  if (!household) throw new Error(`addMember: no household for property ${propertyId}`);
  if (householdOf(store, memberId)) {
    throw new Error(`addMember: "${memberId}" already belongs to a household`);
  }
  household.memberIds.push(memberId);
  return household;
}

// A resident moving out. Refuses to empty a household to zero members
// -- the last resident vacating is a property-level event
// (`property.js`'s own eventual move/sell path), not a households
// concern, so this module never silently produces a zero-member row.
export function removeMember(store, { propertyId, memberId }) {
  const household = householdFor(store, propertyId);
  if (!household) throw new Error(`removeMember: no household for property ${propertyId}`);
  const idx = household.memberIds.indexOf(memberId);
  if (idx === -1) throw new Error(`removeMember: "${memberId}" does not live there`);
  if (household.memberIds.length === 1) {
    throw new Error(`removeMember: "${memberId}" is the only resident -- a household is never emptied to zero`);
  }
  household.memberIds.splice(idx, 1);
  return household;
}

export function householdSize(store, propertyId) {
  const household = householdFor(store, propertyId);
  return household ? household.memberIds.length : 0;
}
