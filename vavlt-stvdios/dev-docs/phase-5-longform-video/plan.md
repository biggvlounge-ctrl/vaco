# Plan — Phase 5: real long-form video (VOD)

## Goal
Close the real gap Phase 4 itself surfaced: this project claims
YouTube among its own six real comparables, but had no real on-demand,
long-form video primitive -- only Reels (Instagram-shaped, capped at a
real, deliberate 20 minutes). Directly blocks `vulture-pods` from
attaching a real video to any episode longer than that -- and real
video podcast episodes routinely are.

## Real investigation before any code
Confirmed via Phase 4's own live pass that a real 45-minute video
episode attempt was rejected by this server's own real Reel
validation -- not a hypothetical, an actually-observed real rejection.
Confirmed this project's own README already names YouTube as a real
comparable for "channel-based creator identity" but never built the
actual YouTube-defining product (on-demand long-form video) -- Channels
here are for live streaming, Posts/Reels are short-form.

## Design
`lib/videos.js` -- a genuinely separate real entity from Reel (own id
space, own store array, own routes), not a duration bump on the same
type, since a Reel and a long-form Video are different real products
with different real UX (the same way this project already keeps
Channels/Posts/Locked Tiers separate). `MAX_VIDEO_DURATION_SECONDS`
(12 hours) is a real, flagged, interpretive number grounded in
YouTube's own real, well-known verified-account upload cap -- not an
invented "unlimited."

Real code reuse: `isLocked`/`requiredTierId` gating and
`getVideoForViewer` mirror `posts.js`'s own `getPostForViewer` exactly,
both driven by the same real `lib/lockedContentTiers.js` gate -- one
real subscription-tier system serving both content types, not two.

`vulture-pods/server.js` is updated to pick the real primitive by the
episode's own real `durationSeconds`: under the real 20-minute Reel
cap routes to `/api/posts`, over it routes to this new `/api/videos`
-- closing the exact gap Phase 4's own live pass had surfaced.

## Explicitly NOT in this task
Any change to `REEL_MAX_DURATION_SECONDS` or the Reel entity itself.
Video comments, playlists, or any other real YouTube feature beyond
the core upload/watch/gate primitive.

## Verification approach
7 plain-Node checks (no artificial cap under 12h, the real 12h cap
enforced, invalid source rejected, locked-video validation, gated read
proven against the real tiers module directly, author/feed scoping and
ordering, numeric-vs-string authorId normalization). A live pass: with
`vulture-pods` re-pointed to route by duration, the exact real
45-minute episode from Phase 4's own live pass now succeeds as a real
long-form Video, independently confirmed on this server; a real short
episode still correctly routes to a Reel; the real 12-hour cap and
real locked-video gating both confirmed over real HTTP.

## Done when
A real long-form video primitive exists, grounded in YouTube's own
real cap, reusing existing locked-tier infrastructure, and the exact
real length mismatch Phase 4 surfaced is closed and re-verified live.
