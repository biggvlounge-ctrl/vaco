# Plan — Phase 2 (seventh slice): Media

## Goal
Section 13's real named add-ons: MAGIC PHOTO, MAGIC VIDEO, MAGIC
MEMORY -- "This becomes another revenue stream."

## Design
- `lib/media.js`: a real `MediaOrder { id, bookingId, type, price,
  status, assetUrl, orderedAt, deliveredAt }`. `orderMedia` charges
  the buyer into the same real escrow account `bookings.js` already
  established (imported, not duplicated); `deliverMedia` pays a real
  host+platform dual payout at the same `PLATFORM_TAKE_RATE`, but only
  at delivery, mirroring the core loop's own "pay at settlement, not
  at purchase" shape.
- Honest, no-fake-media stance: `deliverMedia` requires a real,
  non-empty `assetUrl` supplied by the caller -- this module never
  generates a photo, video, or any synthesized content itself, the
  same standing rule already applied to VXLLAGE/CHOPZ's own
  `mediaUrl` fields.
- MAGIC MEMORY's own real gate: the doc calls it a "Post-event
  experience package," so both ordering a `magic-memory` type and
  assembling the package (`getMagicMemoryPackage`) require the
  booking to have actually completed -- unlike photo/video, which are
  purchasable any time after booking.
- `getMagicMemoryPackage` assembles real, already-existing data
  (the same receipt fields `getPostEventSummary` already surfaces)
  plus whichever real, delivered (not just ordered) media assets exist
  for that booking -- an honest bundle, not synthesized content.

## Explicitly NOT in this task
Real photo/video capture, upload, or storage infrastructure -- this
module tracks and settles real orders against a real, externally-
supplied asset URL, it does not host or generate media.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 27
checks total, shared with the Geofencing slice below since both landed
in one pass): magic-memory rejected pre-completion; a real order
charges the buyer into escrow at order time; invalid type rejected;
delivery rejects an empty assetUrl; delivery pays the real host/
platform split (verified against the exact percentages) only at
delivery, not order time; escrow drains back to exactly zero (within
float tolerance); double-delivery rejected; the memory package
correctly assembles real receipt data plus only the real *delivered*
assets, excluding the still-undelivered memory order itself. Then a
live pass: a real magic-photo order, delivery, and the resulting
magic-memory package all confirmed against the actual running server
and the real V3 mock ledger, escrow returned to precisely its starting
balance.

## Done when
- Order and delivery both settle real money correctly, only at the
  right step.
- MAGIC MEMORY's post-event gate and package assembly are both proven
  correct against real, live data.
