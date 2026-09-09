# Tasks — Phase 1: Core Commerce Loop

- [x] Create `lib/store.js`: `createChopzShopStore()`.
- [x] Create `lib/products.js`: `createProduct`, `getProduct`.
- [x] Create `lib/affiliateLinks.js`: `createAffiliateLink`,
      `getAffiliateLink`, `recordClick`.
- [x] Create `lib/orders.js`: `CHOPZ_ESCROW_ACCOUNT`,
      `CHOPZ_PLATFORM_ACCOUNT`, `DEFAULT_FEE_PERCENT`, `createOrder`
      (real atomic checkout, real 2/3-way payout split), `getOrder`,
      `requestFulfillment` (real, injected VOID call).
- [x] Wire `server.js`: 8 endpoints (`/chopz-shop/products`,
      `/chopz-shop/affiliate/links(+/click)`, `/chopz-shop/orders(+/request-fulfillment)`),
      real injected `transferVCoin` and `requestVoidCourierJob`.
- [x] Split CHOPZ SHOP out of the original single `chopz/` project into
      its own standalone app (own `package.json`, own port 8801, own
      store) per explicit instruction — same real relationship as
      TikTok to TikTok Shop. `chopz/`'s own `lib/videos.js` updated to
      no longer locally validate `linkedProductId` against a product
      list it no longer owns.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 33 checks total, including CHOPZ's own 4 video checks):
      - Product/AffiliateLink/Order field validation and rejection
        cases (negative price, out-of-range commission percent,
        affiliate link for an unknown or mismatched product).
      - The real 2-way payout (no affiliate) proven to sum exactly to
        price via a fake ledger; the real 3-way payout (with a valid
        affiliate link) proven to sum exactly to price.
      - Insufficient buyer funds proven to throw AND leave no order
        record behind (the buyer charge happens before the order is
        pushed to the store).
      - `requestFulfillment` proven to call the injected
        `voidRequestFn` with the real sellerId/shippingCost, set a
        real `voidShipmentId` from the returned job id, and reject a
        second call on an already-fulfilled order.
- [x] Verify live with `chopz-shop/server.js`, `chopz/server.js`, VOID,
      and the V3 mock backend all running independently:
      - A real product created via CHOPZ SHOP.
      - A real CHOPZ video created linking to that product (across the
        two now-separate apps).
      - A real affiliate link generated for the product.
      - A real order placed through that link: buyer charged exactly
        80, seller +62.4, affiliate +12, platform +5.6 (all confirmed
        via the V3 mock's own `/api/vcoin/balance/:userId` endpoint),
        escrow returned to exactly its starting balance.
      - The affiliate link's `conversionsCount` confirmed incremented
        via a real GET after the order.
      - A real VOID courier job requested and confirmed via VOID's own
        `/api/job/:id` endpoint (verticalId `courier`, customerId the
        real seller, unitPrice the real quoted shipping cost) — not a
        stubbed response.
- [x] Shut down all four servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Cart/multi-item checkout, category-based `feePercent`, live shopping,
click-through attribution windows, and a live cross-app validation
call for `ChopzVideo.linkedProductId` against this app.
