# CHOPZ

The ecosystem's short-form video/social app — TikTok's role in this
build. This project is the primary video/social feed only.

**CHOPZ SHOP** (`chopz-shop/`) is a separate, standalone app for the
commerce layer — TikTok Shop's role — per explicit instruction: same
real relationship as TikTok to TikTok Shop, not one app wearing two
hats. See `chopz-shop/README.md`.

**A real naming collision, flagged directly, not silently worked
around**: VENVS already has a different, earlier-built, unrelated
feature also called "CHOPZ" — `venvs/src/lib/chopz.js` / "CHOPZ
District", a retail-unit-leasing minigame inside VENVS's walkable
digital world (documented in `venvs/CLAUDE.md` §4). Same name, two
genuinely different products. This project is the new, TikTok-Shop-
style social commerce app described in
`VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` and `CHOPZ_TIKTOK_COMPARABLES.md`
— built on my own judgment per this session's standing "proceed, flag
gaps" mode, since the user's "CONTINUE" arrived before either the
naming collision or the missing VENVM/Storytime doc (see below) was
explicitly resolved.

**Still missing, still flagged**: nothing anywhere in this session
documents "VENVM" or a "Storytime engine," which the user's own intro
message asked about directly (how CHOPZ connects to VENVM's Storytime
engine and existing video production tools). No such connection is
built here — there's nothing real to build it from yet.

Source docs: `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` (CHOPZ section).

## Run
```
cd chopz && npm install && npm start   # localhost:8800
```

## Test
```
curl http://localhost:8800/api/health
curl -X POST http://localhost:8800/chopz/videos -H "Content-Type: application/json" -d '{
  "creatorId":"creator-1","mediaUrl":"https://cdn/example.mp4","linkedProductId":1
}'
```

## What's here
- `lib/videos.js` — the real `ChopzVideo` model (`creatorId`,
  `mediaUrl`, `linkedProductId: string | null`). `linkedProductId` is
  still NOT validated at creation time — forcing every video upload to
  synchronously round-trip to CHOPZ SHOP (a separate app) would block
  the primary content-creation path on a dependency it doesn't
  strictly need at creation time, the same real TikTok precedent this
  file's own header already cites. **Real, deferred verification added
  (Phase 2)**: `verifyLinkedProduct`, a real, separate, opt-in
  live-validation call against CHOPZ SHOP's own product lookup
  (mirroring CVNVO's `voidFetchFn` pattern) — stores the real product's
  `sellerId`/`price` on the video, not just the caller's bare id, and
  sets a real `linkedProductVerified` flag (defaults `false` on every
  video, verified or not, until this real check actually runs).
- `server.js` — a real Express API (CommonJS) around the video model,
  including the new verification route.

## Verified
4 plain-Node checks (video creation with/without a linked product,
round-trip, required-field rejection) plus a live pass creating a real
video linked to a real product actually created in CHOPZ SHOP
(`chopz-shop/` running independently on its own port). See
`dev-docs/` for the full record.

**Phase 2 (live linkedProductId verification)**: 7 plain-Node checks
(unverified by default, verification rejects a video with no linked
product, real verification stores the real product data, rejects a
nonexistent product), plus a live pass with `chopz-shop` and `chopz`
both running: a real product created, a real video linked to it, live
verification confirmed setting the flag and storing the real seller/
price, and a second video linked to a nonexistent product confirmed
rejected with CHOPZ SHOP's own real error message.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8800) — CHOPZ's own real state now survives a
restart. Live-verified: uploaded a real video, killed the running process,
restarted it, and confirmed the same real state came back from a real GET.
See `dev-docs/phase-4-real-persistence/`.

## Frontend coverage pass (31 Oct 2026)

Audited `public/index.html` against every route `server.js` registers.
Result: 4 of 6 routes were already real frontend clients (`POST
/chopz/videos`, `GET /chopz/videos`, `POST
/chopz/videos/:id/verify-linked-product`, `POST
/chopz/videos/:id/play`, the last from the earlier video-player work).
The two left uncalled are not a gap: `GET /api/health` is an
operational check, not a UI surface, and `GET /chopz/videos/:id`
returns no field the list response (`GET /chopz/videos`) doesn't
already include, so a separate per-item fetch would add a network
call with no new data to show. **No new tab was added** — manufacturing
one here would be coverage theater, not a real gap.

What the audit *did* find, cross-checked against `lib/videos.js` and
the route handlers directly (never guessed): the two already-wired
calls were silently broken.

- **The Post form never sent `mediaUrl`.** `createChopzVideo` (see
  `lib/videos.js`) throws `'createChopzVideo requires a mediaUrl'`
  when it's missing — so every submission of the Post tab's form was
  refused with a 400, every time, since it posted a `caption` field
  instead, which isn't part of the real `ChopzVideo` model and was
  silently dropped by `createChopzVideo` even when present. Fixed: the
  form now has a real `Media URL` field wired to the model's actual
  `mediaUrl`; the fake `caption` field (and the feed's rendering of
  `v.caption`, a field that never existed on a stored video) is gone,
  replaced with the real `mediaUrl` on each card.
- **The verified-product badge checked the wrong field.** `POST
  /chopz/videos/:id/verify-linked-product` returns the real, updated
  video record itself (see the route in `server.js` and
  `verifyLinkedProduct` in `lib/videos.js`), whose real field is
  `linkedProductVerified` — not `verified` or `valid`, which the
  frontend was checking and which never exist on that response. So the
  badge read "product not found" unconditionally, even right after a
  real, successful verification. Fixed: checks `linkedProductVerified`
  directly, and now also surfaces the real verified price
  (`linkedProductPrice`) the verification call stores.

Both bugs were in calls this app already counted as "covered" —
confirming a route is *called* isn't confirming it *works*; this pass
checked the actual payload/response shape against the real handler for
both.

## Engagement: likes, comments, shares (1 Nov 2026)

Closes the first real slice of this project's own flagged "everything
else TikTok's own feed has beyond a bare video record" gap —
deliberately the smallest real slice again, the same scoping
`lib/videos.js`'s own header already used: duets (a real
video-composition feature) and For You ranking (a real recommendation
algorithm) are each their own, separately large builds and stay out
of scope here.

`lib/engagement.js` (new): `toggleLike`/`hasLiked`/`getLikeCount` (a
real toggle — one `(videoId, userId)` pair, liking twice un-likes),
`addComment`/`listComments`/`getCommentCount` (permanent, newest
first), `recordShare`/`getShareCount` (fire-and-forget, deliberately
**not** deduplicated like a like — sharing twice is a second real
share), and `getEngagementSummary` for the combined feed-card shape.

New routes: `POST/GET /chopz/videos/:id/like`, `GET
/chopz/videos/:id/likes` (optional `?viewerId=` to also report whether
that viewer has liked it), `POST/GET /chopz/videos/:id/comments`,
`POST /chopz/videos/:id/share` — `like`/`comments`/`share` all
`requireActor`-gated the same way `/play` already is. `GET
/chopz/videos` and `GET /chopz/videos/:id` now both embed a real
`engagement` object inline, so a feed never round-trips three extra
calls per card just to show its counts.

The frontend (`public/index.html`) gained a like button with a live
count, a share button with a live count, and an expandable comment
list with a real post-a-comment form, on every feed card.

### Verification

`test/engagement.test.js` (new, 10 tests): the toggle behavior, per-
(video, user) scoping, comment ordering/scoping, the fire-and-forget
share count, and the combined summary (including a fresh video's
honest all-zero summary). Full suite: 18/18. Mutation-verified: a
broken toggle-off branch turned exactly the toggle test red; restored
and reconfirmed green. Live-verified against real spawned Shield +
this server: published a video as a real author, liked/commented/
shared it as a real second session, confirmed the counts on both the
single-video and list routes matched, confirmed liking again un-likes
(count back to 0), and confirmed both the no-credential refusal (401)
and the unknown-video refusal (400, honest message) on the real
`/like` route.

## Not yet built
- Duets (real video-composition/response clips) and For You ranking (a
  real recommendation algorithm) — each a separately large build, not
  started.
- Live shopping formats and the four real ad formats named in
  `CHOPZ_TIKTOK_COMPARABLES.md`.
- The VENVM/Storytime engine integration the user's intro message
  asked about — no source material exists anywhere for it yet.
