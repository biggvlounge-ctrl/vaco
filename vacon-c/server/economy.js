// server/economy.js
//
// Real resource tracking + real supply/demand economy — locked Day 1
// step 7. Three tables from VACANCY_POSTGRESQL_SCHEMA.sql, the ones
// directly implied by "real resource tracking (real, per-type), real
// supply/demand economy" (Section 11's locked scope wording):
// resources (raw per-type tracking), market_listings (finished goods
// actually bought/sold — distinct from resources), and
// individual_finances (real per-entity economic participation, which
// engine.js#getFamilyWealth() from step 6 has been waiting on since it
// only had an empty array to sum over).
//
// **`employment_records` IS built here now** — the "natural follow-up"
// this header called it, taken up on 12 Sep 2026. It was one of nine
// urban systems (§7) sitting at `slot`: a table the schema defines and
// no engine code touches. See `urbanSystems.js` for the others.
//
// `investments` and `trade_routes` are still NOT built. Trade routes
// fall under the Transportation deferral in CLAUDE.md, so they are
// closed scope rather than a gap.
//
// Every function here takes `worldState` explicitly (unlike engine.js's
// generate*() functions, which close over the module-level WorldState)
// — engine.js wraps these as the bound, convenient API, same relationship
// entityTraits.js/worldStore.js already have to engine.js.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { getLiveEntity } = require('./entityTraits.js');
// `membership.js` requires nothing, so this is not a cycle. A hire is
// a membership as well as a contract — `worldgen` has always written
// both, and writing only one here would leave the labour market and
// every per-area organization statistic disagreeing about who works
// where.
const membership = require('./membership.js');
// `occupations.js` requires `seeded` and `demographics`, neither of
// which reaches back here, so this is not a cycle either. It is what
// turns `employment_records.position` from a column nobody wrote into
// the trade a person actually holds.
const occupations = require('./occupations.js');

let nextResourceId = 1;
let nextMarketListingId = 1;
let nextEmploymentRecordId = 1;

// ---------------------------------------------------------------------------
// Resources — real, per-type tracking (`resources` table)
// ---------------------------------------------------------------------------
// options:
//   cityId          - entity id | null (resources.city_id is nullable —
//                      no Territory/Community/City generation exists in
//                      any handoff yet, so this stays optional rather
//                      than forcing a dependency on an unbuilt system)
//   resourceType    - string, required (resources.resource_type is
//                      NOT NULL with no default) — schema comment gives
//                      examples (food|water|energy|oil|gold|minerals|
//                      timber|agricultural_land|rare_materials|...) but
//                      explicitly says "...", not a closed enum
//   quantity, quality, ownerEntityId, supply, demand,
//   productionRate, consumptionRate - all optional, default to 0
//   (quality defaults 50, matching the same 0-100/default-50 convention
//   used everywhere else in this schema)
function generateResource(worldState, options = {}) {
  if (!options.resourceType) {
    throw new Error('generateResource requires options.resourceType (resources.resource_type is NOT NULL with no default).');
  }
  const resource = {
    id: nextResourceId++,
    city_id: options.cityId ?? null,
    resource_type: options.resourceType,
    quantity: options.quantity ?? 0,
    quality: options.quality ?? 50,
    owner_entity_id: options.ownerEntityId ?? null,
    supply: options.supply ?? 0,
    demand: options.demand ?? 0,
    production_rate: options.productionRate ?? 0,
    consumption_rate: options.consumptionRate ?? 0,
  };
  worldState.resources.push(resource);
  return resource;
}

// One tick of production/consumption. resources has no `tick` column
// of its own (schema-literal — nothing stamped here), only quantity
// moves, clamped at 0 (can't go negative).
function advanceResourceTick(resource) {
  resource.quantity = Math.max(0, resource.quantity + resource.production_rate - resource.consumption_rate);
  return resource;
}

// ---------------------------------------------------------------------------
// Demand tracks the population that wants the thing
// ---------------------------------------------------------------------------
//
// **`getScarcity` returned the same number for the life of every world
// ever generated.** Measured over 400 ticks of a generated world, every
// tick: food 44, water 45, medicine 46, energy 42, wood 62 — never
// moving by one. Scarcity is `demand / supply`, and the only writer of
// either column anywhere in the engine was the environmental-condition
// applier in `tick.js`. So outside a drought, a settlement's scarcity
// was a constant drawn on tick 0, and everything downstream of it —
// prices, `motivation`'s food satisfier, `mortality.survivalScarcity`,
// the scarcity broadcast that feeds two Key resolvers — was reading
// that constant.
//
// The Resource phase was worse: `production_rate` and
// `consumption_rate` are **0 for every resource in every world**
// (`worldgen` never set them), so `advanceResourceTick` computes
// `max(0, 0 + 0 - 0)` on every resource on every tick. **Phase 2 of the
// locked eleven is a no-op**, and `resources.quantity` — the column it
// exists to move — is 0 everywhere and read by nothing but the
// migration.
//
// ---------------------------------------------------------------------
// What is fixed here, and what is declared
//
// The single most important missing link is that **more people want
// more**. `consumption_rate` is the schema's own column for it, read as
// units per person per tick, so `demand` becomes
// `consumption_rate * residents` and moves whenever the population does
// — births, deaths, migration, a block emptying out. One of the two
// dead rate columns becomes live for what it actually means.
//
// **Centred exactly, and that is why `consumption_rate` is derived from
// the drawn demand rather than chosen.** `worldgen` sets it to
// `demand / residents` at generation, so on tick 0 the target equals
// the value that was drawn and no existing world shifts by a digit.
// Standing rule 12's first clause.
//
// **And a resource nobody can measure a population for is left exactly
// alone.** `resources.city_id` is nullable and most fixtures — the
// drought cascade's included — create a resource with no city at all.
// Null residents is not zero residents: it is a resource whose demand
// this pass cannot speak to, so it does not.
//
// `quantity` and `production_rate` stay **declared rather than
// modelled**, and the reason is a real one rather than an omission.
// This engine represents a resource as LEVELS — a supply and a demand
// that scarcity is the ratio of — and the schema also offers a STOCK
// with flows into and out of it. Those are two models of the same
// thing, and running both would give every reading two disagreeing
// answers. Making the stock load-bearing means deciding that supply is
// drawn from it, which changes what a drought does to a world, and the
// drought cascade is this project's stated Definition of Done. That is
// a design decision with a test in front of it, not a defect with one
// right answer. `statistics.js` carries the declaration.

//: How fast demand moves toward what the population implies. **Flagged
//: interpretive**, and deliberately slow: a resource's demand is a
//: standing appetite rather than a headcount read fresh each morning, so
//: a block emptying out over a season is felt over a season. At 0.02 a
//: resource covers half the distance in about thirty-five ticks.
//:
//: Slow also keeps this composable with the condition applier, which
//: writes the same column as a delta and restores what it took on
//: expiry. Both are deltas, so they add rather than overwrite, and the
//: drift pulls back to the population's level afterwards.
const DEMAND_DRIFT_RATE = 0.02;

// How many people this resource is for, or null when that cannot be
// read. City-scoped, because `resources.city_id` is where the schema
// puts a resource.
function residentsFor(worldState, resource) {
  if (resource.city_id === null || resource.city_id === undefined) return null;
  const here = new Set((worldState.communities || [])
    .filter((c) => c.city_id === resource.city_id)
    .map((c) => c.id));
  if (here.size === 0) return null;
  return (worldState.npcs || []).filter((n) => here.has(n.communityId)).length;
}

// What demand should be, given who is actually there. Null when there
// is no population to read or no per-capita rate recorded.
function demandTargetFor(worldState, resource) {
  const perCapita = Number(resource.consumption_rate);
  if (!Number.isFinite(perCapita) || perCapita <= 0) return null;
  const residents = residentsFor(worldState, resource);
  if (residents === null) return null;
  return Math.max(0, perCapita * residents);
}

// One tick of demand tracking its population. Returns the resources
// whose demand actually moved, so this is a crossing rather than a
// per-tick rewrite of the same number (standing rule 7).
function refreshDemand(worldState, options = {}) {
  const rate = options.rate ?? DEMAND_DRIFT_RATE;
  const moved = [];
  for (const resource of worldState.resources || []) {
    const target = demandTargetFor(worldState, resource);
    if (target === null) continue;
    const current = Number(resource.demand) || 0;
    const next = Math.round((current + (target - current) * rate) * 100) / 100;
    if (next === current) continue;
    resource.demand = next;
    moved.push(resource);
  }
  return moved;
}

// 0-100 scarcity score derived from supply vs. demand — not a schema
// column (resources has none), a read-time computation. Referenced
// elsewhere in the handoff package as a bare threshold ("Black Market
// Engine... scarcity > 60") with no formula given; this is a
// defensible, simple one: demand outstripping supply pushes scarcity
// toward 100, ample supply relative to demand pulls it toward 0.
function getScarcity(resource) {
  const ratio = resource.demand / Math.max(resource.supply, 1);
  return Math.max(0, Math.min(100, Math.round(ratio * 50)));
}

// ---------------------------------------------------------------------------
// Market listings — finished goods actually bought/sold
// (`market_listings` table), distinct from resources (raw inputs).
// ---------------------------------------------------------------------------
// options:
//   cityId      - entity id | null (same nullable rationale as above)
//   productName - string, required (market_listings.product_name is
//                 NOT NULL with no default)
//   price       - number, required — market_listings.price has no
//                 schema default, and product prices are too
//                 domain-specific to guess a sensible one
//   supply, demand, quality, popularity, tick - optional, default 0
//   (quality defaults 50, same convention as elsewhere)
function generateMarketListing(worldState, options = {}) {
  if (!options.productName) {
    throw new Error('generateMarketListing requires options.productName (market_listings.product_name is NOT NULL with no default).');
  }
  if (options.price == null) {
    throw new Error('generateMarketListing requires options.price (market_listings.price has no schema default).');
  }
  const listing = {
    id: nextMarketListingId++,
    city_id: options.cityId ?? null,
    product_name: options.productName,
    // Nullable: a listing with no single raw input prices purely off
    // its own supply/demand, exactly as before this column existed.
    resource_type: options.resourceType ?? null,
    price: options.price,
    supply: options.supply ?? 0,
    demand: options.demand ?? 0,
    quality: options.quality ?? 50,
    popularity: options.popularity ?? 0,
    tick: options.tick ?? 0,
  };
  worldState.marketListings.push(listing);
  return listing;
}

// Price resolution from supply/demand — the tick pipeline's phase 3
// ("ECONOMY — supply/demand keys resolve price + scarcity", Build
// Prompt). No formula is specified anywhere in the handoff package;
// this is a standard, defensible feedback model: price moves
// proportionally to the demand/supply imbalance, damped by
// PRICE_SENSITIVITY (interpretive constant, not derived from any doc),
// clamped so it can never hit zero or run away unboundedly in one step.
const PRICE_SENSITIVITY = 0.1;
// `inputScarcity` — optional 0-100 scarcity of the raw resource this
// listing is made from, from getScarcity(). Added after the
// Definition-of-Done cascade test proved a drought could not reach a
// price: the finished good and its raw input had no connection.
//
// **Why (scarcity - 50) / 50, and not a new constant.** getScarcity()
// is round((demand / supply) * 50) clamped to 0-100, so 50 is exactly
// the point where a resource's demand equals its supply. Subtracting
// 50 and dividing by 50 turns it back into the same normalised
// imbalance the listing's own supply and demand already produce, which
// means it can be added to that term and damped by the same
// PRICE_SENSITIVITY rather than needing a second invented constant.
//
// Neutral input scarcity therefore changes nothing, which is the
// property that matters: a listing with no resource_type, or one whose
// input is in balance, prices exactly as it did before this existed.
function resolveMarketPrice(listing, tick, inputScarcity = null) {
  const imbalance = (listing.demand - listing.supply) / Math.max(listing.supply, 1);
  const inputPressure = inputScarcity === null ? 0 : (inputScarcity - 50) / 50;
  const adjusted = listing.price * (1 + PRICE_SENSITIVITY * (imbalance + inputPressure));
  listing.price = Math.max(0.01, adjusted);
  listing.tick = tick;
  return listing;
}

// ---------------------------------------------------------------------------
// Individual finances — real per-entity economic participation
// (`individual_finances` table). engine.js#getFamilyWealth() (step 6)
// reads this via getNetWorth() below — until this module existed, that
// function only had an empty array to sum over.
// ---------------------------------------------------------------------------
// options: income, savings, debt, assets, tick — all optional, default 0.
function generateIndividualFinances(worldState, entityId, options = {}) {
  const record = {
    entity_id: entityId,
    income: options.income ?? 0,
    savings: options.savings ?? 0,
    debt: options.debt ?? 0,
    assets: options.assets ?? 0,
    tick: options.tick ?? 0,
  };
  worldState.individualFinances.push(record);
  return record;
}

// Most recent individual_finances row for one entity (highest tick).
// individual_finances is keyed (entity_id, tick) — multiple rows can
// exist over time; "current" means the latest one.
function getLatestFinances(worldState, entityId) {
  const rows = worldState.individualFinances.filter((r) => r.entity_id === entityId);
  if (rows.length === 0) return null;
  // `>=`, not `>`. Two rows can share a tick — a mission reward paid on
  // the same tick a person's finances were seeded is the case that
  // found this — and with a strict `>` the FIRST row wins, so the
  // payment lands in the array and is invisible to every reader.
  // Net worth stayed at 100 after a 250 reward was credited.
  //
  // Same rule as property.js#getCurrentOwner: on a tie, the later row
  // is the one that happened later, because it was recorded later.
  return rows.reduce((latest, r) => (r.tick >= latest.tick ? r : latest));
}

// Net worth = assets + savings - debt (the balance-sheet stock
// columns on individual_finances; income is a flow, excluded). Same
// formula engine.js#getFamilyWealth() used inline before this module
// existed — centralized here now.
// **What somebody is worth, and for a long time it left out the
// buildings they own.**
//
// This was `assets + savings - debt` off `individual_finances` alone.
// `property.currentValue` computes a building's worth from its
// condition, `property.getHoldings` rolls that up per owner, and
// `players.js` prints it as `propertySummary.totalValue` in the same
// dashboard, directly beside this number — and this number did not read
// it. The third standing rule's shape: a computed rollup exists, is
// correct, and the function that most needs it does not call it.
//
// **Eleven call sites read this**, including `areaStats.povertyLine`
// (which IS the median of this), both of `crime.js`'s deprivation
// checks, `births.povertyDepth`, `trade.js`, `motivation.js`,
// `statistics.median_net_worth` and `engine.getFamilyWealth`. So a
// person who owned three buildings and no cash read as destitute
// everywhere in the engine at once.
//
// Measured on a 600-tick world before changing it, because adding to
// this moves the poverty line and the line moves crime, births and
// trade together (twelfth rule, first clause):
//
//   poor 53 -> 55 of 148 living, and only 6 people (4%) change status
//   the poverty RATE moves at most 1 point at any sample
//   23 of 58 property owners were classified destitute; the worst held
//     41,275 in buildings against 5,894 in cash
//
// So the aggregate barely moves and the individual misclassification
// was severe where it landed. It also halves a spurious trend: median
// net worth rose 10x over 600 ticks reading savings alone and 5.3x
// reading both, because **property decay is the sink the economy
// looked like it was missing** — 56% of all property value in the world
// is destroyed over 600 ticks (1,282,716 -> 561,879) and nothing that
// reads wealth could see it.
//
// **Only `individual` ownership counts.** `ownership_records.owner_type`
// also has family, organization, government and community; attributing
// family-held property to each member would multiply one building
// across everybody in the household, and `getFamilyWealth` sums member
// net worths, so it would compound there too.
function getNetWorth(worldState, entityId) {
  const finances = getLatestFinances(worldState, entityId);
  const liquid = finances
    ? (finances.assets || 0) + (finances.savings || 0) - (finances.debt || 0)
    : 0;
  return liquid + ownedPropertyValue(worldState, entityId);
}

// The current value of the property this entity holds in its own name.
//
// Lazily required: `property.js` does not depend on this module today,
// and a top-level require would make that a promise rather than a fact.
function ownedPropertyValue(worldState, entityId) {
  // eslint-disable-next-line global-require
  const property = require('./property.js');
  let total = 0;
  for (const row of worldState.properties || []) {
    const owner = property.getCurrentOwner(worldState, row.id);
    if (!owner) continue;
    if (owner.owner_type !== 'individual') continue;
    if (owner.owner_entity_id !== entityId) continue;
    total += property.currentValue(row);
  }
  return total;
}


// ---------------------------------------------------------------------------
// reseedIds — see server/idSequences.js
// ---------------------------------------------------------------------------
// Called after a world is loaded from Postgres. Without it these
// counters restart at 1 against restored rows that already use those
// ids, and two rows end up sharing a primary key with nothing thrown.
// Derived from the rows themselves rather than stored, so it cannot
// disagree with them.

// ---------------------------------------------------------------------------
// Employment — wages that actually move (`employment_records`)
// ---------------------------------------------------------------------------
// **Payroll moves money rather than creating it**, and that is the whole
// reason this is worth building at all. A wage is subtracted from the
// employer organization's `assets` and added to the employee's
// `individual_finances`; the employer's `expenses` records it. An
// employer that cannot cover its payroll does not pay, and says so as
// an event.
//
// The alternative — crediting the employee and leaving the employer
// alone — would have been half a line shorter and would have made
// every organization an infinite money source. `getNetWorth` and
// `getFamilyWealth` both read these finances, so that money would have
// shown up as real household wealth across the whole world.
//
// **One active job per entity**, refused loudly rather than silently
// ignored. Two active records would both draw a wage every tick for
// the same person, which reads as a plausible salary and is not one.
// Ending a job and taking another is the supported path.

const EMPLOYMENT_STATUSES = ['active', 'ended'];

function getEmployment(worldState, entityId) {
  return worldState.employmentRecords.find(
    (r) => r.entity_id === entityId && r.status === 'active',
  ) || null;
}

function listEmployment(worldState, options = {}) {
  const { employerOrganizationId = null, status = null } = options;
  return worldState.employmentRecords.filter(
    (r) => (employerOrganizationId === null || r.employer_organization_id === employerOrganizationId)
      && (status === null || r.status === status),
  );
}

function hireEntity(worldState, options = {}) {
  const {
    entityId, employerOrganizationId, wage, position = null, tick = worldState.tick ?? 0,
  } = options;

  if (!entityId) throw new Error('hireEntity requires an entityId');
  if (!employerOrganizationId) throw new Error('hireEntity requires an employerOrganizationId');
  // `Number.isFinite`, not a truthiness check: a wage of 0 is a real
  // unpaid position, and NaN walks straight through `wage > 0` —
  // the same guard V3's ledger needed for the same reason.
  if (!Number.isFinite(wage) || wage < 0) {
    throw new Error('hireEntity requires a non-negative finite wage');
  }

  const employer = worldState.organizations.find((o) => o.id === employerOrganizationId);
  if (!employer) {
    throw new Error(`hireEntity: no organization ${employerOrganizationId}`);
  }

  const existing = getEmployment(worldState, entityId);
  if (existing) {
    throw new Error(
      `hireEntity: entity ${entityId} already holds employment ${existing.id} `
      + `at organization ${existing.employer_organization_id}. End it first.`,
    );
  }

  const record = {
    id: nextEmploymentRecordId++,
    entity_id: entityId,
    employer_organization_id: employerOrganizationId,
    wage,
    position,
    start_tick: tick,
    status: 'active',
  };
  worldState.employmentRecords.push(record);
  return record;
}

function endEmployment(worldState, options = {}) {
  const { entityId } = options;
  const record = getEmployment(worldState, entityId);
  if (!record) throw new Error(`endEmployment: entity ${entityId} holds no active employment`);
  record.status = 'ended';
  // **No `end_tick`, deliberately.** The first version set one, and
  // `employment_records` has no such column — so it would have been
  // dropped on migrate and absent on restore, a field the engine sets
  // and the database cannot hold. CLAUDE.md's bar for adding one to
  // `schema-extensions.sql` is that the engine must READ it, and
  // nothing does. `status` is what anything actually checks.
  return record;
}

// Pays every active wage once. Returns the events the tick should
// carry, so an employer missing payroll is visible to the Event phase
// rather than only to whoever reads the numbers afterwards.
// ---------------------------------------------------------------------------
// Production — what an employee is worth to an employer
// ---------------------------------------------------------------------------
// **Measured before it was written: 1,488 `payroll_missed` events in
// 300 ticks of a 150-person world.** `organizations.income` is a real
// column, `generateOrganization` sets it to 0, and nothing ever
// produced a penny. Every business in every world paid wages out of a
// fixed pile of assets until the pile was gone, so the economy ran in
// one direction and every employer eventually went bankrupt — which
// also means employment, and every statistic built on it, was on a
// countdown.
//
// **This is also the largest single answer to "what makes an NPC's
// traits matter".** Of 114 individual traits, 44 were read by any code
// at all; the `skills` family is 16 of them and exactly one was read
// anywhere. A person's skills are what they can DO, so they are what
// their labour is worth, and reading the whole family here takes 15
// traits from decoration to load-bearing in one edge.
//
// //: INTERPRETIVE. No document prices labour. The model is the
// //: simplest one that uses what exists rather than inventing a
// //: market: a worker produces `WAGE_TO_OUTPUT` times their wage,
// //: scaled by their own capability. So a business is viable when it
// //: employs capable people and not when it does not, which is the
// //: relationship worth having — and the constant is the single
// //: number to change if the economy runs hot or cold.
//
// **Skills are read through `getLiveEntity`, never `npc.traits`** —
// standing rule 9. The sheet on the object is frozen at generation,
// so a worker who had spent forty years getting better at their job
// would have produced their birth value forever.
const WAGE_TO_OUTPUT = 1.3;

// A worker's capability, **centred on 1.0 for somebody average**, not
// on a 0..1 scale — and the difference is the whole model. The first
// version divided skills by 100 and multiplied two more sub-1
// modulators, so an entirely average worker scored 0.28 and produced
// 45% of their own wage. Every business still failed, just more
// slowly: 470 missed payrolls instead of 1,488.
//
// Every trait here runs 0..100 with 50 as average, so each factor is
// written to give exactly 1.0 at 50. An average worker earns their
// employer `WAGE_TO_OUTPUT` times their wage; a skilled, healthy,
// focused one earns several times it; a poor one costs money. That is
// the relationship worth having, and it only reads correctly if the
// centre is where the trait scale's centre is.
//
// ---------------------------------------------------------------------
// The skill term is the JOB's skill, not the average of all sixteen
// ---------------------------------------------------------------------
// It used to be the mean of the whole sheet, which made specialisation
// invisible: a person with Crafting 90 and everything else 40 scored
// exactly the same as a generalist at 46. Measured on a 300-tick world,
// one person's best skill minus their worst runs **75.7 points on
// average** — people in this engine are enormously specialised, and the
// economy could not tell.
//
// `occupations.js` names the one skill each occupation exercises, and
// `traitDrift`'s work habit grows that exact skill, so the answer was
// already on the employment record. Reading it means a farmer is paid
// for farming.
//
// `JOB_SHARE` is half, not all, for a stated reason: a job is mostly
// its trade and partly everything else somebody can do, and a pure
// job-skill read would make a brilliant carpenter working as a cook
// worth as little as a person with no skills at all. And the blend is
// centred the way standing rule 12's first clause demands — somebody
// whose job skill equals their own sixteen-skill mean scores exactly
// what they scored before this term existed, whatever that mean is. The
// change redistributes; it does not move the baseline.
const JOB_SHARE = 0.5;

// ---------------------------------------------------------------------
// Electricity, the resource nothing consumed
// ---------------------------------------------------------------------
// `urbanSystems.js`'s Energy entry names this exactly: a grid can now
// fail (`infrastructure.js`, 21 Sep 2026) and the outage moves
// `resources` supply for the `energy` type — and stopped there. "No
// need, habit or production step reads it", so a city with electricity
// at zero behaved identically to one at full supply for every person
// in it. §40 names electricity as the head of the whole bottleneck
// chain; this is the first link.
//
// **A production step, not a need.** The fifteen `motivation.js` needs
// are a closed, documented vocabulary — `needs.need_type`'s own schema
// comment enumerates exactly fifteen, and electricity is not one of
// them. Adding a sixteenth because it sounds like it belongs would be
// inventing a need category the package never asked for. What §40
// actually frames electricity as is an ECONOMIC input — a business
// runs on power — so it belongs where `productivityOf` already reads
// health and focus: a factor on what labour produces, not a personal
// want.
//
// **Centred exactly like health and focus, on the same 0.75..1.25
// band**, for the same reason standing rule 12's first clause always
// gives: `getScarcity` returns 50 for supply meeting demand, so that
// is where the factor must sit at 1.0, or reading electricity would
// silently revalue every worker in a perfectly ordinary city the day
// this shipped.
//
// **Unmeasured is neutral, never a penalty.** A world with no `energy`
// resource row for a worker's city — restored from before this
// existed, or one where nothing ever calls `generateResource` for it —
// is unknown, not a blackout. The corollary already shipped wrong once
// in `moodFor`; the fix here is the same explicit default the health
// and focus terms already use.
function energyFactor(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc || npc.communityId == null) return 1;
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  if (!community) return 1;
  const resource = (worldState.resources || []).find(
    (r) => r.city_id === community.city_id && r.resource_type === 'energy',
  );
  if (!resource) return 1;
  const scarcity = getScarcity(resource);
  return Math.max(0, 0.75 + (100 - scarcity) / 200);
}

function productivityOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) return 0;

  const skills = Object.values(live.traits?.skills || {})
    .map(Number)
    .filter((v) => Number.isFinite(v));
  if (skills.length === 0) return 0;
  const mean = skills.reduce((a, b) => a + b, 0) / skills.length;

  // A record with no position is a real state, not a defect: every
  // world restored from before `occupations.js` existed has
  // `position: null` on every row, and `drawOccupation` returns null
  // for an organization type that employs nobody. Those people keep the
  // sheet mean, which is what they had.
  const record = getEmployment(worldState, entityId);
  const trade = record?.position ? occupations.definitionOf(record.position) : null;
  const jobSkill = trade ? Number(live.traits?.skills?.[trade.skill]) : NaN;
  const skill = (Number.isFinite(jobSkill)
    ? JOB_SHARE * jobSkill + (1 - JOB_SHARE) * mean
    : mean) / 50;

  // `?? 50` rather than `|| 50`: a real 0 is somebody with no immune
  // response at all, and `||` would quietly upgrade them to average.
  const health = Number(live.traits?.health?.['Immune Response'] ?? 50);
  const focus = Number(live.traits?.mental?.Focus ?? 50);

  // **Modulators, not gates, and the band matters more than it looks.**
  // At 0.5..1.5 each the two of them swing output by 9x end to end,
  // which overturns a 4.5x skill gap — so a barely-skilled person in
  // perfect health out-produced an ailing expert, in a model whose
  // whole point is that skill is what labour is worth. A test caught
  // it by asserting exactly that comparison.
  //
  // 0.75..1.25 keeps 1.0 at average, still halves the output of
  // somebody seriously ill, and leaves skill the dominant term.
  return Math.max(0, skill * (0.75 + health / 200) * (0.75 + focus / 200)
    * energyFactor(worldState, entityId));
}

// One tick of work, for everybody holding an active contract.
//
// Runs inside the Economy phase immediately BEFORE payroll, because a
// day's wages come out of that day's takings — running it after would
// make an employer miss payroll on money its staff had already earned.
function runProduction(worldState, tick) {
  const events = [];
  const living = new Set(worldState.npcs.map((n) => n.id));
  const byEmployer = new Map();

  for (const record of worldState.employmentRecords) {
    if (record.status !== 'active') continue;
    if (!living.has(record.entity_id)) continue;
    const wage = Number(record.wage) || 0;
    const output = wage * WAGE_TO_OUTPUT * productivityOf(worldState, record.entity_id);
    byEmployer.set(
      record.employer_organization_id,
      (byEmployer.get(record.employer_organization_id) || 0) + output,
    );
  }

  for (const [organizationId, revenue] of byEmployer) {
    const employer = worldState.organizations.find((o) => o.id === organizationId);
    if (!employer) continue;
    const earned = Math.round(revenue);
    // **Accumulated, because `expenses` is** — `runPayroll` does
    // `expenses += wage` and `test/employment.test.js` asserts the
    // running total. An income that reset each tick beside an expense
    // total that never did would make the pair unreadable: the obvious
    // comparison, `income - expenses`, would be nonsense in both
    // directions. Matching the existing field was the smaller and more
    // honest change, and a per-tick figure is recoverable by
    // differencing.
    employer.income = (Number(employer.income) || 0) + earned;
    employer.assets = (Number(employer.assets) || 0) + earned;
  }

  // An employer with staff and no takings at all is worth an event —
  // it is the shape of a business about to fail, and it was
  // indistinguishable from a healthy one before production existed.
  for (const [organizationId, revenue] of byEmployer) {
    if (revenue > 0) continue;
    events.push({ type: 'no_output', organizationId, tick });
  }

  return { events, employers: byEmployer.size };
}

function runPayroll(worldState, tick) {
  const events = [];
  let paid = 0;
  let missed = 0;

  // **The living only.** `runPayroll` walks contracts, not people, so
  // moving a dead NPC out of `worldState.npcs` does not stop their
  // wage on its own — a corpse kept drawing 25 a tick from an employer
  // that could still afford it. Moving the row protects everything
  // that iterates people; this is the one place that iterates
  // agreements about people, and it has to ask.
  //
  // Membership in `npcs`, so this module still knows nothing about
  // mortality. The record is left `active` rather than ended: ending
  // somebody's employment because they died is a decision about
  // inheritance and succession, and inventing it here would put a
  // second, quieter answer next to whatever gets built for that.
  const living = new Set(worldState.npcs.map((n) => n.id));

  for (const record of worldState.employmentRecords) {
    if (record.status !== 'active') continue;
    if (!living.has(record.entity_id)) continue;
    const employer = worldState.organizations.find(
      (o) => o.id === record.employer_organization_id,
    );
    // An employer that no longer exists cannot pay. The record is left
    // active rather than silently ended — somebody deleting an
    // organization out from under its staff is a different bug, and
    // hiding it here would make it unfindable.
    if (!employer) continue;

    const wage = Number(record.wage) || 0;
    const assets = Number(employer.assets) || 0;
    if (wage > assets) {
      missed += 1;
      events.push({
        type: 'payroll_missed',
        organizationId: employer.id,
        entityId: record.entity_id,
        wage,
        assets,
        tick,
      });
      continue;
    }

    employer.assets = assets - wage;
    employer.expenses = (Number(employer.expenses) || 0) + wage;

    // A new finances row for this tick, carrying the previous balance
    // forward. `individual_finances` is keyed (entity_id, tick), so a
    // tick's pay is its own row rather than a mutation of an older one
    // — which is what lets `getLatestFinances` mean anything.
    const previous = getLatestFinances(worldState, record.entity_id);
    worldState.individualFinances.push({
      entity_id: record.entity_id,
      income: wage,
      savings: (Number(previous?.savings) || 0) + wage,
      debt: Number(previous?.debt) || 0,
      assets: Number(previous?.assets) || 0,
      tick,
    });
    paid += 1;
  }

  return { paid, missed, events };
}

// ---------------------------------------------------------------------------
// The labour market — the half of employment that only ever subtracted
// ---------------------------------------------------------------------------
//
// **`hireEntity` was called exactly once in the whole engine, by
// `worldgen`, at generation.** `endEmployment` is called by
// `justice.imprison`, and death takes people out of `npcs` so their
// contract stops producing. So every world this engine has ever run
// had a labour market that could only shrink: nobody was ever hired
// after tick 0, a child born into the world could never hold a job,
// and a released prisoner could never work again. Measured on a
// 400-tick playtest: 55 jobs at generation, 51 at the end, and the
// only direction was down.
//
// That is the thirteenth standing rule again — a mechanism with no
// inverse has no equilibrium — and it is the sixth ratchet this
// project has found. It also sat underneath a lot of other things:
// `communities.employment` is the share employed, `getCommunityHealth`
// reads it, `cities.economy` reads that, and `statecraft.budgetOf`
// reads THAT — so the state's whole budget was quietly draining toward
// zero on a schedule nobody had noticed.
//
// ---------------------------------------------------------------------
// No new constants, and that is the point
//
// The whole pass is written out of numbers this file already has:
//
//   break-even     `productivityOf` is centred on 1.0 for an average
//                  worker and output is `wage * WAGE_TO_OUTPUT *
//                  productivity`, so a worker pays for themselves at
//                  exactly `1 / WAGE_TO_OUTPUT`. Below that they cost
//                  their employer money. That line — not an invented
//                  threshold — is who gets hired, so the unemployment
//                  rate falls out of the population's own trait
//                  distribution rather than out of a number chosen
//                  here. Standing rule 12's third clause, satisfied by
//                  not having a threshold to choose.
//   working age    16, which is `worldgen`'s own cutoff for who it
//                  offered a job to at generation. Reused rather than
//                  picked again.
//   the wage       what this employer already pays, median. A new hire
//                  is paid what the person at the next desk is paid.
//
// And the inverse is what `runPayroll` already reports: an employer
// that could not cover a wage this tick lets that person go. Stateless
// — it reads this tick's `payroll_missed` events rather than keeping a
// strike count — and an exact mirror of the hiring rule, so the two
// meet at an equilibrium instead of either one running away.
const BREAK_EVEN_PRODUCTIVITY = 1 / WAGE_TO_OUTPUT;
const WORKING_AGE = 16;

function medianOf(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// What this employer pays, or what the world pays when it has nobody
// left to compare against. Null when nobody anywhere holds a job,
// which is a world with no labour market rather than a world of
// volunteers.
function goingWage(worldState, organizationId) {
  const active = (worldState.employmentRecords || []).filter((r) => r.status === 'active');
  const here = medianOf(active
    .filter((r) => r.employer_organization_id === organizationId)
    .map((r) => Number(r.wage))
    .filter(Number.isFinite));
  if (here !== null) return here;
  return medianOf(active.map((r) => Number(r.wage)).filter(Number.isFinite));
}

// One tick of the labour market. Runs in the Economy phase after
// payroll, because who an employer can take on depends on whether it
// just made its wages.
//
// `payrollEvents` is what `runPayroll` returned this tick — passed in
// rather than re-derived, so the layoff is a consequence of the actual
// miss rather than a second opinion about whether one happened.
function runLabour(worldState, tick, payrollEvents = []) {
  const events = [];
  const hired = [];
  const laidOff = [];

  // ---- the inverse, first --------------------------------------------
  // Before hiring, because an employer that missed a wage this tick is
  // not an employer with a vacancy.
  const broke = new Set();
  for (const event of payrollEvents) {
    if (event.type !== 'payroll_missed') continue;
    broke.add(event.organizationId);
    // `getEmployment` rather than trusting the event: the same person
    // cannot be let go twice, and an event for a contract something
    // else already ended would otherwise throw out of the tick.
    if (!getEmployment(worldState, event.entityId)) continue;
    endEmployment(worldState, { entityId: event.entityId });
    laidOff.push({ entityId: event.entityId, organizationId: event.organizationId });
    events.push({
      type: 'laid_off',
      severity: 'moderate',
      note: `Entity ${event.entityId} lost their job — employer ${event.organizationId} `
        + 'could not cover the wage',
      tick,
      affected_entity_ids: [event.entityId],
      global_effects: { organizationId: event.organizationId, wage: event.wage },
    });
  }

  // ---- who is looking -------------------------------------------------
  const employed = new Set((worldState.employmentRecords || [])
    .filter((r) => r.status === 'active')
    .map((r) => r.entity_id));

  const applicants = [];
  for (const npc of worldState.npcs || []) {
    if (employed.has(npc.id)) continue;
    // Somebody serving a sentence is not in the labour market.
    // `justice.imprison` ended their contract for exactly this reason
    // and re-hiring them the next tick would undo it.
    if (npc.status === 'imprisoned') continue;
    const age = (tick - (npc.createdTick ?? 0)) / 365;
    if (!(age >= WORKING_AGE)) continue;
    const productivity = productivityOf(worldState, npc.id);
    // **The only test.** Somebody who cannot cover their own wage is
    // not hired, and nothing else is asked about them — not their
    // religion, their ethnicity, their family or where they live. §9
    // permits demographic modelling and forbids demographics deciding
    // what a person is worth, and a labour market is precisely where
    // that line is easiest to cross by accident.
    if (productivity < BREAK_EVEN_PRODUCTIVITY) continue;
    applicants.push({ id: npc.id, productivity });
  }
  // The best applicant gets the job. Deterministic, so no seed is
  // needed and §88 holds without one.
  applicants.sort((a, b) => b.productivity - a.productivity || a.id - b.id);

  // ---- who is hiring ---------------------------------------------------
  // An employer that already has somebody is a going concern; one that
  // has nobody has no wage scale of its own and no evidence it can pay,
  // so it is not in this market. That is also what keeps a dead
  // business dead.
  const staffed = new Map();
  for (const record of worldState.employmentRecords || []) {
    if (record.status !== 'active') continue;
    staffed.set(record.employer_organization_id,
      (staffed.get(record.employer_organization_id) || 0) + 1);
  }

  let next = 0;
  for (const [organizationId] of staffed) {
    if (next >= applicants.length) break;
    if (broke.has(organizationId)) continue;
    const employer = (worldState.organizations || []).find((o) => o.id === organizationId);
    if (!employer) continue;

    const wage = goingWage(worldState, organizationId);
    if (wage === null) continue;
    // It has to be able to pay them on the day it takes them on. Its
    // existing wage bill is already committed, so the new one comes out
    // of what is left.
    const committed = (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active' && r.employer_organization_id === organizationId)
      .reduce((total, r) => total + (Number(r.wage) || 0), 0);
    if ((Number(employer.assets) || 0) < committed + wage) continue;

    // One vacancy per employer per tick. A business does not staff up
    // in an afternoon, and it keeps the market clearing at a pace a
    // reader can follow.
    const applicant = applicants[next];
    next += 1;
    // **The position, which nothing in this engine used to write.**
    // Drawn from what the employer does and what the applicant knows —
    // `occupations.drawOccupation` gates the TIER on attainment and
    // never gates the hire, so the test above stays the only test.
    const hired_npc = (worldState.npcs || []).find((n) => n.id === applicant.id) ?? null;
    const position = occupations.drawOccupation({
      npc: hired_npc,
      worldState,
      organizationType: employer.type ?? null,
      seed: worldState.seed ?? 'world',
      extra: [organizationId, tick],
    });
    hireEntity(worldState, {
      entityId: applicant.id, employerOrganizationId: organizationId, wage, position, tick,
    });
    membership.joinOrganization(worldState, {
      entityId: applicant.id, organizationId, role: 'employee', tick,
    });
    hired.push({
      entityId: applicant.id, organizationId, wage, position,
    });
    events.push({
      type: 'hired',
      severity: 'low',
      note: `Entity ${applicant.id} took ${position ? `work as a ${position}` : 'a job'} `
        + `at organization ${organizationId} for ${wage}`,
      tick,
      affected_entity_ids: [applicant.id],
      global_effects: { organizationId, wage, position },
    });
  }

  return { hired, laidOff, events };
}

// **Computed, never stored** — standing rule 3. `communities.employment`
// is a separate stored field seeded at 50 and is deliberately NOT
// written from here: two sources of truth for one concept is the
// mistake that rule exists to prevent.
//
// The denominator is working-age NPCs, not every entity, because
// organizations and properties are entities too and counting them
// would make the rate meaningless.
function getEmploymentRate(worldState) {
  const people = worldState.npcs.length;
  if (people === 0) return null;
  // **Only the employed who are still alive**, and the first version
  // of this counted every active record against a denominator of the
  // living — so once `mortality.js` started moving dead NPCs out of
  // `worldState.npcs`, two employed people and one survivor reported a
  // rate of 2.0. A rate above 100% is the kind of number that gets
  // read as a units mistake rather than as a defect.
  //
  // This module still knows nothing about mortality: "employed and
  // alive" is membership in `npcs`, which is all it needs to ask.
  const living = new Set(worldState.npcs.map((n) => n.id));
  const employed = worldState.employmentRecords.filter(
    (r) => r.status === 'active' && living.has(r.entity_id),
  ).length;
  return Math.round((employed / people) * 10000) / 10000;
}

function reseedIds(worldState) {
  nextResourceId = nextAfter(worldState.resources);
  nextMarketListingId = nextAfter(worldState.marketListings);
  nextEmploymentRecordId = nextAfter(worldState.employmentRecords);
  return {
    nextResourceId: nextResourceId,
    nextMarketListingId: nextMarketListingId,
    nextEmploymentRecordId: nextEmploymentRecordId,
  };
}

module.exports = {
  reseedIds,
  generateResource,
  advanceResourceTick,
  getScarcity,
  generateMarketListing,
  resolveMarketPrice,
  generateIndividualFinances,
  getLatestFinances,
  getNetWorth,
  ownedPropertyValue,
  EMPLOYMENT_STATUSES,
  hireEntity,
  endEmployment,
  getEmployment,
  listEmployment,
  runPayroll,
  runLabour,
  goingWage,
  DEMAND_DRIFT_RATE,
  residentsFor,
  demandTargetFor,
  refreshDemand,
  BREAK_EVEN_PRODUCTIVITY,
  WORKING_AGE,
  WAGE_TO_OUTPUT,
  productivityOf,
  energyFactor,
  runProduction,
  getEmploymentRate,
};
