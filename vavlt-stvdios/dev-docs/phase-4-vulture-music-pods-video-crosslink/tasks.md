# Tasks — Phase 4: Vvltvre Music/Pods video cross-link

- [x] Investigate: read this project's own README/`posts.js` directly
      to check the user's "YouTube style" framing against what's
      actually built; confirm the real 20-minute Reel cap and its
      real implication for video podcast episodes.
- [x] `lib/posts.js` — added `'vulture-music'`/`'vulture-pods'` to
      `POST_SOURCES`.
- [x] 1 plain-Node check — passing.
- [x] Live pass across four independently running servers
      (`venvs-mock-backend`, `vavlt-stvdios`, `vulture-music`,
      `vulture-pods`): a real music video attached from `vulture-music`
      and independently confirmed on this server's own
      `GET /api/posts/:id`; a real short video episode attached from
      `vulture-pods`; a real long video episode attempt confirmed
      rejected by this server's own real validation, not by either
      caller.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified).
- [x] Write this plan/tasks pair.

## Next
None on this side -- see the two dependent projects' own dev-docs for
their remaining flagged gaps.
