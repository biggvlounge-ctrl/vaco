# Tasks — Phase 2: Content Layer + HVNTZ Integration

- [x] Investigate: confirm HVNTZ's own `checkInAtCheckpoint` has no
      existing photo-proof mechanic on either side before writing code.
- [x] `lib/posts.js` — `POST_TYPES`/`POST_SOURCES`, `createPost` (real
      per-type validation), `getPost`/`getPostForViewer` (gated read),
      `getFeedPosts`/`getActiveStories`/`getReels`/`getExplorePosts`,
      `listPostsForAuthor`, `createHighlight`/`listHighlightsForAuthor`.
- [x] `lib/follows.js` — `followUser`/`unfollowUser` (self-follow and
      duplicate guards), `isFollowing`, `getFollowedIds`.
- [x] `lib/notes.js` — `addNote`, `getActiveNotesForPost` (3-day expiry).
- [x] `lib/lockedContentTiers.js` — `createTier`/`getTier`/
      `listTiersForCreator`, `isSubscribed`/`canAccessLockedContent`,
      `subscribeTier` (real 80/20 split, two transfer calls).
- [x] `lib/mapSearch.js` — local `haversineKm`, `createListing`/
      `getListing`, `searchNearby`.
- [x] `lib/profileCards.js` — `createOrUpdateProfileCard`
      (real upsert), `getProfileCard`.
- [x] `lib/store.js`, `server.js` — Phase 2 fields and ~20 new routes.
- [x] Verify in plain Node: 32-check pass found a test-data-setup bug
      (an Explore-excludes-unfollowed-creator case whose only post was
      a story, correctly excluded — not an app bug); re-run clean at
      14 checks after fixing the test data.
- [x] Verify live against a running `vavlt-stvdios` server: posts/
      feed/stories/reels/explore, a real 25 VCoin tier subscription
      confirmed as an exact 20/5 split via V3's own balances, locked
      media hidden before and visible after subscribing, map search,
      profile card upsert.
- [x] `hvntz/lib/hunts.js` — `checkInAtCheckpoint` takes optional
      `photoUrl` + injected `postToVavltStvdios`, posts a real story to
      the checkpoint's business profile.
- [x] `hvntz/server.js` — `postToVavltStvdios` real fetch client, wired
      into the check-in route.
- [x] Verify live cross-app: HVNTZ's own running server calls this
      app's real `/api/posts` during a real check-in.
- [x] Found and fixed a real bug during that test: numeric
      `authorId` (HVNTZ's `businessId`) never matched string route
      params — normalized `authorId: String(authorId)` in `createPost`.
- [x] Re-verify: restart-and-rerun of the cross-app test, plus a full
      re-run of the 14-check Phase 2 suite to confirm no regression.
- [x] Shut down test servers; confirmed via port checks.
- [x] Update `README.md` ("What's here," "Verified," "Not yet built").
- [x] Update `hvntz/README.md` for the new integration — **resolved**:
      done as part of HVNTZ's own later Phase 6 (real lat/lng +
      Map Search sync), which covers this exact integration in real
      detail under `lib/hunts.js`'s own README entry ("Real Vavlt
      Stvdios integration": `postToVavltStvdios`, the real story-post
      mechanic, and the later `syncLocationToMapSearch` half). Never
      cross-referenced back to close this checkbox at the time —
      closed now, work already real and verified.
- [x] Write this plan/tasks pair.

## Next
HVNTZ's own Map Search wiring (needs lat/lng on `registerLocation`
first). Real video/photo capture infrastructure. The VENVS/VAGO casino
broadcast layer, once this app's own streaming core and VAGO's own
visual casino world exist.
