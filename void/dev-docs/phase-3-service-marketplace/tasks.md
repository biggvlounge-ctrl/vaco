# Tasks — Phase 3: Service Marketplace / Verticals engine

- [x] Create `lib/verticals.js`: `PRICING_UNITS`, `VERTICALS` (23
      real named verticals), `getVertical`, `listVerticals`.
- [x] Create `lib/marketplace.js`: `JOB_STATUSES`, `requestJob`,
      `getJob`, `matchProvider`, `acceptJob`, `completeJob`, `rateJob`,
      `cancelJob`, `getJobsForVertical`, `getJobsForUser`.
- [x] Extend `createVoidStore()` (in `store.js`) with
      `jobs`/`nextJobId`.
- [x] Wire `server.js`: 10 new endpoints (`GET /api/verticals`,
      `GET /api/vertical/:id`, `POST /api/job`, `GET /api/job/:id`,
      `POST /api/job/:id/match`, `POST /api/job/:id/accept`,
      `POST /api/job/:id/complete`, `POST /api/job/:id/rate`,
      `POST /api/job/:id/cancel`, `GET /api/jobs/vertical/:verticalId`,
      `GET /api/jobs/user/:userId`) plus a real `transferVCoin` wired
      to V3's `/api/vcoin/transfer` contract (same pattern as `hvntz`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 18 checks, all passed after fixing one
      test-script bug):
      - `listVerticals` returns 23 real verticals, each with a valid
        pricing unit and a take rate strictly between 0 and 1.
      - `requestJob` rejects an unknown vertical, both licensing-gated
        verticals (Cannabis Delivery, Medical Transportation)
        independently, and missing/non-positive customer/quantity/
        price inputs; correctly computes `totalPrice`.
      - Full state-machine enforcement: `acceptJob` before `matched`
        rejected; `matchProvider` requires a `providerId` and rejects
        re-matching; `completeJob` before `accepted` rejected and
        rejected again once already `completed`; `rateJob` rejected
        before completion and rejects out-of-range/non-integer
        ratings (0, 6, and 4.5 all checked); `cancelJob` allowed from
        both `requested` and `matched`, rejected once `accepted`.
      - `completeJob` performs two real transfers (provider payout +
        platform fee) that sum exactly to `totalPrice` — checked
        against a real 25%-take-rate Laundry job (platformFee: 2.5,
        providerPayout: 7.5 on a $10 job) and independently confirmed
        against the transfer ledger for all three parties (customer,
        provider, `void-platform`).
      - `getJobsForVertical`/`getJobsForUser` scope correctly.
      - One test-script bug found and fixed (not an app bug, same
        class caught repeatedly elsewhere this session): the `check()`
        test helper called `fn()` without awaiting it, so an
        `async () => {...}` check function's internal assertion
        failures became unhandled promise rejections that crashed the
        process *after* the script had already printed "ok" for that
        check and moved on — made `check()` `async` and awaited every
        call site.
- [x] Verify live with both `void/server.js` and `venvs-mock-backend`
      running together:
      - A real Laundry job (10 lbs @ $1/lb = $10) requested, matched,
        accepted, and completed through the actual HTTP API.
      - `acceptJob` before matching correctly rejected via the real
        API.
      - The resulting payout — provider $7.50, platform fee $2.50 —
        independently confirmed via `GET /api/vcoin/balance` for the
        customer, provider, and `void-platform` accounts, exactly
        matching the plain-Node pass.
      - The job rated 5 successfully via the real API.
      - Requesting Cannabis Delivery correctly rejected live with the
        real "licensing-gated" error message.
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`
      that neither port accepted connections.
- [x] Commit as its own change.

## Next
Passenger/Cargo/Load Management (declarations, capacity profiles,
dynamic cargo pricing, sequencing rules) is the next concretely-scoped
buildable piece from `VOID_MASTER_FREEZE.md`.
