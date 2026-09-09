# Tasks — Phase 12: Booking/Stay Naming Correction

- [x] `git mv` `reservations.js` → `bookings.js`,
      `experienceReservations.js` → `experienceBookings.js`.
- [x] Fix requires in `voidServices.js`, `voidHourly.js`, `server.js`.
- [x] Rewrite `lib/bookings/routes.js`: booking resource moved to the
      section root (`POST /`, `GET /:id`, `POST /:id/complete`, etc.),
      with `/experiences` deliberately registered before the generic
      `/:id` to avoid a real Express route-matching ambiguity.
- [x] Re-verify in plain Node (2 checks): `createBooking`/
      `bookExperience` work from their renamed files.
- [x] Verify live: server boots clean; a booking created at
      `POST /api/bookings`, read back via `GET /api/bookings/:id`,
      completed via `POST /api/bookings/:id/complete`;
      `GET /api/bookings/experiences` confirmed still correctly
      returns the experience list (the real collision-risk case,
      proven resolved, not just reasoned about); `/api/flights/bundles`
      re-confirmed correct against the renamed `createBooking`.
- [x] Shut down test server; confirmed via port check.
- [x] Update `README.md`; write this plan/tasks pair.
