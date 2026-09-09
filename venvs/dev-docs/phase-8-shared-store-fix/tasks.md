# Tasks — Phase 8: Fix the shared-store gap

- [x] `App.jsx`: add `SEED_CATALOG`/`SEED_DEGVCHI` helpers; own
      `catalog` and `degvchiStore` via `useState`, seeded once.
- [x] `PublishingView.jsx`: take `catalog` as a prop; drop its own
      `useMemo`-based store creation.
- [x] `DegvchiView.jsx`: take `store` as a prop; drop its own
      `useMemo`-based store creation; `handleEquip` now also triggers
      the shared re-render callback (needed for the second bug below).
- [x] `WorldView.jsx`: accept `catalog`/`degvchiStore` props, forward
      them unchanged to the nested `PublishingView`/`DegvchiView`
      instances; corrected the header comment, which previously
      overclaimed "same instances" when only the component code was
      shared, not the data.
- [x] Verify the fix live (Playwright + this environment's Chromium,
      temporary scratchpad install): buy + equip the sponsored
      cosmetics item in the standalone DEGVCHI view, walk to and enter
      the Fashion District building, confirm the nested view.
      **Initial result: still failed** — nested view showed "Buy," not
      "Equipped." Not assumed away; investigated directly.
- [x] Found the real root cause via direct debug logging (temporarily
      added `console.log` calls to `handleEquip` and captured
      `equipWearable`'s return value): the store mutation was
      genuinely correct (`cosmetics: Object` present in the returned
      outfit), but the DOM never updated. Traced to React's `setState`
      bail-out: refreshing VCoin/VASH after an equip action (which
      doesn't change either balance) produces identical values, so
      React skips the re-render entirely — the mutation was real, the
      render just never happened.
- [x] Fixed with a dedicated `tick` counter in `App.jsx`
      (`setTick((t) => t + 1)`, guaranteed to always differ from its
      previous value) via a new `notifyStateChange` callback, wired to
      all 5 views in place of the direct `refreshBalances` call.
      Removed the temporary debug logging once confirmed working.
- [x] Re-verified the same narrow check clean: nested view now
      correctly shows "Equipped," outfit line matches the standalone
      view exactly.
- [x] Re-ran the full 14-check Phase 7 regression sequence end-to-end:
      all passed, including the new shared-outfit assertion, with the
      same correct final ledger balance (729.51) as Phase 7's original
      run — confirms neither fix disturbed any money-handling
      correctness.
- [x] Shut down both dev processes cleanly (multiple restarts across
      this debugging session for clean baselines); confirmed via
      follow-up `curl` each time that neither port accepted
      connections after shutdown.
- [x] Commit as its own change.

## Next
`MarketplaceView`/`ChopzView` weren't touched (no world-nested
counterpart exists for either). If CHOPZ is ever placed in the world's
district grid (flagged as a gap since Phase 6), it would need the same
lift-the-store treatment applied here.
