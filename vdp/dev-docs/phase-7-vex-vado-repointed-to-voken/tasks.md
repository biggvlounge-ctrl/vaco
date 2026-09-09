# Tasks — Phase 7: VEX/VADO repointed to VOKEN

- [x] Investigate: `git log --diff-filter=A` on both VENVS's and
      VOKEN's own `vex.js`/`vado.js` to establish real chronology;
      grepped both codebases for cross-references (found none);
      confirmed VADO's own `auctions.js` carries no compliance gate,
      unlike VEX's `vex-brokerage` gate.
- [x] `voken/lib/auctions.js` — added `listOpenAuctions`, the real,
      minimal missing piece VDP's own VADO district needed.
      `voken/server.js` — wired `GET /api/auctions/open`.
- [x] `vdp/src/lib/vokenClient.js` — real, thin HTTP client (compliance
      gate status, card listing, broker account open, VEX order,
      open-auctions list, Dutch price, bid).
- [x] `vdp/src/lib/vexMarket.js` — `getVexMarketState`,
      `ensureBrokerAccount`, `buyCardEdition`.
- [x] `vdp/src/lib/vadoMarket.js` — `getVadoMarketState`,
      `getDutchPrice`, `bidOnAuction`.
- [x] `vdp/src/components/VexView.jsx` / `VadoView.jsx` — real UI,
      honest gate-state display, all four VADO auction types
      supported.
- [x] `vdp/src/lib/world.js` — new `voken-embed` contentType
      (documented in the header), `vex`/`vado` districts repointed.
- [x] `vdp/src/components/WorldView.jsx` — import both new views, new
      render branches, header comment updated.
- [x] `venvs/src/App.jsx` — removed `vex.js`/`vado.js` imports, seed
      data, tab entries, and render branches. Header comment updated.
- [x] Deleted `venvs/src/lib/vex.js`, `vado.js`,
      `venvs/src/components/VexView.jsx`, `VadoView.jsx`.
- [x] `npm run build` — confirmed clean on both `venvs` (40 modules,
      down from 41) and `vdp` (55 modules) after every edit.
- [x] Plain-Node check for `listOpenAuctions` (4 checks) — all passing.
- [x] Live pass against `venvs-mock-backend` + `voken` + `vdp`: real
      vehicle + art Cvltvre Cards minted, a real english auction
      created; walked to VADO, confirmed real auction rendered, placed
      a real bid, independently re-confirmed server-side; walked to
      VEX, confirmed the real "Trading is locked" state, browsable
      card, opened a real broker account, confirmed Buy disabled,
      independently re-confirmed the account server-side.
- [x] Separate live pass confirmed VENVS's own tab bar now shows
      exactly 3 tabs, VEX/VADO genuinely gone.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `vdp/README.md`, `venvs/README.md`, `voken/README.md`.
- [x] Write this plan/tasks pair (and matching pairs in `venvs/` and
      `voken/`).

## Next
No VDP-side seller UI for reviewing/accepting VADO offers. VEX limited
to the vehicles category inside VDP (VOKEN itself supports more).
