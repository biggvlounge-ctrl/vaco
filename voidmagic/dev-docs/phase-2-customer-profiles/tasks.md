# Tasks — Phase 2 (sixth slice): Customer Profiles

- [x] Create `lib/customerProfiles.js`: `favoriteCreator`,
      `unfavoriteCreator`, `getFavorites`, `isFavorited`,
      `getMyExperiences` (with `upcomingOnly`).
- [x] Extend `createVoidMagicStore()` with `favorites`/`nextFavoriteId`.
- [x] Wire `server.js`: 5 new endpoints (`POST /api/favorites`,
      `POST /api/favorites/remove`,
      `GET /api/customers/:customerId/favorites`,
      `GET /api/customers/:customerId/favorites/:creatorId`,
      `GET /api/customers/:customerId/experiences` with
      `?upcomingOnly=true`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 18 checks): favorite/unfavorite validation and
      rejection (missing customerId, duplicate favorite, unfavoriting
      something never favorited), `isFavorited`/`getFavorites`
      correctly scoped per customer; `getMyExperiences` returns real
      enriched data sorted by `scheduledAt`; `upcomingOnly` includes
      both active future bookings, then correctly drops a booking that
      actually completed while the full history still shows it; empty
      list (not an error) for a customer with no bookings.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real favorite created and confirmed via
      both the boolean-check and list endpoints, a real booking
      confirmed via both the full and upcoming-only experience
      endpoints, favorite removal confirmed.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Media, Geofencing -- the rest of Phase 2, each its own real, later
slice. Messages and a full Profile entity remain genuinely
undocumented, not built.
