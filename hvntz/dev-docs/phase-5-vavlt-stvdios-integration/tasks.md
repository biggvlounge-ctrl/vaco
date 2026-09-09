# Tasks — Phase 5: Vavlt Stvdios Integration (hunt-checkpoint photo-proof)

- [x] Investigate: confirm `checkInAtCheckpoint` has no photo-proof
      mechanic on the HVNTZ side; confirm Vavlt Stvdios' own receiving
      endpoint doesn't exist yet either.
- [x] `lib/hunts.js` — `checkInAtCheckpoint` takes optional `photoUrl`
      + injected `postToVavltStvdios`; rejects a `photoUrl` supplied
      without the client function; posts a real story to the
      checkpoint's business profile when both are present.
- [x] `server.js` — `VAVLT_STVDIOS_API_URL` env var,
      `postToVavltStvdios(postOptions)` (real fetch POST to
      `/api/posts`), wired into the `/api/hunt/:huntId/checkin` route.
- [x] Verify live cross-app: both servers running, a real check-in
      with a `photoUrl`, the resulting post independently confirmed
      via `GET /api/posts/:id`, `GET /api/authors/:id/posts`, and
      `GET /api/stories` on the Vavlt Stvdios side.
- [x] Real bug found live during this test: `GET /api/authors/:id/
      posts` came back empty despite the post existing, because
      HVNTZ's numeric `businessId` never matched a string route param
      (`1 === '1'` is `false`) — confirmed via a direct `node -e` type
      check. Fixed on the Vavlt Stvdios side (`authorId:
      String(authorId)` in `posts.js`'s `createPost`).
- [x] Re-verify: full restart-and-rerun of the cross-app test, clean.
- [x] Shut down both servers; confirmed via port checks.
- [x] Update `hvntz/README.md` (Run, `lib/hunts.js` bullet, Verified,
      Not yet built).
- [x] Write this plan/tasks pair.

## Next
HVNTZ's own Map Search wiring (`registerLocation` needs a real lat/lng
field first) is the one remaining genuinely unbuilt half of the Vavlt
Stvdios integration described in the source docs.
