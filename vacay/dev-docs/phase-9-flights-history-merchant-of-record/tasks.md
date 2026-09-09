# Tasks — Phase 1: Merchant-of-Record Flights

- [x] `lib/flights.js` — cabin classes, `listFlight` (real capacity/
      seatsAvailable, netRate/retailPrice sanity guard),
      `getFlight`, `searchFlights`.
- [x] `lib/bookings.js` — `bookFlight` (atomic real three-way
      settlement: passenger charge, airline payout, platform margin),
      `getFlightBooking`, `listBookingsForPassenger`.
- [x] `lib/store.js`, `package.json`, `.gitignore`.
- [x] `npm install`.
- [x] Verify in plain Node (16 checks): capacity tracking, margin math
      proven via transfer-call arguments, sell-out/rejection behavior,
      discount math and its netRate floor guard.

## Next
See Phase 2 for `server.js` and the real cross-app bundle feature.
