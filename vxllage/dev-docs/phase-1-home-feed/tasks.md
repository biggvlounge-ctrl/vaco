# Tasks — Phase 1: Home Feed (posts, threads, follows, For You/Following)

- [x] Scaffold the project: `package.json`, `.env.example`,
      `.gitignore`, source docs copied in (`VXLLAGE_CLAUDE.md`,
      `VXLLAGE_VDP_VILLAGE_DISTRICT.md`,
      `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` — VXLLAGE section only;
      CHOPZ/VACAY are separate future apps documented in the same
      combined file).
- [x] Create `lib/store.js`: `createVxllageStore()`.
- [x] Create `lib/posts.js`: `createPost`, `getPost`, `getReplies`,
      `getThread`, `likePost`, `unlikePost`, `repostPost`,
      `unrepostPost`.
- [x] Create `lib/follows.js`: `followUser`, `unfollowUser`,
      `isFollowing`, `getFollowing`, `getFollowers`.
- [x] Create `lib/feed.js`: `FOR_YOU_WEIGHTS`, `RECENCY_WINDOW_HOURS`,
      `computeForYouScore`, `getFollowingFeed`, `getForYouFeed`.
- [x] Create `lib/profiles.js`: `getUserProfile`.
- [x] Wire `server.js`: 15 endpoints (`POST`/`GET /api/posts[/:id]`,
      `GET /api/posts/:id/replies`, `GET /api/posts/:id/thread`,
      `POST /api/posts/:id/like`, `POST /api/posts/:id/unlike`,
      `POST /api/posts/:id/repost`, `POST /api/posts/:id/unrepost`,
      `POST /api/follow`, `POST /api/unfollow`,
      `GET /api/follow-status/:followerId/:followeeId`,
      `GET /api/following/:userId`, `GET /api/followers/:userId`,
      `GET /api/feed/following/:userId`,
      `GET /api/feed/for-you/:userId`, `GET /api/profile/:userId`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 19 checks, all passed clean on first run):
      - An empty top-level post is rejected (real composer submit
        validation); an empty reply/quote-post is allowed.
      - A reply and a quote-post both correctly link to and validate
        against a real existing post, rejecting an unknown target.
      - `getReplies` returns real, direct children only, chronologically
        sorted; `getThread` assembles a real, recursive reply tree
        proven 3 levels deep.
      - `likePost`/`unlikePost` and `repostPost`/`unrepostPost` are
        real, idempotent, per-user actions — a double-like/double-
        repost is rejected, not silently ignored.
      - `followUser` rejects self-follow and duplicate follows;
        `unfollowUser` rejects unfollowing someone not followed.
      - **The centerpiece check**: a low-engagement post from a
        followed author vs. a high-engagement post from a non-followed
        author — Following correctly excludes the stranger's post
        entirely; For You correctly ranks it first by real engagement.
        `computeForYouScore` genuinely rewards engagement and decays
        with real age, with a real floor (never fully zeroed).
      - `getUserProfile` aggregates real post/following/follower counts
        and authored posts; returns real zeroed data for an inactive
        user.
- [x] Verify live with `vxllage/server.js` running alone (no V3
      dependency this phase): a real post, reply, and thread confirmed
      via the running server; likes/reposts confirmed; and the same
      Following-vs-For-You divergence proven against the actual live
      server, not just the in-memory store — Following excluded the
      viral stranger's post, For You surfaced it first with a
      real, non-zero `forYouScore`.
- [x] Shut down the server cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Phase 2: Villages (Discord-style), deliberately built as the lighter,
secondary layer §0 calls for — channels/events/members/boost economy
concepts preserved from the prototype, but not structured as a bigger,
richer app than Home.
