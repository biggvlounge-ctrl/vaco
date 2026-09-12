// VACO — App Store and Merch seed data.
//
// The shell already boots with 31 real registry apps. Without seed
// listings the store would boot empty, which makes it look unbuilt
// even though it works. Same reasoning as VOID's `seedDemoData.js`:
// seed only when the store is genuinely empty, never on top of real
// data.
//
// **Every price below is flagged interpretive.** No source document
// prices any app in this ecosystem. What is *not* interpretive is the
// shape of the pricing: the apps that already make money inside
// themselves are free at the door, because charging admission to a
// marketplace that takes a cut of every transaction would be charging
// twice for the same customer. The paid ones are the tools — the
// things a business buys once and uses, where there is no transaction
// to take a cut of.

import { APPS } from './registry.js';
import { publishListing } from './appStore.js';
import { createProduct } from './merchStore.js';

//: Flagged interpretive: which apps are sold rather than given away.
//: The rule applied is "does it earn inside itself" — VOID takes ~20%
//: of every job, VOKEN takes a marketplace fee, VAGO holds the house
//: edge, so all of those are free to install. VENVM, VACO Analytics,
//: and Vex Business are tools: nothing transacts inside them, so the
//: only way they earn is by being bought.
const PAID_LISTINGS = {
  venvm: { pricingModel: 'subscription', priceVcoin: 40, subscriptionPeriod: 'monthly' },
  'vaco-analytics': { pricingModel: 'subscription', priceVcoin: 25, subscriptionPeriod: 'monthly' },
  'vex-trading': { pricingModel: 'subscription', priceVcoin: 60, subscriptionPeriod: 'monthly' },
  'vacon-c': { pricingModel: 'one-time', priceVcoin: 30 },
};

//: **Free was a fallthrough, and now it is a decision.**
//:
//: Every app not in `PAID_LISTINGS` above was priced at 0 by the `paid
//: ? ... : 'free'` default below — 32 of the 36. That produced the
//: right prices for the wrong reason: an app added tomorrow would also
//: be free, silently, because nobody had thought about it rather than
//: because somebody had.
//:
//: So every app is now named here with the reason it costs nothing,
//: under the same rule the paid table uses:
//:
//:   transacts       it earns inside itself and the store already takes
//:                   a cut, so charging admission would charge twice
//:   infrastructure  a service other apps call, not merchandise — "install
//:                   the ledger" is not a thing to sell a customer
//:
//: `scripts/test/store-pricing.test.mjs` requires the union of this and
//: `PAID_LISTINGS` to cover the registry exactly, so a new app cannot be
//: priced by omission.
const FREE_LISTINGS = {
  vdp: 'transacts',
  venvs: 'transacts',
  hvntz: 'transacts',
  dreams: 'transacts',
  void: 'transacts',
  voidmagic: 'transacts',
  voken: 'transacts',
  cvltvre: 'transacts',
  vado: 'transacts',
  vago: 'transacts',
  vxllage: 'transacts',
  cvnvo: 'transacts',
  yap: 'transacts',
  chopz: 'transacts',
  'chopz-shop': 'transacts',
  vacay: 'transacts',
  'vulture-music': 'transacts',
  'vulture-flix': 'transacts',
  'vulture-pods': 'transacts',
  'vulture-studios': 'transacts',
  'vavlt-stvdios': 'transacts',
  v3: 'infrastructure',
  vaca: 'infrastructure',
  shield: 'infrastructure',
  vacon: 'infrastructure',
  vsafe: 'infrastructure',
  'v4-proxy': 'infrastructure',
  'v4-search': 'infrastructure',
  'vaco-audit': 'infrastructure',
  'vaco-operator': 'infrastructure',
  'vaco-media': 'infrastructure',
  'vaco-notify': 'infrastructure',
};

//: Flagged interpretive: the publisher of every first-party app. In
//: the corporate structure (`dev-docs/CORPORATE_STRUCTURE.md`) these
//: apps sit under VEGA, so that is where publisher revenue settles.
//: A third-party publisher would simply be their own userId.
const FIRST_PARTY_PUBLISHER = 'vega';

// Infrastructure is not merchandise for an end user to install. V3,
// Shield, VACA, the V4 proxies and the retired mock are real services
// other apps call — listing them would put "install the ledger" in a
// consumer storefront.
const NOT_LISTED = new Set(['v3-shield']);

//: Flagged interpretive: seed merch. Retail and fulfilment costs are
//: in VCoin, sized off the source document's own Printify economics
//: (a shirt costing roughly $9–13 to produce against a $25–30 retail).
const SEED_MERCH = [
  { productId: 'void-driver-tee', appBrandId: 'void', name: 'VOID Driver Tee', productType: 'apparel', retailPriceVcoin: 28, fulfilmentCostVcoin: 11 },
  { productId: 'void-station-mug', appBrandId: 'void', name: 'VOID Port Station Mug', productType: 'mug', retailPriceVcoin: 18, fulfilmentCostVcoin: 7 },
  { productId: 'vdp-district-tee', appBrandId: 'vdp', name: 'VDP Districts Tee', productType: 'apparel', retailPriceVcoin: 28, fulfilmentCostVcoin: 11 },
  { productId: 'vdp-avatar-hoodie', appBrandId: 'vdp', name: 'VDP Avatar Hoodie', productType: 'apparel', retailPriceVcoin: 52, fulfilmentCostVcoin: 24 },
  { productId: 'hvntz-explore-cap', appBrandId: 'hvntz', name: 'HVNTZ Explore Cap', productType: 'accessory', retailPriceVcoin: 24, fulfilmentCostVcoin: 10 },
  { productId: 'voken-cvltvre-band', appBrandId: 'voken', name: 'CVLTVRE Watch Band', productType: 'watch-band', retailPriceVcoin: 34, fulfilmentCostVcoin: 14 },
  { productId: 'vulture-music-tee', appBrandId: 'vulture-music', name: 'Vvltvre Music Tee', productType: 'apparel', retailPriceVcoin: 28, fulfilmentCostVcoin: 11 },
  { productId: 'vavlt-stage-hoodie', appBrandId: 'vavlt-stvdios', name: 'Vavlt Stvdios Stage Hoodie', productType: 'apparel', retailPriceVcoin: 52, fulfilmentCostVcoin: 24 },
  { productId: 'cvnvo-heart-mug', appBrandId: 'cvnvo', name: 'CVNVO Mug', productType: 'mug', retailPriceVcoin: 18, fulfilmentCostVcoin: 7 },
  { productId: 'vago-chip-tee', appBrandId: 'vago', name: 'VAGO House Tee', productType: 'apparel', retailPriceVcoin: 28, fulfilmentCostVcoin: 11 },
  { productId: 'vaco-ecosystem-tee', appBrandId: 'vaco', name: 'VACO Ecosystem Tee', productType: 'apparel', retailPriceVcoin: 30, fulfilmentCostVcoin: 11 },
];

export function seedStore(store) {
  if (store.listings.length === 0) {
    for (const registryApp of APPS) {
      if (NOT_LISTED.has(registryApp.id)) continue;
      const paid = PAID_LISTINGS[registryApp.id];
      // An app in neither table has no pricing decision behind it.
      // Refuse rather than default it to free: a price nobody chose is
      // how every app after this one quietly ends up costing nothing.
      if (!paid && !FREE_LISTINGS[registryApp.id]) {
        throw new Error(`seedStore: no pricing decision for "${registryApp.id}" - add it `
          + 'to PAID_LISTINGS or FREE_LISTINGS in vaco-shell/lib/seedStore.js');
      }
      publishListing(store, {
        appId: registryApp.id,
        publisherId: FIRST_PARTY_PUBLISHER,
        pricingModel: paid ? paid.pricingModel : 'free',
        priceVcoin: paid ? paid.priceVcoin : 0,
        subscriptionPeriod: paid ? (paid.subscriptionPeriod || null) : null,
        summary: registryApp.description,
      });
    }
  }

  if (store.merchProducts.length === 0) {
    for (const product of SEED_MERCH) createProduct(store, product);
  }

  return store;
}

export { PAID_LISTINGS, FREE_LISTINGS, FIRST_PARTY_PUBLISHER, SEED_MERCH };
