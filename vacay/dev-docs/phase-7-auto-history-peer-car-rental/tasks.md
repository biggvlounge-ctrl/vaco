# Tasks — Phase 1: Peer Car Rental

- [x] `lib/vehicles.js` — types, `PROTECTION_PLANS`, `listVehicle`,
      `getVehicle`, `listVehiclesForOwner`.
- [x] `lib/rentals.js` — double-booking guard, `bookRental` (real
      escrow charge, `hostEarnPercent` captured on the rental),
      `completeRental` (real dual payout from the rental's own stored
      rate).
- [x] `lib/store.js`, `server.js`, `package.json`, `.gitignore`.
- [x] `npm install`.
- [x] Verify in plain Node (14 checks): plan-derived earn percentage,
      validation, owner scoping, day/total math, escrow charge,
      double-booking guard (overlap/back-to-back/different-vehicle),
      plan-change non-retroactivity, payout-sum correctness,
      double-completion rejection.
- [x] Caught and fixed a real test-script bug (missing `await` on a
      rejected promise) — confirmed the underlying app rejection
      message was already correct.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: a vehicle listed, a real rental booked/confirmed via the
      renter's live balance, an overlap rejected, completion confirmed
      via the owner's live balance.
- [x] Shut down test server; confirmed via port check.
- [x] Write `README.md`, this plan/tasks pair.

## Next
Delivery/pickup via VOID. Cancellation/refunds. Real availability
calendars beyond the overlap guard.
