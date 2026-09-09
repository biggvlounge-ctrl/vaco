# Tasks — Phase 2: Flights+Stays Bundling

- [x] `server.js` — full flight/flight-booking API, real
      `bookStay()` cross-app HTTP client, `POST /api/bundles`.
- [x] Verify live: `vacay-flights/server.js` and `../vacay/server.js`
      run together — a real stay listing and flight created, a real
      bundle booked, the traveler's V3 balance confirmed decreasing by
      the exact combined total ($498: $300 stay + $198 discounted
      flight), the airline's account confirmed receiving its $150 net
      rate, and seat count confirmed decremented.
- [x] Shut down both test servers; confirmed via port check.
- [x] Write `README.md` (including the flagged non-atomicity
      limitation), this plan/tasks pair.
