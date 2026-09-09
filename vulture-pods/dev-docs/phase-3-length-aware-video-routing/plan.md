# Plan — Phase 3: length-aware video routing

## Goal
Close this project's own Phase 2 "Not yet built" gap: a video episode
over Vavlt Stvdios' real 20-minute Reel cap had nowhere to attach.
Vavlt Stvdios' own new Phase 5 (`lib/videos.js`) adds a real long-form
primitive -- this phase wires this project to actually use it.

## Real investigation before any code
Confirmed Vavlt Stvdios' own new `POST /api/videos` contract and its
real `MAX_VIDEO_DURATION_SECONDS` (12 hours). No change needed on this
project's own data model beyond recording which real Vavlt Stvdios
entity a video episode's `vaultStvdiosPostId` actually refers to --
without that, a bare numeric id wouldn't say which collection to look
it up in later.

## Design
`server.js`'s `postVideoToVaultStvdios` now picks the real endpoint by
the episode's own real `durationSeconds` against
`REEL_DURATION_CAP_SECONDS = 1200` (Vavlt Stvdios' own real Reel cap,
reproduced here as a local constant for the routing decision, same
"real, independently reproduced constant" posture as
`vavlt-stvdios/lib/mapSearch.js`'s own `haversineKm`) -- under it
routes to `/api/posts` (a real Reel), over it routes to `/api/videos`
(a real long-form Video). `lib/episodes.js`'s `attachEpisodeVideo`
gains a required `contentType` (`'reel' | 'video'`) recording which
real entity the id points to, honestly.

## Explicitly NOT in this task
Any change to Vavlt Stvdios' own real caps. Exposing the choice as a
caller-facing option -- the routing is automatic, based on the
episode's own real duration, matching how a real platform would
actually decide this (not asking the uploader to pick a content type
by hand).

## Verification approach
3 plain-Node checks (`contentType` validation, `'reel'` recorded
correctly, `'video'` recorded correctly). A live pass: the exact real
45-minute episode from Phase 2's own live pass, previously confirmed
rejected, now succeeds and is independently confirmed as a genuine
long-form Video on Vavlt Stvdios' own server; a real short episode
created immediately after still correctly routes to and is confirmed
as a genuine Reel.

## Done when
A video episode of any real length can attach to the right real Vault
Studios primitive automatically, and the exact real gap Phase 2 left
open is closed and re-verified live.
