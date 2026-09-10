// VOKEN — creator-designed limited-edition merch, real dynamic pricing.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md's `LimitedEditionMerch
// { creatorId, itemType, totalSupply, remainingSupply,
// currentDynamicPrice, linkedCultureCardId }`: a real, fixed, limited
// run (not unlimited print-on-demand) with algorithmic supply-and-
// demand pricing "the same real mechanic already proven by markets
// like StockX for limited sneaker drops." Ordinary commerce, not
// securities-adjacent -- deliberately NOT compliance-gated.
//
// No exact pricing formula is given in the source doc -- the scarcity
// multiplier below is a real, deterministic, bounded, flagged
// interpretive choice, matching this project's established pattern.

const ITEM_TYPES = ['t-shirt', 'hat', 'other'];
const MERCH_SCARCITY_PRICE_MULTIPLIER = 1.0; // price up to 2x basePrice once fully sold out

function round(n) {
  return Math.round(n * 100) / 100;
}

function computeDynamicPrice(basePrice, totalSupply, soldCount) {
  const scarcityFraction = soldCount / totalSupply;
  return round(basePrice * (1 + MERCH_SCARCITY_PRICE_MULTIPLIER * scarcityFraction));
}

function createMerchListing(store, options = {}) {
  const { creatorId, itemType, totalSupply, basePrice, linkedCultureCardId = null } = options;

  if (!creatorId) throw new Error('createMerchListing requires a creatorId');
  if (!ITEM_TYPES.includes(itemType)) {
    throw new Error(`createMerchListing: invalid itemType "${itemType}" (expected one of ${ITEM_TYPES.join(', ')})`);
  }
  if (!Number.isInteger(totalSupply) || totalSupply < 1) {
    throw new Error('createMerchListing requires a positive integer totalSupply');
  }
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw new Error('createMerchListing requires a positive basePrice');
  }

  const listing = {
    id: store.nextMerchListingId++,
    creatorId,
    itemType,
    totalSupply,
    remainingSupply: totalSupply,
    basePrice,
    currentDynamicPrice: basePrice,
    linkedCultureCardId,
    soldCount: 0,
    status: 'available',
    purchases: [],
    createdAt: Date.now(),
  };
  store.limitedEditionMerch.push(listing);
  return listing;
}

function getMerchListing(store, listingId) {
  return store.limitedEditionMerch.find((m) => m.id === listingId) || null;
}

// Charges at the real, live dynamic price at the moment of purchase --
// not the original basePrice -- then recomputes the price for the next
// buyer against the new, smaller remaining supply.
async function purchaseMerchItem(store, options = {}) {
  const { listingId, buyerId, settleFn } = options;
  const listing = getMerchListing(store, listingId);
  if (!listing) throw new Error(`purchaseMerchItem: no merch listing with id ${listingId}`);
  if (listing.remainingSupply <= 0) throw new Error(`purchaseMerchItem: listing ${listingId} is sold out`);
  if (!buyerId) throw new Error('purchaseMerchItem requires a buyerId');
  if (typeof settleFn !== 'function') throw new Error('purchaseMerchItem requires a settleFn(legs, meta)');

  const price = listing.currentDynamicPrice;
  await settleFn(
    [{ fromUserId: buyerId, toUserId: listing.creatorId, amount: price, reason: `voken_merch:${listing.id}` }],
    { reason: `voken_merch:${listing.id}` },
  );

  listing.remainingSupply -= 1;
  listing.soldCount += 1;
  listing.purchases.push({ buyerId, price, at: Date.now() });
  listing.currentDynamicPrice = computeDynamicPrice(listing.basePrice, listing.totalSupply, listing.soldCount);
  if (listing.remainingSupply === 0) listing.status = 'sold-out';

  return { listing, pricePaid: price };
}

module.exports = {
  ITEM_TYPES,
  MERCH_SCARCITY_PRICE_MULTIPLIER,
  computeDynamicPrice,
  createMerchListing,
  getMerchListing,
  purchaseMerchItem,
};
