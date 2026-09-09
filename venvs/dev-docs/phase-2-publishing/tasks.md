# Tasks — Phase 2: Publishing arm

- [x] Create `src/lib/royalties.js`: `calculateEbookRoyalty`,
      `calculatePrintRoyalty`, `calculateSubscriptionFundRate`,
      `calculateSubscriptionPayout`, `calculateAudiobookRoyalty`.
- [x] Create `src/lib/catalog.js`: `createCatalog`, `publishBook`,
      `getBook`, `getCatalog`, `purchaseBook`, `FORMATS`, `SOURCES`,
      `PLATFORM_USER_ID`.
- [x] Verify pure logic in plain Node (throwaway script, deleted
      after — 29 checks):
      - Ebook: negative price/fee throw; in-band royalty (5.99, 0.15
        fee → 4.04) and out-of-band royalty (15.99 → 5.60) both
        hand-checked; fee-exceeds-cut clamps to 0.
      - Print: negative printingCost throws; 24.99/7.25 → 7.74,
        `belowCost: false`; 5.00/7.25 → clamps to 0,
        `belowCost: true`.
      - Subscription fund: 50000/11,000,000 → 0.00455,
        `typicalRange: true`; 50000/100,000,000 → 0.0005,
        `typicalRange: false` (flagged, not thrown); zero fund throws.
      - Subscription payout: 300 pages at 0.0045/page → 1.35.
      - Audiobook: missing `narrationType` throws; `narrationType:
        'narrator'` without an explicit rate throws (confirms no
        invented default); AI narration on 19.99 → flat 40% → 8.00;
        narrator narration with an explicit 0.25 rate → 5.00.
      - `publishBook`: missing `authorId` throws; invalid `format`
        throws; `print` format missing `printingCost` throws;
        self-published ebook gets a real computed royalty; Ingram
        book gets `royalty: null`.
      - `getBook` / `getCatalog` (by format, by source) all correct.
      - `purchaseBook` against a mocked ledger: correct
        `pricePaid`/`royaltyPaid`; buyer charged the full list price;
        platform's net change equals list price minus royalty; author
        receives exactly the royalty; exactly 2 transfer calls in the
        right order for a self-published purchase, exactly 1 for an
        Ingram purchase (no royalty leg); bad `bookId` and missing
        `transferFn` both throw.
- [x] Create `src/components/PublishingView.jsx`: seeded 2-book
      catalog, real "Buy" wired to `v3Client.transferVCoin`, purchase
      confirmation display.
- [x] Wire `App.jsx` to render `PublishingView` when signed in.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install, not part of the repo):
      - Publishing section renders with both books, correct royalty %
        shown for the self-published title, "Ingram catalog" shown
        (no royalty %) for the Ingram title.
      - Buying the self-published book: confirmation text shows the
        exact price (5.99) and royalty (4.04); buyer's displayed
        VCoin balance drops by exactly 5.99.
      - Buying the Ingram book: confirmation correctly shows no
        royalty; buyer's balance drops by exactly 8.99.
      - **Independently verified via a direct `fetch` to the mock
        backend** (not just trusting the UI): `author-1`'s real ledger
        balance is exactly `1000 + 4.04 = 1004.04`;
        `ingram-catalog`'s balance is untouched at `1000`.
      - No unexpected console/page errors (same harmless favicon 404
        as Phase 1).
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections.
- [x] Commit as its own change.

## Next
No print-on-demand/VOID fulfillment connection, no Ingram API
integration, no subscription-pool UI, no full Publishing tab (search,
skill tags, cover art) — all believable next steps, not built here.
The Shopify integration doc (branded storefronts, app ecosystem,
abandoned cart recovery, HVNTZ POS) is the other concretely-specified
feature doc still untouched.
