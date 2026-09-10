// server/property.js
//
// The Property Engine — Phase 2, and the last of the "complete gaps"
// the Master Architecture Document names in its summary ("Family,
// Community, and Property engines are complete gaps"). Family and
// Community are built; this is the third.
//
// Every function takes `worldState` explicitly, the same convention as
// economy.js / territory.js / worldStore.js. engine.js wraps these as
// the bound, convenient API.
//
// ---------------------------------------------------------------------
// **An apparent conflict between the schema and a standing rule, and
// how it is resolved.**
//
// `VACANCY_POSTGRESQL_SCHEMA.sql` gives `properties` a real `value`
// column. CLAUDE.md standing rule 3 says the opposite: "Never duplicate
// computable rollups (Reemergence, Property Value, Community Health,
// Family Wealth are all computed, never stored)."
//
// Both are honoured by reading them as describing two different
// numbers, which they are:
//
//   - `properties.value` is the ASSESSED value — what the property was
//     entered on the books at. It is set once at generation and is not
//     recomputed. That is a fact about the record, not a rollup.
//   - `currentValue()` is the DERIVED value — assessed value adjusted
//     for condition and lifecycle stage. It is computed on every read
//     and **never written back to the row**, exactly as family wealth
//     is summed from members on every read.
//
// The rule forbids storing a derived number where it can drift from
// its inputs. It does not forbid a column that is an input. If
// `currentValue()` were ever assigned to `property.value`, that would
// break the rule, and there is a test asserting it is not.
//
// ---------------------------------------------------------------------
// **A second conflict, this one inside the schema itself.**
//
// `properties.id` is its own BIGSERIAL. `ownership_records.entity_id`
// is `BIGINT NOT NULL REFERENCES entities(id)`, and its own column
// comment says it holds "the thing being owned (property, business,
// artifact, etc.)". Those two statements cannot both be taken
// literally: if properties number themselves from 1 independently of
// entities, then `entity_id = 3` means both property 3 and NPC 3, and
// the FK it declares would reject the property outright.
//
// The comment says what the table is for; the FK says what makes it
// sound. Both are satisfied by drawing property ids from the shared
// entity counter — `worldState.nextEntityId`, the same one generateNPC
// and generateOrganization already draw from. A property id is then
// unique across the whole world and is a legal `entity_id`. Nothing is
// lost: the Postgres `properties` table keeps its own PK column, it is
// simply written explicitly from the shared sequence rather than left
// to default, which is what migrate.js does with every other id.
//
// This is why properties do NOT get a module-local counter, unlike
// cities/communities/artifacts in territory.js and missions.js — those
// are never named as the subject of an ownership record.
// ---------------------------------------------------------------------

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextOwnershipId = 1;

// Schema comment on properties.type, verbatim.
const PROPERTY_TYPES = [
  'residential', 'commercial', 'industrial', 'government', 'agricultural',
  'mixed', 'farm', 'historical_site', 'digital_property', 'virtual_location',
];

// Schema comment on properties.lifecycle_stage, verbatim, in order.
// 'planning' is the schema's own DEFAULT.
const LIFECYCLE = [
  'planning', 'construction', 'operation', 'maintenance',
  'renovation', 'expansion', 'historical_legacy',
];

// Schema comment on ownership_records.owner_type, verbatim.
const OWNER_TYPES = [
  'individual', 'family', 'organization', 'government', 'civilization',
  'shared', 'community', 'none', 'corporation', 'investment_group', 'digital_owner',
];

// Schema comment on ownership_records.acquired_method, verbatim.
const ACQUIRED_METHODS = [
  'purchased', 'inherited', 'gifted', 'won', 'discovered', 'built', 'stolen', 'recovered',
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Reads and writes treat a missing array differently, on purpose.
//
// A READ over a world with no `properties` array should answer "none" —
// getCitizenDashboard runs against worlds assembled by callers that
// predate this module, and a citizen who owns nothing is a real answer.
//
// A WRITE to a world with no array is a wiring bug, and gets said out
// loud rather than throwing "cannot read properties of undefined".
const rows = (worldState, name) => worldState[name] || [];

function writable(worldState, name) {
  if (!Array.isArray(worldState[name])) {
    throw new Error(
      `property.js: worldState.${name} does not exist. The Property Engine `
      + 'is not wired into this world (engine.js declares both arrays on WorldState).',
    );
  }
  return worldState[name];
}

// ---------------------------------------------------------------------------
// generateProperty()
// ---------------------------------------------------------------------------
// options:
//   type       - required. The schema leaves it nullable, but a property
//                with no type cannot be valued or given a lifecycle, and
//                every other generator in this project fails loudly on a
//                field it genuinely needs rather than inventing one.
//   value      - assessed value. Required for the same reason: a
//                property worth an unstated amount is not a fact.
//   condition  - 0-100, schema DEFAULT 100.
function generateProperty(worldState, options = {}) {
  if (!options.type) {
    throw new Error(
      `generateProperty requires options.type (one of: ${PROPERTY_TYPES.join(', ')}).`,
    );
  }
  if (!PROPERTY_TYPES.includes(options.type)) {
    throw new Error(
      `generateProperty: "${options.type}" is not a property type the schema defines `
      + `(one of: ${PROPERTY_TYPES.join(', ')}).`,
    );
  }
  if (options.value == null) {
    throw new Error('generateProperty requires options.value (the assessed value; there is no sensible default).');
  }
  if (options.lifecycleStage && !LIFECYCLE.includes(options.lifecycleStage)) {
    throw new Error(
      `generateProperty: "${options.lifecycleStage}" is not a lifecycle stage `
      + `(one of: ${LIFECYCLE.join(', ')}).`,
    );
  }

  const store = writable(worldState, 'properties');
  if (typeof worldState.nextEntityId !== 'number') {
    throw new Error(
      'property.js: worldState.nextEntityId is not a number. Property ids come from '
      + 'the shared entity counter so they can be used as ownership_records.entity_id.',
    );
  }

  const property = {
    // Shared entity counter, not a local one. See the header.
    id: worldState.nextEntityId++,
    land_size: options.landSize ?? null,
    type: options.type,
    value: Number(options.value),
    condition: options.condition ?? 100,        // schema DEFAULT 100
    occupants: options.occupants ?? [],
    floors: options.floors ?? null,
    units: options.units ?? null,
    age: options.age ?? 0,
    construction_date: options.constructionDate ?? null,
    utilities: options.utilities ?? {},
    operating_organization_id: options.operatingOrganizationId ?? null,
    density_tier: options.densityTier ?? null,
    lifecycle_stage: options.lifecycleStage ?? 'planning',  // schema DEFAULT
    history_ref: null,
    // Not schema columns. Kept so a property can be placed in the world
    // the Community tier already models: the schema points the other way
    // round (entities.location_id references properties(id)), which
    // locates people in buildings but never buildings in wards.
    community_id: options.communityId ?? null,
    city_id: options.cityId ?? null,
  };
  store.push(property);
  return property;
}

// ---------------------------------------------------------------------------
// currentValue() — DERIVED, never stored. See the header.
// ---------------------------------------------------------------------------
// Interpretive, and flagged as such: no formula for property value
// appears in any document in the handoff package. This one is the
// simplest thing that is defensible and reads the two fields the schema
// actually tracks — a building in poor repair is worth less than the
// same building in good repair, and one still being planned is worth
// less than one in operation.
//
// Multipliers by lifecycle stage. 'operation' is the baseline at 1.0
// because that is a property doing its job.
const STAGE_MULTIPLIER = {
  planning: 0.35,
  construction: 0.6,
  operation: 1,
  maintenance: 0.92,
  renovation: 0.8,
  expansion: 1.1,
  historical_legacy: 1.25,
};

function currentValue(property) {
  if (!property) return 0;
  const stage = STAGE_MULTIPLIER[property.lifecycle_stage] ?? 1;
  // Condition runs 0-100 and is treated as a straight proportion: a
  // building at 50 condition is worth half what it would be at 100.
  const condition = clamp(Number(property.condition) || 0, 0, 100) / 100;
  return Math.round(Number(property.value) * stage * condition);
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------
// ownership_records is append-only by shape: it records that ownership
// was acquired at a tick, not who owns a thing now. "Who owns it" is
// therefore a read over the history, which is why there is no
// `owner_id` column on properties to keep in sync.
function recordOwnership(worldState, options = {}) {
  const { entityId, ownerEntityId, ownerType, acquiredMethod, tick } = options;
  if (entityId == null) throw new Error('recordOwnership requires options.entityId (the thing being owned).');
  if (ownerEntityId == null) throw new Error('recordOwnership requires options.ownerEntityId.');
  if (!ownerType) {
    throw new Error(`recordOwnership requires options.ownerType (one of: ${OWNER_TYPES.join(', ')}).`);
  }
  if (!OWNER_TYPES.includes(ownerType)) {
    throw new Error(
      `recordOwnership: "${ownerType}" is not an owner type the schema defines `
      + `(one of: ${OWNER_TYPES.join(', ')}).`,
    );
  }
  if (acquiredMethod && !ACQUIRED_METHODS.includes(acquiredMethod)) {
    throw new Error(
      `recordOwnership: "${acquiredMethod}" is not an acquisition method the schema defines `
      + `(one of: ${ACQUIRED_METHODS.join(', ')}).`,
    );
  }
  if (tick == null) throw new Error('recordOwnership requires options.tick (ownership_records.acquired_tick is NOT NULL).');

  const record = {
    id: nextOwnershipId++,
    entity_id: entityId,
    owner_entity_id: ownerEntityId,
    owner_type: ownerType,
    acquired_method: acquiredMethod ?? null,
    acquired_tick: tick,
  };
  writable(worldState, 'ownershipRecords').push(record);
  return record;
}

// The current owner is the most recent acquisition, which is what
// append-only history means. Ties on tick resolve to the later row,
// since two acquisitions in one tick happened in the order recorded.
function getCurrentOwner(worldState, entityId) {
  let current = null;
  for (const record of rows(worldState, 'ownershipRecords')) {
    if (record.entity_id !== entityId) continue;
    if (!current || record.acquired_tick >= current.acquired_tick) current = record;
  }
  return current;
}

function getOwnershipHistory(worldState, entityId) {
  return rows(worldState, 'ownershipRecords')
    .filter((r) => r.entity_id === entityId)
    .sort((a, b) => a.acquired_tick - b.acquired_tick || a.id - b.id);
}

// Everything an owner holds, with each one's derived value. The rollup
// a citizen dashboard needs, computed on read like every other rollup.
function getHoldings(worldState, ownerEntityId) {
  const held = [];
  for (const property of rows(worldState, 'properties')) {
    const owner = getCurrentOwner(worldState, property.id);
    if (owner && owner.owner_entity_id === ownerEntityId) {
      held.push({ property, value: currentValue(property), acquired: owner });
    }
  }
  return {
    count: held.length,
    totalValue: held.reduce((sum, h) => sum + h.value, 0),
    properties: held,
  };
}

// ---------------------------------------------------------------------------
// advancePropertyLifecycle() — one tick of wear and progress
// ---------------------------------------------------------------------------
// Interpretive, flagged: no decay rate appears in any document.
//
// A property in `planning` or `construction` progresses toward
// `operation` and does not decay — nothing is wearing out yet. From
// `operation` onward it ages and its condition falls slowly. Nothing
// here demolishes a property or changes its assessed value; both would
// be decisions a person should make, not a side effect of time passing.
const CONDITION_DECAY_PER_TICK = 0.4;
const BUILD_TICKS = 3;

function advancePropertyLifecycle(worldState, property, tick) {
  property.age = (property.age ?? 0) + 1;

  if (property.lifecycle_stage === 'planning' || property.lifecycle_stage === 'construction') {
    if (property.lifecycle_stage === 'planning') {
      property.lifecycle_stage = 'construction';
      property.construction_date = property.construction_date ?? tick;
    } else if (property.age >= BUILD_TICKS) {
      property.lifecycle_stage = 'operation';
    }
    return property;
  }

  // Rounded to one decimal. Repeated subtraction of 0.4 in binary
  // floating point produces 86.39999999999998 after a handful of ticks,
  // which is not more precise than 86.4 -- it is the same number wearing
  // fourteen digits of noise, and every display then has to clean up
  // after the engine.
  property.condition = Math.round(clamp(
    Number(property.condition ?? 100) - CONDITION_DECAY_PER_TICK, 0, 100,
  ) * 10) / 10;
  return property;
}


// ---------------------------------------------------------------------------
// reseedIds — see server/idSequences.js
// ---------------------------------------------------------------------------
// Called after a world is loaded from Postgres. Without it these
// counters restart at 1 against restored rows that already use those
// ids, and two rows end up sharing a primary key with nothing thrown.
// Derived from the rows themselves rather than stored, so it cannot
// disagree with them.
function reseedIds(worldState) {
  nextOwnershipId = nextAfter(worldState.ownershipRecords);
  return {
    nextOwnershipId: nextOwnershipId,
  };
}

module.exports = {
  reseedIds,
  PROPERTY_TYPES,
  LIFECYCLE,
  OWNER_TYPES,
  ACQUIRED_METHODS,
  generateProperty,
  currentValue,
  recordOwnership,
  getCurrentOwner,
  getOwnershipHistory,
  getHoldings,
  advancePropertyLifecycle,
};
