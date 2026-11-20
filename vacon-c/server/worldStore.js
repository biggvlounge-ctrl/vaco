// server/worldStore.js
//
// Minimal in-memory stores for the three things every Key resolver
// must write back to (Section 4.3 / CLAUDE.md standing rule 1):
// Memory (`memories`), Relationships (`relationships`), and subjective
// per-entity Knowledge (`entity_knowledge`) — the fact store Key
// resolvers must read instead of raw WorldState ground truth (Section
// 4.4 / standing rule 2). "World state" itself (the third write-back
// target) is entity_traits.key_modifier, handled in engine.js since
// it needs the trait catalog.
//
// Each array mirrors its literal table shape from
// VACANCY_POSTGRESQL_SCHEMA.sql — same principle as
// WorldState.entityTraits: a straight data copy into Postgres later,
// not a reshape. This is not a general CRUD API — only the read/write
// surface Key resolvers currently need.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextMemoryId = 1;
let nextRelationshipId = 1;
let nextKnowledgeId = 1;
let nextHistoricalRecordId = 1;

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------
function addMemory(worldState, {
  entityId, memoryType, category, description, importance, emotionLevel,
  relatedEntityIds, tick, expiration = 'temporary',
}) {
  const memory = {
    id: nextMemoryId++,
    entity_id: entityId,
    memory_type: memoryType,
    category,
    description,
    importance,
    emotion_level: emotionLevel,
    related_entity_ids: relatedEntityIds || [],
    tick,
    expiration,
    reinforcement_count: 0,
  };
  worldState.memories.push(memory);
  return memory;
}

// ---------------------------------------------------------------------------
// Historical records
// ---------------------------------------------------------------------------
// **This counter lived in tick.js and the id it hands out was the only
// thing keeping `historical_records` insertable.** The History phase
// allocated `nextHistoricalRecordId++` on every record it wrote, and
// that was fine for as long as the History phase was the only writer.
//
// It stopped being the only writer when `mortality.js` started pushing
// a death straight onto `worldState.historicalRecords` — a record with
// no id at all. In memory that is invisible: every read path finds the
// row by `what`/`who`, never by id, so `deathRecordFor` works and every
// test passes. In Postgres it is not: `migrate.js` inserts `h.id` into
// a `BIGSERIAL PRIMARY KEY`, `undefined` arrives as NULL, and the
// migration fails on the first death — a world that looks correct in
// memory and cannot be saved.
//
// Standing rule 6's shape exactly: a value nothing reads is a value
// nothing notices is missing. The counter moved here because every
// writer already imports `worldStore` and `tick.js` cannot be imported
// by `crime.js` or `mortality.js` without a cycle.
function addHistoricalRecord(worldState, record) {
  const row = { id: nextHistoricalRecordId++, ...record };
  worldState.historicalRecords.push(row);
  return row;
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

// A real performance fix, not a new mechanism. `findRelationship` was a
// full scan of the WHOLE `relationships` array on every call, and
// `getOrCreateRelationship` — the single real writer every relationship
// in this engine passes through — called it on every single pair
// touched during generation. So touching N pairs cost O(N * however
// many relationships already existed), the same quadratic shape
// `motivation.js`'s `valueOf`/`needOf` had (CLAUDE.md's hundred-and-
// forty-ninth standing rule). Indexed by the pair's own unordered key
// (order never matters here — `(A,B)` and `(B,A)` are the same row),
// kept current at the one real push site below. `restore.js` replaces
// `relationships` wholesale on a world load, so the index is keyed off
// the array's own identity and rebuilt once, lazily, whenever that
// identity changes.
function pairKey(entityAId, entityBId) {
  return entityAId < entityBId ? `${entityAId}:${entityBId}` : `${entityBId}:${entityAId}`;
}

function relationshipIndex(worldState) {
  const arr = worldState.relationships || (worldState.relationships = []);
  const cache = worldState._relationshipIndex;
  if (cache && cache.arr === arr) return cache.map;
  const map = new Map();
  for (const row of arr) map.set(pairKey(row.entity_a_id, row.entity_b_id), row);
  worldState._relationshipIndex = { arr, map };
  return map;
}

function findRelationship(worldState, entityAId, entityBId) {
  return relationshipIndex(worldState).get(pairKey(entityAId, entityBId));
}

function getOrCreateRelationship(worldState, entityAId, entityBId, relationshipType) {
  const existing = findRelationship(worldState, entityAId, entityBId);
  if (existing) return existing;
  const rel = {
    id: nextRelationshipId++,
    entity_a_id: entityAId,
    entity_b_id: entityBId,
    relationship_type: relationshipType,
    trust: 50,
    respect: 50,
    fear: 0,
    love: 0,
    hatred: 0,
    influence: 0,
    debt: 0,
    communication: 50,
    alliance: 0,
    competition: 0,
    shared_history: 0,
    conflict: 0,
    loyalty: 50,
    interaction_count: 0,
    relationship_age: 0,
  };
  relationshipIndex(worldState); // ensures the array/cache exist
  worldState.relationships.push(rel);
  relationshipIndex(worldState).set(pairKey(entityAId, entityBId), rel);
  return rel;
}

// changes: { fieldName: delta, ... } — applied additively, then clamped
// to each field's natural range where the schema implies one (trust/
// respect/etc. are unbounded NUMERIC in the schema, so no clamp is
// enforced here; callers decide sensible deltas).
function adjustRelationship(worldState, entityAId, entityBId, relationshipType, changes = {}) {
  const rel = getOrCreateRelationship(worldState, entityAId, entityBId, relationshipType);
  for (const [field, delta] of Object.entries(changes)) {
    rel[field] = (rel[field] || 0) + delta;
  }
  rel.interaction_count += 1;
  return rel;
}

// ---------------------------------------------------------------------------
// Entity knowledge (subjective — Key resolvers read this, never ground
// truth directly)
// ---------------------------------------------------------------------------
function addKnowledge(worldState, {
  entityId, subjectEntityId, factType, factContent, confidenceLevel,
  sourceEntityId, spreadRate, distortionLevel, tick,
}) {
  const knowledge = {
    id: nextKnowledgeId++,
    entity_id: entityId,
    subject_entity_id: subjectEntityId ?? null,
    fact_type: factType,
    fact_content: factContent,
    confidence_level: confidenceLevel,
    source_entity_id: sourceEntityId ?? null,
    spread_rate: spreadRate ?? null,
    distortion_level: distortionLevel ?? null,
    acquired_tick: tick,
  };
  worldState.entityKnowledge.push(knowledge);
  return knowledge;
}

function getKnowledge(worldState, entityId, subjectEntityId) {
  return worldState.entityKnowledge.filter(
    (k) => k.entity_id === entityId &&
      (subjectEntityId === undefined || k.subject_entity_id === subjectEntityId)
  );
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
  nextMemoryId = nextAfter(worldState.memories);
  nextRelationshipId = nextAfter(worldState.relationships);
  nextKnowledgeId = nextAfter(worldState.entityKnowledge);
  nextHistoricalRecordId = nextAfter(worldState.historicalRecords);
  return {
    nextMemoryId: nextMemoryId,
    nextRelationshipId: nextRelationshipId,
    nextKnowledgeId: nextKnowledgeId,
    nextHistoricalRecordId: nextHistoricalRecordId,
  };
}

module.exports = {
  reseedIds,
  addMemory,
  addHistoricalRecord,
  findRelationship,
  getOrCreateRelationship,
  adjustRelationship,
  addKnowledge,
  getKnowledge,
};
