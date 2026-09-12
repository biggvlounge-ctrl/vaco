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
function getNetWorth(worldState, entityId) {
  const finances = getLatestFinances(worldState, entityId);
  if (!finances) return 0;
  return (finances.assets || 0) + (finances.savings || 0) - (finances.debt || 0);
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
  EMPLOYMENT_STATUSES,
  hireEntity,
  endEmployment,
  getEmployment,
  listEmployment,
  runPayroll,
  getEmploymentRate,
};
