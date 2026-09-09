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
// employment_records, investments, and trade_routes are NOT built
// here — not required by the locked Day 1 definition of done (a
// drought cascade through resources -> economy -> social -> migration/
// security), and CLAUDE.md doesn't enumerate them under step 7
// specifically. Natural follow-ups, not done in this pass.
//
// Every function here takes `worldState` explicitly (unlike engine.js's
// generate*() functions, which close over the module-level WorldState)
// — engine.js wraps these as the bound, convenient API, same relationship
// entityTraits.js/worldStore.js already have to engine.js.

'use strict';

let nextResourceId = 1;
let nextMarketListingId = 1;

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

module.exports = {
  generateResource,
  advanceResourceTick,
  getScarcity,
  generateMarketListing,
  resolveMarketPrice,
  generateIndividualFinances,
  getLatestFinances,
  getNetWorth,
};
