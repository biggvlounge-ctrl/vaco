# Tasks — Phase 2 (fifth slice): Double-Booking Guard

- [x] Add `ACTIVE_EXPERIENCE_STATUSES`, `intervalsOverlap`,
      `findDoubleBooking` to `lib/experiences.js`.
- [x] Wire the check into `createExperience`: rejects with a real
      error naming the specific conflicting experience.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 9 checks): exact-same-slot rejection (with the real
      conflicting experience id/title in the error message);
      partial-overlap rejection across different formats; back-to-back
      scheduling allowed (not treated as overlap); a different host
      allowed the same window; a cancelled experience's slot
      confirmed freed; a completed experience's slot confirmed freed;
      a new, longer experience fully containing an existing shorter
      one also rejected.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real overlapping booking attempt
      confirmed rejected with the real conflict message; the existing
      MVP booking flow re-run on an unrelated experience/host,
      confirmed unaffected.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Customer profiles (Favorites, My Experiences), Media, Geofencing --
the rest of Phase 2, each its own real, later slice. Travel time,
setup/security buffers, and venue availability remain deferred,
substantial "intelligent scheduling system" work, not part of this
slice.
