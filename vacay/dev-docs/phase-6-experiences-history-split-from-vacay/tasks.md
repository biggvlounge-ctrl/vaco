# Tasks — Phase 1: Split from VACAY

- [x] `git mv` `experiences.js`/`experienceBookings.js` from `vacay/lib/`.
- [x] Rename escrow/platform accounts to be genuinely distinct.
- [x] Scaffold `package.json`, `lib/store.js`, `server.js`.
- [x] `npm install`.
- [x] Re-verify in plain Node (7 checks): distinct escrow account,
      creation/capacity, discovery, booking, capacity filling,
      full-experience rejection, completion payout math.
- [x] Verify live alongside `../vacay/server.js` running at the same
      time against the shared V3 mock ledger.
- [x] Shut down test servers; confirmed via port check.
- [x] Write `README.md`, this plan/tasks pair.
