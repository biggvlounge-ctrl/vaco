# Tasks — Phase 3: Food District Flagships

- [x] Investigate: confirm no placeholder restaurant content actually
      existed in `world.js` before writing any code; report the
      discrepancy against the source doc's own premise.
- [x] `lib/foodDistrict.js` — 11 real brands, real menus,
      `nameConfirmed` flag, `getBrand`/`listBrands`/`brandOwnerId`,
      `createFoodDistrict`, `orderMenuItem`, `getOrderHistory`.
- [x] `world.js` — Food District `contentType`: `'none'` →
      `'vdp-native'`; header comment updated.
- [x] `FoodDistrictView.jsx` — real browse/order UI, visible
      unconfirmed-name flag.
- [x] `WorldView.jsx` — import + render branch for `id === 'food'`.
- [x] `App.jsx` — `foodDistrictStore` created and passed down.
- [x] `npm run build` — clean.
- [x] Verify in plain Node (17 checks): brand/slug uniqueness, menu
      pricing, confirmed/unconfirmed split, WEDGE toppings, category
      coverage, distinct per-brand payout accounts, order
      charge/payout correctness, rejection cases, order history
      scoping.
- [x] Verify live (Playwright): walk to Food District, enter it, all
      11 brands + unconfirmed-name flag rendered, a real order placed
      and confirmed in order history, zero console errors.
- [x] Caught and fixed two real test-script bugs (wrong paragraph
      selector; position regex missing the space after the comma) —
      confirmed as test-authoring issues via direct inspection of the
      real rendered page text, not app bugs.
- [x] Shut down test servers; confirmed via port check.
- [x] Update `README.md` (new lib bullet, Phase 3 Verified entry,
      Not-yet-built list correction); write this plan/tasks pair.

## Next
Real final name for the chicken tender spot. The secondary Virtual
Kitchen/Port Station extension and its kitchen grouping. HVNTZ revenue
stack integration. Resolving the "VENVS Design District" open item.
