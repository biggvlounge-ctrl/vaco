# Tasks — Phase 9: Shop, VEX, VADO

- [x] Create `src/lib/shop.js`: `createShop`, `listProduct`,
      `getProduct`, `browseProducts`, `buyNow`.
- [x] Create `src/lib/vex.js`: `createVex`, `listAsset`, `getAsset`,
      `browseAssets`, `adjustPrice`, `getHoldings`,
      `getPortfolioValue`, `buyShares`, `sellShares`.
- [x] Create `src/lib/vado.js`: `createVado`, `listArtwork`,
      `getListing`, `getActiveListings`, `placeBid`, `closeAuction`,
      `PLATFORM_STATUS`.
- [x] Verify pure logic in plain Node (throwaway script, deleted after
      — 27 checks; caught and fixed 2 un-awaited async `closeAuction()`
      calls, the 8th test-script bug this session):
      - Shop: validation, exact price charged, full amount to platform.
      - VEX: `adjustPrice` correct math at +10%/-50%, clamps at 0.01
        under -100%; buy/sell exact cost/proceeds; portfolio value
        correct both at purchase-time price and after a live price
        change; overselling rejected.
      - VADO: validation; first bid at exactly the starting price
        accepted; an equal bid rejected (must strictly exceed); a
        higher bid replaces the leader; cannot close before the end,
        cannot bid after the end, cannot close twice; a real winning
        close pays the artist the exact final price; an unsold auction
        (no bids) closes with zero money movement.
- [x] Create `src/components/ShopView.jsx`, `VexView.jsx`,
      `VadoView.jsx`.
- [x] `world.js`: flip `vex`/`vado` districts' `hasAnalogView` to
      `true`.
- [x] `WorldView.jsx`: accept `vex`/`vado` props, render
      `VexView`/`VadoView` on entering those districts.
- [x] `App.jsx`: own `shop`/`vex`/`vado` (seeded once), pass to all
      standalone views and to `WorldView`.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install):
      - Shop purchase: exact price charged, confirmation correct.
      - VEX: buy 1 share (exact cost), holding and portfolio value
        shown correctly; sell 1 share back (exact proceeds), portfolio
        returns to 0.
      - VADO: bid placed and reflected; **found a real app bug here**
        — the "Close auction" button never appeared because the ended-
        but-not-yet-closed listing had silently dropped out of the
        render list entirely (see plan.md for the exact cause). Fixed
        by rendering all listings unconditionally. Re-verified: waited
        a genuine ~5.5 real seconds for the demo auction to end,
        closed it through an actual click, confirmed the exact VCoin
        deduction and — independently, via direct `fetch` to the mock
        backend — that `artist-1`'s real ledger balance reflects the
        exact proceeds (1000 + 50 = 1050).
      - Walked into the VEX district in the world (caught and fixed a
        9th test-script bug here: wrong arrow-key direction) and
        confirmed the nested `VexView` shows the identical portfolio
        state as the standalone one, with no separate-store bug this
        time.
      - No unexpected console/page errors (same harmless favicon 404
        as every prior phase).
- [x] Shut down both dev processes cleanly across all restarts;
      confirmed via follow-up `curl` each time that neither port
      accepted connections.
- [x] Commit as its own change.

## Next
This completes `CLAUDE.md`'s named 5-tab analog mode. Remaining
feature-list items (Digital Twin Levels, DREAMS billboards,
Residential Towers, Jobs/Careers, Daily Quests/HVNTZ Hunt, Skills,
Population tiers, living NPCs, My Assets dashboard, Live World News)
are all still unbuilt — see the project-level closing status note for
the full picture.
