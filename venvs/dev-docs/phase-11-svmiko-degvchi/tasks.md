# Tasks — Phase 11: SVMIKO DEGVCHI Fashion House

- [x] Create `lib/svmikoDegvchi.js`: `SVMIKO_DEGVCHI_HOUSE`,
      `MONOGRAM`, `GATEWAY_SYMBOL_MEANING`, `SUB_BRANDS` (13 real
      brands), `ownerIdFor`, `seedSvmikoDegvchiStorefronts`.
- [x] Wire `MarketplaceView.jsx`: seed all 13 real storefronts after
      the existing 2 demo sellers (additive, preserves the
      abandoned-cart demo's `products[1]` index reference); improved
      the seller-list render to show the real monogram and fall back
      to `positioning` text when no `banner` exists.
- [x] Verify pure logic in plain Node (`.mjs` script, deleted after —
      20 checks): 13 unique, real brands with real positioning and a
      real flagship product each; seeding registers exactly 13 real
      sellers/products; DEGVCHI's own seller/theme/product checked
      field-by-field; the real luxury-vs-streetwear price-tier
      separation proven directly; per-seller independent
      retrievability and distinct ids; `browseProducts` surfaces all
      13.
- [x] Confirm `npm run build` still succeeds (zero errors).
- [x] Verify live in a real browser (Playwright, this environment's
      pre-installed Chromium): logged in, switched to Marketplace, all
      13 real storefronts confirmed rendered, the SD monogram
      confirmed rendering next to DEGVCHI's name, a real complete
      purchase of the DEGVCHI flagship coat confirmed end to end
      (Order total exactly 640 VCoin), zero console/page errors.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Bugs fixed during verification (test script, not the app)
Two real Playwright test-script bugs caught and fixed mid-verification:
(1) `page.click('text=Marketplace')` accidentally matched the tab's
own descriptive prose ("Analog commerce — Shop, Marketplace,
Publishing...") instead of the tab button, so the click landed on
non-interactive text and did nothing — fixed by scoping to
`button:has-text("Marketplace")`. (2) The "add DEGVCHI to cart" click
used an xpath one level too high (`../..` instead of `..`), which
escaped the product row entirely and grabbed the *first* "Add to
cart" button on the whole page (Claw Hammer, $18.50) instead of
DEGVCHI's own row — confirmed by the resulting order total being
$18.50, not $640; fixed by correcting the xpath depth, re-verified
against the real $640 order total.

## Next
Real product visuals for the SD monogram / DEGVCHI Gateway Symbol.
Fuller per-brand catalogs beyond one flagship piece. A possible,
separate, later decision on whether any SVMIKO DEGVCHI pieces also get
a virtual/avatar-wearable version through VDP's own `degvchi.js` —
not confirmed as in-scope by the source brief's own integration point,
not built here.
