# Tasks — Phase 9: CVLTVRE, the real customer-facing brand

- [x] Investigate: resolve the real scope of CVLTVRE from the user's
      own typed clarification (VOKEN = parent/technical name, CVLTVRE
      = the whole real product, not scoped narrowly); confirm eBay/
      Sotheby's/Christie's/Fanatics were already real, researched
      comparables in this project's own source docs.
- [x] `lib/brand.js` — new file: `BRAND_NAME`, `BRAND_TAGLINE`,
      `POWERED_BY`, `getBrandInfo()`.
- [x] `server.js` — wired `GET /api/brand`, folded `brand` into
      `GET /api/health`.
- [x] 3 plain-Node checks — all passing.
- [x] `vdp/src/lib/vokenClient.js` — added `getBrandInfo()`.
- [x] `vdp/src/lib/vexMarket.js` / `vadoMarket.js` — both now fetch and
      surface the real brand alongside their existing real state.
- [x] `vdp/src/components/VexView.jsx` / `VadoView.jsx` — both render
      "Part of CVLTVRE, powered by VOKEN," live-fetched.
- [x] `npm run build` confirmed clean on `vdp` after every edit.
- [x] Live pass: `GET /api/brand` and `/api/health` confirmed returning
      the real brand object directly from VOKEN's server; VDP's own
      VEX and VADO districts confirmed rendering it live in a real
      browser pass.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (top-level intro, comparable grounding) and
      `../vdp/README.md`'s own matching entry.
- [x] Write this plan/tasks pair.

## Next
None identified.
