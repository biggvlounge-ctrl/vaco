// VACAY HOMES -- Property Listings, built against the real, named
// comparable given for this division: Zillow's real estate listing
// model.
//
// **The real, defining structural difference from every other VACAY
// division**, stated directly because it's easy to assume otherwise:
// there is no escrow-then-settle booking flow here at all. A real
// home sale or long-term lease is a real-world legal transaction that
// happens outside any app's own payment rails -- Zillow itself never
// processes the home purchase price or the rent through its own
// platform as its core business. Real Zillow's actual monetization is
// Premier Agent: agents pay Zillow for buyer/renter leads, not a cut
// of the transaction. `lib/leads.js` is where the real money moves in
// this division -- never here, and never charged to the buyer/renter.

const LISTING_PURPOSES = ['for-sale', 'for-rent'];
const LISTING_STATUSES = ['active', 'pending', 'closed'];

function createPropertyListing(store, options = {}) {
  const {
    agentId, address, purpose, price, bedrooms, bathrooms, sqft, now = Date.now(),
  } = options;

  if (!agentId) throw new Error('createPropertyListing requires an agentId');
  if (!address) throw new Error('createPropertyListing requires an address');
  if (!LISTING_PURPOSES.includes(purpose)) {
    throw new Error(`createPropertyListing requires a purpose of ${LISTING_PURPOSES.join(', ')}`);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error('createPropertyListing requires a positive price');
  if (!Number.isInteger(bedrooms) || bedrooms < 0) throw new Error('createPropertyListing requires a non-negative integer bedrooms');
  if (!Number.isFinite(bathrooms) || bathrooms < 0) throw new Error('createPropertyListing requires a non-negative bathrooms');
  if (!Number.isInteger(sqft) || sqft <= 0) throw new Error('createPropertyListing requires a positive integer sqft');

  const listing = {
    id: store.nextListingId++,
    agentId,
    address,
    purpose,
    price,
    bedrooms,
    bathrooms,
    sqft,
    status: 'active',
    createdAt: now,
  };
  store.listings.push(listing);
  return listing;
}

function getPropertyListing(store, listingId) {
  return store.listings.find((l) => l.id === listingId) || null;
}

function listActiveListings(store) {
  return store.listings.filter((l) => l.status === 'active');
}

function listListingsForAgent(store, agentId) {
  return store.listings.filter((l) => l.agentId === agentId);
}

function requireStatus(store, listingId, expectedStatus, action) {
  const listing = getPropertyListing(store, listingId);
  if (!listing) throw new Error(`${action}: no listing with id ${listingId}`);
  if (listing.status !== expectedStatus) {
    throw new Error(`${action}: listing ${listingId} is "${listing.status}", expected "${expectedStatus}"`);
  }
  return listing;
}

function markPending(store, listingId) {
  const listing = requireStatus(store, listingId, 'active', 'markPending');
  listing.status = 'pending';
  return listing;
}

function markClosed(store, listingId) {
  const listing = requireStatus(store, listingId, 'pending', 'markClosed');
  listing.status = 'closed';
  return listing;
}

module.exports = {
  LISTING_PURPOSES,
  LISTING_STATUSES,
  createPropertyListing,
  getPropertyListing,
  listActiveListings,
  listListingsForAgent,
  markPending,
  markClosed,
};
