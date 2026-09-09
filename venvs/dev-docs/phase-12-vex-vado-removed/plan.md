# Plan — Phase 12: VEX/VADO removed

See `../vdp/dev-docs/phase-7-vex-vado-repointed-to-voken/plan.md` for
the full investigation and design record (this was one combined piece
of work spanning `venvs`, `voken`, and `vdp`). This file covers only
what changed in this project specifically.

## Goal
Remove VENVS's own `vex.js`/`vado.js` — confirmed via git history to
be a real, independent build (Aug 11), never actually the same feature
as VOKEN's own, separately-real VEX/VADO (Aug 13) despite sharing
names. Per direct instruction, VOKEN is now the single canonical home
for both; keeping a second, real, working implementation here would
just perpetuate the collision.

## Design
Deleted outright, not deprecated in place: `src/lib/vex.js`,
`src/lib/vado.js`, `src/components/VexView.jsx`, `src/components/VadoView.jsx`.
`App.jsx`: removed both imports, both seed functions (`SEED_VEX`/
`SEED_VADO`), both tab entries, both render branches. This drops
CLAUDE.md §1/§4's original 5-tab analog mode to 3 tabs — a real,
flagged deviation from the original spec, documented directly in this
project's own header and README rather than silently reconciled, the
same kind of later-instruction-overrides-earlier-spec precedent
VXLLAGE's own Village District already established.

## Verification approach
`npm run build` confirmed clean (40 modules, down from 41). A live
Playwright pass confirmed the tab bar shows exactly 3 tabs (Shop,
Marketplace, Publishing) with VEX and VADO genuinely absent, not
merely hidden by CSS.

## Done when
VENVS has zero VEX/VADO code left, and the remaining 3-tab app still
works end to end.
