// server/tick.js
//
// The 11-phase simulation tick pipeline — locked Day 1 step 8
// ("rebuild advanceTick() into the 11-phase pipeline"). Order per the
// Build Prompt (corrected from an earlier 9-phase count, per Section
// 6 of the architecture doc): Environment -> Resource -> Economy ->
// Social -> Decision -> Migration -> Organization -> Security ->
// Event -> History -> Reemergence. Events are outputs of phases 1-8,
// never rolled independently (Build Prompt, explicit).
//
// Every function here takes `worldState` explicitly, same convention
// as economy.js/worldStore.js — engine.js wraps advanceTick() as the
// bound, convenient `engine.advanceTick()` call. tick.js deliberately
// does NOT require engine.js (avoids a circular dependency, since
// engine.js requires tick.js to expose advanceTick()); it goes
// straight to the lower-level modules (entityTraits.js, keys.js,
// worldStore.js, economy.js) instead.
//
// File-ownership note (Section 8): the architecture doc's own plan
// calls for "phases/ (new, one file per tick phase)" — 11 files. This
// implementation keeps all 11 phases in one file instead, matching the
// pattern already used for keys.js (7 resolvers, one file) and
// worldStore.js/economy.js (several related concerns, one file each)
// rather than switching conventions this late. Flagged in
// dev-docs/phase-8-tick-pipeline/tasks.md in case the finer split is
// wanted later — splitting is mechanical (each function below is
// already self-contained), not a rewrite.
//
// Several phases are honestly minimal because the systems they'd
// normally operate on didn't exist when step 8 first shipped —
// Territory/Community and City are separate, not-numbered locked-scope
// items (see CLAUDE.md's scope list; they don't have their own step in
// "Order of operations" the way steps 1-9 do). Territory/Community was
// since built (see dev-docs/territory-community/) and the Organization
// phase below now uses it for real; Property was since built too (see
// server/property.js) and the Environment phase now ages every standing
// building. What still keeps the Migration phase to a risk signal is
// narrower than it was: properties exist to move into, but nothing
// chooses a destination or writes `occupants`, and City has no
// generation of its own beyond territory.js#generateCity(). Each
// still-minimal phase is commented explaining exactly what's missing,
// not silently faked.

'use strict';

const { getEntityTraitsForEntity, applyKeyModifier, getLiveEntity, traitsToSheet } = require('./entityTraits.js');
const worldStore = require('./worldStore.js');
const economy = require('./economy.js');
const keys = require('./keys.js');
const territory = require('./territory.js');
const property = require('./property.js');
const flows = require('./flows.js');
const behavior = require('./behavior.js');

let nextEventId = 1;
let nextHistoricalRecordId = 1;

// ---------------------------------------------------------------------------
// Environmental conditions — the mechanism for triggering a "drought-
// style cascade" (the locked Definition of Done's own test scenario).
// Not a schema table (environment_state is city-scoped and City isn't
// built) — a minimal, real, in-memory mechanism: a condition applies
// its supply/demand delta to matching resources every tick it's
// active, then expires. This is genuinely how a drought would show up
// mechanically (falling supply, rising demand, tick over tick), just
// without a full weather/climate simulation behind it.
// ---------------------------------------------------------------------------
// condition: { type, resourceType, supplyDelta, demandDelta, ticksRemaining }
function addEnvironmentalCondition(worldState, condition) {
  const entry = { ...condition };
  worldState.activeConditions.push(entry);
  return entry;
}

function runEnvironmentPhase(worldState) {
  const events = [];

  worldState.activeConditions = worldState.activeConditions.filter((condition) => {
    for (const resource of worldState.resources) {
      if (resource.resource_type === condition.resourceType) {
        resource.supply = Math.max(0, resource.supply + (condition.supplyDelta || 0));
        resource.demand = Math.max(0, resource.demand + (condition.demandDelta || 0));
      }
    }
    condition.ticksRemaining -= 1;
    return condition.ticksRemaining > 0;
  });

  // Property lifecycle (Phase 2). Buildings age here rather than in a
  // phase of their own because the pipeline is locked at eleven —
  // `VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md` §"this is an 11-phase
  // pipeline, not 9" settles the count, and a Property phase would make
  // it twelve — and because this is the phase where the
  // physical world changes on its own: conditions arrive, sites finish
  // building, and what is standing wears down another notch. Nothing
  // here demolishes a property or restates its assessed value; both are
  // decisions, and decisions belong to the Decision phase or to a
  // person. See server/property.js.
  for (const prop of worldState.properties || []) {
    const priorStage = prop.lifecycle_stage;
    property.advancePropertyLifecycle(worldState, prop, worldState.tick);

    if (prop.lifecycle_stage !== priorStage) {
      events.push({
        type: 'property_lifecycle_change',
        severity: 'low',
        note: `Property ${prop.id} (${prop.type}) moved from ${priorStage} to ${prop.lifecycle_stage}`,
        tick: worldState.tick,
        // The owner is who this happens to, and an unowned property
        // happens to nobody -- ownership is a read over history, so
        // there is no owner field on the row to reach for.
        affected_entity_ids: (() => {
          const owner = property.getCurrentOwner(worldState, prop.id);
          return owner ? [owner.owner_entity_id] : [];
        })(),
        global_effects: {
          propertyId: prop.id, priorStage, newStage: prop.lifecycle_stage,
        },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Resource — production/consumption per resource type (step 7's
// advanceResourceTick(), run for every tracked resource).
// ---------------------------------------------------------------------------
function runResourcePhase(worldState) {
  for (const resource of worldState.resources) {
    economy.advanceResourceTick(resource);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Economy — supply/demand resolve price + scarcity (Build Prompt,
// phase 3). Also the connection flagged as deferred in
// dev-docs/phase-7-economy/tasks.md: when a resource's scarcity
// crosses 60 (the threshold named elsewhere in the handoff package for
// "Black Market Engine"), every NPC receives real, verified subjective
// knowledge of it — feeding step 4's resolveScarcityResponse/
// resolveFear, which until now only ever received manually-seeded
// knowledge in verification.
//
// Honestly broad, not targeted: no location/Community system exists
// yet to scope the broadcast to "nearby" NPCs specifically, so it
// reaches every NPC in WorldState. Narrowing this is exactly the kind
// of thing Territory/Community (not yet built) would enable.
// ---------------------------------------------------------------------------
const SCARCITY_BROADCAST_THRESHOLD = 60;

function runEconomyPhase(worldState) {
  const events = [];

  // Scarcity is computed BEFORE listings are priced, because prices now
  // depend on it. The original order priced listings first and computed
  // scarcity afterwards, which was harmless only while the two were
  // unconnected -- the cascade test found exactly that disconnection.
  const scarcityByType = new Map();
  for (const resource of worldState.resources) {
    scarcityByType.set(resource.resource_type, economy.getScarcity(resource));
  }

  for (const listing of worldState.marketListings) {
    // null resource_type -> null scarcity -> no input pressure, which
    // is the pre-existing behaviour for any good with no raw input.
    const inputScarcity = listing.resource_type === null || listing.resource_type === undefined
      ? null
      : scarcityByType.get(listing.resource_type) ?? null;
    economy.resolveMarketPrice(listing, worldState.tick, inputScarcity);
  }

  for (const resource of worldState.resources) {
    const scarcity = scarcityByType.get(resource.resource_type);
    if (scarcity <= SCARCITY_BROADCAST_THRESHOLD) continue;

    for (const npc of worldState.npcs) {
      worldStore.addKnowledge(worldState, {
        entityId: npc.id,
        subjectEntityId: null,
        factType: 'verified',
        factContent: `${resource.resource_type} scarcity`,
        confidenceLevel: 0.9,
        tick: worldState.tick,
      });
    }

    events.push({
      type: 'scarcity',
      severity: scarcity > 80 ? 'high' : 'moderate',
      note: `${resource.resource_type} scarcity reached ${scarcity}`,
      tick: worldState.tick,
      affected_entity_ids: [],
      global_effects: { resourceType: resource.resource_type, scarcity },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Social — trust/relationship keys update (Build Prompt, phase 4).
// Resolves resolveTrust() for every existing NPC-NPC relationship
// (not every possible pair — a relationship has to already exist;
// this phase updates standing ties, it doesn't invent new ones).
// ---------------------------------------------------------------------------
function isNpc(worldState, entityId) {
  return worldState.npcs.some((n) => n.id === entityId);
}

function runSocialPhase(worldState) {
  for (const relationship of worldState.relationships) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue; // self-relationships (step 4's introspective-Key fallback) aren't social
    if (!isNpc(worldState, relationship.entity_a_id) || !isNpc(worldState, relationship.entity_b_id)) continue; // Trust reads psychological traits — individual tier only

    const entityA = getLiveEntity(worldState, relationship.entity_a_id);
    const knowledge = worldStore.getKnowledge(worldState, relationship.entity_a_id, relationship.entity_b_id);
    keys.resolveTrust(entityA, {
      tick: worldState.tick,
      worldState,
      applyKeyModifier: (entityId, family, name, delta, tick) => applyKeyModifier(worldState, entityId, family, name, delta, tick),
      otherEntityId: relationship.entity_b_id,
      interactionDescription: 'ongoing contact',
      knowledge,
    });
  }
  return [];
}

// ---------------------------------------------------------------------------
// Decision — NPC choices resolve via Keys (Build Prompt, phase 5).
// Reacts to knowledge acquired THIS tick (from Economy phase's
// scarcity broadcast, or anything else) by resolving
// ScarcityResponse + Fear for whichever NPCs received it.
//
// Matching on `fact_content` (a free-text field) is a real limitation,
// not a design choice: entity_knowledge has no structured "topic"
// column, only fact_type (epistemic status) and free text — flagged
// already in dev-docs/phase-4-key-resolvers/plan.md's interpretive
// choice 1. A real topic system would need a schema addition, not
// something to invent here.
// ---------------------------------------------------------------------------
function runDecisionPhase(worldState) {
  const events = [];
  const boundApplyKeyModifier = (entityId, family, name, delta, tick) => applyKeyModifier(worldState, entityId, family, name, delta, tick);

  for (const npc of worldState.npcs) {
    const freshKnowledge = worldStore.getKnowledge(worldState, npc.id)
      .filter((k) => k.acquired_tick === worldState.tick && typeof k.fact_content === 'string' && k.fact_content.includes('scarcity'));
    if (freshKnowledge.length === 0) continue;

    const resourceType = freshKnowledge[0].fact_content.replace(/\s*scarcity$/, '');
    const live = getLiveEntity(worldState, npc.id);

    keys.resolveScarcityResponse(live, {
      tick: worldState.tick, worldState, applyKeyModifier: boundApplyKeyModifier,
      resourceType, knowledge: freshKnowledge,
    });

    const fearOutcome = keys.resolveFear(getLiveEntity(worldState, npc.id), {
      tick: worldState.tick, worldState, applyKeyModifier: boundApplyKeyModifier,
      threatDescription: `${resourceType} scarcity`, knowledge: freshKnowledge,
    });

    if (fearOutcome.fearLevel > 70) {
      events.push({
        type: 'fear_spike', severity: 'high',
        note: `${npc.name}'s fear spiked to ${fearOutcome.fearLevel} over ${resourceType} scarcity`,
        tick: worldState.tick, affected_entity_ids: [npc.id], global_effects: {},
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Migration — NPCs may relocate based on scarcity+fear keys (Build
// Prompt, phase 6). Property, Territory and Community now all exist, so
// there ARE places to relocate anyone to — what is still missing is the
// choosing: nothing scores a destination against an NPC's situation,
// and nothing writes `properties.occupants` or moves a community's
// population. Until that exists this phase honestly stops at computing
// and recording a migration-risk signal from each NPC's CURRENT
// (post-Decision-phase)
// emotional.Volatility + economic.Resource Hoarding, not moving
// entities anywhere. WorldState.migrationRisk is overwritten each
// tick with the latest snapshot, not accumulated.
// ---------------------------------------------------------------------------
const MIGRATION_RISK_THRESHOLD = 65;

function runMigrationPhase(worldState) {
  const events = [];
  const risks = [];

  for (const npc of worldState.npcs) {
    const live = getLiveEntity(worldState, npc.id);
    const volatility = live.traits.emotional?.Volatility ?? 0;
    const hoarding = live.traits.economic?.['Resource Hoarding'] ?? 0;
    const risk = Math.round((volatility + hoarding) / 2);

    if (risk > MIGRATION_RISK_THRESHOLD) {
      risks.push({ entity_id: npc.id, risk });
      events.push({
        type: 'migration_risk', severity: risk > 80 ? 'high' : 'moderate',
        note: `${npc.name} showing migration risk (${risk}) — no relocation system built yet`,
        tick: worldState.tick, affected_entity_ids: [npc.id], global_effects: {},
      });
    }
  }

  worldState.migrationRisk = risks;
  return events;
}

// ---------------------------------------------------------------------------
// Organization — factions/orgs gain or lose territory, resources
// (Build Prompt, phase 7). Was an explicit no-op until Territory/
// Community existed (flagged in dev-docs/phase-8-tick-pipeline/plan.md
// — "territory_blocks and faction membership lists don't exist yet").
// Now resolves territory.js#resolveTerritoryControl() for every
// tracked territory_block, transitioning contested/controlled/
// fortified based on the controlling faction's LIVE organization-tier
// traits. See dev-docs/territory-community/plan.md.
// ---------------------------------------------------------------------------
function runOrganizationPhase(worldState) {
  const events = [];

  for (const block of worldState.territoryBlocks) {
    const priorStatus = block.status;
    territory.resolveTerritoryControl(worldState, block, worldState.tick);

    if (block.status !== priorStatus) {
      events.push({
        type: 'territory_status_change',
        severity: block.status === 'contested' ? 'high' : 'moderate',
        note: `Territory block ${block.id} (faction ${block.faction_id}) moved from ${priorStatus} to ${block.status}`,
        tick: worldState.tick,
        affected_entity_ids: [block.faction_id],
        global_effects: { territoryBlockId: block.id, priorStatus, newStatus: block.status },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Security — conflict probability resolved from aggression+territory
// keys (Build Prompt, phase 8). Resolves resolveAggression() for
// NPC-NPC relationships already showing meaningful conflict — this
// phase escalates existing tension, it doesn't invent new
// antagonists. (resolveTerritory() is NOT run here: it reads
// individual-tier faction.'Territorial Instinct', calibrated for one
// NPC feeling territorial about something, not an Organization's own
// 'territory' trait dimension — a different scale entirely. Wiring
// Organization-level territorial behavior needs its own logic, not
// this phase reusing an individual-tier Key incorrectly.)
// ---------------------------------------------------------------------------
const CONFLICT_ESCALATION_THRESHOLD = 30;

function runSecurityPhase(worldState) {
  const events = [];
  const boundApplyKeyModifier = (entityId, family, name, delta, tick) => applyKeyModifier(worldState, entityId, family, name, delta, tick);

  for (const relationship of worldState.relationships) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if (relationship.conflict <= CONFLICT_ESCALATION_THRESHOLD) continue;
    if (!isNpc(worldState, relationship.entity_a_id) || !isNpc(worldState, relationship.entity_b_id)) continue;

    const entityA = getLiveEntity(worldState, relationship.entity_a_id);
    const knowledge = worldStore.getKnowledge(worldState, relationship.entity_a_id, relationship.entity_b_id);
    const outcome = keys.resolveAggression(entityA, {
      tick: worldState.tick, worldState, applyKeyModifier: boundApplyKeyModifier,
      otherEntityId: relationship.entity_b_id, provocationDescription: 'ongoing tension', knowledge,
    });

    if (outcome.escalatesToConflict) {
      events.push({
        type: 'conflict_escalation', severity: 'high',
        note: `Conflict escalated between entity ${relationship.entity_a_id} and entity ${relationship.entity_b_id}`,
        tick: worldState.tick,
        affected_entity_ids: [relationship.entity_a_id, relationship.entity_b_id],
        global_effects: {},
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Event — events emerge FROM phases 1-8, never rolled independently
// (Build Prompt, explicit). Every phase function above returns a plain
// array of candidate events; this phase is what actually stores them
// as real `events` table rows.
// ---------------------------------------------------------------------------
function runEventPhase(worldState, candidateEvents) {
  const stored = [];
  for (const candidate of candidateEvents) {
    const event = {
      id: nextEventId++,
      type: candidate.type,
      severity: candidate.severity ?? null,
      note: candidate.note ?? null,
      tick: candidate.tick,
      affected_entity_ids: candidate.affected_entity_ids ?? [],
      global_effects: candidate.global_effects ?? {},
    };
    worldState.events.push(event);
    stored.push(event);
  }
  return stored;
}

// ---------------------------------------------------------------------------
// History — every significant action writes to historical_records
// (Build Prompt, explicit). "Significant" interpreted as severity
// 'high' — an interpretive threshold, not specified by any doc.
// ---------------------------------------------------------------------------
function runHistoryPhase(worldState, storedEvents) {
  const records = [];
  for (const event of storedEvents) {
    if (event.severity !== 'high') continue;
    const record = {
      id: nextHistoricalRecordId++,
      who: event.affected_entity_ids,
      what: event.note,
      when_tick: event.tick,
      where_location_id: null,
      why: event.type,
      result: null,
      consequences: null,
      future_effects: null,
      significance: 80,
    };
    worldState.historicalRecords.push(record);
    records.push(record);
  }
  return records;
}

// ---------------------------------------------------------------------------
// Reemergence — composite score recalculated from full system state
// (Build Prompt, explicit). Section 6.1: "tier-agnostic (every entity
// tier gets one)... with two real Key resolvers (Resilience and
// Adaptability) doing the actual work." No City/Civilization tier
// exists yet to attach `cities.reemergence_index` to (Territory/
// Community isn't built), so this computes a world-level composite —
// the average of every NPC's current Resilience/Adaptability trait
// values — as a stand-in, stored directly on
// worldState.reemergenceIndex rather than a table row that has
// nowhere to live yet.
// ---------------------------------------------------------------------------
function runReemergencePhase(worldState) {
  if (worldState.npcs.length === 0) {
    worldState.reemergenceIndex = null;
    return null;
  }

  let total = 0;
  for (const npc of worldState.npcs) {
    const live = getLiveEntity(worldState, npc.id);
    total += ((live.traits.emotional?.Resilience ?? 0) + (live.traits.mental?.Adaptability ?? 0)) / 2;
  }
  worldState.reemergenceIndex = Math.round(total / worldState.npcs.length);
  return worldState.reemergenceIndex;
}

// ---------------------------------------------------------------------------
// advanceTick() — runs all 11 phases in order, one simulation tick.
// ---------------------------------------------------------------------------
function advanceTick(worldState) {
  worldState.tick += 1;

  const candidateEvents = [];
  candidateEvents.push(...runEnvironmentPhase(worldState));    // 1
  runResourcePhase(worldState);                                // 2
  candidateEvents.push(...runEconomyPhase(worldState));        // 3
  runSocialPhase(worldState);                                  // 4
  candidateEvents.push(...runDecisionPhase(worldState));       // 5
  candidateEvents.push(...runMigrationPhase(worldState));      // 6
  candidateEvents.push(...runOrganizationPhase(worldState));   // 7
  candidateEvents.push(...runSecurityPhase(worldState));       // 8

  // Named Flow Templates. NOT a twelfth phase -- the pipeline is locked
  // at eleven. Flows are a cross-cutting layer that reads the world the
  // eight producing phases have just finished changing and reports what
  // it means, so its output joins theirs as input to the Event phase
  // exactly like any other candidate event. Data, not code: the ten
  // named flows are rows, and `worldState.flowTemplates` overrides them
  // with no code change. See server/flows.js.
  //
  // Placed after phase 8 and before phase 9 for a reason that matters:
  // run earlier and a flow reads a half-updated world; run after the
  // Event phase and its events would miss the tick they describe.
  candidateEvents.push(...flows.resolveFlows(worldState));     // (flows)

  // The Behavior Engine. Also NOT a twelfth phase, and in the same slot
  // for the same reason: it observes a finished tick. Stress decays,
  // schedules fire, habits are reinforced or fade, and what the world
  // would notice about a person -- an entrenched harmful habit, somebody
  // in crisis -- joins the candidate events.
  //
  // Runs AFTER the Decision phase on purpose. Stress accumulates from
  // what the world just did and modulates the NEXT tick's decisions,
  // never the same tick's: a stress level feeding the phase it was
  // computed from would be a loop whose answer depends on line order.
  // See server/behavior.js.
  candidateEvents.push(...behavior.runBehavior(worldState));   // (behavior)

  const events = runEventPhase(worldState, candidateEvents);   // 9
  const historicalRecords = runHistoryPhase(worldState, events); // 10
  const reemergenceIndex = runReemergencePhase(worldState);    // 11

  return { tick: worldState.tick, events, historicalRecords, reemergenceIndex };
}

module.exports = {
  addEnvironmentalCondition,
  advanceTick,
};
