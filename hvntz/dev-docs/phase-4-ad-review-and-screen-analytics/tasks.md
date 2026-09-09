# Tasks — Phase 4: Ad Content Review Workflow, Screen Analytics, cross-phase regression

- [x] Create `lib/adReview.js`: `AD_REVIEW_STATUSES`, `submitAdContent`,
      `getAdSubmission`, `reviewAdSubmission`, `getAdSubmissions`,
      `runAdSubmission`.
- [x] Create `lib/screenAnalytics.js`: `getScreenAnalytics`.
- [x] Extend `createHvntzStore()` (in `revenueStack.js`) with
      `adSubmissions`/`nextAdSubmissionId`.
- [x] Add `payerId` to the stored event record in `recordRevenueEvent`
      (was computed but never persisted) — needed for
      `getScreenAnalytics`'s distinct-advertiser count.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 20 checks, all passed clean after fixing two
      test-script bugs, no real app bugs found):
      - `submitAdContent`: rejects a non-screen location, rejects a
        missing `qrCodeUrl`, starts `pending`.
      - `runAdSubmission`: rejects a `pending` submission; rejects a
        `rejected` submission; succeeds only on `approved`, triggers a
        real `screen-ad` revenue event with the correct amount, and the
        payout lands correctly on the ledger.
      - `reviewAdSubmission`: approves/rejects correctly; rejects a
        second review of the same submission.
      - `getAdSubmissions`: filters correctly by `businessId` and
        `status`.
      - `getScreenAnalytics`: correctly rolls up total revenue and
        per-event-type revenue across screen locations only (a mixed
        `screen-ad` + `screen-dtc-sale` case checked, not just one
        stream); correctly counts distinct advertisers and ad
        submissions by status; throws for an unknown business.
      - **Cross-phase regression** (same shared store, all nine
        modules, a fresh set of businesses): participation correctly
        feeds Digital Twin level (Level 3 via `hub-as-store`); a DREA
        placement rule set earlier is still enforced correctly after
        other modules mutated the store; the neighbor program finds a
        real nearby business by Haversine distance; a hunt check-in's
        revenue lands correctly in the same Franchise List as a
        manually-recorded event, with hunt progress tracked correctly;
        ad pricing computes correctly independent of everything else;
        the Explore Page surfaces both a hunt and a neighbor match
        together in one correctly-sorted feed; screen analytics
        correctly returns real zeroed data (not an error) for a
        hub-only business with no screen locations.
      - Two test-script bugs found and fixed during this pass (not app
        bugs): `setPlacementRule` call was missing the required
        `businessId`; `optInToNeighborProgram`/`recordNeighborTrade`/
        `setCvnvoPlacement` calls used wrong parameter names
        (`radiusKm`/`incentiveGiven`/`tier` instead of the real
        `definedVicinityRadius`/`incentiveOffered`/`packageTier`), and
        one test-data issue (a 15km neighbor radius was too small for
        the real ~29km distance between the Confluence and Gateway Arch
        coordinates used — widened to 40km, not an app bug).
- [x] Wire `server.js`: 5 new endpoints (`POST /api/ad-submission`,
      `GET /api/ad-submission/:id`, `POST /api/ad-submission/:id/review`,
      `GET /api/ad-submissions`, `POST /api/ad-submission/:id/run`,
      `GET /api/screen-analytics/:businessId`).
- [x] Verify live with both `hvntz/server.js` and `venvs-mock-backend`
      running together:
      - A real business + screen location registered; an ad submitted;
        running it before review correctly rejected
        ("not approved (status: pending)"); reviewed/approved; run
        again — succeeded, real `screen-ad` revenue event returned.
      - Payout independently confirmed via `GET /api/vcoin/balance`
        for both the business owner and the advertiser.
      - `GET /api/screen-analytics/:businessId` correctly reflected
        the live data (1 screen location, 12.5 total revenue, 1
        distinct advertiser, 1 approved submission).
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`
      that neither port accepted connections (curl exit 7 on both
      `8791` and `8792`).
- [x] Commit as its own change.

## Next
This closes the genuinely software-buildable slice of the source docs
identified across all four phases. Remaining "Not yet built" items are
either explicitly out of scope (drone routing, physical hardware, real
AI agents, third-party integrations) or blocked on systems that don't
exist elsewhere in this session yet (CHOPZ). Final delivery.
