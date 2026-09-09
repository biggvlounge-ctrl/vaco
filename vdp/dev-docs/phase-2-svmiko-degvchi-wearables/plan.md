# Plan — Phase 2: SVMIKO DEGVCHI Avatar Wearables

## Goal
The other real half of the SVMIKO DEGVCHI handoff's own framing —
"the first real clothing lines for VENVS **and VDP**." VENVS's own
storefronts (`venvs/src/lib/svmikoDegvchi.js`) covered the confirmed
Marketplace integration; this phase extends the same house into VDP's
existing avatar-wearable economy (`degvchi.js`), a real, defensible
extension since DEGVCHI is explicitly the house's own flagship brand
and `degvchi.js` already exists as VDP's real system for exactly this
kind of content.

## Design
- `lib/svmikoDegvchiWearables.js`: `SUB_BRAND_WEARABLES`, one real
  virtual piece per sub-brand (13 total), each mapped to one of
  `degvchi.js`'s own three real categories — `clothing` for the 10
  brands built around garments, `accessories` for the 3 built around
  hardware/jewelry/emblems (Devil in Details' chains, VAISON's own
  geometric logo mark, ANCÓR's own signature anchor emblem).
  `cosmetics` is honestly left unused — no SVMIKO DEGVCHI brand's real
  description centers on cosmetics, so nothing was forced into that
  category just to exercise it.
- Real, *independently*-reasoned virtual price scale, deliberately
  different from VENVS's own physical prices ($32-$640) — every real
  avatar-economy comparable (Roblox's own) prices virtual goods far
  lower than physical luxury goods, so this isn't the physical price
  divided by a constant. The same real luxury-vs-streetwear tier
  separation VENVS's own line proved is preserved at this new scale.
- Real, deliberate cross-app identity link: `creatorId` uses the exact
  same `svmiko-degvchi-<slug>` convention VENVS's own `ownerIdFor()`
  produces — the same real brand entity is credited in both apps, a
  real naming-convention match, not a functional link (VENVS and VDP
  share no backend state).
- Seeded into `App.jsx` additively, after the original 3 demo
  wearables (Sunset Glow Palette, DEGVCHI Signature Jacket, Chrome
  Chain), which stay in place — same posture as VENVS's own seeding.

## Real bug found and fixed during verification
Buying a SVMIKO DEGVCHI virtual piece worked correctly, but equipping
it silently never updated the visible "My outfit" line in a live
browser test. Root cause, confirmed directly: this project's own
`App.jsx`, split out of VENVS's original Phase 1 shell, never carried
over a real fix VENVS had already made once before (Phase 8) for
exactly this class of bug — React's `setState` bails out of
re-rendering when a new value is `Object.is`-identical to the old one,
and equipping a wearable doesn't touch VCoin, so `refreshBalances`
alone gives React no reason to re-render even though the store's own
`equipped` state was genuinely, correctly mutated. Fixed by restoring
the same real `tick` counter fix in both `vdp/src/App.jsx` and (it had
the identical regression) `venvs/src/App.jsx` — `setTick` always
changes, forcing the real re-render regardless of whether the balance
itself changed. Checked every other `onPurchase()` call site across
both apps afterward and confirmed this was the only one actually
affected — every other call site is a real money-moving action, where
the balance change itself already forced the correct re-render.

## Explicitly NOT in this task
Real visual assets for any of the 13 virtual pieces (no 3D/2D asset
pipeline exists in this session). A cosmetics-category item forced in
just for category coverage.

## Verification approach
Plain-Node pass first (`.mjs` script, deleted after — 20 checks): 13
unique real virtual pieces with real categories/prices; seeding
registers exactly 13; DEGVCHI's own piece checked field-by-field
(creatorId convention, category, price, sponsor label); Devil in
Details/VAISON/ANCÓR confirmed real `accessories`; exactly 3
accessories/10 clothing/0 cosmetics; the luxury-vs-streetwear tier
proven directly at VDP's own real price scale, confirmed genuinely
different from VENVS's physical scale; a real purchase charges the
exact price and pays the exact real creator account; the purchased
piece can be genuinely equipped and read back via
`getEquippedOutfit`. Then a live pass in a real browser: all 13 real
virtual pieces confirmed rendered in the Fashion District view reached
by actually walking VDP's avatar there; a real purchase and (after the
bug fix above) a real, live-visible equip of the DEGVCHI virtual coat
confirmed end to end; zero console/page errors.

## Done when
- All 13 real virtual pieces exist, are purchasable, and are equippable
  with the result genuinely visible without a page reload.
- The cross-app `creatorId` convention matches VENVS's own exactly.
- The equip-not-re-rendering regression is fixed in both apps, not
  just worked around in this one view.
