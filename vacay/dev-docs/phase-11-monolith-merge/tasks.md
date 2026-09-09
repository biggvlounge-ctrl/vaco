# Tasks — Phase 11: Monolith Merge

- [x] `git mv` all section `lib/*.js` files into `vacay/lib/<section>/`
      (bookings, home, auto, flights) — `bookings.js` renamed to
      `reservations.js` in both the Bookings and Flights sections to
      avoid stuttering against the section name.
- [x] Build the two new real Auto sub-features: `carListings.js`
      (CarGurus price-rating + flat listing fee), `fleetRentals.js`
      (VACAY's own fleet, no owner split).
- [x] Consolidate `lib/store.js` — one store, nested by section,
      field names matching exactly what each moved lib file already
      expects.
- [x] Write `routes.js` per section (real Express Routers).
- [x] Rewrite `server.js` as the composition root.
- [x] Fix two stale `require('./bookings')` references
      (`voidServices.js`, `voidHourly.js`) left over from the
      `bookings.js` → `reservations.js` rename — caught by the server
      failing to boot on first run, fixed, confirmed via clean
      restart.
- [x] Re-verify every section in plain Node against the merged code
      (5 bookings + 2 home + 9 auto + 3 flights = 19 checks) — a
      regression check, no lib-level logic changed.
- [x] Verify live, full-stack: one running server, all four section
      `/meta` endpoints, a real `/api/flights/bundles` call, the two
      new Auto features (CarGurus listing fee, fleet rental's
      no-split full payout), and a free Home tour request — all
      confirmed against the real, independently running V3 mock
      ledger.
- [x] Shut down the test server; confirmed via port check.
- [x] Move historical dev-docs from the four absorbed apps into
      `vacay/dev-docs/` (phases 6-10), preserving their own rationale
      rather than deleting it.
- [x] Remove the now fully-absorbed `vacay-experiences/`,
      `vacay-auto/`, `vacay-homes/`, `vacay-flights/` directories.
- [x] Rewrite `README.md` for the merged app.
