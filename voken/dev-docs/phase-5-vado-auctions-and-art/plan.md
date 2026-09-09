# Plan — Phase 5: VADO Auctions and Art

## Goal
Build VADO's real auction mechanics and its `ArtCultureCard` structure:
four genuinely different settlement mechanics (instant, English, Dutch,
offer) and a physical-original + limited-digital-edition art asset
type, all through real code reuse of Phase 1's `mintCultureCard()` and
this project's established injected-`transferFn` pattern. Fractional
ownership is explicitly deferred to Phase 6.

## Design
- `lib/auctions.js`: `createAuction()` validates the seller genuinely,
  currently owns the specific edition being listed (never trusted from
  a stale claim) before creating the auction. Each `auctionType`
  branches to real, distinct behavior in `placeBid()`:
  - `instant` settles immediately at the full asking price.
  - `english` only records the bid (`currentBid`/`highestBidderId`);
    settlement is deferred to `endAuction()`, which pays out at the
    final `currentBid` -- or marks the auction `unsold` if it never
    received a bid, or if a set `reservePrice` was never met.
  - `dutch` computes a real linear price decay
    (`DUTCH_DECAY_PER_MINUTE = 0.01` of the starting price per elapsed
    minute, floored at `reservePrice`) via `getCurrentDutchPrice()`,
    and settles the instant a bid meets or beats that live price -- at
    the live price, not the bid amount.
  - `offer` just appends to `auction.offers[]`; settlement is entirely
    seller-driven via `acceptOffer()`.
- `lib/artCultureCard.js`: `createArtCultureCard()` calls Phase 1's own
  `mintCultureCard({category: 'art', ...})` to get the real card-#1
  guarantee and mint-transparency mechanics for free, then layers a
  separate `artCultureCards` record linked by `cardId` -- the same
  own-entity-linked-by-id resolution already used for VOID's
  `VoidLocker` (linked via `stationId`, never merged into
  `VoidStation`). A physical "original" is always exactly one physical
  edition, regardless of how many digital editions exist.
- `lib/vadoExplore.js`: reuses the same attention-ranking pattern as
  `exploreVoken.js` (Phase 3's real engagement stats feeding Phase 1's
  real `computeDigitalEngagementScore()`), scoped to `category ===
  'art'` and enriched with VADO-specific `isForSale`/gallery
  `viewCount` signals general Explore has no concept of -- VADO's own
  dedicated feed, per the doc's explicit confirmation, not a filtered
  view of the general one.
- `lib/galleryAccounts.js`: `getGalleryHoldings()` is a real
  aggregation query over the existing `cultureCards`/`editions`
  ownership data already maintained by `cultureCards.js` -- no separate
  ownership ledger.

## Explicitly NOT in this task
- Fractional ownership -- deferred to Phase 6, where it reuses the
  `'fractional-ownership'` compliance gate already built in Phase 4.
- No real order-matching/clearing between independent art buyers beyond
  the four mechanics above; all settle directly seller-to-buyer through
  the injected `transferFn`.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 27
checks), covering all four auction types' real settlement/non-
settlement behavior, ownership-before-listing validation, Dutch decay
math against hand-computed values, and VADO explore's category
filtering. Then a live pass: both `voken/server.js` and
`venvs-mock-backend` running together — an instant auction's real $75
payout independently confirmed against the mock ledger (not just
trusted from the auction response), then an offer accepted, VADO
explore and gallery holdings both confirmed live.

## Done when
- All four auction types behave per their real, distinct settlement
  rules, verified in plain Node and live.
- `createAuction` rejects listing an edition the seller doesn't
  genuinely own.
- Dutch decay is a real, verifiable linear formula, floored at reserve.
- `endAuction` correctly distinguishes "no bids" from "bids below
  reserve" -- both `unsold`, never silently sold below reserve.
- VADO explore only ever surfaces `category === 'art'` cards.
- Gallery holdings reflect real, current ownership, not a cached count.
- Live: an instant auction's payout independently confirmed against the
  mock V3 ledger.
