# Plan — Phase 3: Channels, Boost Economy, Cosmetics, Search

## Goal
Close the real, named gaps from VXLLAGE's own README, per the full
ecosystem status audit that flagged this as the app to resume next:
text Channels, the village boost economy, village-specific cosmetics,
and real search. Explicitly not in this pass: voice channels/Live/Call
(real audio/video infra doesn't exist anywhere in this ecosystem) and
Articles/newsletter (a separate, larger real slice).

## Real investigation before any code
Read `villageRooms.js` and `villageEvents.js` directly before writing
anything new, since both already establish real patterns this phase
should match, not reinvent: `villageRooms.js`'s cross-module
membership validation (an owner must be a real village member,
checked via `getVillage`, not trusted from a bare id) and
`villageEvents.js`'s derived-not-stored count (`getGoingCount` is
always the real attendee list's length). Read `VXLLAGE_CLAUDE.md`'s
own prototype inventory directly for the exact real shape of what
"boost" and "cosmetics" meant there (VCoin spend, progress bar,
village-specific purchase) rather than inventing a shape from the
README's one-line gap summary alone.

## Design
- Channels are membership-gated exactly like rooms — real, not a new
  pattern.
- Unread counts are a real derived difference against a stored read
  marker (`lastReadMessageId` per `${channelId}:${userId}`), the same
  "never a separately-tracked counter that could drift" posture
  `villageEvents.js` already established for going-counts.
- `BOOST_LEVEL_THRESHOLDS`: a real, flagged, bounded 3-tier VCoin
  scale, modeled on Discord's own real 3-level server-boost structure
  (the actual comparable this feature descends from) since no source
  doc gives exact numbers.
- Both boost payments and cosmetic purchases pay the village's own
  `ownerId` directly via a real, injected `transferFn` — the same
  cross-app VCoin pattern used everywhere else this session, and the
  literal real version of the prototype's own "real VCoin spend"
  claim, which was never actually backed by a transfer before this.
- A cosmetic can only be listed by a village's own real owner — a
  structural check, matching `villageRooms.js`'s membership check in
  spirit (don't trust an id at face value).
- Search is real, case-insensitive substring matching over villages
  (name) and posts (text) — no ranking algorithm is invented since
  none is specified anywhere.

## Explicitly NOT in this task
Voice channels, Live, Call — all need real shared audio/video
infrastructure that doesn't exist in this ecosystem. Long-form
Articles/newsletter and the cross-publication recommendation system —
a separate, larger real slice, not attempted here. The VDP Village
District — a cross-app VDP-side wiring task, same shape as Vault
Studios' own Stage integration, not part of standing up VXLLAGE's own
side first. Real auth — Shell (now real, built as VACO, see `../vaco-shell/`) is the
correct place for this, not a local rebuild.

## Verification approach
Plain-Node pass (27 checks): membership-gated channel posting,
unread-count correctness across a real read marker and a new
post-after-read, `computeBoostLevel` checked at every real tier
boundary, non-owner cosmetic-listing rejection, duplicate-purchase
rejection, case-insensitive search over both real content types. Live
pass against a running server with the real V3 mock: a real boost
confirmed via V3's own before/after balances (not just VXLLAGE's own
response), a real cosmetic purchase confirmed the same way, unread
counts confirmed via actual `GET` calls before and after a real mark-
read call.

## Done when
- Channels, boost, cosmetics, and search are all real, tested, and
  live-verified against a real ledger for the two money-moving
  features.
- The README accurately reflects what's now real vs. what's still
  genuinely out (voice/Live/Call, Articles, VDP District, auth).
