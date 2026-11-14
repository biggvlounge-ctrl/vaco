// server/hiddenCaches.js
//
// By direct instruction: "safes... secret compartments and secret
// passageways... things that have been buried or put in the wall...
// these are all missions... stash spots, stash houses, where a lot of
// the inventory and items get kept for organizations, families...
// underground caves, secret passageways, secret spots in woods...
// integrate these all over the country and the world, in houses,
// apartments, especially old things like old Masonic buildings,
// mosque, religious places that have a lot of age, old buildings,
// historic buildings... inside of it will be more artifacts,
// inventory, books, weapons... keys still exist... or have some type
// of knowledge... or it can come from word of mouth."
//
// ---------------------------------------------------------------------
// What was already real, reused rather than duplicated
// ---------------------------------------------------------------------
// `discovery.js` already turns a landmark's own real category into a
// real pool of books/artifacts/items, scaled by `landmarks
// .significanceOf`, and already names `masonic-building`,
// `historic-site`, mosque, church, synagogue, temple and
// `cave-system` among its pools — exactly the places this request
// names. That file's own search is open and finite: anybody can walk
// in and search it down, no key, no knowledge, no word of mouth. This
// file is the GATED layer the user is actually asking for, reusing
// `discovery.poolFor` for landmark properties rather than inventing a
// second content vocabulary, and extending the same idea to ordinary
// residential properties, which `discovery.js` never covered at all.
//
// ---------------------------------------------------------------------
// "These are all missions" — taken literally
// ---------------------------------------------------------------------
// `discovery.js#search` hands a find over immediately. A hidden cache
// does not: `revealCache` generates a real artifact
// (`missions.generateArtifact`, `location_id` pointed at the real
// property, the identical precedent `discovery.js` itself already
// set) and a real mission around it (`missions.generateMission`) —
// the finder then goes through the one real mission state machine
// this engine already has (`acceptMission`/`resolveMission`,
// `payReward`) to actually bring it home, rather than a second,
// parallel "claim" mechanic invented here.
//
// ---------------------------------------------------------------------
// Three real gates, the user's own three words, nothing invented
// ---------------------------------------------------------------------
// **A key** — a real, specific item (`Old Key (cache N)`), registered
// under §26's existing `tools` category the same way `weapons.js`
// registers `pistol`/`rifle` under `protection` — one real item per
// cache, never a universal skeleton key that would open all of them.
// Given to the property's own real current owner at generation, when
// one already exists (`property.getCurrentOwner`); honestly
// unassigned otherwise, the same "nobody holds this yet" posture
// `fraud.js`'s own victim search already holds.
//
// **Knowledge** — a real occupation, not an invented skill check.
// `architect` is `occupations.js`'s own tier-5 Construction post —
// "a contractor... who has the knowledge to see a secret spot" is
// this engine's own real architect, not a new trait threshold.
//
// **Word of mouth** — the real channel `media.js#runWordOfMouth`
// already runs every tick, propagating any `entity_knowledge` row
// that carries a real `spread_rate`. The first person who actually
// finds a cache (by key or by trade) has that fact written with
// `media.CHANNELS.word_of_mouth`'s own real rate — never a second
// rumour mechanism invented for the identical idea.
//
// ---------------------------------------------------------------------
// Stash houses — a declaration, not a second inventory system
// ---------------------------------------------------------------------
// `inventory.js` holds everything by a real `holder_entity_id` — a
// PERSON, never a building, and that has not changed here.
// `designateStashHouse` records which real organization or family a
// property belongs to for this purpose; the actual inventory a stash
// house "keeps" still lives on whichever real person actually holds
// it, same as everywhere else in this engine. Validated against the
// property's own real current owner, so a sponsor can only designate
// ground their own real people genuinely hold.

'use strict';

const discovery = require('./discovery.js');
const property = require('./property.js');
const inventory = require('./inventory.js');
const membership = require('./membership.js');
const worldStore = require('./worldStore.js');
const media = require('./media.js');
const { seededDraw } = require('./seeded.js');

// Flagged interpretive, same posture as `discovery.js`'s own
// `FINDS_PER_SIGNIFICANCE`/`SEARCH_CHANCE`: no document gives a real
// number for how many hidden caches a world should hold, so these are
// chosen to produce the real, stated ORDERING the user asked for
// (old, historic, religious places far more often than an ordinary
// house) rather than fitted against a measured population.
const HISTORIC_CATEGORIES = [
  'masonic-building', 'historic-site', 'church', 'mosque', 'synagogue', 'temple', 'cave-system',
];
const LANDMARK_CACHE_CHANCE = 0.35;
const HISTORIC_CACHE_BONUS = 0.25;
const RESIDENTIAL_CACHE_CHANCE = 0.02;
const RESIDENTIAL_AGE_FOR_BONUS = 40;
const RESIDENTIAL_AGE_BONUS = 0.05;

// An ordinary house's own small, flat pool — "mix in with that" is
// the user's own words for reusing `discovery.js`'s vocabulary, not a
// cathedral's worth of relics behind a water heater.
const RESIDENTIAL_POOL = { itemCategories: ['tools', 'materials'] };

function poolForProperty(propertyRow) {
  if (propertyRow.landmark_category) return discovery.poolFor(propertyRow.landmark_category);
  return RESIDENTIAL_POOL;
}

function chanceFor(propertyRow) {
  if (propertyRow.landmark_category) {
    const bonus = HISTORIC_CATEGORIES.includes(propertyRow.landmark_category) ? HISTORIC_CACHE_BONUS : 0;
    return Math.min(1, LANDMARK_CACHE_CHANCE + bonus);
  }
  const ageYears = Number.isFinite(propertyRow.age) ? propertyRow.age : 0;
  return RESIDENTIAL_CACHE_CHANCE + (ageYears >= RESIDENTIAL_AGE_FOR_BONUS ? RESIDENTIAL_AGE_BONUS : 0);
}

function keyItemNameFor(cacheId) {
  return `Old Key (cache ${cacheId})`;
}

// Scatters hidden caches across every real property a world already
// has — "integrate these all over the country and the world." Opt-in
// at the call site (see `worldgen.js`'s own `config.hiddenCaches`);
// idempotent the same way every other generation pass in this engine
// is — a property that already has a cache is skipped, never given a
// second one.
function generateHiddenCaches(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, seed = worldState.seed ?? 'world' } = options;
  worldState.hiddenCaches = worldState.hiddenCaches || [];
  worldState.barterItems = worldState.barterItems || [];
  const alreadyCached = new Set(worldState.hiddenCaches.map((c) => c.propertyId));

  const created = [];
  (worldState.properties || []).forEach((propertyRow, i) => {
    if (alreadyCached.has(propertyRow.id)) return;
    const pool = poolForProperty(propertyRow);
    if (!pool) return;
    const chance = chanceFor(propertyRow);
    if (seededDraw([seed, 'hidden-cache', propertyRow.id, i]) >= chance) return;

    const cacheId = worldState.hiddenCaches.length + 1;
    const keyItemName = keyItemNameFor(cacheId);
    const cache = {
      id: cacheId,
      propertyId: propertyRow.id,
      category: propertyRow.landmark_category ?? 'residential',
      keyItemName,
      revealed: false,
      claimed: false,
      foundBy: null,
      missionId: null,
    };
    worldState.hiddenCaches.push(cache);

    if (!worldState.barterItems.some((it) => it.name === keyItemName)) {
      worldState.barterItems.push({ name: keyItemName, category: 'tools', origin: 'remnant' });
    }

    const owner = property.getCurrentOwner(worldState, propertyRow.id);
    if (owner) {
      inventory.give(worldState, { entityId: owner.owner_entity_id, itemName: keyItemName, quantity: 1, tick });
    }

    created.push(cache);
  });
  return created;
}

// ---------------------------------------------------------------------
// The three real gates
// ---------------------------------------------------------------------

function isArchitect(worldState, entityId) {
  return (worldState.employmentRecords || []).some(
    (r) => r.status === 'active' && r.entity_id === entityId && r.position === 'architect',
  );
}

function hasKey(worldState, entityId, cache) {
  return inventory.quantityOf(worldState, entityId, cache.keyItemName) > 0;
}

function hasWordOfMouthKnowledge(worldState, entityId, cache) {
  return (worldState.entityKnowledge || []).some(
    (k) => k.entity_id === entityId && k.fact_type === 'hidden_cache' && k.fact_content === String(cache.id),
  );
}

function canAccessCache(worldState, entityId, cacheId) {
  const cache = (worldState.hiddenCaches || []).find((c) => c.id === cacheId);
  if (!cache) return false;
  return hasKey(worldState, entityId, cache)
    || isArchitect(worldState, entityId)
    || hasWordOfMouthKnowledge(worldState, entityId, cache);
}

// ---------------------------------------------------------------------
// Revealing — one real mission, once, per cache
// ---------------------------------------------------------------------

function revealCache(worldState, entityId, cacheId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const cache = (worldState.hiddenCaches || []).find((c) => c.id === cacheId);
  if (!cache) throw new Error(`revealCache: no hidden cache with id ${cacheId}.`);
  if (cache.claimed) return null;
  if (!canAccessCache(worldState, entityId, cacheId)) {
    throw new Error(
      `revealCache: entity ${entityId} has no real key, is not a real architect, and has no `
      + `real word-of-mouth knowledge of cache ${cacheId}.`,
    );
  }

  // eslint-disable-next-line global-require
  const missions = require('./missions.js');
  const propertyRow = (worldState.properties || []).find((p) => p.id === cache.propertyId);

  const artifact = missions.generateArtifact(worldState, {
    name: `hidden find at property ${cache.propertyId}`,
    origin: cache.category,
    locationId: cache.propertyId,
    condition: Math.round(Number(propertyRow?.condition ?? 100)),
  });
  const mission = missions.generateMission(worldState, { artifactId: artifact.id, locationId: cache.propertyId });

  cache.revealed = true;
  cache.claimed = true;
  cache.foundBy = entityId;
  cache.missionId = mission.id;

  // Real word of mouth from here on -- the fact now exists for
  // `media.runWordOfMouth` (already ticking) to carry to whoever this
  // person actually talks to, at the identical real rate the channel
  // itself already has, never a second number for the same idea.
  worldStore.addKnowledge(worldState, {
    entityId,
    factType: 'hidden_cache',
    factContent: String(cache.id),
    confidenceLevel: 100,
    sourceEntityId: entityId,
    spreadRate: media.CHANNELS.word_of_mouth.spreadRate,
    distortionLevel: media.CHANNELS.word_of_mouth.distortion,
    tick,
  });

  return { cacheId: cache.id, artifactId: artifact.id, missionId: mission.id };
}

// ---------------------------------------------------------------------
// Stash houses — a declaration, never a second inventory system
// ---------------------------------------------------------------------

function designateStashHouse(worldState, sponsorEntityId, options = {}) {
  const { propertyId, organizationId = null, familyId = null } = options;
  if (propertyId == null) throw new Error('designateStashHouse requires propertyId.');
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('designateStashHouse requires exactly one of organizationId or familyId.');
  }

  const propertyRow = (worldState.properties || []).find((p) => p.id === Number(propertyId));
  if (!propertyRow) throw new Error(`designateStashHouse: no property with id ${propertyId}.`);

  const owner = property.getCurrentOwner(worldState, propertyRow.id);
  if (!owner) {
    throw new Error(`designateStashHouse: property ${propertyId} has no real recorded owner at all.`);
  }

  if (organizationId != null) {
    const org = (worldState.organizations || []).find((o) => o.id === Number(organizationId));
    if (!org) throw new Error(`designateStashHouse: no organization with id ${organizationId}.`);
    if (org.leader_id !== Number(sponsorEntityId)) {
      throw new Error(`designateStashHouse: entity ${sponsorEntityId} does not lead organization ${organizationId}.`);
    }
    const ownerIsMember = owner.owner_entity_id === Number(sponsorEntityId)
      || !!membership.findMembership(worldState, owner.owner_entity_id, org.id);
    if (!ownerIsMember) {
      throw new Error(
        `designateStashHouse: property ${propertyId}'s real owner is not the sponsor or a real `
        + `member of organization ${organizationId}.`,
      );
    }
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) throw new Error(`designateStashHouse: no family with id ${familyId}.`);
    if (family.head_npc_id !== Number(sponsorEntityId)) {
      throw new Error(`designateStashHouse: entity ${sponsorEntityId} does not head family ${familyId}.`);
    }
    const ownerIsMember = owner.owner_entity_id === Number(sponsorEntityId)
      || (worldState.familyMemberships || []).some(
        (m) => m.entity_id === owner.owner_entity_id && m.family_id === family.id,
      );
    if (!ownerIsMember) {
      throw new Error(
        `designateStashHouse: property ${propertyId}'s real owner is not the sponsor or a real `
        + `member of family ${familyId}.`,
      );
    }
  }

  worldState.stashHouses = worldState.stashHouses || {};
  worldState.stashHouses[propertyRow.id] = { organizationId, familyId, custodianEntityId: owner.owner_entity_id };
  return worldState.stashHouses[propertyRow.id];
}

function stashHouseOf(worldState, propertyId) {
  return (worldState.stashHouses || {})[propertyId] ?? null;
}

module.exports = {
  HISTORIC_CATEGORIES,
  LANDMARK_CACHE_CHANCE,
  HISTORIC_CACHE_BONUS,
  RESIDENTIAL_CACHE_CHANCE,
  RESIDENTIAL_AGE_FOR_BONUS,
  RESIDENTIAL_AGE_BONUS,
  poolForProperty,
  chanceFor,
  keyItemNameFor,
  generateHiddenCaches,
  isArchitect,
  hasKey,
  hasWordOfMouthKnowledge,
  canAccessCache,
  revealCache,
  designateStashHouse,
  stashHouseOf,
};
