# Plan — Phase 1: Multi-Channel Core

## Goal
Stand up Vavlt Stvdios (Vavlt Stvdios) for the first time, scoped
narrowly to the piece explicitly named as "the single biggest
differentiator": the multi-channel architecture (Channel, ChannelChat,
ChannelGroup, ChannelTip). Not the IG layer, not HVNTZ integration,
not the VAGO casino broadcast layer — all confirmed, real, separate
later phases.

## Real investigation before any code
Confirmed via `grep` across the whole ecosystem that Vavlt Stvdios is
referenced by name in 20+ source docs (HVNTZ, VOID, CHOPZ, VDP, VAGO,
and more) but has zero real code anywhere — the same position VACON
was in before this session built it. The IG layer doc's own claim that
Vavlt Stvdios' "spatial multi-camera streaming" is "already
confirmed... as a real, separate, built app" doesn't describe this
codebase. Also confirmed VAGO's own README explicitly flags the
walkable Venus Resort & Casino world as not yet built ("a VENVS/VDP-
side build, not this backend"), and VDP's own world map has no casino
district at all — both reported back before any code was written, per
explicit instruction not to start until confirmed.

## Design
- `GROUPING_TYPES`: a real, deliberate reconciliation of a genuine
  inconsistency between the two source docs — the architecture doc's
  `Channel.groupingType` only lists two values, but the IG layer doc's
  later "global role-based grouping" section needs a real third
  (`same-role-multi-location`). Unified around one real three-value
  enum used by both `Channel` and `ChannelGroup`.
- `Channel.parentGroupId` / `ChannelGroup.memberChannelIds` kept as a
  real single source of truth, updated together in `createChannel`,
  not two arrays a caller has to keep in sync.
- A real structural guard: a channel's `groupingType` must match its
  parent group's own `groupingBasis` — prevents a role-based channel
  from silently ending up in a location-based group or vice versa.
- Every channel gets its own real chat the moment it's created (not
  lazily on first message), per the doc's own "EVERY channel has its
  own independent chat."
- Tips pay `recipientPersonId` directly, never the channel's own
  `ownerId` — the real, defining point of the whole tipping feature
  (the doorman/bartender/DJ example), proven via the transfer call's
  own arguments in verification, not just a stored field.

## Explicitly NOT in this task
Real video/stream infrastructure. The Instagram-style content layer
(`Post`, `LockedContentTier`, `MapSearchListing`, Stories/Reels/
Explore/Notes/Profile Cards). HVNTZ integration. The VENVS/VAGO casino
broadcast layer — depends on this app's own streaming core (this
phase) and VAGO's own visual casino world (confirmed not yet built),
neither of which existed before this phase.

## Verification approach
Plain-Node pass (17 checks): the reconciled grouping enum, real
location-based and role-based groups (including one spanning
genuinely unrelated owners — three DJs at three different real
venues), the groupingType/groupingBasis mismatch guard, a channel with
no group at all, the live/end lifecycle, per-channel chat independence,
tips proven to pay the specific person via the transfer call's own
arguments (not the business), the doorman example proving a real
queryable per-person total, rejection cases. Then a live pass against
the real, independently running V3 mock ledger: a real club group and
two channels (DJ booth, doorman) created, one taken live, a chat
message posted, a real tip sent to the doorman confirmed via V3's own
balance, with the club's own business account independently confirmed
UNCHANGED — proving the per-person payout routing live.

## Done when
- Channels, groups (all 3 types), chat, and tips are all real, tested,
  and live-verified against a real ledger.
- The tip-goes-to-the-person-not-the-business claim is proven, not
  just asserted.
