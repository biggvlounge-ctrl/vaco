// server/keys.js
// Each Key resolver: (entity, context) -> outcome
// context includes: entity_knowledge (subjective, not raw world
// state), relationships, history — never traits alone.
// Every resolver MUST write back to: Memory, Relationships, World
// state. That three-way write-back is the definition of "done" for
// any Key — see VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md Section 4.3.
//
// Locked Day 1 step 4 (see dev-docs/phase-4-key-resolvers/).
//
// 5 Key categories per the architecture doc (4.1): Human, Social,
// Economic, Power, World. The 7 resolvers below are the only Keys
// named or directly implied anywhere in the handoff package:
//   - Resilience, Adaptability (World) — explicitly named for
//     Reemergence, Section 6.1.
//   - Trust (Social) — the tick pipeline's "SOCIAL — trust/
//     relationship keys", Section 6 / Build Prompt.
//   - ScarcityResponse (Economic) — "ECONOMY — supply/demand keys"
//     and migration's "scarcity...keys", pipeline phases 3 and 6.
//   - Fear (Human) — migration's "...+fear keys", pipeline phase 6.
//   - Aggression, Territory (Power) — security's "aggression+
//     territory keys", pipeline phase 8.
//
// Two interpretive choices the docs don't spell out directly, flagged
// in dev-docs/phase-4-key-resolvers/tasks.md for confirmation:
//
// 1. Resolvers never read another entity's raw traits or WorldState
//    ground truth (only "never raw world state directly" is explicit
//    — Section 4.4 / standing rule 2). They read the acting entity's
//    OWN traits (the equation's "ENTITY TRAITS" term, always
//    available) plus pre-filtered entity_knowledge rows the caller
//    supplies via context.knowledge. Retrieving/filtering knowledge is
//    the caller's job (it knows the query intent); interpreting it
//    into an outcome + write-backs is the resolver's job.
//
// 2. Introspective Keys with no natural second party (Resilience,
//    Adaptability, ScarcityResponse) still satisfy the unconditional
//    "every Key writes to Relationships" rule via a self-relationship
//    row (entity_a_id === entity_b_id). Will likely change once
//    Community becomes a real WorldState entity for these to relate
//    to instead of self.

'use strict';

const worldStore = require('./worldStore.js');

function traitValue(entity, family, name, fallback = 50) {
  return entity.traits?.[family]?.[name] ?? fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// Average confidence-weighted "charge" of a knowledge set, roughly
// [-1, 1]: verified/known facts count fully toward positive, false
// facts invert, rumor/assumption/prediction/unknown count as neutral-
// leaning-positive (something worth noting, just unconfirmed), each
// damped by its own confidence_level.
const POSITIVE_FACTS = new Set(['known', 'verified']);
const NEGATIVE_FACTS = new Set(['false']);
function knowledgeCharge(knowledge = []) {
  if (knowledge.length === 0) return 0;
  let total = 0;
  for (const k of knowledge) {
    const confidence = k.confidence_level ?? 0.5;
    const sign = NEGATIVE_FACTS.has(k.fact_type) ? -1 : POSITIVE_FACTS.has(k.fact_type) ? 1 : 0.5;
    total += sign * confidence;
  }
  return total / knowledge.length;
}

// Shared three-way write-back (Section 4.3). `relationship.otherEntityId`
// omitted means the introspective self-relationship fallback (see file
// header, interpretive choice 2).
function writeBack(worldState, applyKeyModifier, { entityId, tick, memory, relationship, worldTrait }) {
  const memoryRow = worldStore.addMemory(worldState, { entityId, tick, ...memory });

  const otherId = relationship.otherEntityId ?? entityId;
  const relationshipRow = worldStore.adjustRelationship(
    worldState, entityId, otherId, relationship.relationshipType, relationship.changes
  );

  const worldRow = worldTrait
    ? applyKeyModifier(entityId, worldTrait.family, worldTrait.name, worldTrait.delta, tick)
    : null;

  return { memoryRow, relationshipRow, worldRow };
}

// ---------------------------------------------------------------------------
// World — Resilience
// ---------------------------------------------------------------------------
// Reads emotional.Resilience + physical.Recovery Rate. How much of a
// setback's severity the entity absorbs vs. actually takes.
function resolveResilience(entity, context) {
  const { setbackDescription = 'a setback', setbackSeverity = 50, tick, worldState, applyKeyModifier } = context;

  const resilienceTrait = traitValue(entity, 'emotional', 'Resilience');
  const recoveryRate = traitValue(entity, 'physical', 'Recovery Rate');
  const resilienceScore = clamp(Math.round(resilienceTrait * 0.6 + recoveryRate * 0.4));
  const severityAbsorbed = Math.round(setbackSeverity * (resilienceScore / 100));
  const netImpact = setbackSeverity - severityAbsorbed;

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: netImpact <= setbackSeverity / 2 ? 'positive' : 'negative',
      category: 'failure',
      description: `Weathered ${setbackDescription} (severity ${setbackSeverity}) — resilience score ${resilienceScore}, absorbed ${severityAbsorbed}.`,
      importance: setbackSeverity,
      emotionLevel: netImpact,
    },
    relationship: { relationshipType: 'self', changes: { shared_history: 1 } },
    worldTrait: { family: 'emotional', name: 'Resilience', delta: Math.round(severityAbsorbed / 20) },
  });

  return { key: 'Resilience', resilienceScore, severityAbsorbed, netImpact, writes };
}

// ---------------------------------------------------------------------------
// World — Adaptability
// ---------------------------------------------------------------------------
// Reads mental.Adaptability + mental.Learning Speed. How quickly the
// entity adjusts to a changed condition.
function resolveAdaptability(entity, context) {
  const { changeDescription = 'a change in conditions', changeMagnitude = 50, tick, worldState, applyKeyModifier } = context;

  const adaptabilityTrait = traitValue(entity, 'mental', 'Adaptability');
  const learningSpeed = traitValue(entity, 'mental', 'Learning Speed');
  const adaptabilityScore = clamp(Math.round(adaptabilityTrait * 0.65 + learningSpeed * 0.35));
  // Higher score -> fewer ticks needed to adjust.
  const adjustmentTicks = Math.max(1, Math.round(changeMagnitude * (1 - adaptabilityScore / 100) / 5));

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: 'neutral',
      category: 'discovery',
      description: `Adjusting to ${changeDescription} (magnitude ${changeMagnitude}) — adaptability score ${adaptabilityScore}, ~${adjustmentTicks} ticks to settle.`,
      importance: changeMagnitude,
      emotionLevel: 0,
    },
    relationship: { relationshipType: 'self', changes: { shared_history: 1 } },
    worldTrait: { family: 'mental', name: 'Adaptability', delta: Math.round(adaptabilityScore / 25) },
  });

  return { key: 'Adaptability', adaptabilityScore, adjustmentTicks, writes };
}

// ---------------------------------------------------------------------------
// Social — Trust
// ---------------------------------------------------------------------------
// Reads psychological.Trust Threshold (self) + context.knowledge
// (subjective impressions of otherEntityId) + any existing
// relationship history with them.
function resolveTrust(entity, context) {
  const { otherEntityId, interactionDescription = 'an interaction', knowledge = [], tick, worldState, applyKeyModifier } = context;

  const trustThreshold = traitValue(entity, 'psychological', 'Trust Threshold');
  const priorRelationship = worldStore.findRelationship(worldState, entity.id, otherEntityId);
  const priorTrust = priorRelationship ? priorRelationship.trust : 50;
  const charge = knowledgeCharge(knowledge); // [-1, 1]

  // Higher Trust Threshold = slower to move off prior trust; knowledge
  // charge pulls it up or down.
  const openness = 1 - trustThreshold / 200; // [0.5, 1] roughly
  const trustDelta = Math.round(charge * 20 * openness);
  const newTrust = clamp(priorTrust + trustDelta, 0, 100);

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: trustDelta > 0 ? 'positive' : trustDelta < 0 ? 'negative' : 'neutral',
      category: 'relationship',
      description: `Trust reassessed after ${interactionDescription} with entity ${otherEntityId}: ${priorTrust} -> ${newTrust}.`,
      importance: Math.abs(trustDelta),
      emotionLevel: trustDelta,
      relatedEntityIds: [otherEntityId],
    },
    relationship: {
      otherEntityId,
      relationshipType: priorRelationship?.relationship_type || 'social',
      changes: { trust: trustDelta },
    },
    worldTrait: { family: 'psychological', name: 'Trust Threshold', delta: trustDelta > 0 ? -1 : 1 },
  });

  return { key: 'Trust', priorTrust, newTrust, trustDelta, writes };
}

// ---------------------------------------------------------------------------
// Economic — ScarcityResponse
// ---------------------------------------------------------------------------
// Reads economic.Resource Hoarding + economic.Greed (self) +
// context.knowledge (subjective awareness of scarcity — never a raw
// scarcity number passed as ground truth).
function resolveScarcityResponse(entity, context) {
  const { resourceType = 'a resource', knowledge = [], tick, worldState, applyKeyModifier } = context;

  const hoarding = traitValue(entity, 'economic', 'Resource Hoarding');
  const greed = traitValue(entity, 'economic', 'Greed');
  const perceivedScarcity = clamp(Math.round(knowledgeCharge(knowledge) * 100)); // knowledge here should skew negative (scarcity = bad news)
  const hoardingResponse = clamp(Math.round((hoarding * 0.5 + greed * 0.3) * (perceivedScarcity / 100) + (perceivedScarcity * 0.2)));

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: hoardingResponse > 60 ? 'negative' : 'neutral',
      category: 'business',
      description: `Perceived scarcity of ${resourceType} at ${perceivedScarcity} — hoarding response ${hoardingResponse}.`,
      importance: perceivedScarcity,
      emotionLevel: hoardingResponse > 60 ? -10 : 0,
    },
    relationship: { relationshipType: 'self', changes: { shared_history: 1 } },
    worldTrait: { family: 'economic', name: 'Resource Hoarding', delta: hoardingResponse > 60 ? 1 : -1 },
  });

  return { key: 'ScarcityResponse', perceivedScarcity, hoardingResponse, writes };
}

// ---------------------------------------------------------------------------
// Human — Fear
// ---------------------------------------------------------------------------
// Reads emotional.Volatility + psychological.Paranoia (self) +
// context.knowledge about a perceived threat. If the knowledge names a
// source entity, the relationship write-back targets that entity's
// `fear` column directly instead of a self-relationship.
function resolveFear(entity, context) {
  const { threatDescription = 'a perceived threat', knowledge = [], tick, worldState, applyKeyModifier } = context;

  const volatility = traitValue(entity, 'emotional', 'Volatility');
  const paranoia = traitValue(entity, 'psychological', 'Paranoia');
  const threatCharge = clamp(Math.round(Math.abs(knowledgeCharge(knowledge)) * 100));
  const fearLevel = clamp(Math.round((volatility * 0.4 + paranoia * 0.4) + threatCharge * 0.2));

  const sourceEntityId = knowledge.find((k) => k.source_entity_id != null)?.source_entity_id
    ?? knowledge.find((k) => k.subject_entity_id != null)?.subject_entity_id;

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: fearLevel > 50 ? 'negative' : 'neutral',
      category: 'trauma',
      description: `Fear response to ${threatDescription}: level ${fearLevel}.`,
      importance: fearLevel,
      emotionLevel: -fearLevel,
      relatedEntityIds: sourceEntityId != null ? [sourceEntityId] : [],
    },
    relationship: {
      otherEntityId: sourceEntityId,
      relationshipType: sourceEntityId != null ? 'social' : 'self',
      changes: { fear: fearLevel > 50 ? Math.round(fearLevel / 10) : 0 },
    },
    worldTrait: { family: 'emotional', name: 'Volatility', delta: fearLevel > 50 ? 1 : 0 },
  });

  return { key: 'Fear', fearLevel, sourceEntityId: sourceEntityId ?? null, writes };
}

// ---------------------------------------------------------------------------
// Power — Aggression
// ---------------------------------------------------------------------------
// Reads behavioral.Aggression + combat['Tactical Awareness'] (self) +
// context.knowledge about a provocation from otherEntityId.
function resolveAggression(entity, context) {
  const { otherEntityId, provocationDescription = 'a provocation', knowledge = [], tick, worldState, applyKeyModifier } = context;

  const aggression = traitValue(entity, 'behavioral', 'Aggression');
  const tacticalAwareness = traitValue(entity, 'combat', 'Tactical Awareness');
  const provocationCharge = clamp(Math.round(Math.abs(knowledgeCharge(knowledge)) * 100));
  // Tactical Awareness tempers raw aggression into a measured response.
  const responseLevel = clamp(Math.round(aggression * 0.6 + provocationCharge * 0.4 - tacticalAwareness * 0.15));
  const escalatesToConflict = responseLevel >= 70;

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: 'negative',
      category: 'conflict',
      description: `Aggression response to ${provocationDescription} from entity ${otherEntityId}: level ${responseLevel}${escalatesToConflict ? ' (escalated)' : ''}.`,
      importance: responseLevel,
      emotionLevel: -responseLevel,
      relatedEntityIds: [otherEntityId],
    },
    relationship: {
      otherEntityId,
      relationshipType: 'social',
      changes: {
        conflict: Math.round(responseLevel / 10),
        hatred: escalatesToConflict ? Math.round(responseLevel / 20) : 0,
      },
    },
    worldTrait: { family: 'behavioral', name: 'Aggression', delta: escalatesToConflict ? 1 : -1 },
  });

  return { key: 'Aggression', responseLevel, escalatesToConflict, writes };
}

// ---------------------------------------------------------------------------
// Power — Territory
// ---------------------------------------------------------------------------
// Reads faction['Territorial Instinct'] + faction['Defection Risk']
// (self) + context.knowledge about an encroachment from otherEntityId.
function resolveTerritory(entity, context) {
  const { otherEntityId, encroachmentDescription = 'an encroachment', knowledge = [], tick, worldState, applyKeyModifier } = context;

  const territorialInstinct = traitValue(entity, 'faction', 'Territorial Instinct');
  const defectionRisk = traitValue(entity, 'faction', 'Defection Risk');
  const encroachmentCharge = clamp(Math.round(Math.abs(knowledgeCharge(knowledge)) * 100));
  // High Defection Risk dampens the territorial response (less invested
  // in defending it).
  const defenseLevel = clamp(Math.round(territorialInstinct * 0.7 + encroachmentCharge * 0.3 - defectionRisk * 0.2));
  const contested = defenseLevel >= 60;

  const writes = writeBack(worldState, applyKeyModifier, {
    entityId: entity.id,
    tick,
    memory: {
      memoryType: contested ? 'negative' : 'neutral',
      category: 'conflict',
      description: `Territorial response to ${encroachmentDescription} from entity ${otherEntityId}: defense level ${defenseLevel}${contested ? ' (contested)' : ''}.`,
      importance: defenseLevel,
      emotionLevel: contested ? -defenseLevel : 0,
      relatedEntityIds: [otherEntityId],
    },
    relationship: {
      otherEntityId,
      relationshipType: 'social',
      changes: { competition: Math.round(defenseLevel / 10), conflict: contested ? Math.round(defenseLevel / 15) : 0 },
    },
    worldTrait: { family: 'faction', name: 'Territorial Instinct', delta: contested ? 1 : 0 },
  });

  return { key: 'Territory', defenseLevel, contested, writes };
}

module.exports = {
  resolveResilience,
  resolveAdaptability,
  resolveTrust,
  resolveScarcityResponse,
  resolveFear,
  resolveAggression,
  resolveTerritory,
};
