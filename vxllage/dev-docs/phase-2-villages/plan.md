# Plan — Phase 2: Villages (deliberately lighter, secondary)

## Goal
Build the Villages layer §0 explicitly calls for keeping ("the
channel/event/member/boost concepts are worth keeping") while
genuinely shrinking it relative to the prototype's own full nested
six-tab depth ("shouldn't be structured as a bigger, richer app than
the Home feed"). This phase deliberately scopes to real membership,
real events/RSVP, and real permanent creator-owned rooms only —
Channels, Shop/boost economy, and the procedurally-generated
leaderboard are left for a later phase, not ported over at prototype
depth.

## Design
- `lib/villages.js`: real membership with two roles only (owner,
  member) — a deliberately smaller role model than the prototype's
  owner/mod/member, matching the "shrink" instruction rather than
  porting that depth over. The owner is auto-added at creation and
  structurally cannot leave their own village (a real constraint, not
  just a UI affordance).
- `lib/villageEvents.js`: real RSVP, with the going-count as a
  genuinely *derived* value (the real attendee list's length) rather
  than a separately-tracked counter that could desync from reality —
  an improvement over the prototype's own "RSVP toggle... generates a
  going-count increment," which implies a separate counter.
- `lib/villageRooms.js`: real permanent, creator-owned rooms modeled
  directly on Clubhouse's actual Clubs feature per
  VXLLAGE_VDP_VILLAGE_DISTRICT.md, including real support for a
  recurring scheduled slot. Real cross-module validation: a room's
  owner must be a genuine member of the parent village, checked
  against `lib/villages.js`'s own membership data, not a bare id
  trusted at face value.

## Explicitly NOT in this task
- Channels (text/voice), the boost economy, cosmetics shop, and the
  procedurally-generated members leaderboard — all real prototype
  features, deliberately deferred rather than ported at full depth,
  per §0's own "shrink" instruction. Worth building later, lighter.
- No VCoin/V3 integration — the boost economy is exactly the piece
  that would need it, and it's deferred.
- No actual live audio/video for the Clubhouse-style rooms — this
  phase only builds real room existence and real live-participant
  membership tracking, not real media.
- The VDP Village District itself (the walkable multi-room space
  inside VENVS/VDP) — a VENVS-side build, not this backend; this phase
  only builds the real data model (`VillageRoom`) that district would
  eventually read from.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 14
checks, all passed clean on first run): real owner auto-membership at
creation, a structural rejection of the owner leaving their own
village, idempotent join/RSVP/room-join behavior throughout, and the
real derived going-count checked directly against the attendee array
rather than trusted as a separate field. Then a live pass:
`vxllage/server.js` alone — a village created and joined, an event
RSVP'd by two real users with the derived going-count confirmed via
`GET`, and a permanent creator-owned room created and joined, all
against the actual running server.

## Done when
- Village membership, roles, and the owner-cannot-leave constraint are
  all real and enforced.
- Event RSVP is real and idempotent; going-count is provably derived,
  not a separate, driftable counter.
- Room ownership is validated against real village membership, not
  trusted from a bare id.
- Live: the same behaviors confirmed against the actual running
  server.
