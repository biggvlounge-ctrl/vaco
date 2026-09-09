# Plan — Phase 2: Content Layer + HVNTZ Integration

## Goal
Build the real Instagram-style content layer named as Phase 2 in the
Phase 1 plan: `Post` (photo/reel/carousel/story/locked),
`LockedContentTier`, `MapSearchListing`, Follows, Notes, Highlights,
Profile Cards — plus the real HVNTZ side of the integration
(hunt-checkpoint photo-proof posts) that Phase 1 explicitly deferred.

## Real investigation before any code
Checked `hvntz/lib/hunts.js`'s own `checkInAtCheckpoint` directly:
confirmed it had no photo-proof mechanic at all before this change, on
either side — meaning the "HVNTZ integration" `VAULT_STUDIOS_IG_LAYER.md`
describes required building both this app's own `/api/posts` endpoint
AND HVNTZ's own caller-side wiring, not just one half.

## Design
- `postType` (`photo`/`reel`/`carousel`) added beyond the architecture
  doc's own four `Post` fields — without it a 20-minute reel and a
  single photo would be structurally indistinguishable, and the IG
  layer doc explicitly wants both.
- `storyExpiresAt` defaults to a real 24-hour window — the doc
  discusses removing Stories' per-segment length cap but never states
  a total display lifetime, so the well-established real Instagram
  convention is used as a grounded default, not invented from nothing.
- `getPostForViewer` withholds `mediaUrl`/`mediaUrls` for a locked post
  the viewer hasn't subscribed to, mirroring VACAY Homes' own
  `getLeadForAgent` contact-info gating pattern.
- `lockedContentTiers.js`'s `subscribeTier` fires two real `transferFn`
  calls (80% creator, 20% platform) that together sum to exactly
  `priceVCoin`, rather than one combined transfer a caller has to trust
  was split correctly internally.
- `getExplorePosts` is honestly chronological among non-followed
  authors, not full engagement ranking — flagged directly in the code
  and the README rather than passed off as the doc's full spec.
- HVNTZ's own `checkInAtCheckpoint` takes an optional `photoUrl` +
  injected `postToVavltStvdios`, posting to the checkpoint's
  **business** profile (`authorId: checkpoint.businessId`) as a real
  story — matching the doc's own "tagged to the relevant business's...
  profile," using this session's established cross-app HTTP client
  injection pattern.

## Explicitly NOT in this task
Real video/photo capture infrastructure. Real AI-generated interactive
stickers, real-time story comments. An actual rendered QR image behind
`ProfileCard.qrCodeUrl`. HVNTZ's own Map Search wiring (its
`registerLocation` has no lat/lng field yet). The VENVS/VAGO casino
broadcast layer. Kevin's date-planning concierge extension (a CVNVO/V4
change).

## Verification approach
Plain-Node pass (14 checks after one 32-check pass surfaced a
test-data-setup bug, not an app bug — see tasks.md): post-type
validation, gated-content reveal in both directions, Feed/Stories/
Reels/Explore partitioning proven via a real follow graph, Highlights'
ownership/story-only guards, Notes expiry, Haversine sanity check.
Live HTTP pass against a running server: the real 80/20 split proven
against V3's own live balances (25 → 20/5), locked-media visibility
flipping before/after subscription, map search radius/category
filtering, profile card upsert. Live cross-app pass with HVNTZ's own
running server: a real check-in with a photo creating a real post
tagged to the business, independently confirmed via three different
read endpoints — this is where the real `authorId` type-mismatch bug
(HVNTZ's numeric `businessId` vs. Express's always-string route
params) was found and fixed, then re-verified via a full restart-and-
rerun of the same cross-app test plus a full re-run of the Phase 2
suite.

## Done when
- All six Phase 2 modules are real, tested, and live-verified,
  including against a real ledger for the tier-subscription split.
- HVNTZ's own side of the photo-proof integration is real and
  live-tested end-to-end, not just this app's receiving endpoint.
- The README accurately reflects what's built vs. genuinely still
  missing (Map Search's HVNTZ-side wiring, real capture infra, AI
  stickers/live comments).
