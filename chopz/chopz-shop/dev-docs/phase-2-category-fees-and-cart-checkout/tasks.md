# Tasks — Phase 2: real category-based fees + cart checkout

- [x] Investigate: read `CHOPZ_TIKTOK_COMPARABLES.md`'s own real cited
      fee data directly; read the doc's own `Order` schema to confirm
      no `Cart` entity exists, ruling out inventing one.
- [x] `lib/products.js` — added optional `category` field.
- [x] `lib/orders.js` — added `computeFeePercentForCategory`
      (apparel 0.15, general 0.07); `createOrder`'s default `feePercent`
      now derives from the product's real category, explicit caller
      value still wins; added `createCartCheckout`.
- [x] `server.js` — wired `POST /chopz-shop/cart-checkout`.
- [x] 12 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `chopz-shop`: two real
      products (apparel + general), a real 2-item cart checkout,
      independently confirmed against V3's own real balances for both
      sellers (bob 1000→900, seller-a 1000→1037.20, seller-b
      1000→1051), matching the plain-Node math exactly.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
None identified for this specific gap.
