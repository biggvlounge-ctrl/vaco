// VOID MAGIC -- Customer Profiles (Section 28, Phase 2's sixth real
// slice). Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS28's
// real HOME nav: "Discover, Upcoming, My Experiences, Favorites,
// Messages, Wallet, Profile."
//
// Honest scoping: Discover already exists (`experiences.js`'s
// `discoverExperiences`). Wallet is real, but it's V3's job per
// Section 16 ("VOID MAGIC should NOT create its own financial
// ledger") -- not duplicated here. Messages and a full Profile entity
// have no real field shape anywhere in the brief (Section 38 names a
// bare `User` entity, nothing more) -- genuinely undocumented, not
// invented here. This module builds the two real, concretely-
// specified, data-backed pieces: Favorites (a real relationship, not
// named with a field shape but unambiguous in meaning) and Upcoming/
// My Experiences (a real, honest query over this codebase's own
// already-existing `Booking`/`Experience` data, the same "pure
// read-side aggregation over real data" pattern already established
// by `creatorAnalytics.js`, just from the customer's side of the same
// data instead of the host's).

const { getExperience } = require('./experiences');

function favoriteCreator(store, options = {}) {
  const { customerId, creatorId, now = Date.now() } = options;
  if (!customerId) throw new Error('favoriteCreator requires a customerId');
  if (!creatorId) throw new Error('favoriteCreator requires a creatorId');
  if (store.favorites.some((f) => f.customerId === customerId && f.creatorId === creatorId)) {
    throw new Error(`favoriteCreator: ${customerId} has already favorited ${creatorId}`);
  }

  const favorite = {
    id: store.nextFavoriteId++, customerId, creatorId, createdAt: now,
  };
  store.favorites.push(favorite);
  return favorite;
}

function unfavoriteCreator(store, options = {}) {
  const { customerId, creatorId } = options;
  if (!customerId) throw new Error('unfavoriteCreator requires a customerId');
  if (!creatorId) throw new Error('unfavoriteCreator requires a creatorId');

  const index = store.favorites.findIndex((f) => f.customerId === customerId && f.creatorId === creatorId);
  if (index === -1) throw new Error(`unfavoriteCreator: ${customerId} has not favorited ${creatorId}`);
  const [removed] = store.favorites.splice(index, 1);
  return removed;
}

function getFavorites(store, customerId) {
  if (!customerId) throw new Error('getFavorites requires a customerId');
  return store.favorites.filter((f) => f.customerId === customerId);
}

function isFavorited(store, customerId, creatorId) {
  return store.favorites.some((f) => f.customerId === customerId && f.creatorId === creatorId);
}

// The real "Upcoming" (`upcomingOnly: true`) vs "My Experiences"
// (`upcomingOnly: false`, the default -- full booking history)
// distinction from SS28's nav, both served by one real query: Upcoming
// is a real, honest subset (still-active bookings whose experience
// hasn't happened yet), not a second data model.
function getMyExperiences(store, customerId, options = {}) {
  const { upcomingOnly = false, now = Date.now() } = options;
  if (!customerId) throw new Error('getMyExperiences requires a customerId');

  return store.bookings
    .filter((b) => b.customerId === customerId)
    .map((b) => {
      const experience = getExperience(store, b.experienceId);
      return {
        bookingId: b.id,
        bookingStatus: b.status,
        pricePaid: b.pricePaid,
        experienceId: experience.id,
        title: experience.title,
        hostId: experience.hostId,
        type: experience.type,
        format: experience.format,
        scheduledAt: experience.scheduledAt,
        location: experience.location,
      };
    })
    .filter((entry) => !upcomingOnly || (
      (entry.bookingStatus === 'confirmed' || entry.bookingStatus === 'checked-in') && entry.scheduledAt > now
    ))
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

module.exports = {
  favoriteCreator, unfavoriteCreator, getFavorites, isFavorited, getMyExperiences,
};
