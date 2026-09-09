# Tasks — Phase 6: Fractional Ownership, Limited-Edition Merch, Digital Art Frame

- [x] Create `lib/fractionalOwnership.js`: `VOKEN_FRACTIONAL_POOL`,
      `createFractionalListing`, `getFractionalListing`, `buyShares`,
      `getFractionalHoldings`.
- [x] Create `lib/limitedEditionMerch.js`: `ITEM_TYPES`,
      `MERCH_SCARCITY_PRICE_MULTIPLIER`, `computeDynamicPrice`,
      `createMerchListing`, `getMerchListing`, `purchaseMerchItem`.
- [x] Create `lib/digitalArtFrame.js`: `SCREEN_TECHNOLOGY`,
      `registerDigitalArtFrame`, `getDigitalArtFrame`,
      `loadArtworkOntoFrame`.
- [x] Extend `createVokenStore()` with `fractionalListings`/
      `nextFractionalListingId`, `limitedEditionMerch`/
      `nextMerchListingId`, `digitalArtFrames`/`nextArtFrameId`.
- [x] Wire `server.js`: 11 new endpoints (`POST`/`GET /api/fractional/listing[/:id]`,
      `POST /api/fractional/listing/:id/buy`,
      `GET /api/fractional/holdings/:userId`, `POST`/`GET /api/merch[/:id]`,
      `POST /api/merch/:id/purchase`, `POST`/`GET /api/art-frame[/:id]`,
      `POST /api/art-frame/:id/load`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 23 checks, all passed after fixing one test-fixture bug):
      - Fractional gate starts closed; `createFractionalListing` works
        regardless (moves no money) and genuinely transfers edition
        custody into the pool; rejects a non-owning seller.
      - `buyShares` genuinely rejects while the gate is closed and
        genuinely succeeds once `setComplianceStatus` opens it, with a
        real payment to the seller and real per-investor share
        tracking across two different buyers.
      - `buyShares` rejects over-buying remaining shares; marks the
        listing `fully-sold` at 100%; rejects further buys once closed.
      - `getFractionalHoldings` reflects real, current ownership
        fractions; empty for a user with no stake.
      - `createFractionalListing` rejects `totalShares < 2`.
      - Merch dynamic pricing matches hand-computed scarcity values at
        0/50%/100% sold; `purchaseMerchItem` charges the live price at
        purchase time, then raises it for the next buyer -- proven
        with two sequential purchases at two different real prices.
      - Merch listing marks `sold-out` at zero remaining supply and
        rejects further purchases; rejects an invalid `itemType`.
      - `registerDigitalArtFrame` starts with no artwork loaded.
      - `loadArtworkOntoFrame` succeeds for a genuine owner; rejects a
        requester who doesn't own the artwork, a requester who isn't
        the frame's owner, and a non-art card.
- [x] Verify live with both `voken/server.js` and `venvs-mock-backend`
      running together: a fractional share purchase correctly rejected
      before the gate clears and correctly succeeded after, with the
      resulting $50 payout **independently confirmed** via
      `GET /api/vcoin/balance` on both the investor and seller; two
      sequential merch purchases at two different dynamically-computed
      prices, both payouts **independently confirmed** the same way; a
      digital art frame correctly loaded with genuinely owned artwork
      and correctly rejected for artwork a second collector didn't own.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Test-fixture bug fixed during verification
One assertion checked `ledger['buyer-1']` (the merch listing's
`creatorId`) for exactly the `$20` sale price, forgetting that
`buyer-1` in this shared test ledger also started with the same
`$1000` seed balance as every other test account. Not an app bug --
fixed by asserting the correct combined total (`$1020`).

## Next
VOKEN's five confirmed source docs are now fully built out: Cvltvre
Cards, the value algorithm, packs/raffles/trading, Kenji's onboarding,
engagement/Explore/creator profiles, VEX brokerage, VADO auctions/art,
fractional ownership, merch, and the digital art frame. Remaining work
is a full cross-phase regression across all six phases in one shared
store (matching VOID's Phase 7/12 regression discipline), then final
delivery.
