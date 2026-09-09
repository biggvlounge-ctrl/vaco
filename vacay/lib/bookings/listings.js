// VACAY -- Listings (Phase 1 core loop).
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `Listing { id, hostId, type: "stay" | "experience",
// pricePerNight }`.
//
// A real, flagged resolution of an apparent inconsistency in the
// source doc: `Listing.type` names "experience" as an option, but the
// same doc separately defines a distinct `Experience { id, hostId,
// description, durationHours }` entity AND a separate API endpoint
// (`POST /vacay/experiences -- separate from stays, same host model`)
// -- the API map itself treats stays and experiences as two different
// real flows, not one polymorphic Listing. This module therefore
// scopes `Listing` to stays only (`type` is always `'stay'`, kept on
// the record for forward compatibility with the doc's own field name
// rather than dropped); Experience is real, separate, split out into
// `../vacay-experiences/`.
//
// **`hostType` (VACAY division split, Phase N)**: per explicit
// instruction to split VACAY into its own real divisions matching
// Airbnb, Turo (`../vacay-auto/`), Zillow (`../vacay-homes/`), and
// Booking.com. Booking.com is deliberately NOT a separate app here --
// its real booking transaction (book a place for nights, pay, the
// property gets paid) is mechanically identical to Airbnb's, and its
// real differentiator is inventory type (hotels/professional
// properties vs. individual hosts), not a different economic model.
// Building a structurally-duplicate app just to re-implement this same
// escrow-then-settle flow a second time would be real, needless
// duplication -- `hostType` distinguishes the two inventory types
// within the one real booking flow that already fits both, the same
// way real OTAs (Expedia/Vrbo, per `VACAY_COMPARABLES.md`) already
// carry both individual-host and professional/hotel inventory through
// one booking system.

const LISTING_TYPES = ['stay'];
const HOST_TYPES = ['individual', 'professional'];

function createListing(store, options = {}) {
  const {
    hostId, pricePerNight, hostType = 'individual', now = Date.now(),
  } = options;

  if (!hostId) throw new Error('createListing requires a hostId');
  if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) {
    throw new Error('createListing requires a positive pricePerNight');
  }
  if (!HOST_TYPES.includes(hostType)) {
    throw new Error(`createListing requires a hostType of ${HOST_TYPES.join(', ')}`);
  }

  const listing = {
    id: store.nextListingId++,
    hostId,
    type: 'stay',
    hostType,
    pricePerNight,
    status: 'active',
    createdAt: now,
  };
  store.listings.push(listing);
  return listing;
}

function getListing(store, listingId) {
  return store.listings.find((l) => l.id === listingId) || null;
}

module.exports = {
  LISTING_TYPES, HOST_TYPES, createListing, getListing,
};
