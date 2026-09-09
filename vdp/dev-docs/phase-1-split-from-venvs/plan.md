# Plan — Phase 1: Split from VENVS (pointer)

VDP was split out of VENVS's own repo into this real, separate
project, per explicit instruction: VENVS is the real, analog/physical
commerce layer; VDP is the real, digital/virtual layer (land
ownership, avatar economy, the walkable world). The full plan, task
list, and verification record for that split live in
`../../venvs/dev-docs/phase-10-split-into-vdp/`, not duplicated here.

What this project actually is, going forward: `world.js` (the walkable
world), `chopz.js` (CHOPZ District), `degvchi.js` (the avatar-wearable
economy), and their view components -- moved here via `git mv` from
VENVS, plus real, separate copies of the thin V3/Shield client
wrappers. See this project's own `README.md` for what's here and what
was verified live.
