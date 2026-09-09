# Plan — Phase 5: real video cross-link to Vavlt Stvdios

## Goal
Per explicit instruction: give Vvltvre Music a real video component
(music videos) similar to YouTube, connected to Vavlt Stvdios' own
real video infrastructure rather than duplicated here.

## Real investigation before any code
Checked Vavlt Stvdios' own real architecture before designing anything
(see `../../vavlt-stvdios/dev-docs/phase-4-vulture-music-pods-video-crosslink/`
for the full investigation) -- its Reel post type has a real 20-minute
cap. A real music video is almost always well under that (typically
3-8 minutes), so this is a clean fit with no length concerns, unlike
the Pods side.

Also confirmed: `submitRelease` already has `RELEASE_FORMATS` including
`video`, but a real music video most commonly accompanies a `single`
or `album` release (the official/lyric video for a song), not a
standalone video-format release -- so `attachMusicVideo` deliberately
works on ANY release format, not gated to `format === 'video'` only.

## Design
`attachMusicVideo(store, {releaseId, vaultStvdiosPostId})` in
`lib/releases.js` -- a real, later attach step mirroring CHOPZ SHOP's
own `requestFulfillment` pattern (separate from `submitRelease`, not
baked in). `Release` gains `vaultStvdiosPostId: null` by default. One
video per release; a second attach is rejected.

`server.js`'s new `POST /api/releases/:id/video` owns the actual
cross-app HTTP call: fetches the release, POSTs to Vavlt Stvdios' own
`POST /api/posts` (`postType: 'reel'`, `authorId: release.artistId`,
`source: 'vulture-music'`), then calls `attachMusicVideo` with the
real returned post id. Vavlt Stvdios' own real validation (including
its 20-minute cap) applies as-is; any rejection passes straight
through rather than being re-raised as a new error.

## Explicitly NOT in this task
Multiple videos per release. Any change to Vavlt Stvdios' own Reel
validation or cap.

## Verification approach
4 plain-Node checks (video attaches to any format, second attach
rejected, unknown release rejected, missing id rejected). A live pass
across four independently running servers: a real 4-minute music
video attached to a real `single` release, independently confirmed as
a genuine Reel on Vavlt Stvdios' own server (not mocked); a
double-attach confirmed rejected over real HTTP.

## Done when
A real music video can attach to any release via a real, live
cross-app call into Vavlt Stvdios, tested and live-verified.
