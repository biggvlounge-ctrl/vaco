# Plan — Phase 4: DEGVCHI avatar-wearable economy

## Goal
`VENVS_DIGITAL_PLANET_COMPARABLES.md`'s direct, buildable
recommendation: "DEGVCHI's fashion district should be built around
this exact mechanic: real or DEGVCHI-original branded avatar
wearables, sold for VCoin, with the same category structure Roblox
validated (clothing, makeup/cosmetics, accessories) — not invented
from scratch." Per `venvs/CLAUDE.md` §4, DEGVCHI is a district inside
VENVS's Fashion District, not standalone.

Of the doc's 3 sections, this is the only one with a concrete,
buildable mechanic. The land-economy section (Decentraland/Sandbox
rental-over-flipping) validates VENVS's Digital Twin ownership ladder
as a direction, but Digital Twin/CHOPZ isn't built yet — nothing new
to write code against. The "real revenue mechanism worth adopting"
section explicitly IS already built: VCoin → VASH cash-out, from
Phase 1 (`cashOutToVash`) — the doc's own point is this doesn't need a
new mechanism, so nothing new was added for it here either.

## Design
- `src/lib/degvchi.js`: `WEARABLE_CATEGORIES = ['clothing',
  'cosmetics', 'accessories']` — the doc's exact category list,
  quoted directly, not reinterpreted.
- `registerWearable` takes a `sponsor` field (a real brand name, e.g.
  "e.l.f. Cosmetics" — the doc's own launch-sponsor example) or `null`
  for a DEGVCHI-original item. Purely descriptive; doesn't change
  payout routing.
- **No revenue-split percentage is specified anywhere in this source
  doc** for a sponsored item, unlike Publishing's precise royalty
  rates. Rather than invent one, `purchaseWearable` sends the full
  sale price to the item's `creatorId` — the same "seller gets their
  full line-item price via platform pass-through" pattern Phase 3's
  Marketplace already established, kept consistent rather than
  inventing a third revenue-split model.
- `equipWearable` / `unequipWearable` / `getEquippedOutfit` — a real
  "one item equipped per category" mechanic: equipping a second
  clothing item replaces the first rather than layering, matching how
  Roblox's own (and every comparable) avatar system actually works.
  This is the one genuinely new mechanic in this phase, not a repeat
  of Publishing/Marketplace's catalog+purchase shape.
- `src/components/DegvchiView.jsx` — real demo UI: 3 seeded items (1
  sponsored, 2 DEGVCHI-original) across all 3 categories, real Buy
  buttons wired to the wallet, Equip buttons, and a live "my outfit"
  display.

## Verification approach
Same two-layer rigor as Phases 1-3. Plain-Node pass first (26 checks).
**Caught a second bug in a test script this session, not the app**:
the mocked ledger's insufficient-balance guard (`ledger[from] <
amount`) silently passed when `ledger['buyer-2']` was `undefined`,
since `undefined < 8` evaluates to `false` in JS — the test's intended
"a buyer with no funds should fail" case actually succeeded, and only
showed up as an unexpected ownership-record count (5 instead of 4) at
the end of the run rather than an explicit assertion failure. Fixed by
explicitly initializing `buyer-2`'s balance to `0` and re-ran clean.
The real `purchaseWearable`/`registerWearable` logic was never at
fault — confirmed by re-running with the same code, only the test's
own ledger fixture changed.

A third bug, also in test tooling: the browser-pass "equip all 3"
loop originally grabbed all 3 `Equip` buttons via `.all()` up front,
then clicked them in sequence — but each click causes React to
re-render that button into an "Equipped" label, so the 3rd stale
locator timed out waiting for a button that no longer existed at that
list position. Fixed by re-querying `.first()` fresh before each
click, same lesson already applied to the "buy all 3" loop earlier in
the same script.

Final live-browser pass confirms: 3 real purchases against the actual
wallet (buyer's balance drops by exactly $45.00 total), a full 3-slot
outfit correctly equipped, and — independently checked directly
against the mock backend's ledger, not the UI — both payout accounts
(`elf-cosmetics-brand`, `degvchi-original`) show their exact correct
accumulated balances.

## Explicitly NOT in this task
- No visual avatar rendering — "equipped" is state only, no character/
  sprite/3D model reflects it. The walkable-world/avatar-rendering
  system doesn't exist in this session.
- No real revenue-split negotiation logic for sponsored items — full
  price to `creatorId`, as above; a real sponsor deal splitting
  revenue between the sponsor and DEGVCHI/VENVS is a real business
  decision not specified anywhere, not invented here.
- No Digital Twin ownership ladder, no CHOPZ, no land-rental economy
  — the other two sections of the source doc, neither has a
  buildable mechanic yet given what else exists in this session.

## Done when
- `registerWearable` validates `name`, `category` (against the exact
  3-item list), `price`, and `creatorId`; stores `sponsor` correctly
  (a real name or `null`).
- `browseWearables` filters correctly by category and by
  `sponsoredOnly`.
- `purchaseWearable` moves the full price to `creatorId` (verified
  against a correctly-initialized mocked ledger, not one with an
  undefined-balance bug), records real ownership, rejects a double
  purchase, a bad `wearableId`, and a buyer without funds (verified
  this actually rejects, not just assumed).
- `equipWearable` correctly replaces same-category items rather than
  layering them, verified directly across a 3-item full outfit;
  rejects equipping an unowned item; `unequipWearable` clears exactly
  the targeted category and rejects an invalid one.
- Live browser pass: 3 real purchases, exact wallet balance change,
  full outfit equip, and both payout accounts independently verified
  against the real ledger.
- Regression: Phases 1-3 (wallet, Publishing, Marketplace) still work
  in the same session.
