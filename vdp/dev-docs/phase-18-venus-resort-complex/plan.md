# Plan — Phase 18: The Venus Resort Complex

## Goal
Promote VDP's casino from a doorway to a place, per
`vdp/VDP_CASINO_FIRST_STARTER_WORLD.md`: "the casino as the deliberate
centerpiece, not one feature among equals."

## Real investigation before any code
The `vago` district already existed in `world.js` — but as
`contentType: 'vago-embed'`, which is VDP's own taxonomy for a
lounge-style link-out into the standalone app. So the casino was
present as a doorway and absent as a place.

Two of the source document's own premises were checked and do not
hold, and are recorded in that document's Implementation status
section rather than worked around silently: "Venus Resort Complex
already designed as VDP's first-wave build priority" (the name appears
only in `vago/` and `vavlt-stvdios/` documents — no district, no lib
module, no phase record in `vdp/`), and "VENVS Crown Resort, the
native VENVS casino district already established" (no such district in
`venvs/`). This is the third document to cite a casino destination as
existing precedent; phase-5 caught the first two.

## Design
- **Two venues, not one floor.** `land` and `riverboat` are separate
  places with their own bounds and their own dock. They are not
  walkable-adjacent, because the source document asks for VOID water
  taxis connecting them — and a taxi between adjacent rooms is
  decoration.
- **The crossing is a real timed state.** A player aboard is in
  neither venue. That is the constraint that makes the taxi mean
  something, and it is also what creates the one interesting bug:
  "seated at a table" and "standing in the room" can disagree.
- **The split with VAGO, stated once.** VDP owns the venue — where you
  stand, how you cross, who is staffing the table. VAGO owns the game
  and the money. `VenusResortView` renders `VagoView` unchanged once
  the player sits down; nothing in `venusResort.js` moves a balance.
- **Staffing is derived, never stored.** A table is open when a dealer
  is assigned to it. A stored `isOpen` flag and an absent dealer can
  disagree, and then the room says open while nobody can deal.
- **Compliance.** The source document names a gambling compliance
  review "already flagged … before anything real-money-adjacent goes
  live." It is not recorded as complete anywhere in this repo, so
  `assertNoRealMoney` throws on any currency but `vcoin`.

## What this phase also had to fix
`vite build` failed on both Vite frontends before a line of this
phase's code was written. Commit `c7b1d7a` renamed `shieldAuth.js` to
`.cjs` repo-wide for a real reason, matched on filename, and caught
`vdp/src/lib/shieldAuth.js` and `venvs/src/lib/shieldAuth.js` — each
app's own browser-side ESM session client, which share the name
deliberately per the VENVS/VDP split. Roughly thirty importers still
said `./shieldAuth.js`. Both apps had been unbuildable since.

Nothing caught it: neither Vite app had a test suite, and `vite build`
is in no verification path. All seven checks passed while two of the
thirty-six services could not build.
