# Tasks — Phase 7: casino streaming events, minimal slice

- [x] Direct status check: confirmed
      `VAULT_STUDIOS_INTERACTIVE_CASINO_LAYER.md` is a design document
      only (dated back to the very first Vavlt Stvdios commit) — no
      route, no lib module, nothing runnable existed for it.
- [x] Offered the user three real scope options for building it
      (minimal backend slice / full vision / skip); user chose the
      minimal backend slice.
- [x] Investigated `channels.js` and `screenSessions.js` to reuse
      their existing ownership/ interactivity infra rather than
      duplicate it.
- [x] Built `lib/casinoEvents.js`: `createCasinoEvent`,
      `getCasinoEvent`, `listCasinoEvents`, `goLiveCasinoEvent`,
      `endCasinoEvent`, `joinCasinoEvent`, `leaveCasinoEvent`,
      `listAttendees`, `listActiveAttendees`,
      `getCasinoEventWithDetail`.
- [x] Added `casinoEvents`/`casinoEventAttendees` fields to
      `lib/store.js`.
- [x] Wired 7 new routes into `server.js`
      (`POST /api/casino-events`, `GET /api/casino-events`,
      `GET /api/casino-events/:id`, `POST .../go-live`,
      `POST .../end`, `POST .../join`, `POST .../leave`,
      `GET .../attendees`); updated `/api/health`.
- [x] `node --check` on all new/modified files — passed.
- [x] Wrote 6 real unit tests to a scratchpad file, ran them — all
      passed on first run. Deleted the scratch test file.
- [x] Started the real server, ran the full real HTTP flow: channel ->
      broadcaster screen session -> casino event -> join rejected
      while scheduled -> go-live -> two real joins -> composed detail
      read (real host channel + real screen session + attendee count
      2) -> end -> join rejected again.
- [x] Confirmed real restart-survival: killed the process, restarted,
      re-`GET` of the same event returned the identical real state.
- [x] Killed the test server process; removed the test `data/`
      directory.
- [x] Updated `README.md`: new "Real casino streaming events —
      minimal slice (Phase 7)" section, and rewrote the "Not yet
      built" casino bullet to reflect what's now closed vs. what's
      still genuinely open (real video infra, real visual casino
      world).

## Next
The two real remaining dependencies for the FULL vision — real video
streaming infrastructure, and a real visual/walkable casino world on
the VENVS/VDP side — are each their own real, multi-phase project, not
started here.
