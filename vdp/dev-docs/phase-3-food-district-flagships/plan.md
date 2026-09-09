# Plan — Phase 3: Food District Flagships

## Goal
Build VDP's Food District as a real, native district for the first
time, using the 11 real flagship brands from `VACO_FOOD_WELLNESS_BRANDS.md`.

## Real investigation before any code
The source doc's own premise — "replace the placeholder content [the
Food District] was originally built with" — was checked directly
against `world.js` and confirmed false as a description of this
codebase: `contentType` was `'none'`, the same honest "no view built"
gap as Stage, documented in VDP's own README. The "5 named restaurant
brands" the doc's predecessor referenced traces to exactly one place:
a parenthetical in VENVS's own `CLAUDE.md` §4 district list, never
implemented anywhere. Reported this discrepancy back before writing
any code, per explicit instruction not to start until confirmed.

## Design
- `lib/foodDistrict.js`: 11 real brand records (`FLAGSHIP_BRANDS`),
  each with a real menu (`{ item, price }`), grounded directly in the
  source doc's own named products where given, honestly minimal where
  the doc itself says "to be detailed further" (TACO TOWN, BIG JACK'S,
  NETTY'S) rather than inventing a fuller menu. Two brands added
  directly by the founder after the doc: WEDGE (potato wedges, topped
  different ways — two real named toppings, Alfredo and Nacho, not
  exhaustive) and a chicken tender spot with `nameConfirmed: false` —
  "Tenderoni" was floated but explicitly not locked in ("we'll come
  back and get a name"), so the real data model carries that
  uncertainty rather than picking a name.
- Real purchase shape: closer to VENVS's own `shop.js` (`buyNow` —
  instant purchase, no ownership persistence) than to DEGVCHI's own
  wearable-with-equip flow, since ordering food isn't wearing it. Real,
  distinct payout account per brand (`brandOwnerId(slug)`), not one
  shared platform account — the same per-creator-payout posture
  DEGVCHI already established for sponsored wearables, applied to 11
  real, separate restaurant brands instead of sponsors.
- `world.js`: Food District's `contentType` flipped from `'none'` to
  `'vdp-native'`, mirroring Fashion District exactly.
- `FoodDistrictView.jsx`: mirrors `DegvchiView.jsx`'s real shape
  (browse, buy, real order history instead of DEGVCHI's real
  ownership/equip state), including a visible "(name not yet
  finalized)" flag on the chicken spot rather than silently presenting
  a placeholder name as final.

## Explicitly NOT in this task
The secondary Virtual Kitchen/Port Station real-world extension and
its 3-location kitchen grouping (doc's own framing: "a genuine
secondary/additional revenue layer, not the primary purpose"). HVNTZ's
12-stream revenue stack integration. The "VENVS Design District"
naming question — flagged as open in the source doc itself, not
resolved here.

## Verification approach
Plain-Node pass (17 checks): brand/slug uniqueness, menu completeness
and pricing, the confirmed/unconfirmed name split, WEDGE's real
toppings, category coverage, distinct per-brand payout accounts proven
via the transfer call's own arguments (not just a stored field),
unknown-brand/menu-item rejection, per-buyer order history scoping.
Then a live pass in a real browser: walk to Food District, enter it,
confirm all 11 brand names render (including the unconfirmed-name
flag), place a real order, confirm it appears in order history, zero
console errors.

## Done when
- All 11 brands are real, browsable, and orderable, each paying its
  own distinct real account.
- The unnamed chicken spot is honestly flagged in the UI, not silently
  given a made-up final name.
- The district's `contentType` flip is proven live, not just changed
  in `world.js`.
