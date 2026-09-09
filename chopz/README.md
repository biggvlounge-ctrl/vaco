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

## Not yet built
- Everything else TikTok's own feed has beyond a bare video record:
  likes/comments/shares/duets/For You ranking, live shopping formats,
  the four real ad formats named in `CHOPZ_TIKTOK_COMPARABLES.md`.
  This phase deliberately scoped to the smallest real slice: the
  `ChopzVideo` record and its link into CHOPZ SHOP's commerce layer.
- The VENVM/Storytime engine integration the user's intro message
  asked about — no source material exists anywhere for it yet.
