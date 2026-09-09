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

let nextMemoryId = 1;
let nextRelationshipId = 1;
let nextKnowledgeId = 1;

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

module.exports = {
  addMemory,
  findRelationship,
  getOrCreateRelationship,
  adjustRelationship,
  addKnowledge,
  getKnowledge,
};
