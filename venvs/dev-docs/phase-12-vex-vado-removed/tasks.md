# Tasks — Phase 12: VEX/VADO removed

- [x] Confirm via `git log --diff-filter=A` that this project's own
      `vex.js`/`vado.js` predate VOKEN's by 2 days and were never
      cross-referenced by either codebase.
- [x] `src/App.jsx` — removed `vex.js`/`vado.js` imports, `SEED_VEX`/
      `SEED_VADO`, both `TABS` entries, both render branches. Header
      comment updated to document the real deviation from CLAUDE.md
      §1/§4's original 5-tab spec.
- [x] Deleted `src/lib/vex.js`, `src/lib/vado.js`,
      `src/components/VexView.jsx`, `src/components/VadoView.jsx`.
- [x] `npm run build` — confirmed clean (40 modules).
- [x] Live Playwright pass — confirmed exactly 3 tabs render, VEX/VADO
      genuinely gone from the tab bar.
- [x] Update `README.md` (intro, split note, What's here, Build
      status, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
None for this project specifically — VEX/VADO's real future work now
lives in `../voken/`.
