# Tasks — Phase 5: VADO Auctions and Art

- [x] Create `lib/auctions.js`: `AUCTION_TYPES`, `AUCTION_STATUSES`,
      `DUTCH_DECAY_PER_MINUTE`, `createAuction`, `getAuction`,
      `getCurrentDutchPrice`, `placeBid`, `endAuction`, `acceptOffer`.
- [x] Create `lib/artCultureCard.js`: `createArtCultureCard` (real
      reuse of `mintCultureCard`), `getArtCultureCard`, `setForSale`,
      `recordArtView`.
- [x] Create `lib/vadoExplore.js`: `getVadoExplorePage`.
- [x] Create `lib/galleryAccounts.js`: `registerGalleryAccount`,
      `getGalleryAccount`, `getGalleryHoldings`.
- [x] Extend `createVokenStore()` with `auctions`/`nextAuctionId`,
      `artCultureCards`, `galleryAccounts`/`nextGalleryAccountId`.
- [x] Wire `server.js`: 12 new endpoints (`POST /api/auction`,
      `GET /api/auction/:id`, `GET /api/auction/:id/dutch-price`,
      `POST /api/auction/:id/bid`, `POST /api/auction/:id/end`,
      `POST /api/auction/:id/accept-offer`, `POST /api/art-card`,
      `GET /api/art-card/:cardId`, `POST /api/art-card/:cardId/for-sale`,
      `POST /api/art-card/:cardId/view`, `GET /api/vado/explore`,
      `POST /api/gallery-account`, `GET /api/gallery-account/:id`,
      `GET /api/gallery-account/:userId/holdings`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 27 checks, all passed after fixing one test-harness bug):
      - Art card mint reuses `mintCultureCard`, gets the real card-#1
        guarantee, and the `artCultureCards` record stays separate from
        the base card shape.
      - `setForSale`/`recordArtView` work and reject unknown card IDs;
        views count regardless of for-sale status.
      - `createAuction` rejects listing an edition the seller doesn't
        own; rejects a dutch auction with `reservePrice >= startingPrice`.
      - Instant: settles immediately at the asking price; rejects a
        second bid once sold.
      - Dutch: real linear decay verified against hand-computed values
        (100 → 90 at 10 minutes elapsed, floored at 40); a bid below the
        live price rejected; a qualifying bid settles at the *live
        price*, not the bid amount.
      - English: first bid must meet the starting price; bidding alone
        moves no money/ownership; a later bid must strictly exceed the
        current bid; `endAuction` settles at the final bid to the
        highest bidder; `endAuction` with zero bids marks `unsold`, not
        sold; `endAuction` rejects non-english auctions.
      - Offer: bids just record offers, no settlement; `acceptOffer`
        settles seller-driven at the accepted amount; rejects an
        invalid offer index.
      - VADO explore only ever surfaces `category === 'art'` cards,
        ranked by real engagement, excluding a non-art card verified
        present in the same store.
      - Gallery holdings reflect real, current ownership across
        multiple settled auctions; empty for a user owning nothing;
        `registerGalleryAccount` requires a `userId`.
- [x] Verify live with both `voken/server.js` and `venvs-mock-backend`
      running together: a real art card minted, an instant auction's
      $75 payout **independently confirmed** via `GET /api/vcoin/balance`
      on both the buyer and artist accounts (1000→925 buyer,
      1000→1075 artist) and edition ownership confirmed via
      `GET /api/card/1`; an offer placed and accepted; VADO explore and
      gallery holdings both confirmed correct against real live state.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Test-harness bug fixed during verification
The plain-Node script's `check()` helper originally called `fn()`
without awaiting it, so async checks (which call `placeBid`/
`endAuction`/`acceptOffer`) logged "ok" and moved on before their
internal `transferFn`/`transferEditionOwnership` calls had actually
run. Later synchronous checks (e.g. gallery holdings) then read stale
state. Not an app bug — fixed by making `check()` `async` and awaiting
every call.

## Next
Phase 6: fractional ownership (reusing the `'fractional-ownership'`
compliance gate from Phase 4), limited-edition merch with dynamic
pricing (Vaco Merch tie-in), and the physical digital art frame
product.
