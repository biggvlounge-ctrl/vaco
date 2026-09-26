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
const drugs = require('./drugs.js');
const gambling = require('./gambling.js');
const warfare = require('./warfare.js');
const behavior = require('./behavior.js');
const areaStats = require('./areaStats.js');
const perception = require('./perception.js');
const traitDrift = require('./traitDrift.js');
const motivation = require('./motivation.js');
const archetypes = require('./archetypes.js');
const competition = require('./competition.js');
const justice = require('./justice.js');
const households = require('./households.js');
const tribeMissions = require('./tribeMissions.js');
const migration = require('./migration.js');
const environment = require('./environment.js');
const statecraft = require('./statecraft.js');
const media = require('./media.js');
const trade = require('./trade.js');
const familyTraits = require('./familyTraits.js');
const control = require('./control.js');
const salvage = require('./salvage.js');
const discovery = require('./discovery.js');
const knowledge = require('./knowledge.js');
const snapshots = require('./snapshots.js');
const { seededDraw } = require('./seeded.js');

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

// **A temporary condition has to have a temporary effect.**
//
// It did not. Every delta a condition applied was permanent, and every
// delta in the engine is negative — droughts, freezes, storms, failed
// harvests — so `resources.supply` was a one-way ratchet and nothing
// anywhere ever raised it. Measured on a two-city world at the default
// settings: city 1's food supply went 107 → 0 over 200 ticks and its
// water 70 → 42, while demand climbed 101 → 141. Scarcity pinned at 100
// and stayed there. **Every world this engine has ever run ended in
// total famine**, and the only thing that varied was how long it took.
//
// That is not a harsh world; it is a broken one, and it made every
// downstream reading a lie. `motivation`'s food need converges on
// supply, so a measurement of 127 people found all 127 sitting at
// exactly the same level with no spread between them at all — which
// meant anything derived from how well fed somebody is was reading a
// world-level constant wearing a person's clothes.
//
// The fix is not a production model. It is that `ticksRemaining`
// already promises the condition ends, and the code did not deliver it:
// what a condition took while it ran is given back when it expires. A
// drought becomes an event with a recovery rather than a permanent step
// down, which is what the word means.
//
// **Restore what was actually taken, not what was asked for.** The
// clamp at 0 means a condition draining a nearly-empty resource takes
// less than its delta says; handing back the delta would create supply
// out of a famine. So each pass records the real movement per resource
// and the expiry replays exactly that.
function applyConditionDelta(resource, condition, sign) {
  const key = resource.id ?? `${resource.city_id}:${resource.resource_type}`;
  const taken = condition.applied || (condition.applied = {});
  const entry = taken[key] || (taken[key] = { supply: 0, demand: 0 });

  const supplyBefore = resource.supply;
  const demandBefore = resource.demand;
  resource.supply = Math.max(0, resource.supply + sign * (condition.supplyDelta || 0));
  resource.demand = Math.max(0, resource.demand + sign * (condition.demandDelta || 0));
  entry.supply += resource.supply - supplyBefore;
  entry.demand += resource.demand - demandBefore;
}

function releaseCondition(worldState, condition) {
  const taken = condition.applied;
  if (!taken) return;
  for (const resource of worldState.resources) {
    const key = resource.id ?? `${resource.city_id}:${resource.resource_type}`;
    const entry = taken[key];
    if (!entry) continue;
    resource.supply = Math.max(0, resource.supply - entry.supply);
    resource.demand = Math.max(0, resource.demand - entry.demand);
  }
  condition.applied = null;
}

function runEnvironmentPhase(worldState) {
  const events = [];

  worldState.activeConditions = worldState.activeConditions.filter((condition) => {
    for (const resource of worldState.resources) {
      if (resource.resource_type !== condition.resourceType) continue;
      // **A condition with a `cityId` applies to THAT city only.** It
      // did not before, and nothing had a cityId to honour until
      // `environment.js` started producing weather — at which point one
      // city's drought drained every city's water, three generated
      // worlds in a row read as starving, and `fear_spike` fired 90
      // times in 120 ticks for 36 people off the scarcity it invented.
      //
      // A condition with no cityId is still global, which is what a
      // scenario-wide drought is.
      if (condition.cityId !== undefined && condition.cityId !== null
          && resource.city_id !== condition.cityId) continue;
      applyConditionDelta(resource, condition, 1);
    }
    condition.ticksRemaining -= 1;
    if (condition.ticksRemaining > 0) return true;

    // Over. Give back exactly what it took.
    releaseCondition(worldState, condition);
    return false;
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

  // The weather, in the phase named for it. **Runs AFTER conditions are
  // aged above**, so a condition a storm creates this tick gets its
  // full length rather than being decremented on the tick it started.
  // `environment_state` was schema-only, and `activeConditions` had no
  // table at all — so a world checkpointed mid-drought came back with
  // the drought gone and the resources still depressed.
  events.push(...environment.runEnvironment(worldState, { tick: worldState.tick }));

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

  // **This phase was a no-op in every world ever generated.**
  // `advanceResourceTick` moves `quantity` by `production_rate -
  // consumption_rate`, and `worldgen` set neither, so it computed
  // `max(0, 0 + 0 - 0)` on every resource on every tick — and
  // `getScarcity`, which reads `supply`/`demand` instead, returned the
  // same number for the life of the world: measured over 400 ticks,
  // food 44, water 45, medicine 46, energy 42, wood 62, never moving by
  // one. Everything downstream of scarcity — prices, the food
  // satisfier, survival pressure, the broadcast that feeds two Key
  // resolvers — was reading a constant drawn on tick 0.
  //
  // Demand now tracks the population that wants the thing, which is
  // the link that was missing. See economy.js#refreshDemand for what is
  // fixed and what is declared instead.
  economy.refreshDemand(worldState);

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

  // **The labour market, and it is the half that was missing.**
  // `hireEntity` was called exactly once in the whole engine — by
  // `worldgen`, at generation — while `justice.imprison` and death both
  // took people out of work. So employment could only ever shrink: a
  // child born into the world could never hold a job and a released
  // prisoner could never work again. Measured over 400 ticks: 55 jobs
  // down to 51, and the only direction was down.
  //
  // After payroll on purpose. Who an employer can take on depends on
  // whether it just made its wages, and the layoff side reads this
  // tick's own `payroll_missed` events rather than forming a second
  // opinion about whether one happened.
  const labour = economy.runLabour(worldState, worldState.tick, payroll.events);
  events.push(...labour.events);

  // **The unlock chain, and it belongs HERE rather than in the
  // Organization phase.** `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`'s
  // trigger is precise: "The moment a Tribe recruits someone whose
  // occupation matches a nearby location's specialist requirement, that
  // match itself becomes the trigger." The moment is a hire, the hires
  // are in `labour.hired`, and a periodic scan would be a condition
  // rather than a crossing (standing rule 7) — at generation every
  // tribe qualifies for something, so a scan would emit thousands of
  // "newly viable" notices on tick 1 and nothing thereafter.
  events.push(...control.noteRecruitment(worldState, labour.hired, worldState.tick));

  // **Salvage, and it belongs after `runLabour` for the same reason the
  // unlock chain does**: who has no work today is settled by the hiring
  // and layoff pass immediately above, and forming a second opinion
  // about it here would let a person be laid off and go scavenging in
  // the same afternoon, or be hired and go anyway.
  events.push(...salvage.runSalvage(worldState, worldState.tick));

  // **Searching a landmark, which is not salvaging one.** A separate
  // pass rather than a branch inside `runSalvage` on purpose: salvage
  // strips an empty building for what it is made of, discovery carries
  // something out of a library or a cathedral, and folding them
  // together would make the rate of one depend on the supply of the
  // other. Both sit here because both are what somebody does with a
  // day, which is what this phase already decides.
  events.push(...discovery.runDiscovery(worldState, worldState.tick));

  // **The market, and `barter.exchange` had never executed in a
  // generated world.** A complete, conservative, tested trade — priced
  // from §27's barter key, adjusted for scarcity, population, both
  // sides' Barter Skill and the seller's Trustworthiness — with no
  // caller anywhere outside its own module. The same shape as
  // `contest.js` before `competition.js` gave it an occasion.
  //
  // The occasion was already in the engine: `crime.js` reads
  // deprivation pressure and turns it into a theft. Somebody under
  // that pressure who owns something does not have to steal — they can
  // sell it, and only those with nothing left to sell are pushed toward
  // the alternative. See server/trade.js.
  //
  // After payroll and hiring, because a wage paid this tick is money
  // somebody no longer needs to raise.
  const market = trade.runMarket(worldState, worldState.tick);
  events.push(...market.events);

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

  // **And feuds, which had exactly the same hole.**
  // `relationships.conflict` was initialised to 0 and the only writer
  // in the engine was `keys.resolveAggression`, which `runSecurityPhase`
  // calls only for a relationship ALREADY above
  // CONFLICT_ESCALATION_THRESHOLD. Conflict starts at 0, so the
  // resolver never ran, so conflict never rose. Measured at 200 ticks:
  // 0 of 241 relationships above zero, and therefore not one violent or
  // domestic offence in any world this engine has ever generated — two
  // of §9's four generatable categories unreachable.
  //
  // Before `advanceBonds` on purpose: `advanceBonds` refuses to grow a
  // bond above `BOND_CONFLICT_CEILING`, a check that could never have
  // fired while conflict was always 0, and it should read this tick's
  // friction rather than last tick's.
  const feuds = crime.advanceFriction(worldState, {
    tick: worldState.tick, threshold: CONFLICT_ESCALATION_THRESHOLD,
  });

  // **Word of mouth, which is what makes awareness a variable at all.**
  // Here because it moves along `relationships` and that is what this
  // phase is about. `entity_knowledge.spread_rate` was a column
  // `worldStore.addKnowledge` accepted and no caller ever passed, so no
  // fact in any world had ever been passed from one person to another
  // — every broadcast arrived everywhere at once and awareness was a
  // constant 1. See server/media.js.
  media.runWordOfMouth(worldState, worldState.tick);

  // **Bonds form here, and they had to start somewhere.**
  // `relationships.love` is initialised to 0 and was written by
  // nothing — six of the twelve dimensions are written and love was
  // not one — so `births.js`'s partnership threshold could never be
  // reached and no child could ever be born in a running world. This
  // runs after `resolveTrust` above, so a bond reads the interaction
  // count and trust this tick just produced. See server/births.js.
  const bonds = births.advanceBonds(worldState, worldState.tick);

  // **And families, which had the hole in two fields at once.**
  // `families.unity` was 50 and `families.conflict` 0 on every family
  // in every world — `generateFamily` set both and nothing in the
  // engine ever moved either. `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.
  // md` specifies the takeover key's second factor as a multiplier on
  // exactly those fields plus `cooperation`, so two of its three terms
  // were constants and the document's whole point — that a tribe can
  // meet every requirement and still fail because the people do not
  // work together — could not happen.
  //
  // Last in the phase on purpose: unity converges on the trust
  // `resolveTrust` just moved and conflict on the friction
  // `advanceFriction` just moved, so a family reads this tick's
  // relationships rather than last tick's. Same ordering argument as
  // `advanceBonds` above. See server/familyTraits.js.
  const discord = familyTraits.advanceCohesion(worldState, {
    tick: worldState.tick, discordThreshold: FAMILY_DISCORD_THRESHOLD,
  });

  return [...feuds, ...bonds, ...discord];
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

  // **And now they actually go.** Everything above is a disposition
  // reading and says so; this is the relocation the old event text
  // promised did not exist. Driven by unmet needs rather than by the
  // two traits above — an unmet housing, safety or income need is a
  // reason to leave, where Volatility is a reading of who somebody is.
  // See server/migration.js.
  events.push(...migration.runMigration(worldState, { tick: worldState.tick }));
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

  // **What each area is actually like.** `communities.housing`,
  // `safety`, `employment`, `education` and `reputation` sat at the
  // schema default of 50 in every community of every world ever
  // generated, and `crime` at 0 — nothing wrote any of them, so
  // `getCommunityHealth` returned 50 everywhere and every city's
  // reemergence was 37 or 38. Six communities across two cities,
  // identical to the integer.
  //
  // Here rather than in a phase of its own because this is the phase
  // that already asks who holds what ground, and the pipeline is locked
  // at eleven. The columns are a durable VIEW of a live computation,
  // the same pattern `environment_state.active_disasters` uses.
  territory.refreshCommunityConditions(worldState, { tick: worldState.tick });

  // **And the same four columns one tier up.** `cities.economy`,
  // `safety`, `infrastructure` and `growth` were written once by
  // `generateCity` and by nothing ever again — `getCityReemergence`
  // has been reading a founding constant for its infrastructure
  // sub-index in every world this engine has run. After the
  // communities, because the city reading is a rollup of theirs.
  territory.refreshCityConditions(worldState, { tick: worldState.tick });

  // **What the state spends, and where it reaches.** §7's last three
  // `absent` urban systems — 20 Government Services, 35 Military /
  // National Guard, 36 Tourism — as the CITY and CIVILIZATION
  // tier-level trait sheets the package defines and the engine never
  // built. Here because a budget is a government act and a government
  // is an organization (standing rule 4), and after the two condition
  // refreshes above because the budget is the mean city economy and
  // tourism reads city infrastructure.
  events.push(...statecraft.runStatecraft(worldState, worldState.tick));

  // **§24 KNOWLEDGE RECOVERY.** Here, immediately after
  // `runStatecraft`, because `runSchooling` lives inside it and the two
  // are the same question asked of different people: schooling is what
  // the state teaches the young, and this is what everybody else
  // teaches themselves from whatever survived. Running it second means
  // somebody schooled this tick is not also self-taught this tick for
  // the same rung.
  //
  // It moves the `educational` family, which `technology.learningOf`
  // averages to decide whether a civilization can recover an era — so
  // "knowledge is a civilization resource" is the wire that was always
  // there and had nothing pushing current through it. See
  // server/knowledge.js.
  events.push(...knowledge.runStudy(worldState, worldState.tick));

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
//: **Measured, after being guessed twice.**
//:
//: 30 was chosen when nothing anywhere wrote `relationships.conflict`,
//: which CLAUDE.md's fourteenth standing rule records: the resolver
//: behind this threshold was the field's only writer, so the field sat
//: at 0 forever and not one violent or domestic offence had ever
//: occurred in any world the engine had generated. `crime.
//: advanceFriction` fixed the writer. It did not fix the threshold, and
//: a 400-tick playtest showed why — **1 of 883 relationships above 30**,
//: so three of the five generatable crime categories (violent, gun,
//: domestic) were still effectively unreachable. The mechanism had gone
//: from impossible to almost impossible, which is harder to see.
//:
//: So: measure the population the cutoff applies to, which is standing
//: rule 12's third clause and is the step that was skipped both times.
//: On a 400-tick world, `crime.frictionTarget` — what conflict is
//: driven toward — runs p50 2, p90 13, max 50.8, and conflict itself
//: lands at p90 14.5, p99 25, max 42.7. A threshold of 30 sits ABOVE
//: the 99th percentile of its own driver.
//:
//: 20 is the p95 of that measured distribution: the top few relationships
//: in a settlement, which is what "already showing meaningful conflict"
//: was always meant to mean, rather than a number that sounds like
//: trouble on a 0-100 scale.
const CONFLICT_ESCALATION_THRESHOLD = 20;

//: **Measured on the population it applies to, which is families and
//: not relationships.** `familyTraits.conflictTarget` is the MEAN
//: conflict across a family's internal relationships, so it cannot
//: reach the tail a single pair reaches — averaging is what makes this
//: a different distribution from the one above, and reusing 20 here
//: would have been standing rule 17's second failure exactly: two
//: numbers on the same 0-100 scale that describe different
//: populations.
//:
//: Measured on a 400-tick generated world, 30 families of which 23 are
//: measurable at all: stored family conflict runs p50 3.3, p90 31.9,
//: p95 33.8, max 49.2, against a `conflictTarget` it lags — p50 5.5,
//: p90 43.6, max 53.5. So 32 is the p90 of the field this fires on:
//: the three or four households in a settlement that have genuinely
//: fallen apart, which is what "open discord" is for. At 8 — the first
//: figure here, chosen before the measurement existed — most of the
//: town would have qualified.
const FAMILY_DISCORD_THRESHOLD = 32;

//: **A flashpoint is an occasion, not a state**, and this constant is
//: standing rule 7 applied to the thing that rule was written about.
//:
//: `resolveAggression` was built to answer one provocation. This phase
//: ran it every tick for every relationship over the threshold, which
//: is a condition rather than a crossing — and the resolver writes
//: `conflict: +responseLevel/10` on every call, so conflict ratcheted
//: to 100 for every eligible pair within about forty ticks, which made
//: the escalation arithmetic trivially satisfiable, which produced
//: **6,247 violent offences in 400 ticks among 150 people** — 3.8
//: million per 100,000 per year. The same pair fought every single day
//: forever.
//:
//: Two people with ongoing tension do not come to blows daily; they
//: come to blows occasionally, and more often the worse the tension.
//: So the occasion is drawn, seeded on the pair and the tick (§88), at
//: a rate proportional to the grievance itself — which also stops the
//: ratchet, because the resolver now runs tens of times over a world's
//: life instead of tens of thousands.
//:
//: **Flagged interpretive. This is the dial that sets the VOLUME, and
//: separating it from the floor took one more measurement mistake.**
//:
//: `keys.ESCALATION_RESPONSE_FLOOR` decides who CAN ever escalate;
//: this decides how often the question gets asked. Those are different
//: jobs and the first attempt conflated them: the floor was set at the
//: p95 of a SNAPSHOT of `responseLevel` across eligible pairs, on the
//: reasoning that only the top few percent should ever come to blows.
//:
//: A snapshot percentile is the wrong basis for a threshold that is
//: sampled repeatedly. Each eligible pair gets a draw every tick for
//: hundreds of ticks, and `advanceFriction` walks its conflict up
//: toward `frictionTarget` the whole time — so a pair that sits below
//: the floor today clears it next month, and over 400 ticks **43 of the
//: 44 eligible pairs escalated at least once**: 67 offences, 40
//: distinct perpetrators out of 149 people, and no pair fighting more
//: than three times. Not a feud — a quarter of the town, which is a
//: warzone rather than a settlement.
//:
//: So the floor keeps the meaning it was measured for (a serious
//: response, on this formula's real range) and the rate carries the
//: volume. 0.0006 puts violent and domestic offences somewhat below the
//: theft rate the deprivation model produces independently — the
//: within-model comparison, which is the right one here, because the
//: setting is a post-reset settlement whose every area measures as
//: `contested` and real-world rates come from societies with a
//: functioning state.
const AGGRESSION_FLASHPOINT_RATE = 0.0006;

function runSecurityPhase(worldState) {
  const events = [];
  const boundApplyKeyModifier = (entityId, family, name, delta, tick) => applyKeyModifier(worldState, entityId, family, name, delta, tick);

  for (const relationship of worldState.relationships) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if (relationship.conflict <= CONFLICT_ESCALATION_THRESHOLD) continue;
    if (!isNpc(worldState, relationship.entity_a_id) || !isNpc(worldState, relationship.entity_b_id)) continue;

    // Does anything actually happen between them today? See
    // AGGRESSION_FLASHPOINT_RATE. Seeded on the pair and the tick, not
    // on a counter, so the same world replays (§88).
    const chance = (Number(relationship.conflict) / 100) * AGGRESSION_FLASHPOINT_RATE;
    if (seededDraw([
      worldState.seed ?? 'world', 'flashpoint',
      relationship.entity_a_id, relationship.entity_b_id, worldState.tick,
    ]) >= chance) continue;

    const entityA = getLiveEntity(worldState, relationship.entity_a_id);
    const knowledge = worldStore.getKnowledge(worldState, relationship.entity_a_id, relationship.entity_b_id);
    const outcome = keys.resolveAggression(entityA, {
      tick: worldState.tick, worldState, applyKeyModifier: boundApplyKeyModifier,
      otherEntityId: relationship.entity_b_id, provocationDescription: 'ongoing tension', knowledge,
      // **The grievance this phase already selected on.** Without it
      // the resolver reads a provocation charge of 0 — no knowledge row
      // in a generated world is ever about the other party — and its
      // own escalation threshold becomes unreachable by arithmetic. See
      // keys.js#resolveAggression.
      grievance: Number(relationship.conflict) || 0,
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

      // **The confrontation spends the tension, and without this the
      // whole mechanism is a ratchet that feeds itself.**
      //
      // `resolveAggression` writes `conflict: +responseLevel/10` on
      // every call and `hatred` on top when it escalates — so violence
      // RAISED the grievance that causes violence, which raised both
      // the flashpoint rate and the next responseLevel. Measured: at a
      // correctly-calibrated floor the same pairs escalated over and
      // over at an accelerating rate, **78 violent offences in 400
      // ticks among 149 people — 47,768 per 100,000 per year**, about
      // sixty times a real high-crime city.
      //
      // That is standing rule 13 inside a single mechanism: the
      // escalation had no inverse, so there was no equilibrium, and no
      // choice of floor could have produced one. Lowering the floor
      // until the rate looked right would have been fitting a constant
      // to hide a missing term.
      //
      // Discharged to zero rather than damped, because that is the
      // honest statement: the fight happened, and whatever was
      // between them today is settled today. `crime.advanceFriction`
      // is the restoring force — it walks conflict back toward
      // `frictionTarget` at 2% of the gap a tick, so a pair whose
      // distrust, rivalry and strain persist becomes dangerous again
      // over months, and a pair whose quarrel was circumstantial does
      // not. A feud is then something the world produces, not
      // something the arithmetic guarantees.
      relationship.conflict = 0;

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

  // Drug possession — caught rather than committed, and independent of
  // deprivation on purpose: holding contraband is the offence
  // regardless of why, the same way an armed escalation above does not
  // ask whether the aggressor needed to be. Same phase, same reason:
  // crime is what Security is for.
  for (const incident of crime.runDrugCrime(worldState, worldState.tick)) {
    events.push({
      type: 'crime', severity: incident.severity >= 60 ? 'high' : 'medium',
      note: `${incident.category} offence by entity ${incident.perpetrator_entity_id}`,
      tick: incident.tick,
      affected_entity_ids: [incident.perpetrator_entity_id],
      global_effects: { crimeIncidentId: incident.id, crimeCategory: incident.category },
    });
  }

  // Fraud — a falsified position claim, deprivation-driven exactly like
  // the theft/property pass above. Same phase, same reason.
  for (const incident of crime.runFraudCrime(worldState, worldState.tick)) {
    events.push({
      type: 'crime', severity: incident.severity >= 60 ? 'high' : 'medium',
      note: `${incident.category} offence by entity ${incident.perpetrator_entity_id}`,
      tick: incident.tick,
      affected_entity_ids: [incident.perpetrator_entity_id],
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

  // What happens after somebody is caught.
  //
  // **Last in the phase, and that ordering is the whole design.**
  // Clearance is the input: `runPolicing` has just decided which
  // incidents were solved, and `server/justice.js` turns a cleared
  // incident with a named perpetrator into a charge, a judgement
  // against the city's actual laws, and a sentence. Run it before
  // policing and it would be charging people for crimes nobody had
  // investigated yet.
  //
  // Still inside the Security phase, not a twelfth: arrest, trial and
  // prison are what security DOES with what it found, and the pipeline
  // is locked at eleven.
  events.push(...justice.runJustice(worldState, { tick: worldState.tick }));

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
  // **Phase 4's return value was discarded, and had been since it
  // started returning one.** `runSocialPhase` builds and returns
  // events — `feud_opened` from `crime.advanceFriction` and
  // `partnership_formed` from `births.advanceBonds` — and this line
  // read `runSocialPhase(worldState);` with no `candidateEvents.push`
  // in front of it. So **no social event in the history of this engine
  // has ever reached the event log**: every feud that opened and every
  // partnership that formed happened, changed the world, and was
  // recorded nowhere. Found by adding a third such event
  // (`family_discord`), measuring a 400-tick world, and getting zero of
  // them while the field it fires on plainly moved.
  //
  // The suite could not see it. `test/births.test.js` asserts on
  // `advanceBonds`' RETURN, which is correct and complete for that
  // function, and nothing anywhere asserted that phase 4's events
  // arrive — the one shape a fixture never checks is what the caller
  // does with the value. Every event here is a crossing rather than a
  // condition (standing rule 7), so nothing floods.
  candidateEvents.push(...runSocialPhase(worldState));          // 4
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

  // Drug production, use and withdrawal. Also NOT a twelfth phase, same
  // slot as flows and for the same shape of reason: it is a
  // cross-cutting effect of the population's own traits and holdings,
  // not a stage every property or community passes through. Runs before
  // `applyEventStress` below so a `withdrawal` event this tick raises
  // stress this tick, the same guarantee `runSecurityPhase`'s crime
  // events already get. See server/drugs.js.
  candidateEvents.push(...drugs.runDrugs(worldState, { tick: worldState.tick }).events);

  // Gambling urges, same slot and same reason as drugs immediately
  // above: a cross-cutting effect of the population's own traits and
  // savings, confined to the game's own virtual currency. See
  // server/gambling.js.
  candidateEvents.push(...gambling.runGambling(worldState, { tick: worldState.tick }).events);

  // Warfare — battles in whatever wars are currently active. Same slot,
  // same reason: a war's battles are a cross-cutting consequence of who
  // declared what, not a stage every organization passes through. Runs
  // before `applyEventStress` below so a battle this tick raises stress
  // this tick. See server/warfare.js.
  candidateEvents.push(...warfare.runWarfare(worldState, { tick: worldState.tick }));

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

  // Who lives where. Before motivation, which reads whether somebody
  // has a home, and after mortality and births, which are what change
  // the membership of one.
  candidateEvents.push(...households.runHouseholds(worldState, { tick: worldState.tick }));

  // What everybody wants. Before trait drift and after behavior, which
  // is the order the data flows in: `runBehavior` reinforces the habits
  // that satisfy needs, motivation reads those habits, and trait drift
  // then reads the habits too. Nothing here feeds the phase that
  // produced it.
  candidateEvents.push(...motivation.runMotivation(worldState, { tick: worldState.tick }));

  // What people have become. AFTER trait drift would be the obvious
  // place and is the wrong one: drift writes the traits this reads, and
  // a tag derived from values written earlier in the same tick would be
  // a loop with no defined order. Before, so an archetype reflects a
  // finished person rather than a half-updated one.
  candidateEvents.push(...archetypes.runArchetypes(worldState, { tick: worldState.tick }));

  // Somebody actually plays.
  //
  // **`server/contest.js` was a complete resolver that nothing called.**
  // Five disciplines, live traits, a seeded draw, a re-runnable result —
  // tested, green, and `grep -n contest server/tick.js` returned two
  // matches, both the word "contested" about territory blocks. No
  // generated world had ever held a contest, which made the `sports`
  // family a reader on paper and nothing else.
  //
  // Here rather than earlier in the slot because a game reads a settled
  // population: mortality and births have already run, so nobody enters
  // a match they did not live to see. Before trait drift, which is what
  // turns the habit of turning up into being good at it.
  candidateEvents.push(...competition.runCompetition(worldState, { tick: worldState.tick }));

  // What the tribes can now do — `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`.
  //
  // `generateMission` had exactly one caller in the whole engine, in
  // `worldgen.js`, at tick 0, so `mAvail` was 3 in every world forever
  // and finding 2 of the 19 Sep playtest recorded that no mission had
  // ever been completed. The eleventh standing rule with the generator
  // called precisely once at the beginning of time.
  //
  // After `runLabour` (Economy phase) and after births and mortality,
  // because the match it looks for is between a tribe's living members'
  // OCCUPATIONS and what a nearby location asks for — so the hire that
  // creates the match has to have happened already, and somebody who
  // died this tick must not unlock anything.
  candidateEvents.push(...tribeMissions.runTribeMissions(worldState, {
    tick: worldState.tick,
  }));

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

  // History. Also not a twelfth phase, and last of all the cross-cutting
  // layers rather than among them: it reads what the tick produced
  // (`analytics_snapshots`) and what individuals now hold
  // (`economy_snapshots`), so it runs after the Event/History/
  // Reemergence phases have finished writing everything else a snapshot
  // could report. See server/snapshots.js.
  snapshots.runSnapshots(worldState, worldState.tick);

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
  // Exported so the condition ledger can be tested on a fixture rather
  // than only through a 200-tick world. What it guards — that a
  // temporary condition has a temporary effect — is the kind of thing
  // that only shows over hundreds of ticks otherwise, which is how it
  // went unnoticed for the life of the project.
  runEnvironmentPhase,
  // **Exported because a player action happens between ticks.** The
  // Event phase is the only thing in the engine that turns a candidate
  // event into an `events` row, and before this it was reachable only
  // from inside `advanceTick`. A takeover a player performs through
  // `POST /api/players/:id/action` is a real event in the world and had
  // nowhere to be recorded — the alternative was a second event writer
  // in `engine.js`, which is two sources of truth for the id sequence
  // and the row shape.
  recordEvents: runEventPhase,
  advanceTick,
};
