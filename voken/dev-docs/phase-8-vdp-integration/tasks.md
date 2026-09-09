# Tasks — Phase 8: VDP integration (VEX/VADO made canonical)

- [x] Investigate: confirmed `/api/vado/explore` is a different real
      feature (engagement-ranked art cards) than "list open auctions,"
      by reading `vadoExplore.js` directly.
- [x] `lib/auctions.js` — added `listOpenAuctions`.
- [x] `server.js` — wired `GET /api/auctions/open`.
- [x] 4 plain-Node checks — all passing.
- [x] Live-verified as part of VDP's own cross-app Playwright pass
      (real auction created here, browsed and bid on live from VDP's
      VADO district, independently re-confirmed server-side on this
      project's own API) — see `../vdp/dev-docs/phase-7-vex-vado-repointed-to-voken/`
      for the full record.
- [x] Update `README.md` (intro cross-reference, `lib/auctions.js`
      bullet, Verified section).
- [x] Write this plan/tasks pair.

## Next
None for this project specifically.
