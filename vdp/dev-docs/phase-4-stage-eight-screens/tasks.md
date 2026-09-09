# Tasks — Phase 4: VENVS Stage Wired to Vavlt Stvdios' Eight Screens

- [x] Investigate: grep VDP's `src/` for any existing Vavlt Stvdios
      reference (none found); confirm Stage is `world.js`'s one
      remaining `contentType: 'none'` district; read VENVS's own
      `CLAUDE.md` directly and confirm its own §4/§5 name Stage as the
      real, intended home for "up to 8 real camera feeds with AI
      operators."
- [x] `src/lib/vavltStvdiosClient.js` — real fetch client (channels,
      screen sessions, chat, tips), same shape/error convention as
      `v3Client.js`.
- [x] `src/lib/stage.js` — `STAGE_OWNER_ID`, `STAGE_CAMERAS` (8 real,
      named roles + operator ids, flagged interpretive), idempotent
      `ensureStageSession`, `operatorIdForChannel` (matched by channel
      name, not fragile id arithmetic).
- [x] `src/components/StageView.jsx` — real 8-screen grid, click-to-
      focus, real per-screen chat (fetch + post), real tip form paying
      the focused screen's own operator.
- [x] `src/lib/world.js` — new `contentType: 'vavlt-stvdios-embed'`
      (documented in the module header alongside the existing 2
      values), Stage's `contentType` flipped from `'none'`.
- [x] `src/components/WorldView.jsx` — import `StageView`, render
      branch for `vavlt-stvdios-embed` + `id === 'stage'`, header
      comment updated (no district left with `contentType: 'none'`).
- [x] `npm run build` — confirmed clean.
- [x] Verify live cross-app via direct HTTP (mirroring the exact
      client logic before touching the browser): 8 channels created,
      3 live, broadcaster session created, composed read confirmed,
      chat post confirmed, tip confirmed against real V3 balances
      (1000 → 1005 operator, 1000 → 995 tipper), idempotent re-lookup
      confirmed.
- [x] Verify live in a real browser (Playwright, all 3 servers +
      Vite dev server running): login, walk to Stage, enter, exactly 8
      camera tiles, exactly 3 LIVE badges, focus a different screen,
      real chat sent and rendered back, real tip sent with no error.
- [x] Investigate a console 404 found during the live pass rather than
      suppressing it blindly: traced to the browser's own default
      `/favicon.ico` request (Vite serves none), confirmed pre-existing
      and unrelated via 3 isolated diagnostic runs (including one with
      zero navigation and no login).
- [x] Shut down all test servers/processes; confirmed via port checks
      (connection refused on 8791/8808/5174).
- [x] Update `README.md` ("Run," "What's here," "Verified," "Not yet
      built").
- [x] Write this plan/tasks pair.

## Next
No further VDP work requested. Real remaining gaps: real video/camera
capture, a broadcaster-side Stage operator console, Digital Twin
Levels/DREAMS billboards/etc. named in "Not yet built."
