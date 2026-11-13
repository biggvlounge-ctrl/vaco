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

**Still missing, still flagged, corrected reasoning (5 Nov 2026)**: real
source *does* document VENVM's Storytime engine —
`venvm/VENVM_INTERNAL_OPERATING_SYSTEM_EXPANSION.md` (item 5, "CHOPZ
Storytime Engine (VENVM-powered)") and
`venvm/VENVM_MARKETING_DTC_CAPABILITIES.md` both describe a real
Script → AI Scene Builder → Voice → Character Gen → Animation →
Publishing pipeline. Checked directly rather than assumed: that same
doc's own "Implementation status" table says only one of its four
synthesized capabilities is real (`venvm/lib/scriptEngine.js`, short-
form video scripts) — Photo-Grounded Scene Generation, AI Human Twin
generation, and Gaussian Splatting are each its own "Not built," named
against real external services (Seedance 2.5, Kling 3.0, Runway
Gen-4.5, Nerfstudio 3DGS, Sudowrite's Muse model) this environment has
no access to. The real reason this integration isn't built here is
this ecosystem's standing no-fake-media-generation stance, not a
missing spec.

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

**Addition (13 Nov 2026), checked directly against `server.js` rather
than assumed from the paragraph above**: this section described the
file-backed path only, but `server.js` no longer builds its store with
`createPersistentStore` directly — it boots through
`lib/storeBackend.js#attachStore`, a later, ecosystem-wide addition
(its own header: wired into "every real app in this ecosystem that
holds meaningful mutable state"). Without `DATABASE_URL` set, nothing
above changes — same file, same guarantees. With it set, the store
instead lives in Postgres via `lib/persistencePg.js`, behind a gate
that holds every request until the store has actually loaded, and the
process exits rather than serving against a store that never loaded.
This real capability already existed in the code; it was never
written down here until now.

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

## Duets (5 Nov 2026)

Closes this project's own flagged "Duets (real video-composition/
response clips)" gap, with the honest limitation stated up front: a
real TikTok Duet's split-screen composition happens client-side, on
the real app, before upload. By the time it reaches TikTok's own
servers it is already one ordinary video file. This app has no real
video-composition pipeline (consistent with `vaco-media`'s posture
across this whole ecosystem) and does not fabricate one — a Duet here
is an ordinary `ChopzVideo`, plus one new, real, honest relationship
field (`duetOfVideoId`).

**Validated synchronously, unlike `linkedProductId`.** `linkedProductId`
references CHOPZ SHOP, a genuinely separate app, so this project
deliberately defers that check. `duetOfVideoId` references this same
app's own local store, so there is no reason to defer it — it is
checked against a real existing video the same way any other local
foreign-key reference in this codebase is, and a duet of an unknown
video is refused outright, storing nothing.

`lib/videos.js` gained `getDuetsOf` (every real video that duets a
given one, newest first — the real "View X duets" feature). New route:
`GET /chopz/videos/:id/duets`. `GET /chopz/videos` and `GET
/chopz/videos/:id` both now embed a real `duetCount` alongside
`engagement`, same inline-shape discipline as everything else a feed
card needs in one call.

The frontend gained a "duet of #N" badge on a duet's own card, a real
duet count/list toggle (the same pattern comments already use), and an
inline "Post duet" mini-form that posts a new video with
`duetOfVideoId` set — no cross-tab state plumbing, the duet happens
right on the original's own card.

### Verification

`test/videos.test.js` grew by 5: a fresh video's honestly-null
`duetOfVideoId`; a real duet recorded and retrievable both directions;
duetting an unknown video refused with nothing stored; `getDuetsOf`
ordering newest-first and correctly scoped (not leaking another
video's duets); and an honest empty list for a video with none. Full
suite: 34/34 → 39/39. Mutation-verified: replacing the existence
check with `if (false)` turned exactly the "duetting a video that
does not exist" test red (12/13 in that file); restored, 39/39 green
across the full suite.

Live-verified against a real spawned Shield + this server: posted a
real original video as one real creator, posted a real duet of it as
a second real creator, confirmed `GET /chopz/videos/:id/duets`
returned exactly that one real duet, confirmed a duet naming a
nonexistent video id was refused (400, honest message, nothing
stored), and confirmed the real video list reported `duetCount: 1` on
the original and `0` on the duet itself.

## For You ranking (5 Nov 2026)

Closes this project's own flagged "For You ranking (a real
recommendation algorithm)" gap — the one piece `lib/engagement.js`'s
own header deliberately left out as separately large.

**What this honestly is, and is not.** TikTok's own real ranking is
proprietary; its public "How TikTok recommends videos For You"
explainer names real signal categories (completion rate strongest,
then comments/likes/shares/plays) but publishes no numeric weights —
there is nothing to cite beyond the signal *names*. `lib/forYou.js`'s
own header says so plainly: this is a real, deterministic, stated
heuristic over this app's own real data, not a reconstruction of
TikTok's secret formula, and it does not invent a completion-rate
signal this app has no real watch-duration data for.

**A real fourth engagement signal added first: plays.** `lib/
engagement.js` gained `recordPlay`/`getPlayCount`, wired into the
existing `POST /chopz/videos/:id/play` route — but only in the branch
where a real, ready playback credential was actually handed out,
never on a bare click against unregistered media. `getEngagementSummary`
now reports `playCount` alongside the other three.

**The ranking itself (`lib/forYou.js`):**
- `computeEngagementScore` — a weighted sum (play 1, like 3, comment 5,
  share 8). The ordering (rarer, higher-effort actions count more) is
  the real, stated principle; the exact numbers are this file's own
  chosen heuristic, said so directly rather than dressed up as a
  citation.
- `computeRecencyMultiplier` — a real 48-hour half-life decay, never
  reaching zero, so a video with enormous real engagement can still
  outrank a brand-new one.
- `computeAffinityMultiplier` — a signed-in viewer's own real prior
  likes/comments/shares/plays on a creator's *other* videos (the video
  being scored is always excluded, so a video can never be boosted by
  the viewer's own interaction with that same video) lift that
  creator's new videos, bounded at 2×. No follow mechanism exists in
  this app, so this is derived entirely from the viewer's own real
  interaction history, not an invented social graph. An anonymous call
  (no `viewerId`) gets exactly 1× — no personalization, not a fabricated
  default history.
- `getForYouFeed` — scores every video, sorts by score then by
  `createdAt` (a deterministic tie-break, not array order).

**One honest, named limitation.** A video with zero real engagement
scores exactly zero and sorts last, regardless of age — there is no
cold-start/exploration mechanism (TikTok's real one seeds a new video
to a small test audience first). That is a real, separate, larger
mechanism this file does not claim to solve.

New route: `GET /chopz/for-you` (`?viewerId=` optional,
`?limit=` optional, default 20). The frontend gained a "For You" tab
(`public/index.html`), sharing the exact same per-video card the Feed
tab already used (refactored into `buildVideoCard` so the two views
cannot drift apart) plus a real score badge and a "you like X" badge
when the real affinity multiplier is above 1.

### Verification

`test/forYou.test.js` (new, 14 tests) plus 2 new tests in
`test/engagement.test.js` for the play primitive. Full suite: 18/18 →
34/34. Mutation-verified both of the riskiest lines independently:
removing the self-exclusion in the affinity lookup (`v.id !==
excludeVideoId` → `true`) turned exactly the two tests that check it
red (12/14 passing); restored, 14/14 green. Replacing the recency
decay formula with a flat `1` turned exactly the half-life test red
(13/14 passing); restored, 34/34 green across the full suite.

Live-verified against a real spawned Shield + this server: created two
videos by different real creators, gave one two real shares (score 16)
and left the other at zero (score 0) — confirmed the engagement-only
feed ranked them correctly. Gave a real viewer a real like + comment on
one creator's video, then posted that same creator a second, newly
shared video — confirmed the real personalized feed's affinity
multiplier read exactly 1.05/1.10 (1 + 0.05 × 1 and × 2 real prior
interactions respectively, cross-checked by hand), still correctly
ranked below a much more heavily-engaged stranger's video rather than
unrealistically leapfrogging it. Confirmed a `/play` call against a
video with no real registered media asset recorded no play at all
(`playCount` stayed 0) — the honest negative path, not a fabricated
count.

## Not yet built
- ~~Duets (real video-composition/response clips)~~ **Done (5 Nov
  2026), with one honest limitation stated directly rather than
  faked — see "Duets" below.** This app has no real split-screen
  video-composition pipeline, and never pretends to; a real Duet's
  composition happens client-side on the real TikTok app before
  upload, so this closes the real, local relationship a Duet actually
  is at the data layer, not a fabricated rendering step.
- ~~For You ranking (a real recommendation algorithm)~~ **Done (5 Nov
  2026) — see "For You ranking" below.**
- ~~Live shopping formats...~~ **The live-shopping half is done, but
  in CHOPZ SHOP, not here (13 Nov 2026) — checked directly rather than
  left stale.** `chopz-shop/README.md`'s own "Live Shopping Events"
  section and `chopz-shop/lib/liveShoppingEvents.js` are real: a
  seller can schedule a live shopping event against a real, verified
  Vavlt Stvdios channel they own, with real featured products and a
  real checkout attribution. Live shopping is a commerce feature —
  per this same file's own naming-collision section above, commerce
  lives in CHOPZ SHOP, not in this video/social app — so there is
  nothing left on *this* app's side of that gap. The four real ad
  formats named in `CHOPZ_TIKTOK_COMPARABLES.md` are still not built
  anywhere in this pair of apps; `chopz-shop/README.md`'s own "Not yet
  built" section already names the real reason (no existing
  seller-to-VENVM-brand onboarding seam) and declines them outright,
  rather than leaving it an open question.
- The VENVM/Storytime engine integration the user's intro message
  asked about — real source material exists (see above), but building
  it would mean fabricating the AI scene/character/animation generation
  this ecosystem's real external-service integrations don't actually
  have here, not inventing a spec from nothing.
