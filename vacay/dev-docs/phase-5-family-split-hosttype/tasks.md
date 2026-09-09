# Tasks — Phase 5: Family Split + hostType

- [x] `git mv` `lib/experiences.js`/`lib/experienceBookings.js` into
      new `../vacay-experiences/` project.
- [x] Give the moved app its own distinct escrow/platform account
      names (`vacay-experiences-escrow`/`-platform`).
- [x] Strip Experiences fields/imports/endpoints out of `vacay/`
      (`lib/store.js`, `server.js`).
- [x] Scaffold `vacay-experiences/` (`package.json`, `lib/store.js`,
      `server.js`), `npm install`.
- [x] Add `HOST_TYPES`/`hostType` to `lib/listings.js` (Booking.com
      fold-in), default `'individual'`.
- [x] Verify in plain Node: `vacay`'s own `hostType` behavior (6
      checks, including proof that professional/individual settle
      identically); `vacay-experiences`' moved logic re-verified
      standalone (7 checks).
- [x] Verify live: `vacay/server.js` and `vacay-experiences/server.js`
      run together as independent processes against the shared V3 mock
      — a professional stay and an independent experience both booked
      and settled, confirmed via real ledger balances.
- [x] Shut down both test servers; confirmed via port check.
- [x] Update `vacay/README.md` (family-split note, updated What's
      Here/Verified/Not yet built); write `vacay-experiences/README.md`.

## Next
`../vacay-auto/` (Turo) and `../vacay-homes/` (Zillow) as their own
new divisions.
