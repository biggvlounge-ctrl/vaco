// server/events.js
//
// Local-area events — a real geographic anchor on the one log every
// tick phase already writes to, so a player can see "something
// happened two blocks over" instead of only events that name them
// directly via `affected_entity_ids`.
//
// ---------------------------------------------------------------------
// The real gap, checked directly rather than assumed
// ---------------------------------------------------------------------
// `VACANCY_POSTGRESQL_SCHEMA.sql`'s own `events` table has no location
// column at all — not even a dormant one, unlike `historical_records.
// where_location_id`, which exists but is hardcoded to `null` on every
// write in `tick.js#runHistoryPhase`. Every one of the 28 modules that
// construct a candidate event already carries real location
// information on it, just not in a shape this file invented: `crime.js
// #recordCrime` already derives `community_id` from the victim,
// falling back to the perpetrator (`communityForIncident`), and stores
// it on the CRIME INCIDENT — a separate log from the tick-level
// `events` this file adds location to. This module generalises that
// exact pattern (an entity's real `npcs.communityId`) to the broader
// `affected_entity_ids` array every candidate event already carries,
// rather than inventing a second, disagreeing location mechanism.
//
// `community_id`/`city_id` are stored on the in-memory event object
// only, the same documented posture `city.healthBaseline`/
// `city.hazardRisk` already have — no schema column, so a world
// restored from Postgres loses them, same as those two.
//
// ---------------------------------------------------------------------
// What resolves and what honestly does not
// ---------------------------------------------------------------------
// An event naming a person (the overwhelming majority — crime,
// conflict, bluffing, births, deaths, behavior) resolves through that
// person's own real `communityId`. An event naming an ORGANIZATION
// (business founded/closed, territory status change) resolves through
// a property that organization actually operates
// (`properties.operating_organization_id`), when one exists — a real
// link, not invented for this file. A territory event additionally
// carries its own real `territoryBlockId` in `global_effects`, which
// is checked first since a block's own stored `community_id` is more
// direct than reaching through its faction's operated property.
//
// An event naming neither — or naming only entities with no resolvable
// community (a homeless NPC, an organization with no property) —
// resolves to `{ communityId: null, cityId: null }`. Declared, not
// forced: the thirtieth standing rule's own "a real import nothing
// reads is indistinguishable from not importing it" has a mirror here
// — a location guessed onto an event that has none would be
// indistinguishable from a real one to anything reading it later.

'use strict';

function communityIdForEntity(worldState, entityId) {
  if (entityId === null || entityId === undefined) return null;

  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (npc && npc.communityId !== null && npc.communityId !== undefined) {
    return npc.communityId;
  }

  // Not a person (or a person with no resolvable home) — try the
  // organization path: a business/faction's own operated property
  // already carries a real `community_id` (`property.js`'s own
  // `options.communityId ?? null`, read the identical way
  // `property.dangerDecayMultiplier` already reads it).
  const isOrganization = (worldState.organizations || []).some((o) => o.id === entityId);
  if (!isOrganization) return null;

  const property = (worldState.properties || [])
    .find((p) => p.operating_organization_id === entityId && p.community_id !== null && p.community_id !== undefined);
  return property ? property.community_id : null;
}

// Prefer an explicit, already-real location hint in `global_effects`
// over reaching through an entity — `territory_status_change` carries
// its own `territoryBlockId`, and a block's own stored `community_id`
// (`territory.generateTerritoryBlock`'s own `communityId` option) is
// more direct than resolving through the faction that holds it, which
// may hold several blocks in several communities at once.
function communityIdFromHint(worldState, globalEffects) {
  if (!globalEffects || typeof globalEffects !== 'object') return null;
  if (globalEffects.territoryBlockId !== undefined && globalEffects.territoryBlockId !== null) {
    const block = (worldState.territoryBlocks || []).find((b) => b.id === globalEffects.territoryBlockId);
    if (block && block.community_id !== null && block.community_id !== undefined) {
      return block.community_id;
    }
  }
  return null;
}

function cityIdForCommunity(worldState, communityId) {
  if (communityId === null || communityId === undefined) return null;
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  // `territory.generateCommunity` stores this as `city_id` (snake_case)
  // on the real object, despite taking `cityId` (camelCase) as its own
  // OPTIONS parameter name — checked directly in `territory.js` after
  // a live-verify run against a real generated world returned every
  // community's city as `undefined`. The sixth standing rule's own
  // shape: a field read that does not exist returns nothing, forever,
  // and no fixture built on the same wrong assumption would ever catch
  // it.
  return community && community.city_id !== null && community.city_id !== undefined
    ? community.city_id
    : null;
}

// The one function `tick.js#runEventPhase` calls for every candidate
// event, once, at the moment it is stored — never re-derived later,
// since an entity's own community can move (migration) after the event
// that named them has already happened.
function locationOfEvent(worldState, candidate) {
  const hinted = communityIdFromHint(worldState, candidate.global_effects);
  if (hinted !== null) {
    return { communityId: hinted, cityId: cityIdForCommunity(worldState, hinted) };
  }

  for (const entityId of candidate.affected_entity_ids || []) {
    const communityId = communityIdForEntity(worldState, entityId);
    if (communityId !== null) {
      return { communityId, cityId: cityIdForCommunity(worldState, communityId) };
    }
  }

  return { communityId: null, cityId: null };
}

// ---------------------------------------------------------------------
// Reading events back, scoped to where somebody actually is
// ---------------------------------------------------------------------
// An event naming the viewer directly is always included, regardless
// of scope or location — the pre-existing behavior every caller of
// `GET /api/events` already relies on, never narrowed by this file.
const SCOPES = ['community', 'city'];

function eventsNear(worldState, entityId, options = {}) {
  const { scope = 'city', sinceTick = null, limit = 50 } = options;
  if (!SCOPES.includes(scope)) {
    throw new Error(`eventsNear: "${scope}" is not a scope. The two are: ${SCOPES.join(', ')}.`);
  }

  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  const communityId = npc && npc.communityId !== null && npc.communityId !== undefined
    ? npc.communityId
    : null;
  const cityId = cityIdForCommunity(worldState, communityId);

  const matches = (worldState.events || []).filter((event) => {
    if (sinceTick !== null && event.tick < sinceTick) return false;
    if ((event.affected_entity_ids || []).includes(entityId)) return true;
    if (communityId === null) return false;
    if (scope === 'community') return event.community_id === communityId;
    return cityId !== null && event.city_id === cityId;
  });

  return matches.slice(-limit);
}

// The same scoping, by an explicit community/city rather than a
// living entity — the real shape `GET /api/events?communityId=`/
// `?cityId=` needs, since a caller may not have (or want to resolve
// through) a specific entity.
function eventsIn(worldState, options = {}) {
  const { communityId = null, cityId = null, sinceTick = null, limit = 50 } = options;
  if (communityId === null && cityId === null) {
    throw new Error('eventsIn: pass communityId and/or cityId.');
  }

  const matches = (worldState.events || []).filter((event) => {
    if (sinceTick !== null && event.tick < sinceTick) return false;
    if (communityId !== null && event.community_id === communityId) return true;
    if (cityId !== null && event.city_id === cityId) return true;
    return false;
  });

  return matches.slice(-limit);
}

module.exports = {
  SCOPES,
  locationOfEvent,
  communityIdForEntity,
  eventsNear,
  eventsIn,
};
