// server/households.js
//
// Who actually lives together.
//
// **A family is a lineage; a household is an address.** The engine had
// only the first, and `mean_household_size` measured family size and
// called it household size — which is not a rounding error, it is a
// different quantity. Somebody living alone next door to their brother
// is one family and two households, and a lodger is a household member
// and no relation at all.
//
// `households` was a table with no WorldState array and no code. The
// substrate for it already existed: `npcs.home_property_id` is set for
// every resident by `worldgen`, so who shares a dwelling was knowable
// and nothing grouped them.
//
// ---------------------------------------------------------------------
// Derived, and stored anyway — the same argument as archetypes
//
// A household IS computable: group the living by `home_property_id`.
// Standing rule 3 forbids storing a computable rollup, so the question
// is why this table exists at all, and the answer is in what the schema
// gives it — an `id`. A household with an identity is something other
// rows can point AT: a property's occupants, a future lease, a utility
// bill, a census. A recomputed grouping has no identity and cannot be
// referenced, which is exactly what `families` has and `households`
// would otherwise duplicate.
//
// So this is kept in sync rather than recomputed per read, and the sync
// is a crossing: a row is written when the membership of a dwelling
// actually CHANGES. A version that rewrote every household every tick
// would be a stored rollup in the rule's plain sense.
//
// ---------------------------------------------------------------------
// It also writes `properties.occupants`, which nothing did
//
// `tick.js`'s own header names this gap in its list of what keeps the
// Migration phase thin: "properties exist to move into, but nothing
// chooses a destination or writes `occupants`". Half of that is closed
// here — `occupants` is now the household living in the building, which
// is what the column means. Choosing a destination is migration's job
// and stays open.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextHouseholdId = 1;

function reseedIds(worldState) {
  nextHouseholdId = nextAfter(worldState.households, 'id');
  return { nextHouseholdId };
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function householdsIn(worldState, communityId = null) {
  const properties = new Map((worldState.properties || []).map((p) => [p.id, p]));
  return (worldState.households || []).filter((h) => {
    if (communityId === null) return true;
    const property = properties.get(h.property_id);
    return property ? property.community_id === communityId : false;
  });
}

function householdOf(worldState, entityId) {
  return (worldState.households || []).find(
    (h) => (h.member_entity_ids || []).includes(entityId),
  ) ?? null;
}

function membersOf(worldState, householdId) {
  const household = (worldState.households || []).find((h) => h.id === householdId);
  return household ? [...(household.member_entity_ids || [])] : [];
}

// Mean household size in an area, or null when there are no households
// there. **Null rather than 0** — an area with no dwellings has no
// household size, which is a different fact from having households of
// size zero, and a zero here would drag a world-level mean down.
function meanSizeIn(worldState, communityId = null) {
  const sizes = householdsIn(worldState, communityId)
    .map((h) => (h.member_entity_ids || []).length)
    .filter((n) => n > 0);
  if (sizes.length === 0) return null;
  return Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 100) / 100;
}

// How many people live alone. A real demographic reading that family
// membership cannot produce at all — somebody with a large family who
// lives by themselves is a one-person household.
function soloShareIn(worldState, communityId = null) {
  const households = householdsIn(worldState, communityId)
    .filter((h) => (h.member_entity_ids || []).length > 0);
  if (households.length === 0) return null;
  const solo = households.filter((h) => h.member_entity_ids.length === 1).length;
  return Math.round((solo / households.length) * 10000) / 10000;
}

// ---------------------------------------------------------------------
// Keeping it true
// ---------------------------------------------------------------------

// Who lives where, right now, from the living population.
//
// **The living only.** `mortality.recordDeath` moves a dead person out
// of `worldState.npcs`, so iterating npcs is what makes a household
// shrink when somebody dies without this module having to know about
// death at all.
function occupancyNow(worldState) {
  const byProperty = new Map();
  for (const npc of worldState.npcs || []) {
    const propertyId = npc.home_property_id;
    if (propertyId === null || propertyId === undefined) continue;
    const list = byProperty.get(propertyId) ?? [];
    list.push(npc.id);
    byProperty.set(propertyId, list);
  }
  // Sorted so two runs of the same world produce the same membership
  // array rather than one that depends on npc array order — the same
  // determinism §88 asks of everything else.
  for (const list of byProperty.values()) list.sort((a, b) => a - b);
  return byProperty;
}

const sameMembers = (a = [], b = []) => a.length === b.length && a.every((id, i) => id === b[i]);

// Bring `households` and `properties.occupants` into line with who is
// actually living where, and report what changed.
//
// Returns the changes rather than events, because whether a household
// forming is worth an event is the caller's call — `runHouseholds`
// makes it, and a scenario setting a world up should not fill the log.
function syncHouseholds(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const occupancy = occupancyNow(worldState);
  const changes = { formed: [], changed: [], dissolved: [] };

  const existing = new Map(
    (worldState.households || []).map((h) => [h.property_id, h]),
  );

  for (const [propertyId, members] of occupancy) {
    const household = existing.get(propertyId);
    if (!household) {
      const row = {
        id: nextHouseholdId++,
        property_id: propertyId,
        member_entity_ids: members,
        // Not schema columns. `formed_tick` is what makes this a record
        // of something that happened rather than a grouping, and
        // `updated_tick` is what a caller checks to see whether a
        // household has been stable. Neither is migrated — see
        // migrate.js, which writes only the three columns that exist.
        formed_tick: tick,
        updated_tick: tick,
      };
      (worldState.households || (worldState.households = [])).push(row);
      changes.formed.push(row);
      continue;
    }
    // **A crossing, not a condition.** Rewriting the array every tick
    // would make this a stored rollup in the plain sense the third
    // standing rule forbids, and would stamp `updated_tick` on a
    // household where nothing happened.
    if (sameMembers(household.member_entity_ids, members)) continue;
    household.member_entity_ids = members;
    household.updated_tick = tick;
    changes.changed.push(household);
  }

  // A dwelling nobody lives in any more. The row is KEPT with an empty
  // membership rather than deleted: the household really existed, and
  // `formed_tick` is a fact about the world. An empty one is excluded
  // from `meanSizeIn` so it cannot drag the average toward zero.
  for (const [propertyId, household] of existing) {
    if (occupancy.has(propertyId)) continue;
    if ((household.member_entity_ids || []).length === 0) continue;
    household.member_entity_ids = [];
    household.updated_tick = tick;
    changes.dissolved.push(household);
  }

  // `properties.occupants` is what the column means and nothing wrote
  // it — see the header. Written from the same pass so the two cannot
  // disagree.
  for (const property of worldState.properties || []) {
    const members = occupancy.get(property.id) ?? [];
    if (sameMembers(property.occupants, members)) continue;
    property.occupants = members;
  }

  return changes;
}

// One tick of people living somewhere. Runs in the cross-cutting slot —
// the pipeline is locked at eleven phases and who shares a roof is not
// a stage of a tick.
//
// Only a dissolution is worth an event. A household forming is the
// normal case at generation (every dwelling at once) and would put
// hundreds of identical rows in the log on tick one; a household
// emptying is a building going vacant, which is a real thing to notice.
function runHouseholds(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const changes = syncHouseholds(worldState, { tick });

  return changes.dissolved.map((household) => ({
    type: 'household_dissolved',
    severity: 'low',
    note: `nobody lives at property ${household.property_id} any more`,
    tick,
    affected_entity_ids: [],
    global_effects: { householdId: household.id, propertyId: household.property_id },
  }));
}

function describeHousehold(worldState, entityId) {
  const household = householdOf(worldState, entityId);
  if (!household) return null;
  return {
    householdId: household.id,
    propertyId: household.property_id,
    members: [...household.member_entity_ids],
    size: household.member_entity_ids.length,
    livesAlone: household.member_entity_ids.length === 1,
    formedTick: household.formed_tick,
  };
}

module.exports = {
  reseedIds,
  householdsIn,
  householdOf,
  membersOf,
  meanSizeIn,
  soloShareIn,
  occupancyNow,
  syncHouseholds,
  runHouseholds,
  describeHousehold,
};
