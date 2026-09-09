# Tasks — Phase 3: Hunts and Explore Page

- [x] Create `lib/hunts.js`: `HUNT_INTENSITY_LEVELS`, `createHunt`,
      `getHunt`, `addCheckpoint`, `getCheckpoint`, `hasCheckedIn`,
      `checkInAtCheckpoint`, `getHuntProgress`, `recommendBreak`.
- [x] Create `lib/explore.js`: `LOCATION_SCORE_DECAY_KM`,
      `computeLocationScore`, `getExplorePage`.
- [x] Extend `createHvntzStore()` (in `revenueStack.js`) with
      `hunts`/`nextHuntId`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 22 checks, all passed clean on first run, using
      the real Cahokia Mounds/Gateway Arch/Confluence worked example
      with three real host businesses):
      - `createHunt`: missing title/sponsorId/non-positive
        totalBudget/invalid intensityLevel all throw.
      - `addCheckpoint`: missing hunt/business/location, non-positive
        bountyAmount/hostFee, missing clue all throw.
      - `checkInAtCheckpoint`: real dual payout on check-in — bounty
        to hunter, host fee to business, both from the sponsor's
        budget, remaining budget decremented correctly; a second
        check-in by the same user at the same checkpoint is rejected;
        a check-in exceeding a tiny hunt's remaining budget is
        rejected.
      - `getHuntProgress`: correctly reports 1/3 visited after one
        check-in, 3/3 and `complete: true` after all three.
      - `recommendBreak`: returns `null` for a non-action-based hunt;
        for an action-based hunt, returns the hunter's unvisited
        checkpoints sorted nearest-first by real Haversine distance
        from a given current position; returns an empty list once the
        hunter has visited every checkpoint.
      - `getExplorePage`: non-numeric userLat/userLng throws;
        `computeLocationScore` returns 100 at distance 0 and 0 at
        1000km; a hunt with a geolocated checkpoint is surfaced; the
        feed is sorted by `combinedRankingScore` descending.
      - Final ledger cross-checked against hand computation:
        `{ 'sponsor-1': 945, 'hunter-1': 37, 'confluence-cafe-owner': 7,
        'arch-diner-owner': 6, 'mounds-grill-owner': 5 }` (sponsor paid
        out 55 total across 3 checkpoints: bounties 10+12+15=37 to the
        hunter, host fees 5+6+7=18 across the three businesses).
- [x] Wire `server.js`: 6 new endpoints (`POST /api/hunt`,
      `GET /api/hunt/:huntId`, `POST /api/hunt/:huntId/checkpoint`,
      `POST /api/hunt/:huntId/checkin`,
      `GET /api/hunt/:huntId/progress/:userId`,
      `GET /api/hunt/:huntId/break-recommendation/:userId`,
      `GET /api/explore`).
- [x] Verify live with both `hvntz/server.js` and `venvs-mock-backend`
      running together, the full worked example through actual HTTP
      calls:
      - 3 businesses registered (Mounds Grill, Arch Diner, Confluence
        Cafe), each with a `hub` location at Cahokia Mounds, the
        Gateway Arch, and the Confluence respectively.
      - A real action-based hunt ("Confluence Trail", budget 55)
        created with 3 checkpoints at real coordinates.
      - Checking in at checkpoint 1 paid the hunter 10 and Mounds
        Grill's owner 5 — confirmed independently via
        `GET /api/vcoin/balance/:userId` on both accounts, not just
        trusted from the check-in response; `remainingBudget` dropped
        55 → 40 correctly.
      - `GET /api/hunt/1/break-recommendation/hunter-1` (queried from
        near checkpoint 1) correctly returned the two unvisited
        checkpoints sorted nearest-first (11.2km, then 26.56km).
      - `GET /api/hunt/1/progress/hunter-1` correctly showed 1/3, then
        3/3 with `complete: true` after checking in at checkpoints 2
        and 3.
      - A repeat check-in at checkpoint 1 was correctly rejected
        ("has already checked in").
      - `GET /api/explore` near St. Louis correctly surfaced the hunt
        with a non-zero combined ranking score.
      - Final live ledger — independently confirmed per user against
        the mock V3 ledger, each starting from the mock backend's
        1000-VCoin default — matched the plain-Node pass exactly:
        sponsor-1: 945 (1000-55), hunter-1: 1037 (1000+37),
        mounds-grill-owner: 1005, arch-diner-owner: 1006,
        confluence-cafe-owner: 1007.
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`
      that neither port accepted connections (curl exit 7, connection
      refused, on both `8791` and `8792`).
- [x] Commit as its own change.

## Next
Full HVNTZ regression pass across Phases 1-3 together (mirroring
VENVS's Phase 7 regression pattern), then final delivery.
