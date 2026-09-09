# Plan — Phase 2 (sixth slice): Customer Profiles

## Goal
Section 28's real HOME nav: "Discover, Upcoming, My Experiences,
Favorites, Messages, Wallet, Profile." Build the two real, concretely-
specified, data-backed pieces this codebase can actually support:
Favorites and Upcoming/My Experiences.

## Design
- `lib/customerProfiles.js`: a real `Favorite { id, customerId,
  creatorId, createdAt }` relationship -- `favoriteCreator`,
  `unfavoriteCreator`, `getFavorites`, `isFavorited`. Duplicate
  favorites rejected; unfavoriting something never favorited rejected.
- `getMyExperiences(store, customerId, { upcomingOnly })`: one real
  query serving both "Upcoming" and "My Experiences" from the same
  real data (`Booking`/`Experience`), the same "pure read-side
  aggregation" pattern `creatorAnalytics.js` already established, just
  from the customer's side. `upcomingOnly` filters to bookings still
  `confirmed`/`checked-in` whose experience hasn't happened yet --
  genuinely different from just "future timestamp," since a completed
  booking should drop out of Upcoming even if checked against a clock
  that's technically still before its original `scheduledAt` in an
  edge case, while still appearing in the full history.

## Explicitly NOT in this task
- Wallet — real, but V3's job per Section 16 ("VOID MAGIC should NOT
  create its own financial ledger"), not duplicated here.
- Messages, a full Profile entity — genuinely undocumented anywhere in
  the brief (Section 38 names a bare `User` entity, nothing more), not
  invented here.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 18
checks): favorite/unfavorite validation and rejection cases (missing
customerId, duplicate favorite, unfavoriting something never
favorited), `isFavorited`/`getFavorites` proven correctly scoped per
customer; `getMyExperiences` proven to return real, enriched data (not
bare ids), sorted by `scheduledAt`; `upcomingOnly` proven to include
both real active bookings before either happens, then correctly drop a
booking that actually completed (even checked against a clock where
its original timestamp would still read as "future"), while the full,
non-upcoming history still shows it; a customer with no bookings gets
a real empty list, not an error. Then a live pass: a real favorite
created and confirmed both via the boolean check and the list
endpoint, a real booking created and returned by both the full and
upcoming-only endpoints, and the favorite removed and reconfirmed
gone.

## Done when
- Favorites are proven idempotent-safe (duplicates rejected) and
  correctly scoped per customer.
- Upcoming vs. full history are proven to genuinely diverge once a
  booking actually completes, not just filtered by a raw timestamp.
