# Phase 14 — Beat Marketplace district — tasks

- [x] `src/lib/beatMarketplaceClient.js` — thin real client
      (`listBeats`, `listBeat`, `purchaseBeat`, `listMyPurchases`),
      reusing `VITE_VULTURE_MUSIC_API_URL`.
- [x] `src/components/BeatMarketplaceView.jsx` — real listing form,
      real browse list with `<audio>` preview, real purchase flow,
      real license-delivery rendering, real "your licenses" list.
- [x] `src/lib/world.js` — `WORLD_HEIGHT` grown 1700 → 1980, new
      `beat-marketplace` district entry (7th row, `x:20, y:1700`).
- [x] `src/components/WorldView.jsx` — import, `DISTRICT_COLORS`,
      header comment, render switch for `beat-marketplace-embed`.
- [x] `vite build` — clean, 78 modules, no errors.
- [x] Live Playwright verification against real running vulture-music
      (8806), v3 (8811), shield (8812), and vdp dev server (5174):
      - Walked to the district's exact computed position (down 97,
        left 18 from spawn), confirmed the honest empty state.
      - Listed a real beat as the session user via the real form,
        confirmed it rendered and was correctly marked "your listing"
        (non-buyable by its own lister).
      - Listed a second real beat under a distinct real producer
        directly against the API, confirmed its real `<audio>`
        preview rendered, clicked the real "Buy" button, and confirmed
        the real license-delivery message rendered with the correct
        beat title, license type, and price.
      - Confirmed directly against V3 that the real balance moved
        (985 buyer / 1015 producer on a real 15 VCoin beat) as a
        direct result of the browser click.
      - Regression: VEX still enterable, unaffected.
- [x] Test/runtime artifacts cleaned up (all involved apps' `data/`
      dirs, `vdp/dist`, logs).
- [x] README.md — new district documented in Run instructions context
      (already covered — no new backend to add) and Verified section.
- [x] plan.md / tasks.md (this file).

## Next
- No further VDP work identified for this district. It covers the
  full real loop it was built for.
