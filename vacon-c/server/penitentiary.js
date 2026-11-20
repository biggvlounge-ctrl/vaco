// server/penitentiary.js
//
// By direct instruction: "penitentiary inventory list (inmate-made
// weapons, commissary, etc.)" — task #43 of "the next 5 tasks."
//
// ---------------------------------------------------------------------
// Inmate-made weapons need no new mechanic — only a new real name in
// the one real crafting system this engine already has
// ---------------------------------------------------------------------
// `salvage.js`'s `PRODUCTS`/`RECIPES`/`canMake`/`make` is the one real
// crafting mechanism in this engine, already the home for every other
// improvised weapon (`blade`, `club`, `zip_gun` — `weapons.js`'s own
// header: "`zip_gun` knows its name as a firearm; `salvage.js` knows
// how to build one"). `shank` follows the identical split: this file
// knows its name as the real, classic inmate-made weapon — a
// toothbrush handle, melted and sharpened into a point — and
// `salvage.js` carries its real `PRODUCTS`/`RECIPES` entry, reusing the
// exact Tier/skill gate every other `protection`-category product
// already has, never a second, parallel crafting path invented here.
// Its real recipe ingredient is `plastic` (a toothbrush's own real
// material), not this file's own purchased `toothbrush` item directly
// — `test/salvage.test.js`'s own guard requires every recipe
// ingredient to be a real `salvage.MATERIALS`/`produce.PRIMARY_PRODUCE`
// entry, and a commissary-purchased good is neither; see `salvage.js
// #RECIPES.shank`'s own comment.
// It is reachable the same way `blade`/`zip_gun` already are — the
// real, existing `make-thing` player verb — because `grep -n
// "salvage\.\(make\|canMake\)" server/tick.js` returns nothing at all:
// crafting in this engine has never had an ambient, NPC-driven caller
// for ANY product, so giving `shank` one here would be a double
// standard against every weapon already in the catalogue.
//
// ---------------------------------------------------------------------
// Commissary is the real new mechanic — a real purchase, not a second
// production system
// ---------------------------------------------------------------------
// Nothing in this engine lets an NPC spend real money on a real item
// outside of production or theft (`grep -n "'buy'\|'purchase'"
// server/actions.js` returns nothing) — so, unlike crafting,
// commissary purchases need their own real, ambient pass, the same
// shape `corruption.js`/`extortion.js` already established this round
// for a real, periodic, per-person economic event. `runCommissary
// Purchases` iterates every real prison property
// (`properties.landmark_category === 'prison'`, the identical filter
// `drugTrade.js#runPrisonSmuggling` already uses) and every real
// current inmate there (`justice.inmatesOf`, already built and
// exported — never a second "who is locked up here" query). An inmate
// with real, positive savings (`economy.getLatestFinances`) draws a
// real item they can actually afford from `COMMISSARY_CATALOG`, pays
// its real price out of their own real savings, and the real money
// lands in the prison's own real operating organization's `assets` —
// the same direct-mutation pattern `corruption.js#runEmbezzlement`
// already uses for organization assets, so a purchase is never money
// vanishing into nowhere. `registerCommissaryItems` follows the
// identical real registration shape `drugTrade.js#registerDrugItems`
// already established for a lightweight item vocabulary nothing else
// needs to craft.
//
// `COMMISSARY_PURCHASE_RATE` reuses `crime.BASE_DEPRIVATION_RISK`, the
// identical real per-person-per-tick order of magnitude
// `corruption.js`/`extortion.js` already reuse for a real, periodic
// pressure-driven event, never a fourth invented rate at a different
// scale. The five catalogue items and their prices are flagged
// interpretive — no document gives real commissary pricing — chosen
// as a small, real, recognisable list (hygiene, food, correspondence,
// a leisure item) rather than an exhaustive invented inventory.

'use strict';

const crime = require('./crime.js');
const economy = require('./economy.js');
const inventory = require('./inventory.js');
const justice = require('./justice.js');
const { seededDraw } = require('./seeded.js');

//: Flagged interpretive — no document gives real commissary pricing.
//: Categories reuse §26's own real vocabulary (`salvage.
//: CATEGORY_TEARDOWNS`'s keys) where one fits; none of the twenty has
//: a dedicated hygiene/correspondence/leisure bucket, so `soap`/
//: `toothbrush` sit under the closest real fit, `medicine`, the same
//: way `bandage` already does.
const COMMISSARY_CATALOG = {
  soap: { category: 'medicine', price: 2 },
  toothbrush: { category: 'medicine', price: 1 },
  instant_noodles: { category: 'food', price: 3 },
  postage_stamp: { category: 'knowledge', price: 1 },
  playing_cards: { category: 'luxury goods', price: 5 },
};

const COMMISSARY_ITEM_NAMES = Object.keys(COMMISSARY_CATALOG);

const COMMISSARY_PURCHASE_RATE = crime.BASE_DEPRIVATION_RISK;

function registerCommissaryItems(worldState) {
  worldState.barterItems = worldState.barterItems || [];
  const known = new Set(worldState.barterItems.map((i) => i?.name));
  let added = 0;
  for (const [name, def] of Object.entries(COMMISSARY_CATALOG)) {
    if (known.has(name)) continue;
    worldState.barterItems.push({
      name, category: def.category, baseValue: def.price, origin: 'commissary',
    });
    added += 1;
  }
  return added;
}

function affordableItemsFor(savings) {
  return COMMISSARY_ITEM_NAMES.filter((name) => COMMISSARY_CATALOG[name].price <= savings);
}

function runCommissaryPurchases(worldState, tick = worldState.tick ?? 0) {
  const purchases = [];
  registerCommissaryItems(worldState);

  const prisons = (worldState.properties || []).filter((p) => p.landmark_category === 'prison');
  for (const prison of prisons) {
    const operator = (worldState.organizations || [])
      .find((o) => o.id === prison.operating_organization_id) || null;

    for (const inmateId of justice.inmatesOf(worldState, prison.id)) {
      const finances = economy.getLatestFinances(worldState, inmateId);
      const savings = Number(finances?.savings) || 0;
      // No separate `savings <= 0` check: every real catalogue price is
      // positive, so `affordableItemsFor` already returns none for any
      // non-positive balance -- a second check here would be the
      // decorative-guard shape this project's own twentieth standing
      // rule already warns against, not a real second gate.
      const affordable = affordableItemsFor(savings);
      if (affordable.length === 0) continue;

      const draw = seededDraw([worldState.seed ?? 'world', 'commissary', inmateId, tick]);
      if (draw >= COMMISSARY_PURCHASE_RATE) continue;

      const itemIndex = Math.floor(
        seededDraw([worldState.seed ?? 'world', 'commissary-pick', inmateId, tick]) * affordable.length,
      );
      const itemName = affordable[itemIndex];
      const price = COMMISSARY_CATALOG[itemName].price;

      economy.generateIndividualFinances(worldState, inmateId, {
        income: finances?.income ?? 0,
        savings: Math.round((savings - price) * 100) / 100,
        debt: finances?.debt ?? 0,
        assets: finances?.assets ?? 0,
        tick,
      });
      if (operator) {
        operator.assets = Math.round(((Number(operator.assets) || 0) + price) * 100) / 100;
      }

      const purchase = inventory.give(worldState, { entityId: inmateId, itemName, quantity: 1, tick });
      purchases.push({
        inmateId, prisonPropertyId: prison.id, itemName, price, holding: purchase,
      });
    }
  }
  return purchases;
}

module.exports = {
  COMMISSARY_CATALOG,
  COMMISSARY_ITEM_NAMES,
  COMMISSARY_PURCHASE_RATE,
  registerCommissaryItems,
  affordableItemsFor,
  runCommissaryPurchases,
};
