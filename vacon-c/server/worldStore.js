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
function findRelationship(worldState, entityAId, entityBId) {
  return worldState.relationships.find(
    (r) => (r.entity_a_id === entityAId && r.entity_b_id === entityBId) ||
           (r.entity_a_id === entityBId && r.entity_b_id === entityAId)
  );
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
  worldState.relationships.push(rel);
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
