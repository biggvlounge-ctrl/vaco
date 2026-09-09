# Tasks — Phase 10: BarBuddy's live HVNTZ venue validation

- [x] Investigate: confirmed HVNTZ's own `GET /api/business/:id` now
      exists; confirmed VDP's Dating Village calls the same
      `checkInAtVenue` function with a synthetic, non-HVNTZ venueId,
      ruling out mandatory validation.
- [x] `lib/proximity.js` — `checkInAtVenue` gained opt-in
      `verifyAgainstHvntz` + injected `hvntzFetchFn`; `getOrCreateVenue`
      gained `hvntzVerified`/`hvntzBusinessName`, cached on first
      verification.
- [x] `server.js` — added `fetchBusiness` client, wired into
      `POST /api/barbuddy/check-in` (always injected, only used when
      the caller opts in).
- [x] 6 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `hvntz` + `cvnvo`: real
      business registered; unverified check-in against
      `vdp-dating-village` confirmed unaffected; verified check-in
      against the real business confirmed succeeding; verified
      check-in against a nonexistent business confirmed rejected with
      HVNTZ's own real error message.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
None identified for this specific gap.
