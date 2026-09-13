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

const { nextAfter } = require('./nextAfter.js');
const { hashSeed } = require('./seeded.js');

const { getEntityTraitsForEntity, applyKeyModifier, getLiveEntity, traitsToSheet } = require('./entityTraits.js');
const worldStore = require('./worldStore.js');
const economy = require('./economy.js');
const politics = require('./politics.js');
const technology = require('./technology.js');
const mortality = require('./mortality.js');
const births = require('./births.js');
const crime = require('./crime.js');
const infrastructure = require('./infrastructure.js');
const policing = require('./policing.js');
const keys = require('./keys.js');
const territory = require('./territory.js');
const property = require('./property.js');
const flows = require('./flows.js');
const behavior = require('./behavior.js');
const areaStats = require('./areaStats.js');
const perception = require('./perception.js');
const traitDrift = require('./traitDrift.js');

let nextEventId = 1;

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

  // Infrastructure wears out here for the reason this phase's own
  // comment already gives: it is where the physical world changes on
  // its own. Beside the property lifecycle, not in a phase of its own
  // — the pipeline is locked at eleven. See server/infrastructure.js.
  events.push(...infrastructure.advanceInfrastructure(worldState, worldState.tick));

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

//: How much worse a known shortage has to get before it is news
//: again. Flagged interpretive: no document sets it, and the value
//: only has to be large enough that ordinary tick-to-tick jitter does
//: not re-announce the same shortage.
const SCARCITY_NEWS_STEP = 10;

//: How firmly a scarcity crossing is broadcast. 0.9 rather than 1: a
//: shortage everybody can see is close to certain, not certain. This
//: was an inline literal and is named because `perception.js` now
//: scales it per person — the broadcaster's confidence and the
//: receiver's are different numbers and want different names.
const SCARCITY_NEWS_CONFIDENCE = 0.9;

function runEconomyPhase(worldState) {
  const events = [];

  // **Payroll first, before prices move.** Wages are what people have
  // to spend, so paying them after this tick's prices were resolved
  // would mean everyone shops on last tick's wallet. It also puts the
  // `payroll_missed` events into the same tick's candidate list, so a
  // failing employer is visible to the Event phase rather than only to
  // whoever reads the numbers afterwards.
  //
  // Inside the Economy phase deliberately — the pipeline is locked at
  // eleven phases, and payroll is economy rather than a twelfth thing.
  // **Production before payroll**, because a day's wages come out of
  // that day's takings. Run the other way round and an employer misses
  // payroll on money its staff have already earned — which is what was
  // happening, except that nothing earned anything at all: 1,488
  // `payroll_missed` events in 300 ticks, because `organizations.income`
  // was a column nothing ever wrote. See economy.js#runProduction.
  const production = economy.runProduction(worldState, worldState.tick);
  events.push(...production.events);

  const payroll = economy.runPayroll(worldState, worldState.tick);
  events.push(...payroll.events);

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

  // **News, not weather** — and the difference was 44,899 knowledge
  // rows and 28,016 `fear_spike` events in 300 ticks of a 150-person
  // world, which is 95% of everything the event log contained.
  //
  // This broadcast fired on a CONDITION: every tick a resource sat
  // above the threshold, every NPC in the world received another
  // "verified" knowledge row saying so. Since `runDecisionPhase`
  // resolves Fear and ScarcityResponse for anybody with knowledge
  // acquired THIS tick, every frightened person also re-resolved Fear
  // and re-emitted `fear_spike` every tick for as long as the shortage
  // lasted. Standing rule 7, three systems deep, and the events that
  // mattered — a birth, a death, a crime — were buried under it.
  //
  // A shortage becoming news is an event. A shortage continuing is
  // not: people already know. So the broadcast fires when a resource
  // CROSSES into scarcity, and again only if it worsens materially.
  // `worldState.scarcityNews` holds the level last broadcast per
  // resource type — an in-memory working field with no table, same as
  // `migrationRisk` and `reemergenceIndex` beside it, and losing it on
  // a restore costs at most one extra broadcast.
  worldState.scarcityNews = worldState.scarcityNews || {};

  for (const resource of worldState.resources) {
    const scarcity = scarcityByType.get(resource.resource_type);
    const lastBroadcast = worldState.scarcityNews[resource.resource_type];

    if (scarcity <= SCARCITY_BROADCAST_THRESHOLD) {
      // It has eased. Clear the mark so a fresh crossing is news again.
      delete worldState.scarcityNews[resource.resource_type];
      continue;
    }
    // Already news, and no worse than when it was announced.
    if (lastBroadcast !== undefined && scarcity < lastBroadcast + SCARCITY_NEWS_STEP) continue;
    worldState.scarcityNews[resource.resource_type] = scarcity;

    for (const npc of worldState.npcs) {
      worldStore.addKnowledge(worldState, {
        entityId: npc.id,
        subjectEntityId: null,
        factType: 'verified',
        factContent: `${resource.resource_type} scarcity`,
        // **Not a flat 0.9 any more, and this is where the `special`
        // family reads.** The broadcast is the same for everybody; what
        // each person ends up holding it at is not. Signal Perception
        // is exactly how well a signal is picked up, and
        // `confidence_level` is read by `knowledgeCharge` in keys.js,
        // so this reaches ScarcityResponse, Fear and migration rather
        // than sitting in a column. An ordinary person still gets 0.9.
        confidenceLevel: perception.receivedConfidence(worldState, npc.id, SCARCITY_NEWS_CONFIDENCE),
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

    const knowledge = worldStore.getKnowledge(worldState, relationship.entity_a_id, relationship.entity_b_id);

    // **Contact is not a reassessment, and conflating them wrote a
    // memory of nothing happening 445 times a tick.** `resolveTrust`
    // moves trust by the CHARGE of what this entity knows about the
    // other; with no new knowledge the charge is 0, trust cannot move,
    // and the Key still wrote a "Trust reassessed: 50 -> 50" memory
    // for every relationship in the world on every tick. Measured on a
    // generated world: 53,401 memories after 120 ticks, growing without
    // bound, which is what made the long runs this engine needs for its
    // own calibration take a quarter of an hour.
    //
    // Standing rule 1 is untouched — a Key that RUNS still writes back
    // to all three. What changes is that a Key with nothing to resolve
    // is not run. The relationship still records that the two met:
    // `adjustRelationship` with no changes increments
    // `interaction_count`, which is what `births.advanceBonds` reads,
    // so bonds keep forming on contact exactly as before.
    if (knowledge.length === 0) {
      worldStore.adjustRelationship(
        worldState, relationship.entity_a_id, relationship.entity_b_id,
        relationship.relationship_type || 'social', {},
      );
      continue;
    }

    const entityA = getLiveEntity(worldState, relationship.entity_a_id);
    keys.resolveTrust(entityA, {
      tick: worldState.tick,
      worldState,
      applyKeyModifier: (entityId, family, name, delta, tick) => applyKeyModifier(worldState, entityId, family, name, delta, tick),
      otherEntityId: relationship.entity_b_id,
      interactionDescription: 'ongoing contact',
      knowledge,
    });
  }

  // **Bonds form here, and they had to start somewhere.**
  // `relationships.love` is initialised to 0 and was written by
  // nothing — six of the twelve dimensions are written and love was
  // not one — so `births.js`'s partnership threshold could never be
  // reached and no child could ever be born in a running world. This
  // runs after `resolveTrust` above, so a bond reads the interaction
  // count and trust this tick just produced. See server/births.js.
  return births.advanceBonds(worldState, worldState.tick);
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
//: How often somebody stops to consider their own situation, in ticks.
//: Seven — a tick is a day, so roughly weekly, which spreads the whole
//: population across the interval rather than resolving everybody at
//: once. Flagged interpretive: no document sets a cadence.
const REFLECTION_INTERVAL = 7;

function runDecisionPhase(worldState) {
  const events = [];
  const decided = new Set();
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
    decided.add(npc.id);
  }

  // **The other thing this phase was missing: people deciding about
  // their own lives.** Measured, a generated world ran forty ticks and
  // recorded ZERO decisions — the phase fired only on fresh scarcity
  // knowledge, the Social phase resolves Trust only when there is
  // knowledge to reassess, and Security resolves Aggression only for a
  // relationship already carrying conflict above 30. So in an ordinary
  // world none of the seven Key resolvers ran at all, and the decision
  // machinery this engine is built around sat idle.
  //
  // Everybody considers their own situation, on their own cadence.
  // **Not everybody every tick** — that is how the Fear spike came to
  // fire 28,016 times in 300 ticks — but on a seeded weekly rota, so
  // roughly a seventh of the population decides something on any given
  // day and the same world always produces the same decisions.
  for (const npc of worldState.npcs) {
    if (decided.has(npc.id)) continue;
    if (hashSeed([npc.id, 'reflect']) % REFLECTION_INTERVAL
        !== worldState.tick % REFLECTION_INTERVAL) continue;

    const live = getLiveEntity(worldState, npc.id);
    if (!live) continue;
    const bound = {
      tick: worldState.tick, worldState, applyKeyModifier: boundApplyKeyModifier,
    };

    // **The Key that fits the situation**, rather than a random one.
    // Which resolver applies is itself a reading of the world: somebody
    // under real strain is weathering a setback, somebody in a quarrel
    // is deciding whether to escalate, and somebody with neither is
    // adjusting to a world that keeps changing around them.
    const state = behavior.getEntityState(worldState, npc.id);
    const stress = state?.stressLevel ?? 0;
    const quarrel = worldState.relationships.find(
      (r) => r.entity_a_id === npc.id && (r.conflict ?? 0) > 0,
    );

    if (stress >= 50) {
      keys.resolveResilience(live, { ...bound, setbackDescription: 'a hard stretch', setbackSeverity: Math.round(stress) });
    } else if (quarrel) {
      keys.resolveAggression(live, {
        ...bound,
        otherEntityId: quarrel.entity_b_id,
        provocationDescription: 'an unsettled quarrel',
        knowledge: worldStore.getKnowledge(worldState, npc.id, quarrel.entity_b_id),
      });
    } else {
      keys.resolveAdaptability(live, { ...bound, changeDescription: 'the way things are going' });
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

//: How much worse a standing migration risk has to get before it is
//: reported again. Flagged interpretive, same as the scarcity step.
const MIGRATION_RISK_STEP = 10;

function runMigrationPhase(worldState) {
  const events = [];
  const risks = [];

  // **The same condition-versus-crossing failure as the scarcity
  // broadcast, and the largest single source of noise left in the
  // event log: 11,809 events in 300 ticks.** This risk is computed
  // from Volatility and Resource Hoarding, which barely move — so the
  // same people crossed the threshold on tick 1 and re-announced it
  // every tick for the rest of their lives.
  //
  // `worldState.migrationRisk` already holds last tick's snapshot,
  // because this phase overwrites it rather than accumulating. That is
  // exactly the prior state a crossing needs, so no new field is
  // required — it only has to be read before it is replaced.
  const previous = new Map(
    (worldState.migrationRisk || []).map((r) => [r.entity_id, r.risk]),
  );

  for (const npc of worldState.npcs) {
    const live = getLiveEntity(worldState, npc.id);
    const volatility = live.traits.emotional?.Volatility ?? 0;
    const hoarding = live.traits.economic?.['Resource Hoarding'] ?? 0;
    const risk = Math.round((volatility + hoarding) / 2);

    if (risk > MIGRATION_RISK_THRESHOLD) {
      risks.push({ entity_id: npc.id, risk });
      const was = previous.get(npc.id);
      // Newly at risk, or materially worse than when it was last
      // reported. Somebody who has been at risk since tick 1 is not
      // news on tick 900.
      const crossed = was === undefined || was <= MIGRATION_RISK_THRESHOLD
        || risk >= was + MIGRATION_RISK_STEP;
      if (!crossed) continue;
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

  // **Politics, inside this phase rather than as a twelfth.** A
  // government is an organization subtype, so this is where it
  // belongs; the pipeline is locked at eleven phases.
  //
  // Snapshots public opinion, then assesses whether any government has
  // lost enough support — among enough people who have actually heard
  // of it — to face a revolution. Both events land in this tick's
  // candidate list, so the Event phase sees them.
  const political = politics.runPolitics(worldState, worldState.tick);
  events.push(...political.events);

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
      // **The escalation is named, not just noted.** Before this, the
      // only record of a violent act was the English sentence below,
      // so §9's seven crime categories had nothing to count and no
      // way to attribute what happened to a place. `recordEscalation`
      // does not re-decide anything — the aggression key already ran
      // and already said this escalates; it classifies the result as
      // `domestic` or `violent` and files it against a community.
      const incident = crime.recordEscalation(worldState, {
        perpetratorId: relationship.entity_a_id,
        victimId: relationship.entity_b_id,
        tick: worldState.tick,
        responseLevel: outcome.responseLevel,
      });

      events.push({
        type: 'conflict_escalation', severity: 'high',
        note: `Conflict escalated between entity ${relationship.entity_a_id} and entity ${relationship.entity_b_id}`,
        tick: worldState.tick,
        affected_entity_ids: [relationship.entity_a_id, relationship.entity_b_id],
        global_effects: { crimeIncidentId: incident.id, crimeCategory: incident.category },
      });
    }
  }

  // Deprivation crime — theft and property offences driven by poverty
  // and shortage, read from the environment exactly as mortality reads
  // it. Inside this phase rather than beside it: the pipeline is
  // locked at eleven, and crime is what Security is for.
  for (const incident of crime.runDeprivationCrime(worldState, worldState.tick)) {
    events.push({
      type: 'crime', severity: incident.severity >= 60 ? 'high' : 'medium',
      note: `${incident.category} offence by entity ${incident.perpetrator_entity_id}`
        + `${incident.victim_entity_id === null ? '' : ` against entity ${incident.victim_entity_id}`}`,
      tick: incident.tick,
      affected_entity_ids: [incident.perpetrator_entity_id, incident.victim_entity_id]
        .filter((id) => id !== null),
      global_effects: { crimeIncidentId: incident.id, crimeCategory: incident.category },
    });
  }

  // The policing half of this phase, which did nothing until
  // `server/policing.js` existed. `urbanSystems.js` said so in system
  // 13's own note: "One phase covers this and Crime together. No
  // patrols, investigations, raids, arrests or clearance rates."
  //
  // Runs after the crime half so a case opened this tick is in the
  // list, and clears nothing on the tick it happened — investigation
  // is delayed, which is what makes a backlog visible.
  events.push(...policing.runPolicing(worldState, worldState.tick).events);

  return events;
}

//: **Conditions, not events — and both are needed.** With only events
//: feeding it, 142 of 149 people in a 200-tick world had no
//: `entity_state` row at all: in a quiet world most people simply have
//: nothing happen TO them, so the mood model stayed unengaged for
//: everybody but the handful caught up in a crime or a death.
//:
//: What was missing is the ongoing kind of load. Being poor, being out
//: of work and having nowhere to live are not events — they are
//: circumstances that press every day, and `runBehavior` decays stress
//: every tick, so a small daily load against that recovery settles a
//: person at an equilibrium rather than ratcheting them to crisis.
//: Somebody in poverty sits higher than somebody not, permanently,
//: which is the relationship worth having.
//:
//: Calibrated against proportional recovery: a constant load L settles
//: at `100 * L / rate`, and `recoveryRate` is about 5. So being poor
//: and out of work (2.0) comes to rest near 40 — steady shading into
//: strained — and being poor, jobless and unhoused (4.0) near 80,
//: which is a crisis and should read as one.
const DAILY_POVERTY_STRESS = 1.5;
const DAILY_UNEMPLOYMENT_STRESS = 1;
const DAILY_HOMELESS_STRESS = 1.5;
const DAILY_SETTLED_RELIEF = -0.5;

// The load somebody's circumstances put on them today.
//
// **Reads the same poverty depth `crime.js` reads**, through
// `areaStats.povertyDepth`, rather than a second definition of what
// being poor means. One environment, several systems reading it — the
// rule `mortality` and `births` already follow.
//
// **It lives here rather than in behavior.js**, which is where stress
// otherwise lives, because it needs poverty, employment and age —
// and `mortality.js` already requires `behavior.js` to release a dead
// person's routine. Reaching back the other way is the cycle that
// broke `items.js` out of `barter.js` an hour ago. `behavior` stays
// close to a leaf; `tick` is the file allowed to know about
// everything, and already holds the other cross-cutting thresholds.
function applyConditionStress(worldState, options = {}) {
  const { line = null, tick = worldState.tick ?? 0 } = options;
  let loaded = 0;

  const employed = new Set((worldState.employmentRecords || [])
    .filter((r) => r.status === 'active')
    .map((r) => r.entity_id));

  for (const npc of worldState.npcs) {
    let load = 0;

    if (line !== null) {
      const worth = economy.getNetWorth(worldState, npc.id);
      load += areaStats.povertyDepth(worth, line) * DAILY_POVERTY_STRESS;
    }

    // **Only for somebody old enough to work.** A child is not
    // unemployed, and counting them would make a young population read
    // as a distressed one.
    const age = mortality.ageInYears(worldState, npc, tick);
    if (age !== null && age >= 16 && age < 65 && !employed.has(npc.id)) {
      load += DAILY_UNEMPLOYMENT_STRESS;
    }

    if (npc.home_property_id === null || npc.home_property_id === undefined) {
      load += DAILY_HOMELESS_STRESS;
    } else {
      load += DAILY_SETTLED_RELIEF;
    }

    if (load === 0) continue;
    behavior.applyStress(worldState, npc.id, load);
    loaded += 1;
  }

  return { loaded };
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
    const record = worldStore.addHistoricalRecord(worldState, {
      who: event.affected_entity_ids,
      what: event.note,
      when_tick: event.tick,
      where_location_id: null,
      why: event.type,
      result: null,
      consequences: null,
      future_effects: null,
      significance: 80,
    });
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

  // **Technology, after the index it depends on.** Ordering is the
  // whole point: `canUnlock` reads `worldState.reemergenceIndex`, so
  // running this first would test every civilization against last
  // tick's capability. Same mistake the Economy phase already fixed
  // when it priced listings before computing scarcity.
  //
  // Not a twelfth phase — civilization coming back is this phase's own
  // subject, and the pipeline is locked at eleven.
  const advanced = technology.runTechnology(worldState, worldState.tick);
  worldState.technologyEvents = advanced.events;

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
  // **What the world just did, done to the people it happened to.**
  // `entity_state`, `habits` and `schedule_events` were all three
  // empty in every running world — 0 rows each after 300 ticks of a
  // 150-person world — because `applyStress` was reachable only
  // through the API and nothing ever added a schedule. The Behavior
  // Engine was complete and never engaged.
  //
  // Runs BEFORE `runBehavior` so the same tick that produced a death
  // or a robbery is the tick somebody is shaken by it — and
  // `runBehavior`'s first act is to decay stress, so applying it after
  // would mean every load was already a tick stale.
  behavior.applyEventStress(worldState, candidateEvents, worldState.tick);
  applyConditionStress(worldState, {
    line: areaStats.povertyLine(worldState), tick: worldState.tick,
  });

  candidateEvents.push(...behavior.runBehavior(worldState));   // (behavior)

  // Mortality. The third cross-cutting layer, in the same slot and for
  // a sharper version of the same reason: it must run AFTER phase 8,
  // because the Security phase is what can kill somebody violently,
  // and BEFORE phases 9 and 10, so a death becomes an event and a
  // historical record on the tick it happened rather than the next one.
  //
  // Not a twelfth phase. Death is not a stage of a tick — it is a
  // consequence of every stage, which is exactly what a cross-cutting
  // layer is for. See server/mortality.js.
  candidateEvents.push(...mortality.runMortality(worldState, worldState.tick).events);

  // Births, in the same cross-cutting slot and for the same reason: a
  // birth and a death are the same kind of event about the same
  // population, and neither is a stage of a tick.
  //
  // **After mortality on purpose.** Run before it and somebody can be
  // born to a parent who dies earlier in the same tick — the child
  // would exist, the historical record would name a parent who was
  // already in `deceased`, and nothing would throw. See
  // server/births.js.
  candidateEvents.push(...births.runBirths(worldState, worldState.tick).events);

  // Trait drift, last of the cross-cutting layers and deliberately at
  // the end of them.
  //
  // **What it fixes.** Measured over 200 ticks across 17,358 trait
  // rows, six of `entity_traits`' seven contributing columns never
  // moved at all — only Key resolvers ever wrote anything, to their
  // own column, on 2.3% of rows. Nobody learned a trade, was hardened
  // or worn down by where they lived, or was changed by the people
  // around them, and `trait_definitions.growth_rate`/`decay_rate` were
  // columns no code applied.
  //
  // Last because it reads what the whole tick produced: the habits
  // `runBehavior` just reinforced, the stress it just decayed, and a
  // population that mortality and births have already settled. A
  // person who died this tick does not spend it learning.
  //
  // Not a twelfth phase — the same cross-cutting slot as behavior,
  // mortality and births, for the same reason. Living is not a stage
  // of a tick.
  traitDrift.runTraitDrift(worldState, {
    tick: worldState.tick,
    scarcity: mortality.survivalScarcity(worldState),
    crimeByCommunity: crime.dangerByCommunity(worldState),
    // A community inherits its city's infrastructure condition — the
    // water systems and roads a block depends on are the city's, not
    // the block's, and `infrastructure` is city-scoped in the schema.
    conditionByCommunity: new Map((worldState.communities || []).map(
      (c) => [c.id, infrastructure.cityCondition(worldState, c.city_id)],
    )),
  });

  const events = runEventPhase(worldState, candidateEvents);   // 9
  const historicalRecords = runHistoryPhase(worldState, events); // 10
  const reemergenceIndex = runReemergencePhase(worldState);    // 11

  return { tick: worldState.tick, events, historicalRecords, reemergenceIndex };
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
  nextEventId = nextAfter(worldState.events);
  // `nextHistoricalRecordId` moved to worldStore.js — see the note
  // there. It was reseeded from here and allocated from here, and the
  // moment a second module started writing history records without an
  // id, a counter only one writer could reach stopped being enough.
  return {
    nextEventId: nextEventId,
  };
}

module.exports = {
  reseedIds,
  addEnvironmentalCondition,
  advanceTick,
};
