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
const decisions = require('./decisions.js');
const keysLog = require('./keysLog.js');
const { getLiveEntity } = require('./entityTraits.js');

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

//: How much somebody's own Confidence moves how firmly they hold a
//: reading. At 0.3, a person at 100 holds the same judgement about a
//: third more firmly than one at 0 — centred on 50, so an ordinary
//: person's decisions are logged at exactly the confidence their
//: resolver computed and the trait changes the spread rather than the
//: baseline.
const CONFIDENCE_SWING = 0.3;

// The confidence a decision is actually recorded at: what the resolver
// computed, shifted by who is holding it.
//
// Null in, null out. A resolver that did not compute a confidence has
// not produced a diffident decision — it has produced one nobody
// measured the certainty of, and multiplying that by a trait would
// invent a number.
function heldWith(worldState, entityId, computed) {
  if (computed === undefined || computed === null) return null;
  // `?? 50` rather than `|| 50`: a real 0 is somebody with no certainty
  // at all, and `||` would quietly promote them to average. 50 when
  // there is nothing to read, because unknown is not a zero.
  const live = getLiveEntity(worldState, entityId);
  const raw = Number(live?.traits?.personality?.Confidence ?? 50);
  const confident = Number.isFinite(raw) ? raw : 50;
  return Math.max(0, Math.min(1, computed * (1 + ((confident - 50) / 50) * CONFIDENCE_SWING)));
}

// ---------------------------------------------------------------------------
// key_definitions — the seven, as data
// ---------------------------------------------------------------------------
//
// **`server/completeness.js` declared this table "a module constant
// (keys.js), not per-world state" and the constant did not exist.** So
// `keys_log.key_id` had nothing to reference, which is part of why that
// table had no store: you cannot log which Key resolved without a
// stable id per Key.
//
// Same call `traitDefinitions.js` makes for traits, and for the same
// reason: a definition is a property of the engine rather than of a
// world, so it needs no per-world store. The columns are the schema's
// own — `name`, `category` (its comment enumerates
// human|social|economic|power|world), `inputs` ("list of trait/
// relationship/knowledge fields this Key reads"), `outputs` ("list of
// fields this Key writes back to (memory/relationship/world, per
// 4.3)"), `priority`, `dependencies`.
//
// The categories are not chosen here — they are this file's own section
// headers, which have said World/World/Social/Economic/Human/Power/
// Power since it was written. `inputs` is what each resolver actually
// reads, and `test/keys.test.js` holds the claim against the code
// rather than trusting this comment.
//
// `key_id` is assigned 1-based in the order the resolvers appear below,
// mirroring BIGSERIAL: a stable sequential integer assigned once, not
// reshuffled when a resolver moves.
const KEY_DEFINITIONS = [
  {
    key_id: 1, name: 'Resilience', category: 'world',
    inputs: ['mental.Resilience', 'emotional.Volatility', 'context.setbackSeverity'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 2, name: 'Adaptability', category: 'world',
    inputs: ['mental.Adaptability', 'mental.Focus', 'context.changeMagnitude'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 3, name: 'Trust', category: 'social',
    inputs: ['social.Trustfulness', 'psychological.Paranoia', 'relationships.trust',
      'entity_knowledge'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 4, name: 'ScarcityResponse', category: 'economic',
    inputs: ['survival.Resourcefulness', 'behavioral.Greed', 'entity_knowledge'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 5, name: 'Fear', category: 'human',
    inputs: ['emotional.Volatility', 'psychological.Paranoia', 'entity_knowledge'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 6, name: 'Aggression', category: 'power',
    inputs: ['behavioral.Aggression', 'combat.Tactical Awareness', 'entity_knowledge',
      'relationships.conflict'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
  {
    key_id: 7, name: 'Territory', category: 'power',
    inputs: ['faction.Territorial Instinct', 'survival.Threat Detection',
      'context.claimStrength'],
    outputs: ['memory', 'relationship', 'world', 'decision'],
    probability_curve: null, priority: 0, dependencies: [],
  },
];

const KEY_NAMES = KEY_DEFINITIONS.map((k) => k.name);

// Throws rather than returning null: a resolver logging under a name
// that is not a Key is a typo, and a `keys_log` row with a dangling
// `key_id` is worse than no row.
function keyIdFor(name) {
  const definition = KEY_DEFINITIONS.find((k) => k.name === name);
  if (!definition) {
    throw new Error(`keys: "${name}" is not a Key (one of: ${KEY_NAMES.join(', ')}).`);
  }
  return definition.key_id;
}

// Shared three-way write-back (Section 4.3). `relationship.otherEntityId`
// omitted means the introspective self-relationship fallback (see file
// header, interpretive choice 2).
//
// **Four-way, then five.** `decision_log` was the fourth; `keys_log` is
// the fifth, and it is the one that makes a resolution re-derivable
// rather than merely explained — see server/keysLog.js.
function writeBack(worldState, applyKeyModifier, {
  entityId, tick, memory, relationship, worldTrait, decision,
  resolvedValue = null, context = null,
}) {
  const memoryRow = worldStore.addMemory(worldState, { entityId, tick, ...memory });

  const otherId = relationship.otherEntityId ?? entityId;
  const relationshipRow = worldStore.adjustRelationship(
    worldState, entityId, otherId, relationship.relationshipType, relationship.changes
  );

  const worldRow = worldTrait
    ? applyKeyModifier(entityId, worldTrait.family, worldTrait.name, worldTrait.delta, tick)
    : null;

  // **The fourth write-back.** `decision_log` is one of the most
  // specific tables in the schema — situation, available options,
  // what was chosen, what was expected, confidence, which traits,
  // which keys, which memories, and what actually followed — and it
  // had no WorldState array at all. Every resolver already held all of
  // it and discarded it on every resolution.
  //
  // Here rather than in each of the seven resolvers for the same
  // reason the other three are here: one place that cannot be
  // forgotten. `test/decisions.test.js` asserts every resolver
  // supplies one, because a Key that resolves without saying why
  // would work perfectly and just make the log shorter than it should
  // be.
  // **`personality.Confidence` reads here, and it is the family's
  // home.** How sure somebody is of a judgement is not a property of
  // the judgement — two people can read the same situation the same
  // way and hold it with different certainty. Each resolver supplies
  // the confidence its own weighting implies; this shifts it by who is
  // holding it, which is what `decision_log.confidence` means.
  //
  // **`...decision` spreads FIRST, and that ordering is the whole
  // mechanism.** The first version computed `confidence` above the
  // spread — and every one of the seven resolvers supplies its own
  // `confidence`, so the spread overwrote the computed value on every
  // single call. The trait was read, the arithmetic ran, and the
  // result was discarded before it reached the row. Nothing failed:
  // the family had a reader, the log had a number, and the number was
  // simply the one it would have had if none of this existed. A
  // computed field placed above a spread of its own source is dead
  // code that looks live.
  const decisionRow = decision
    ? decisions.record(worldState, {
      entityId,
      tick,
      // The memory this resolution just wrote is what the entity will
      // draw on next time, so it IS the memory this decision used.
      memoryUsed: memoryRow ? [memoryRow.id] : [],
      ...decision,
      confidence: heldWith(worldState, entityId, decision.confidence),
    })
    : null;

  // **The fifth write-back, and the one that makes a resolution
  // re-derivable.** `decision_log` says somebody chose to escalate with
  // confidence 0.6; it does not say from what, so nobody can recompute
  // the number — the traits have drifted and the relationship has
  // moved. `keys_log.context_json`'s own schema comment asks for a
  // "snapshot of entity_knowledge/relationships read at resolution
  // time", which is exactly what `contest.verifyContest` had to be
  // rebuilt to record after it turned out to verify nothing anybody
  // would want verified.
  //
  // Here rather than in the seven resolvers for the same reason the
  // other four are: one place that cannot be forgotten. The Key's name
  // comes from `decision.keysUsed`, which every resolver already fills
  // and which `test/decisions.test.js` already holds them to.
  // **Skipped when the world has no store for it, and that is not the
  // optional-audit hazard it looks like.** `culture.js`'s `writable`
  // throws for a missing array, on the argument that a world not wired
  // for a system cannot do that system. That argument does not hold
  // here: a world with no `keysLog` array resolves its Keys perfectly
  // and just keeps no receipt. Throwing would mean every hand-made
  // fixture that exercises a resolver has to know about logging, and
  // `writeBack` is the funnel all seven go through, so that is most of
  // the suite.
  //
  // The risk of an optional audit is that it silently does nothing in a
  // real world. `engine.js` declares the array on `WorldState`, so
  // every world the engine actually builds has one — and
  // `test/keys-log.test.js` asserts on a GENERATED world that every
  // resolution is logged, which is standing rule 11's answer: hold the
  // wiring with a measurement of a built world, not with a throw that
  // fixtures have to satisfy.
  const keyName = decision?.keysUsed?.[0] ?? null;
  const keysLogRow = keyName === null || !Array.isArray(worldState.keysLog)
    ? null
    : keysLog.record(worldState, {
    entityId,
    keyId: keyIdFor(keyName),
    resolvedValue,
    // The traits the resolver named, plus whatever of the relationship
    // and the knowledge it read — captured from what `decision` already
    // carries so a resolver cannot supply one and forget the other.
    context: context ?? {
      traits: decision?.traitsUsed ?? [],
      relationship: relationship?.otherEntityId === undefined ? null : {
        otherEntityId: relationship.otherEntityId,
        changes: relationship.changes ?? null,
      },
    },
    tick,
  });

  return { memoryRow, relationshipRow, worldRow, decisionRow, keysLogRow };
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
    resolvedValue: resilienceScore,
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
    decision: {
      situation: `${setbackDescription} (severity ${setbackSeverity})`,
      availableOptions: ['absorb', 'be overwhelmed'],
      selectedOption: netImpact <= setbackSeverity / 2 ? 'absorb' : 'be overwhelmed',
      expectedResult: `net impact ${netImpact}`,
      confidence: resilienceScore / 100,
      traitsUsed: [
        { family: 'emotional', name: 'Resilience', value: resilienceTrait },
        { family: 'physical', name: 'Recovery Rate', value: recoveryRate },
      ],
      keysUsed: ['Resilience'],
    },
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
    resolvedValue: adaptabilityScore,
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
    decision: {
      situation: `${changeDescription} (magnitude ${changeMagnitude})`,
      availableOptions: ['adjust', 'resist'],
      selectedOption: adaptabilityScore >= 50 ? 'adjust' : 'resist',
      expectedResult: `${adjustmentTicks} ticks to adjust`,
      confidence: adaptabilityScore / 100,
      traitsUsed: [
        { family: 'mental', name: 'Adaptability', value: adaptabilityTrait },
        { family: 'mental', name: 'Learning Speed', value: learningSpeed },
      ],
      keysUsed: ['Adaptability'],
    },
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
    resolvedValue: newTrust,
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
    decision: {
      situation: `${interactionDescription} with entity ${otherEntityId}`,
      availableOptions: ['trust more', 'trust less', 'unchanged'],
      selectedOption: trustDelta > 0 ? 'trust more' : trustDelta < 0 ? 'trust less' : 'unchanged',
      expectedResult: `trust ${newTrust}`,
      // **Confidence is how settled the judgement is, not how high it
      // is.** Somebody with a high Trust Threshold is slow to move off
      // a prior, which is exactly what being confident in a reading
      // means here.
      confidence: trustThreshold / 100,
      traitsUsed: [
        { family: 'psychological', name: 'Trust Threshold', value: trustThreshold },
      ],
      keysUsed: ['Trust'],
    },
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
    resolvedValue: perceivedScarcity,
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
    decision: {
      situation: `${resourceType} scarcity`,
      availableOptions: ['hoard', 'share'],
      selectedOption: hoardingResponse > 60 ? 'hoard' : 'share',
      expectedResult: `hoarding response ${hoardingResponse}`,
      confidence: Math.abs(hoardingResponse - 50) / 50,
      traitsUsed: [
        { family: 'economic', name: 'Resource Hoarding', value: hoarding },
        { family: 'economic', name: 'Greed', value: greed },
      ],
      keysUsed: ['ScarcityResponse'],
    },
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
    resolvedValue: fearLevel,
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
    decision: {
      situation: threatDescription,
      availableOptions: ['face it', 'take fright'],
      selectedOption: fearLevel > 50 ? 'take fright' : 'face it',
      expectedResult: `fear level ${fearLevel}`,
      confidence: Math.abs(fearLevel - 50) / 50,
      traitsUsed: [
        { family: 'emotional', name: 'Volatility', value: volatility },
        { family: 'psychological', name: 'Paranoia', value: paranoia },
      ],
      keysUsed: ['Fear'],
    },
  });

  return { key: 'Fear', fearLevel, sourceEntityId: sourceEntityId ?? null, writes };
}

// ---------------------------------------------------------------------------
// Power — Aggression
// ---------------------------------------------------------------------------
// Reads behavioral.Aggression + combat['Tactical Awareness'] (self) +
// context.knowledge about a provocation from otherEntityId.
function resolveAggression(entity, context) {
  const {
    otherEntityId, provocationDescription = 'a provocation', knowledge = [],
    grievance = null, tick, worldState, applyKeyModifier,
  } = context;

  const aggression = traitValue(entity, 'behavioral', 'Aggression');
  const tacticalAwareness = traitValue(entity, 'combat', 'Tactical Awareness');

  // **`grievance` is the provocation the CALLER already holds, and
  // without it this resolver could never escalate anything.**
  //
  // The charge was derived only from `entity_knowledge` about the other
  // party, and measured on a 400-tick world: **0 of 600 knowledge rows
  // were about the other party in any relationship**, so the charge was
  // structurally zero for every pair. That collapses the formula to
  // `aggression * 0.6 - tacticalAwareness * 0.15`, whose maximum on a
  // real population is 25 — against a threshold of 70. Violent, gun and
  // domestic offences were therefore impossible, not merely rare.
  //
  // This is CLAUDE.md's fourteenth standing rule one level deeper than
  // where it was first found. That rule fixed the OUTER gate: the
  // `conflict > threshold` filter whose only writer sat behind it, so
  // no relationship ever qualified. `crime.advanceFriction` gave
  // conflict a real writer and relationships started qualifying — 38 of
  // them — and every one still let it go, because the INNER gate's
  // input had no writer either. Fixing a gate is not the same as
  // fixing the gate behind it.
  //
  // The fix is not a new number. `runSecurityPhase` selects a
  // relationship BY its accumulated conflict and then passes none of
  // that to the resolver. Handing it over invents nothing — it is the
  // same measured grievance the phase already used to decide this pair
  // was worth resolving — and it leaves the 70 threshold exactly where
  // it was, meaning what it always meant.
  const provocationCharge = grievance === null
    ? clamp(Math.round(Math.abs(knowledgeCharge(knowledge)) * 100))
    : clamp(Math.round(Number(grievance) || 0));
  // Tactical Awareness tempers raw aggression into a measured response.
  const responseLevel = clamp(Math.round(aggression * 0.6 + provocationCharge * 0.4 - tacticalAwareness * 0.15));
  //: **30, and getting here took three wrong answers — each one a
  //: different way of not measuring the right population.**
  //:
  //: `responseLevel` is `0.6*aggression + 0.4*provocation -
  //: 0.15*tacticalAwareness`, and the floor is what makes it a
  //: violent offence rather than a bad mood.
  //:
  //:   **70** — the original. Chosen as if this expression spanned
  //:   0..100. It does not: provocation reaches the resolver as
  //:   `relationships.conflict`, whose measured ceiling is about 50, so
  //:   its term contributes at most 20, and the trait half contributes
  //:   at most 60. Nobody ever came close.
  //:
  //:   **60** — measured, and still wrong. The trait half
  //:   `0.6*agg - 0.15*ta` runs p50 21.6, p90 43.2, max 53.7 across a
  //:   generated population of 150, and conflict tops out near 50, so
  //:   68 looked like the ceiling and 60 looked safely under it. A
  //:   1,200-tick world produced **zero** violent offences.
  //:
  //:   **The error both times was the same**: measuring the trait half
  //:   over the WHOLE population and the grievance over the WHOLE
  //:   distribution, then assuming their maxima can co-occur. They
  //:   cannot, because nothing correlates them — `crime.frictionTarget`
  //:   drives conflict from distrust, rivalry and strain and reads
  //:   nothing about aggression. The people in the worst relationships
  //:   are ordinary people.
  //:
  //: So measure the JOINT population the floor actually applies to:
  //: `responseLevel` over the pairs the flashpoint draw selects from,
  //: which is every relationship above CONFLICT_ESCALATION_THRESHOLD.
  //: On a 400-tick world, 44 such pairs, and responseLevel runs **p50
  //: 5, p75 18, p90 24, p95 28, max 36**. A floor of 40 qualifies
  //: nobody. That is the distribution, and it is nothing like the one
  //: either earlier guess imagined.
  //:
  //: 30 sits just above its p95: a handful of pairs in a settlement at
  //: any moment, each with a flashpoint chance of a few thousandths a
  //: tick, which lands violent offences near 500-900 per 100,000 per
  //: year against the deprivation model's ~4,300 for theft. That ratio
  //: is what a real high-crime city has, and it was checked rather than
  //: assumed.
  //:
  //: **The general lesson, which is standing rule 12's third clause
  //: sharpened:** when a threshold reads several inputs, the population
  //: to measure is the joint one at the moment of the check — not each
  //: input's own range. Two maxima that never co-occur produce a
  //: ceiling that does not exist.
  const ESCALATION_RESPONSE_FLOOR = 30;
  const escalatesToConflict = responseLevel >= ESCALATION_RESPONSE_FLOOR;

  const writes = writeBack(worldState, applyKeyModifier, {
    resolvedValue: responseLevel,
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
    decision: {
      situation: `${provocationDescription} from entity ${otherEntityId}`,
      availableOptions: ['let it go', 'escalate'],
      selectedOption: escalatesToConflict ? 'escalate' : 'let it go',
      expectedResult: `response level ${responseLevel}`,
      confidence: tacticalAwareness / 100,
      traitsUsed: [
        { family: 'behavioral', name: 'Aggression', value: aggression },
        { family: 'combat', name: 'Tactical Awareness', value: tacticalAwareness },
      ],
      keysUsed: ['Aggression'],
    },
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
    resolvedValue: defenseLevel,
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
    decision: {
      situation: `${encroachmentDescription} from entity ${otherEntityId}`,
      availableOptions: ['concede', 'contest'],
      selectedOption: contested ? 'contest' : 'concede',
      expectedResult: `defense level ${defenseLevel}`,
      confidence: territorialInstinct / 100,
      traitsUsed: [
        { family: 'faction', name: 'Territorial Instinct', value: territorialInstinct },
        { family: 'faction', name: 'Defection Risk', value: defectionRisk },
      ],
      keysUsed: ['Territory'],
    },
  });

  return { key: 'Territory', defenseLevel, contested, writes };
}

module.exports = {
  KEY_DEFINITIONS,
  KEY_NAMES,
  keyIdFor,
  resolveResilience,
  resolveAdaptability,
  resolveTrust,
  resolveScarcityResponse,
  resolveFear,
  resolveAggression,
  resolveTerritory,
};
