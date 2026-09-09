# Tasks — Phase 2: SVMIKO DEGVCHI Avatar Wearables

- [x] Create `lib/svmikoDegvchiWearables.js`: `SVMIKO_DEGVCHI_HOUSE`,
      `SUB_BRAND_WEARABLES` (13 real virtual pieces), `creatorIdFor`,
      `seedSvmikoDegvchiWearables`.
- [x] Wire `App.jsx`: seed the 13 real wearables after the original 3
      demo fixtures (additive).
- [x] Verify pure logic in plain Node (`.mjs` script, deleted after —
      20 checks): unique real pieces with real categories/prices;
      seeding registers exactly 13; DEGVCHI's own piece checked field-
      by-field; category assignment for Devil in Details/VAISON/ANCÓR
      confirmed real `accessories`; category distribution (3/10/0)
      confirmed; the real luxury-vs-streetwear tier proven at VDP's
      own real, independently-reasoned price scale; a real purchase
      and equip flow proven correct.
- [x] Confirm `npm run build` still succeeds (zero errors), both
      before and after the regression fix below.
- [x] Verify live in a real browser (Playwright): walked to the real
      Fashion District building (position-readout-driven navigation),
      entered it, all 13 real virtual pieces confirmed rendered.
- [x] **Real bug found live**: bought the DEGVCHI virtual coat, equipped
      it, "My outfit" stayed `clothing=none` — confirmed a genuine app
      regression (not a test artifact) by inspecting the actual row
      HTML before/after buy (button correctly flips Buy → Equip, so
      the purchase itself was fine) and tracing it to `App.jsx`'s own
      `notifyStateChange` missing the real `tick`-counter fix VENVS
      had already made once before (Phase 8) for this exact class of
      bug. Fixed by restoring the `tick` counter in both
      `vdp/src/App.jsx` and `venvs/src/App.jsx` (which had the
      identical regression, introduced when its own App.jsx was
      rewritten for the tab switcher). Audited every other
      `onPurchase()` call site in both apps afterward and confirmed
      this was the only one actually affected (every other site is a
      real money-moving action).
- [x] Re-verified live after the fix: equip now correctly, immediately
      shows `clothing=DEGVCHI Virtual Kimono-Sleeve Coat` in "My
      outfit," zero console/page errors.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change (alongside the VENVS-side App.jsx fix).

## Next
Real visual assets for any of the 13 virtual pieces. A possible,
separate, later decision on whether the SD monogram / DEGVCHI Gateway
Symbol get real rendered treatments once real asset tooling exists.
