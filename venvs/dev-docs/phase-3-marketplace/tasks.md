# Tasks — Phase 3: Marketplace

- [x] Create `src/lib/marketplace.js`: `createMarketplace`,
      `registerSeller`, `getSeller`, `listProduct`, `getProduct`,
      `browseProducts`, `getSellerStorefront`, `createCart`, `getCart`,
      `addToCart`, `checkout`, `checkAbandonedCarts`,
      `generateRecoveryOffer`, `PLATFORM_USER_ID`.
- [x] Verify pure logic in plain Node (throwaway script, deleted
      after — 30 checks; caught and fixed one bug in the script itself,
      an un-awaited async `checkout()` call inside a sync `try`):
      - `registerSeller` rejects missing `ownerId`; two sellers get
        real, distinct `theme` objects.
      - `listProduct` rejects a bad `sellerId` and a non-positive
        price.
      - `browseProducts` sees all 3 products across both sellers;
        category filter works.
      - `getSellerStorefront` isolates exactly one seller's products
        and theme; rejects a bad `sellerId`.
      - `createCart` rejects missing `buyerId`; `addToCart` rejects a
        bad cart/product id and accumulates quantity on a repeat add
        instead of duplicating the line.
      - `checkout`: correct total (77.50) across a 2-seller, 2-product
        cart with a repeated line; buyer charged exactly the total;
        each seller paid exactly their own line total (55.50 /
        22.00); platform nets to zero; exactly 3 transfer calls in
        the right order; cart marked `completed`; rejects a second
        checkout, adding to a completed cart, and an empty-cart
        checkout.
      - `checkAbandonedCarts`: flags exactly a 45-minutes-stale
        non-empty cart, not a fresh one; a second pass finds nothing
        new; an empty cart is never flagged regardless of age.
      - `generateRecoveryOffer`: correct discount math off the real
        cart total (34.00 → 5.10 off → 28.90 at 15%); rejects a
        non-abandoned cart and a bad `cartId`.
- [x] Create `src/components/MarketplaceView.jsx`: 2 branded
      storefronts, unified browse, real cart/checkout wired to
      `v3Client.transferVCoin`, a backdated demo cart + abandonment
      check button.
- [x] Wire `App.jsx` to render `MarketplaceView` alongside
      `PublishingView`.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install):
      - Both storefronts render with their real theme banners/colors;
        all 3 products visible in the unified browse.
      - Adding 2 products from 2 different sellers and checking out:
        order confirmation shows the correct total (40.50) and correct
        2-way split (18.5 + 22); buyer's displayed VCoin balance drops
        by exactly 40.50.
      - **Independently verified via direct `fetch` calls to the mock
        backend** (not the UI): both `seller-hardware` and
        `seller-vinyl` show their exact correct payout on the real
        ledger.
      - Clicking "Check for abandoned carts" correctly flags the
        backdated cart and displays a recovery offer matching the real
        cart total (15% off $34.00 → $28.90).
      - No unexpected console/page errors (same harmless favicon 404
        as prior phases).
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections.
- [x] Commit as its own change.

## Next
VENVM app ecosystem and HVNTZ POS integration are explicitly not
built — neither system exists in this session. A scheduled/background
abandonment sweep (instead of on-demand), seller onboarding, and
inventory management are believable next steps for Marketplace
specifically, also not built here.
