# Plan — Phase 5: The Village District

## Goal
Wire VXLLAGE's own real Villages/Rooms/Channels into VDP's walkable
world as a real, inhabitable multi-room space, per
`VXLLAGE_VDP_VILLAGE_DISTRICT.md`'s own direct instruction: "a real
place with multiple distinct rooms a player's avatar can walk between,
not just a card linking out to the standalone VXLLAGE app."

## Real investigation before any code
Read `world.js`'s own existing header rule directly before designing
anything: "Only the 6 'native districts'... get physical space here.
Lounge districts are explicitly described as living in their own
separate VACO app... a literal read of that distinction, not an
oversight." VENVS's own `CLAUDE.md` names VXLLAGE by name as a lounge
district. `VXLLAGE_VDP_VILLAGE_DISTRICT.md` directly contradicts this
for VXLLAGE specifically, asking for real, native-style physical
space. Confirmed this is a genuine conflict between two real source
docs, not a misreading of either one — resolved in VXLLAGE's favor
here per direct instruction to close this exact gap, and documented as
a real, flagged exception rather than silently reconciled.

Also checked that same doc's own claim directly: "the same treatment
already given to VAGO's Resort & Casino, which is a real walkable
destination inside VDP." Grepped `world.js`'s own `DISTRICTS` array —
no VAGO entry exists anywhere. Read VAGO's own README — its casino
world is explicitly "a VENVS/VDP-side build, not this backend," not
yet built. The doc's own precedent claim is false; this district is a
first, not a copy.

## Design
- A real 7th district cell, not a redesign of the existing 6 — the
  outer world grid grows one row (`WORLD_HEIGHT` 580 → 860), the
  existing 6 districts' own positions are untouched.
- The interior (two rooms, walkable) reuses `world.js`'s own real
  movement/proximity/camera-clamp algorithm shape, applied at a
  smaller, independent scale (`villageDistrict.js`'s own `INTERIOR_*`
  constants) rather than importing `world.js` directly — its constants
  are module-scoped to the outer world, not parameterized, and forcing
  that would risk entangling two maps that should be free to evolve
  independently. A real, proportionate choice, not a full second nested
  2D engine with its own asset pipeline.
- `ensureVillageDistrict` is idempotent, the same real pattern
  `stage.js` already proved for Vavlt Stvdios: create the village +
  two real rooms (one `clubhouse-audio`, one `discord-hangout` — both
  real `ROOM_TYPES` VXLLAGE's own `villageRooms.js` already defines) +
  one channel on a genuine first visit; reuse on every later one.
- Entering the district grants real VXLLAGE village membership
  (idempotent, "already a member" swallowed) — required for the real
  channel's own real membership gate to ever let a VDP player post.

## Explicitly NOT in this task
Real audio for the clubhouse-audio room. QVAN's own confirmed security/
anti-bot mandate — named in the source doc, not implemented anywhere
in this ecosystem, out of scope for wiring the district itself.
Browsing/joining a different, pre-existing VXLLAGE village from inside
VDP — only the one auto-created district village is wired in. Village
boost/cosmetics purchases inside this district's own UI.

## Verification approach
`npm run build` confirmed clean after each edit. A live Playwright
pass against `venvs-mock-backend` + `vxllage` + `vdp` all running
together: walk to the real 7th district, enter it (proving
`ensureVillageDistrict` actually ran live), walk the interior to each
real room, join/leave Main Stage with the real participant list
confirmed via actual DOM state, send a real chat message in The Lounge
and confirm it round-trips through VXLLAGE's own API. One real app bug
was found during this exact pass (see tasks.md) and fixed, then
re-verified with a clean re-run. One console artifact (a real 400) was
investigated via response-URL diagnostics rather than dismissed, and
confirmed to be a real, expected, already-correctly-handled
React.StrictMode double-invocation, not a bug.

## Done when
- Walking into the Village District shows a real, multi-room space
  sourced from VXLLAGE's own live data, with real join/leave and real
  chat, verified end to end against real running servers.
- The real doc conflict (native space vs. lounge-only) and the false
  VAGO precedent claim are both documented, not silently resolved.
