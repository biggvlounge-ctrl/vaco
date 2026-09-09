# Plan — Real resource tracking + supply/demand economy (locked Day 1 step 7)

## Goal
Section 11's locked scope wording: "Resource tracking (real, per-type),
Economy (supply/demand-driven)." Three tables from
`VACANCY_POSTGRESQL_SCHEMA.sql` are the direct implementation of that:
`resources` (raw per-type tracking), `market_listings` (finished goods
actually bought/sold, distinct from resources), and
`individual_finances` (real per-entity economic participation — which
step 6's `getFamilyWealth()` has been waiting on since it only had an
empty array to sum over).

## Design
- `server/economy.js` — new module, all functions take `worldState`
  explicitly (same relationship to `engine.js` that `entityTraits.js`/
  `worldStore.js` already have):
  - `generateResource` / `advanceResourceTick` / `getScarcity`
  - `generateMarketListing` / `resolveMarketPrice`
  - `generateIndividualFinances` / `getLatestFinances` / `getNetWorth`
- `engine.js` — adds `resources`, `marketListings` to `WorldState`
  (`individualFinances` already existed from step 6), wraps every
  `economy.js` function as a bound `engine.generateX({...})` call
  (same convention as `generateNPC()`/`generateFamily()`), and
  **refactors** `getFamilyWealth()` to call `economy.getNetWorth()`
  instead of keeping its own private copy of the "latest finances" — a
  cleanup, not new behavior; the formula is unchanged from step 6.

## Interpretive choices — no formula/model is specified in any doc
1. **Scarcity score**: `round(50 * demand / max(supply, 1))`, clamped
   to `[0, 100]`. Referenced elsewhere in the handoff package only as a
   bare threshold ("Black Market Engine... scarcity > 60") with no
   formula given.
2. **Price resolution**: `price *= (1 + 0.1 * (demand - supply) /
   max(supply, 1))`, clamped to a minimum of `0.01`. A standard
   proportional feedback model — price rises when demand outstrips
   supply, falls under oversupply — damped by an interpretive
   `PRICE_SENSITIVITY = 0.1` constant not derived from any doc.
3. **Net worth**: `assets + savings - debt` from an entity's most
   recent `individual_finances` row (`income` is a flow, excluded from
   a stock/balance calculation) — same formula step 6 already used
   inline, just centralized now.

## Explicitly NOT in this task
- `employment_records`, `investments`, `trade_routes` — not required by
  the locked Day 1 definition of done, not enumerated under step 7 in
  `CLAUDE.md`.
- The Black Market Engine mechanic itself (gang-faction response to
  `scarcity > 60`) — referenced as "already correctly built" in a
  `VacancyDemo.jsx` that was never included in any handoff; nothing to
  extend, and building a full mechanic from a bare threshold mention
  would be inventing behavior, not implementing a spec.
- Wiring resource scarcity into `entity_knowledge` automatically (so
  `resolveScarcityResponse` from step 4 would "hear about" a real
  drought without manual seeding) — that's a tick-pipeline concern,
  step 8, not this one. Demonstrated manually in verification instead.

## Done when
- Resources generate and tick correctly (production/consumption net,
  clamped at 0).
- Scarcity score reflects supply/demand direction correctly.
- Market listings' price moves the correct direction under demand
  pressure vs. oversupply.
- `getFamilyWealth()` returns real, correct numbers once
  `individualFinances` is populated (previously always 0).
- Full regression: NPC/Organization/Family generation and existing Key
  resolvers all unaffected.
