// server/construction.js
//
// §7 system 30, Construction: "Condition advances over time... Nothing
// is built by anyone... no property is ever founded, and
// `lifecycle_stage` still walks its stages on a timer nobody
// influences." `property.js`'s own `ACQUIRED_METHODS` enumeration has
// named `'built'` since the Property Engine shipped — a real,
// schema-given acquisition method with no caller anywhere, the exact
// "citation is not presence" shape this project keeps finding.
//
// ---------------------------------------------------------------------
// What this closes, and what it deliberately does not
// ---------------------------------------------------------------------
// A person who owns no property yet and can afford to builds a home —
// the schema's own `residential` type, financed from their own
// `individual_finances.savings` (the same ledger `businesses.js` and
// `investments.js` already move real money through), and recorded with
// `acquired_method: 'built'` rather than `'purchased'`, because nobody
// sold it to them. The new row starts at `lifecycle_stage: 'planning'`
// — the schema's own DEFAULT — and from there `property.
// advancePropertyLifecycle` does the entire rest of the work this
// system was missing: planning -> construction -> operation on its
// existing `BUILD_TICKS` timer, condition decay and upkeep, all of it
// already built and already running every tick in the Environment
// phase. Construction did not need a lifecycle; it needed a first
// mover.
//
// **The cost is not invented.** `worldgen.js` already draws a
// residential property's assessed value from `random.range(4000,
// 60000, ...)` at generation — this file draws a NEW one's cost from
// the identical range, so a house built mid-world costs what the same
// house would have cost if `worldgen` had built it at the start. No
// second number for the same question.
//
// **Added 30 Oct 2026: a real USGS terrain reading re-centres and
// re-spreads that same band**, same reason and same shape as every
// other pack-driven re-centring in this registry. See
// `terrainPacks.js`'s own header for why this invented band, of every
// one in the engine, is the one terrain was asked to feed.
//
// **Only residential, and only for an individual.** `businesses.js`
// already covers an organization acquiring new assets (through
// investment and its own trading); a business constructing its own
// premises, or a government, family or community building something,
// is a different decision this file does not make for them — adding
// it later is additive, not a correction, because nothing here claims
// those cases do not exist.

'use strict';

const { seededDraw } = require('./seeded.js');
const economy = require('./economy.js');
const property = require('./property.js');
const terrainPacks = require('./terrainPacks.js');

// Reused from `worldgen.js`'s own residential value draw — see the
// header. Not re-measured here because it is not a new question.
const RESIDENTIAL_COST_MIN = 4000;
const RESIDENTIAL_COST_MAX = 60000;

// Per eligible person per tick. Flagged interpretive, same discipline
// `businesses.FOUNDING_CHANCE_PER_TICK` carries — building a house is
// a bigger commitment than opening a business, so this sits under it.
const BUILD_CHANCE_PER_TICK = 0.0004;

// Deterministic, so the same seed draws the same cost for the same
// person on the same tick whether it is checked once or ten times.
//
// `options.costMultiplier` is `terrainPacks.constructionCostMultiplierFor`'s
// own real, bounded figure — see `terrainPacks.js`'s own header for why
// this invented band, specifically, is the one real terrain feeds.
// Defaults to 1 (no change) so every existing call site is unaffected.
function costFor(seed, tick, builderId, options = {}) {
  const { costMultiplier = 1 } = options;
  const multiplier = Number.isFinite(costMultiplier) ? costMultiplier : 1;
  const draw = seededDraw([seed, 'build-cost', tick, builderId]);
  const min = RESIDENTIAL_COST_MIN * multiplier;
  const max = RESIDENTIAL_COST_MAX * multiplier;
  return Math.round(min + draw * (max - min));
}

// The real terrain-based cost multiplier for whichever city a
// community sits in, or 1 (no change) for a community with no city,
// a city with no real terrain reading, or no terrain pack at all.
// Resolved from `city.terrainClass`, set once at generation — see
// `terrainPacks.js`'s own header on why this is read fresh here
// rather than carried on the community or cached.
function terrainCostMultiplierFor(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community || community.city_id == null) return 1;
  const city = (worldState.cities || []).find((c) => c.id === community.city_id);
  return terrainPacks.constructionCostMultiplierFor(city?.terrainClass ?? null);
}

function constructResidentialProperty(worldState, options = {}) {
  const {
    builderId, communityId, cityId = null, tick = worldState.tick ?? 0,
    seed = worldState.seed ?? 'world',
  } = options;

  if (!builderId) throw new Error('constructResidentialProperty requires a builderId');
  if (communityId == null) throw new Error('constructResidentialProperty requires a communityId');

  const builder = (worldState.npcs || []).find((n) => n.id === builderId);
  if (!builder) throw new Error(`constructResidentialProperty: no entity ${builderId}`);

  const costMultiplier = terrainCostMultiplierFor(worldState, communityId);
  const cost = costFor(seed, tick, builderId, { costMultiplier });
  const finances = economy.getLatestFinances(worldState, builderId);
  const savings = Number(finances?.savings ?? 0);
  if (savings < cost) {
    throw new Error(`constructResidentialProperty: entity ${builderId} has ${savings} savings, needs ${cost}`);
  }

  const built = property.generateProperty(worldState, {
    type: 'residential',
    communityId,
    cityId,
    value: cost,
    condition: 100,
    lifecycleStage: 'planning',
  });

  economy.generateIndividualFinances(worldState, builderId, {
    income: finances?.income ?? 0,
    savings: savings - cost,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });

  property.recordOwnership(worldState, {
    entityId: built.id, ownerEntityId: builderId, ownerType: 'individual', acquiredMethod: 'built', tick,
  });

  return built;
}

// Somebody who owns nowhere yet. `getHoldings` is the existing rollup
// — reused rather than a second way of answering "does this person own
// property", which is exactly standing rule 3's shape one level up
// from a stored column.
function eligibleBuilders(worldState, tick) {
  return (worldState.npcs || []).filter((npc) => {
    if (npc.status === 'imprisoned') return false;
    if (npc.communityId == null) return false;
    const age = (tick - (npc.createdTick ?? 0)) / 365;
    if (!(age >= economy.WORKING_AGE)) return false;
    return property.getHoldings(worldState, npc.id).count === 0;
  });
}

// One tick of people deciding whether to build. Runs in the
// Organization phase beside `businesses.runBusinessFormation` — both
// are a person choosing to put savings into a durable asset, and
// `advancePropertyLifecycle` (Environment phase) picks up what this
// creates on the very same tick it is created, the same ordering
// `businesses.js` relies on for its own founder's first hire.
function runConstruction(worldState, tick) {
  const events = [];
  const seed = worldState.seed ?? 'world';
  let built = 0;

  const candidates = eligibleBuilders(worldState, tick)
    .filter((npc) => {
      // Same real terrain multiplier `constructResidentialProperty`
      // will charge below — checked here too so a candidate is never
      // let through on the flat-terrain price and then charged the
      // mountainous one.
      const costMultiplier = terrainCostMultiplierFor(worldState, npc.communityId);
      const cost = costFor(seed, tick, npc.id, { costMultiplier });
      return Number(economy.getLatestFinances(worldState, npc.id)?.savings ?? 0) >= cost;
    })
    .sort((a, b) => a.id - b.id);

  for (const npc of candidates) {
    if (seededDraw([seed, 'construct', tick, npc.id]) >= BUILD_CHANCE_PER_TICK) continue;
    const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
    const newProperty = constructResidentialProperty(worldState, {
      builderId: npc.id,
      communityId: npc.communityId,
      cityId: community?.city_id ?? null,
      tick,
      seed,
    });
    built += 1;
    events.push({
      type: 'property_built',
      severity: 'low',
      note: `Entity ${npc.id} built a new home`,
      tick,
      affected_entity_ids: [npc.id],
      global_effects: { propertyId: newProperty.id, cost: newProperty.value },
    });
  }

  return { events, built };
}

module.exports = {
  RESIDENTIAL_COST_MIN,
  RESIDENTIAL_COST_MAX,
  BUILD_CHANCE_PER_TICK,
  costFor,
  terrainCostMultiplierFor,
  constructResidentialProperty,
  runConstruction,
};
