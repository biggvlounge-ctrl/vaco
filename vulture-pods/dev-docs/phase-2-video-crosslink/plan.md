# Plan — Phase 2: real video cross-link to Vavlt Stvdios

## Goal
Per explicit instruction: give Vvltvre Pods a real video component
(video podcast episodes) similar to YouTube, connected to Vault
Studios' own real video infrastructure rather than duplicated here.

## Real investigation before any code
Checked Vavlt Stvdios' own real architecture before designing anything
(see `../../vavlt-stvdios/dev-docs/phase-4-vulture-music-pods-video-crosslink/`
for the full investigation) -- its Reel post type has a real,
deliberate 20-minute cap. Unlike a music video, a real video podcast
episode routinely runs 30-90+ minutes -- a genuine, real mismatch, not
a hypothetical one. Rather than silently expanding Vavlt Stvdios' own
constant, the honest choice is to reuse the Reel primitive as-is and
let its own real validation gate what fits, flagging the mismatch
directly in this project's own README.

## Design
`attachEpisodeVideo(store, {episodeId, vaultStvdiosPostId})` in
`lib/episodes.js`, mirroring `vulture-music`'s own `attachMusicVideo`
-- a real, later attach step, independent of an episode's publish
state (a video can attach to a draft or a published episode). Episode
gains `vaultStvdiosPostId: null` by default. One video per episode; a
second attach is rejected.

`server.js`'s new `POST /api/episodes/:id/video` owns the actual
cross-app HTTP call: fetches the episode and its show (for
`authorId: show.creatorId`), POSTs to Vavlt Stvdios' own
`POST /api/posts` (`postType: 'reel'`, `source: 'vulture-pods'`), then
calls `attachEpisodeVideo`. Vavlt Stvdios' own real validation
(including its 20-minute cap) applies as-is; any rejection passes
straight through.

## Explicitly NOT in this task
Any real long-form video host for episodes over 20 minutes -- flagged
directly in this project's own "Not yet built," not silently worked
around. Multiple videos per episode.

## Verification approach
4 plain-Node checks (video attaches to an episode, second attach
rejected, works independent of publish state, missing id rejected). A
live pass across four independently running servers: a real
10-minute video episode attached successfully; a real 45-minute video
episode attempt confirmed rejected by Vavlt Stvdios' own real
validation, proving the real length mismatch is honestly enforced end
to end, not silently bypassed.

## Done when
A real video episode can attach via a real, live cross-app call into
Vavlt Stvdios where it fits, and is honestly rejected (not silently
truncated or faked) where it doesn't.
