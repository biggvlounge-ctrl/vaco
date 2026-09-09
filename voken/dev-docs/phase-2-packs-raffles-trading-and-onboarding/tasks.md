# Tasks — Phase 2: Packs, Raffles, Trading, Kenji's onboarding flow

- [x] Create `lib/cardPacks.js`: `PACK_TIER_NAMES`,
      `DIGITAL_OR_PHYSICAL`, `CATEGORY_POOLS`, `DEFAULT_CARDS_PER_PACK`,
      `createPackTier`, `getPackTier`, `openPack`.
- [x] Create `lib/raffles.js`: `RAFFLE_STATUSES`, `createRaffle`,
      `getRaffle`, `enterRaffle`, `drawRaffleWinner`.
- [x] Create `lib/trading.js`: `TRADE_STATUSES`, `proposeTrade`,
      `getTrade`, `acceptTrade`, `rejectTrade`, `cancelTrade`.
- [x] Create `lib/cultureCardApplication.js`: `APPLICATION_PATHS`,
      `APPLICATION_STATUSES`, `SELF_INITIATED_MIN_EXTERNAL_SCORE`,
      `submitApplication`, `getApplication`, `runKenjiAnalysis`.
- [x] Extend `createVokenStore()` with `cardPackTiers`/`nextPackTierId`/
      `raffles`/`nextRaffleId`/`trades`/`nextTradeId`/
      `cultureCardApplications`/`nextApplicationId`.
- [x] Wire `server.js`: 14 new endpoints.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 17 checks, all passed after fixing one
      test-script bug):
      - `createPackTier` rejects invalid tier name, price, and
        guaranteed rarity.
      - `openPack` draws the correct configured card count; genuinely
        enforces a guaranteed-minimum-rarity even under an `rng` that
        would otherwise miss it; throws when no candidate can ever
        meet the guarantee; rejects an unknown pack tier and an empty
        candidate list.
      - `enterRaffle` dedupes a repeat entry from the same user.
      - `drawRaffleWinner` mints a real edition to the winner and
        closes the raffle; rejects drawing twice; rejects a
        zero-entry raffle.
      - `acceptTrade` verifies real current ownership on both sides
        before swapping, then genuinely swaps; rejects a trade whose
        offered item is no longer owned by the proposer.
      - `rejectTrade`/`cancelTrade` work correctly, with
        `cancelTrade` restricted to the real proposer.
      - `submitApplication` rejects an invalid path and missing
        fields.
      - `runKenjiAnalysis`: always accepts a proactive invitation;
        declines a self-initiated request with a genuinely empty real
        profile (0 followers, no credentials — fixed from an initial
        5-follower test case that the real formula correctly scored
        above threshold, a test-script bug, not an app bug); accepts
        a self-initiated request with one real documented credential;
        rejects re-analyzing an already-decided application.
- [x] Verify live with `voken/server.js` running alone:
      - A real premium pack (guaranteed legendary) opened against a
        2-card pool, correctly receiving the legendary card.
      - A raffle drawn to its sole real entrant, minting a real third
        edition.
      - A real trade between two card subjects, accepted, with the
        resulting ownership swap **independently confirmed** via two
        separate `GET /api/card/:id` calls, not just trusted from the
        trade response.
      - A proactive Kenji invitation confirmed always accepted through
        the real HTTP API.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 3: the Explore page integration (reusing HVNTZ's real ranking
logic) and Creator Digital Profile aggregation.
