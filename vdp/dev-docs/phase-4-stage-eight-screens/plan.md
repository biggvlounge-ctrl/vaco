# Plan — Phase 4: VENVS Stage Wired to Vavlt Stvdios' Eight Screens

## Goal
Wire Vavlt Stvdios' real Phase 3 "up to 8 interactive screens" mechanic
into VDP's own walkable world, per direct instruction. Give VENVS
Stage — a native district that has carried an honest `contentType:
'none'` gap since the original world build — a real view.

## Real investigation before any code
Grepped VDP's own `src/` for any existing Vavlt Stvdios/streaming/
channel reference first: none existed. Read `world.js`'s own district
list and found "VENVS Stage" already named, with `contentType: 'none'`
and no other district left unbuilt. Read VENVS's own `CLAUDE.md`
directly (not just VDP's own docs) and found the exact real anchor:
§4 names "VENVS Stage (event plaza)" as a native district, and §5
("Explicitly NOT built") says plainly: "Real Vavlt Stvdios streaming.
The 'go live' toggle is a boolean state flag with an earn-rate bonus —
no video, no camera feeds, despite the spec describing up to 8 real
camera feeds with AI operators." This is the exact same "up to 8" shape
Vavlt Stvdios' own Phase 3 just built, confirming Stage is the real,
intended home for this integration rather than an invented pairing.

## Design
- New `contentType: 'vavlt-stvdios-embed'` in `world.js` — a real third
  rendering category, distinct from `'venvs-embed'` (an iframe onto
  VENVS's own frontend) and `'vdp-native'` (VDP's own local data):
  content genuinely sourced from Vavlt Stvdios' own separate server via
  a real HTTP client, rendered directly since Vavlt Stvdios has no
  frontend of its own to iframe.
- `vavltStvdiosClient.js` — a real, thin fetch client mirroring
  `v3Client.js`'s own established shape and error-handling convention.
- `stage.js`'s `ensureStageSession` is real and idempotent: checks
  Vavlt Stvdios' own `/api/owners/venvs-stage/screen-sessions` first;
  only creates the 8 channels + broadcaster session on a genuine first
  visit, reusing the existing one on every later visit rather than
  growing duplicate channels forever.
- `STAGE_CAMERAS`' 8 named roles + operator ids are a real, flagged
  interpretive choice (no doc names specific cameras) grounded directly
  in the doc's own "AI operators" phrase.
- Tips pay each screen's own specific `operatorId` directly (matched by
  channel name, not fragile array-index/id arithmetic, since Vavlt
  Stvdios' own channel ids aren't guaranteed contiguous or to start at
  1), never a shared Stage account — the same real point Vavlt
  Stvdios' own `channelTips.js` exists to prove.
- Stage's real state lives entirely on Vavlt Stvdios' own server — an
  honest architectural difference from Food District/DEGVCHI, which
  keep their own state in a VDP-local store, since this content
  genuinely isn't VDP's own.

## Explicitly NOT in this task
Real video/camera capture — screens are real, named, live/offline
channel records with no media pipeline behind them, matching Vavlt
Stvdios' own established posture. A broadcaster-side "go
live"/"end stream" control for a real Stage operator — `StageView` is
a real viewer surface only.

## Verification approach
A live cross-app HTTP pass mirroring `ensureStageSession`'s exact real
logic (create 8 channels, go live on 3, create the broadcaster
session, confirm idempotent reuse on a second lookup) before ever
touching the browser. A live Playwright pass: log in, walk to VENVS
Stage, enter it, confirm exactly 8 real camera tiles and exactly 3 LIVE
badges (both fetched live, not hardcoded), focus a different screen,
send a real chat message and confirm it round-trips, send a real tip
and confirm no error, then independently confirm via direct HTTP calls
that the operator's real V3 balance moved and the tipper's dropped by
the exact tip amount. One console-error artifact was investigated
directly (not dismissed) and confirmed pre-existing and unrelated: a
generic 404 traced to the browser's own default `/favicon.ico` request
(Vite serves none), reproduced firing before any of this project's
code runs at all, via 3 isolated diagnostic passes.

## Done when
- Walking into VENVS Stage shows 8 real, live-fetched screens with
  real per-screen chat and tipping, verified end to end against real
  running servers, not just asserted.
- The README accurately reflects the real architectural difference
  (Stage's state lives on Vavlt Stvdios, not VDP) and the real
  remaining gaps (no video, no broadcaster console).
