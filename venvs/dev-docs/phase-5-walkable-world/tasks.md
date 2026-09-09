# Tasks — Phase 5: Digital-mode walkable world

- [x] Create `src/lib/world.js`: `WORLD_WIDTH`, `WORLD_HEIGHT`,
      `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`, `MOVE_STEP`,
      `BUILDING_ENTRY_RADIUS`, `DISTRICTS` (6 native districts),
      `createWorldState`, `movePlayer`, `getCurrentDistrict`,
      `getNearbyBuilding`, `enterBuilding`, `getCameraOffset`.
- [x] Verify pure logic in plain Node (throwaway script, deleted
      after — 24 checks, all passed clean on first run):
      - Spawn point is neutral (no district) and within world bounds.
      - `movePlayer` clamps at all 4 edges (top, left,
        bottom-right combined) when pushed far past them.
      - Standing at each of the 6 districts' centers correctly
        reports that district's id.
      - The documented neutral spawn gap correctly reports no
        district.
      - 1 unit past a district's right edge is correctly outside it;
        exactly on its top-left corner is correctly inside it
        (inclusive bounds, both directions checked).
      - Far from any building: `getNearbyBuilding` is `null`;
        `enterBuilding` throws.
      - 1 unit past the entry radius: not nearby. 1 unit inside it:
        correctly nearby.
      - Entering the building you're actually at succeeds; entering a
        *different* building while near this one throws.
      - Camera centers exactly on a mid-map player; clamps correctly
        at both the top-left and bottom-right world edges.
- [x] Create `src/components/WorldView.jsx`: canvas rendering
      (districts colored + labeled + border style signaling analog-
      view availability, player as a dot), `window`-level keydown
      handling for arrow keys/WASD, an "Enter {building}" prompt gated
      on `getNearbyBuilding`, and real `PublishingView`/`DegvchiView`
      instances rendered on entering their districts.
- [x] Wire `App.jsx` to render `WorldView` after `DegvchiView`.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install):
      - World section renders; spawn position displays exactly
        "(430, 290)"; correctly reports "Neutral ground."
      - Canvas element present at the correct 400×300 size.
      - 18 `ArrowRight` + 9 `ArrowUp` presses move the player to the
        exact hand-computed position (718, 146); district readout
        correctly switches to "In: VENVS Publisher"; the "Enter VENVS
        Publisher" prompt appears (confirms real proximity gating,
        not always-visible).
      - Before entering: exactly 1 `Publishing` heading exists (the
        analog-mode one from Phase 2). After clicking "Enter VENVS
        Publisher": exactly 2 exist — confirms a real, second
        `PublishingView` instance rendered, not a placeholder or fake
        confirmation text.
      - 36 further `ArrowLeft` presses reach VEX; entering it shows
        "Entered VEX" + the honest "No analog-mode view built for this
        district yet" message, not a fabricated view.
      - No unexpected console/page errors (same harmless favicon 404
        as prior phases).
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections.
- [x] Commit as its own change.

## Next
VEX, VADO, Stage, and Food District all have no analog view — real
gaps, not attempted here. No multiplayer/shared-world state, no
character art, no district-interior collision, no CHOPZ/DREAMS/
Residential Towers/Jobs/Quests/NPCs/Skills — all believable next steps
for this world, none started.
