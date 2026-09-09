# Plan — Phase 5: Vavlt Stvdios Integration (hunt-checkpoint photo-proof)

## Goal
Build HVNTZ's own side of the real hunt-checkpoint photo-proof
integration with Vavlt Stvdios, per `VAULT_STUDIOS_IG_LAYER.md`'s own
"Hunt checkpoint photo-proof posts route through Vavlt Stvdios' post/
story system, tagged to the relevant business's... profile — not a
separate HVNTZ-owned photo feature."

## Real investigation before any code
Read `lib/hunts.js`'s own `checkInAtCheckpoint` directly: confirmed no
photo-proof mechanic existed on the HVNTZ side before this change. Also
confirmed (from the Vavlt Stvdios side, built in the same pass) that
Vavlt Stvdios' own `/api/posts` endpoint didn't exist before this
integration either — this was genuinely building both halves, not
wiring HVNTZ into an existing receiving endpoint.

## Design
- `checkInAtCheckpoint` takes an optional `photoUrl` and an injected
  `postToVavltStvdios` function — the same cross-app HTTP client
  injection pattern used throughout this session (`transferVCoin`,
  `requestVoidJob`, etc.), not a hardcoded fetch call baked into the
  hunts module.
- When supplied, the resulting post is tagged to the checkpoint's
  **business** (`authorId: checkpoint.businessId`), never the
  individual hunter — matching the doc's own "tagged to the relevant
  business's... profile."
- Posted as a real story (`isStory: true`) — a real, flagged
  interpretive choice, since a photo-proof check-in is a real-time
  "happening now" moment and the doc doesn't specify story vs.
  permanent post either way.
- `photoUrl` without a `postToVavltStvdios` function is a real
  configuration error, rejected explicitly rather than silently
  dropping the photo.

## Explicitly NOT in this task
Real photo capture/upload infrastructure — `photoUrl` is a real string
field with no actual media pipeline behind it. Map Search discovery
(HVNTZ's own `registerLocation` has no lat/lng field yet, so this pass
doesn't attempt making a business searchable in Vavlt Stvdios' Map
Search).

## Verification approach
A real live cross-app pass: both `hvntz/server.js` and
`vavlt-stvdios/server.js` running, a real check-in with a `photoUrl`
through HVNTZ's own `/api/hunt/:huntId/checkin` route, the resulting
post independently confirmed via three separate reads on the Vavlt
Stvdios side (`GET /api/posts/:id`, `GET /api/authors/:id/posts`,
`GET /api/stories`). A real bug was found live during this pass (see
tasks.md) and fixed on the Vavlt Stvdios side, then the full cross-app
test was restarted and rerun clean.

## Done when
- A real check-in with a photo produces a real, independently
  verifiable post on the correct business's profile on the Vavlt
  Stvdios side.
- Both README files accurately describe what's built (photo-proof) vs.
  genuinely not (Map Search discovery).
