# Tasks — Phase 3: concurrent-stream limit enforcement

- [x] Re-read `titles.js`/`subscriptions.js` to confirm the real gap
      and decide the additive (not `watchTitle`-modifying) design.
- [x] `store.js` — add `streamSessions: []`, `nextStreamSessionId: 1`.
- [x] `titles.js` — extract `assertCanWatch` (shared, no side
      effects) from `watchTitle`'s own checks; add `startStream`
      (concurrency-checked, logs watch event + opens session only on
      success), `endStream`, `listActiveStreams`, `countActiveStreams`.
- [x] `server.js` — 3 new routes
      (`POST /api/titles/:id/stream`, `POST /api/streams/:id/end`,
      `GET /api/users/:userId/active-streams`).
- [x] 8 plain-Node checks — all passing.
- [x] Live pass: real V3 + Vvltvre Flix started (post-cutover
      defaults), a real ad-supported viewer's stream rejected at their
      real limit, succeeding again after the first stream was ended.
- [x] Shut down all test servers.
- [x] Update `vulture-flix/README.md` — new Phase 3 bullets in "What's
      here", a new "Verified" paragraph, and the resolved item removed
      from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Time-based session auto-expiry and per-device (not per-user) stream
counting remain real, separate, undocumented features -- not attempted
here.
