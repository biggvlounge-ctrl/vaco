# Plan — Phase 6: VDP + VACON-C split into their own bundle

## Goal
Per direct instruction: VDP and VACON-C are both genuinely gamified
(VDP's avatar economy/districts, VACON-C's civilization-sim/NPC/
mission engine) — a different kind of product than the rest, so they
get their own bundle instead of VACON-C staying folded into
Operations & Infrastructure just to keep it at 3.

## Change
- `vdp` gains a real `parent`/`bundle` for the first time (`'VDP'` /
  `'Gamified & Simulation'`) — it was previously host-only with no
  product identity of its own in this registry.
- `vacon-c`, `vsafe`, `vacon` (VACON-C's folded family) move from
  `Operations & Infrastructure` to the new `Gamified & Simulation`.
- `Operations & Infrastructure` correctly drops to 2 parents (VOID,
  V4) — not padded back to 3, per direct instruction.
- 16 real parents now (VDP added), 6 real bundles (5 of 3 + this one
  of 2).

## Verification
Booted `vaco-shell` live, called `GET /api/bundles`: `Gamified &
Simulation` correctly holds `vdp`, `vsafe`, `vacon-c`, `vacon`;
`Operations & Infrastructure` correctly holds only `void`,
`voidmagic`, `v4-proxy`, `v4-search`. All other bundles unchanged.
