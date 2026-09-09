# Plan — Phase 5: Digital-mode walkable world

## Goal
`CLAUDE.md` §1's core design principle: "digital mode is not a
separate app — every VACO app has an analog interface AND a physical
space in this one shared world, using the same account/wallet/
identity." §4: "a walkable top-down world you move an avatar through
with arrow keys/WASD, camera follows you, buildings you walk up to and
enter." First phase in this session built without a source doc giving
concrete numbers to check against (unlike Publishing's royalty rates
or DEGVCHI's category list) — every constant here is flagged as
interpretive.

## Design
- `src/lib/world.js` — pure, plain-Node-testable logic, deliberately
  separated from rendering:
  - `WORLD_WIDTH/HEIGHT` (860×580), a 3×2 grid of 260×260 districts
    with 20px gaps/margins. The gaps are genuinely neutral walkable
    space (not inside any district) — used deliberately as the
    player's spawn point, so "not in a district" is a real, checked
    state from the very first frame, not just a theoretical case.
  - **Only the 6 "native districts"** from `CLAUDE.md` §4 get placed
    here (VEX, VADO, VENVS Publisher, VENVS Stage, Food District,
    Fashion District). Lounge districts are explicitly described as
    living in their own separate VACO app — literally not placed in
    this world, not an oversight.
  - `movePlayer` clamps at the world edges (can't walk off the map).
  - `getCurrentDistrict` — inclusive-boundary point-in-rectangle test.
  - `getNearbyBuilding`/`enterBuilding` — "walk up to and enter":
    proximity to a district's building (its center point) within
    `BUILDING_ENTRY_RADIUS` (40 units), not just "standing inside the
    district." `enterBuilding` validates the player is actually near
    *that specific* building — can't enter one building while
    standing near a different one.
  - `getCameraOffset` — centers the viewport (400×300) on the player,
    clamped so it never scrolls past the world's edges. Real,
    testable clamped-camera math, not just "always centered."
- `src/components/WorldView.jsx` — the real rendering + input layer:
  canvas draws districts (color + name label + a border style that
  distinguishes "has a real analog view" from "doesn't" — an
  invented-for-this-demo visual signal, not from any source doc, which
  only distinguishes native/lounge, a different distinction already
  handled by which districts exist in `world.js` at all) and the
  player as a dot; `window`-level keydown listener for arrow keys/WASD
  (matching the doc's own two control schemes); an "Enter {building}"
  button appears only when `getNearbyBuilding` returns something.
- **The literal proof of CLAUDE.md's core design principle**: entering
  the Publisher or Fashion District building renders the *actual*
  `PublishingView`/`DegvchiView` components from Phases 2 and 4 inside
  the world — not a copy, not a mock-up, the same components, reading
  the same `session` and calling the same real `v3Client` wallet
  functions. The other 4 native districts have no analog view built
  yet, shown as an explicit "No analog-mode view built for this
  district yet" message — the honest gap, not a placeholder pretending
  to be content.

## Verification approach
Two layers again. Plain-Node pass on `world.js` first (24 checks,
including precise edge cases: 1 unit outside a district's bounds vs.
exactly on its corner, 1 unit outside the entry radius vs. 1 unit
inside it, camera behavior at both world edges and dead center) — all
passed clean on the first run, no bugs caught this time, likely
because the boundary-precision discipline from catching 4 earlier test
bugs this session carried into how these test cases were written
up front. Then a real browser pass (Playwright + this environment's
Chromium): confirmed the canvas renders at the correct size, walked
the player a precise, hand-computed distance (18 `ArrowRight` + 9
`ArrowUp` presses from the documented spawn point) to land within 9
units of the Publisher building's center, confirmed the district/
position readout matched the computed value exactly, entered the
building, and confirmed a *second* real `Publishing` heading appeared
(not a placeholder) — then walked 36 `ArrowLeft` presses to VEX and
confirmed the honest "not built yet" message renders there instead.

## Explicitly NOT in this task
- No multiplayer/shared-world state — per `CLAUDE.md` §7 step 5, this
  explicitly comes after wallet/auth are solid, which Phases 1-4
  covered; a single local player only.
- No sprite/character art — the player is a rendered dot, not an
  avatar model.
- No collision with anything other than the world's outer edges —
  districts don't block movement, matching "walk up to and enter,"
  not "walk into a wall."
- No CHOPZ, DREAMS billboards, Residential Towers, Jobs, Quests,
  NPCs, Skills, or the remaining lounge districts — none of these have
  a concrete spec to build against yet in this session.
- No VEX/VADO/Stage/Food analog views — flagged as real gaps, not
  attempted.

## Done when
- `movePlayer` clamps correctly at all 4 world edges.
- `getCurrentDistrict` correctly identifies all 6 native districts by
  their center point, correctly reports the neutral spawn gap as no
  district, and correctly handles the 1-unit-outside vs. exactly-on-
  the-boundary edge cases.
- `getNearbyBuilding`/`enterBuilding` correctly gate on the exact
  entry radius (1 unit outside fails, 1 unit inside succeeds) and
  reject entering a building the player isn't actually near.
- `getCameraOffset` correctly centers on a mid-map player and clamps
  at both world edges.
- Live browser: real keyboard-driven movement lands at a precisely
  predicted position; entering the Publisher building renders the real
  `PublishingView` (a second one, confirmed by heading count, not
  assumed); entering VEX shows the honest gap message instead.
- Regression: Phases 1-4 (wallet, Publishing, Marketplace, DEGVCHI)
  still work in the same session, including inside the newly-nested
  instances rendered by `WorldView`.
