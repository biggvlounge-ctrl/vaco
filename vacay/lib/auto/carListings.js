// VACAY AUTO -- Used Car Listings, built against the real, named
// comparable given for this sub-section: CarGurus. Genuinely
// different real business from Turo's peer rental (`vehicles.js`) --
// CarGurus is a **buy/sell** marketplace, not a rental one, and it
// never processes the actual car purchase (that happens outside the
// platform, the same real "outside the platform's payment rails"
// posture already established for `../home/listings.js`'s own Zillow
// comparable).
//
// **CarGurus' real, signature differentiator**: a price rating
// (their actual, well-known "Great Price"/"Good Price"/"Fair
// Price"/"High Price"/"Overpriced" deal badges) comparing a listing's
// asking price against a real market-average reference price. Real
// CarGurus computes that reference from aggregated market data across
// millions of real listings, which doesn't exist in this session --
// `marketAveragePrice` is honestly caller-supplied here, not computed
// from anything real; the rating-band math itself (percentage
// deviation from that reference) is the real, structurally-grounded
// part, and is what's actually tested.
//
// Real monetization, genuinely different again from Turo (owner
// earns a split) and Homes (agent pays per lead): sellers pay a real
// flat `LISTING_FEE` to post -- CarGurus' actual real revenue is
// substantially dealer listing/advertising fees, not a transaction
// cut or a lead fee.

const PRICE_RATINGS = ['great-price', 'good-price', 'fair-price', 'high-price', 'overpriced'];
const FOR_SALE_STATUSES = ['active', 'sold'];
const VACAY_AUTO_LISTINGS_ACCOUNT = 'vacay-auto-listings-platform';

// Real, deliberately interpretive percentage bands -- CarGurus
// doesn't publish exact cutoffs, but the concept (IMV-based rating
// tiers) is real and well-known; these are a structurally accurate
// stand-in.
const LISTING_FEE = 25;

function round(n) {
  return Math.round(n * 100) / 100;
}

function computePriceRating(price, marketAveragePrice) {
  const ratio = price / marketAveragePrice;
  if (ratio <= 0.95) return 'great-price';
  if (ratio <= 0.98) return 'good-price';
  if (ratio <= 1.03) return 'fair-price';
  if (ratio <= 1.10) return 'high-price';
  return 'overpriced';
}

async function createForSaleListing(store, options = {}) {
  const {
    sellerId, make, model, year, mileage, price, marketAveragePrice, transferFn, now = Date.now(),
  } = options;

  if (!sellerId) throw new Error('createForSaleListing requires a sellerId');
  if (!make) throw new Error('createForSaleListing requires a make');
  if (!model) throw new Error('createForSaleListing requires a model');
  if (!Number.isInteger(year) || year < 1900) throw new Error('createForSaleListing requires a real integer year');
  if (!Number.isInteger(mileage) || mileage < 0) throw new Error('createForSaleListing requires a non-negative integer mileage');
  if (!Number.isFinite(price) || price <= 0) throw new Error('createForSaleListing requires a positive price');
  if (!Number.isFinite(marketAveragePrice) || marketAveragePrice <= 0) {
    throw new Error('createForSaleListing requires a positive marketAveragePrice');
  }
  if (typeof transferFn !== 'function') throw new Error('createForSaleListing requires a transferFn(fromUserId, toUserId, amount, reason)');

  await transferFn(sellerId, VACAY_AUTO_LISTINGS_ACCOUNT, LISTING_FEE, 'vacay_auto_listing_fee');

  const listing = {
    id: store.nextForSaleListingId++,
    sellerId,
    make,
    model,
    year,
    mileage,
    price,
    marketAveragePrice,
    priceRating: computePriceRating(price, marketAveragePrice),
    status: 'active',
    createdAt: now,
  };
  store.forSaleListings.push(listing);
  return listing;
}

function getForSaleListing(store, listingId) {
  return store.forSaleListings.find((l) => l.id === listingId) || null;
}

function searchForSaleListings(store, options = {}) {
  const { make, model } = options;
  return store.forSaleListings.filter((l) => l.status === 'active'
    && (!make || l.make === make)
    && (!model || l.model === model));
}

function markSold(store, listingId) {
  const listing = getForSaleListing(store, listingId);
  if (!listing) throw new Error(`markSold: no listing with id ${listingId}`);
  if (listing.status !== 'active') throw new Error(`markSold: listing ${listingId} is not active (status: ${listing.status})`);
  listing.status = 'sold';
  return listing;
}

module.exports = {
  PRICE_RATINGS,
  FOR_SALE_STATUSES,
  VACAY_AUTO_LISTINGS_ACCOUNT,
  LISTING_FEE,
  computePriceRating,
  createForSaleListing,
  getForSaleListing,
  searchForSaleListings,
  markSold,
};
