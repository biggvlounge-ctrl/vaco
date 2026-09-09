# Tasks — Phase 3: Eight-Screen Interactive Sessions + Repositioning

- [x] Investigate: map each of the six named comparables (YouTube,
      Instagram, Patreon, OnlyFans, Kick, Twitch) to what's already
      built here; confirm the "compose several channels into one
      session" mechanic doesn't exist anywhere yet, on either the
      broadcaster or viewer side.
- [x] `lib/screenSessions.js` — `MAX_SCREENS = 8`, `SESSION_TYPES`,
      `createScreenSession` (broadcaster ownership guard, 1-8 range,
      duplicate rejection), `getScreenSession`, `addScreenToSession`/
      `removeScreenFromSession` (cap enforced on add too),
      `listScreenSessionsForOwner`, `getScreenSessionWithChannels`
      (composed read).
- [x] `lib/store.js` — `screenSessions`/`nextScreenSessionId`.
- [x] `server.js` — 5 new routes: `POST /api/screen-sessions`,
      `GET /api/screen-sessions/:id`, `POST /api/screen-sessions/:id/
      screens`, `DELETE /api/screen-sessions/:id/screens/:channelId`,
      `GET /api/owners/:ownerId/screen-sessions`; `maxScreens` added to
      `/api/health`.
- [x] Verify in plain Node (17 checks): one test-script bug found and
      fixed (a 9-element duplicate array's expected error message was
      wrong — the real 1-8 length check correctly fires before the
      duplicate check, not an app bug).
- [x] Verify live against a running `vavlt-stvdios` server: 8 real
      channels for one casino composed into a broadcaster session and
      read back with full channel objects; a viewer session live-mixing
      two unrelated streamers with one casino channel; the ownership
      guard rejected live with the specific channel id named; a 9th-
      screen add rejected live once full; a screen removed and the
      session confirmed shrunk; owner-scoped listing confirmed live.
- [x] Shut down test server; confirmed via port check (curl exit 7).
- [x] Rewrite the README's intro/positioning against all six named
      comparables; update "What's here," "Verified," "Not yet built."
- [x] Write this plan/tasks pair.

## Next
No further Vavlt Stvdios work requested. The VENVS/VAGO casino world
broadcast layer remains blocked on infrastructure that doesn't exist
(this app's own video pipeline, VAGO's own visual casino world).
