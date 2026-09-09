# Tasks — Phase 5: The Village District

- [x] Investigate: confirm the real conflict between `world.js`'s own
      "lounge apps live only in their own app" rule and
      `VXLLAGE_VDP_VILLAGE_DISTRICT.md`'s own direct instruction;
      confirm that same doc's own VAGO-precedent claim is false by
      grepping `world.js`'s `DISTRICTS` and reading VAGO's own README.
- [x] `src/lib/vxllageClient.js` — real, thin HTTP client into
      VXLLAGE's own API (villages, rooms, channels).
- [x] `src/lib/villageDistrict.js` — `ROOMS_LAYOUT` (2 real rooms, one
      per real `ROOM_TYPE`), the real interior movement/proximity/
      camera-clamp functions (own scale, independent of `world.js`),
      `ensureVillageDistrict` (idempotent create-or-reuse),
      `ensureMembership` (idempotent join).
- [x] `src/components/VillageDistrictView.jsx` — real interior canvas,
      real room entry, real join/leave for Main Stage, real chat for
      The Lounge.
- [x] `src/lib/world.js` — `WORLD_HEIGHT` 580 → 860 (a real new 3rd
      row), new `contentType: 'vxllage-embed'` (documented in the
      header alongside the other 3), the real 7th `village` district
      entry.
- [x] `src/components/WorldView.jsx` — import `VillageDistrictView`,
      new render branch, `DISTRICT_COLORS` entry, header comment
      updated.
- [x] `npm run build` — confirmed clean after each edit.
- [x] Verify live in a real browser (Playwright, `venvs-mock-backend` +
      `vxllage` + `vdp` all running): walked to the real 7th district,
      entered it, real village name rendered; walked the interior,
      entered Main Stage, joined (real participant list showed the
      real session userId), left (list emptied); entered The Lounge,
      sent a real chat message, confirmed it rendered back.
- [x] **Real bug found live during this exact pass, fixed, and
      re-verified**: the Enter button was gated behind `!enteredRoom`,
      so walking from an already-entered room to a *different* room
      never showed that second room's own Enter button — `enteredRoom`
      was only ever set, never cleared. Fixed by removing that gate,
      matching `WorldView.jsx`'s own real, already-correct pattern
      (its own Enter button depends only on proximity).
- [x] Investigated a real console 400 rather than dismissing it: URL
      diagnostics traced it to `POST /api/villages/:id/join`; read
      `main.jsx` directly and confirmed `React.StrictMode` double-
      invokes effects in dev, so `ensureMembership` genuinely runs
      twice — the second, expected "already a member" response is
      already caught and swallowed correctly; only the raw browser
      network log still surfaces it.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (intro, Run, What's here, Verified, Not yet
      built).
- [x] Write this plan/tasks pair.

## Next
Real audio for Main Stage. QVAN's own security/anti-bot mandate.
Browsing/joining a different, pre-existing VXLLAGE village from inside
VDP. Village boost/cosmetics purchases inside this district's own UI.
