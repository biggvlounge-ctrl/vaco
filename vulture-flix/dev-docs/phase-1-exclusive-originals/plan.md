# Plan — Phase 1: Exclusive Originals

## Goal
Start Vvltvre Flix built specifically against its real, named
comparable: the Netflix Originals model, for its real exclusive-
content strategy (explicitly named by the user alongside DistroKid/
TuneCore/gamma. for Vvltvre Music, and Cameo/Eventbrite/etc. for VOID
MAGIC — each Vvltvre division grounded in its own real comparables,
not a generic build).

## Design
- The defining real contrast with `../vulture-music/`: Netflix
  Originals is the economic opposite of DistroKid/TuneCore. Vvltvre
  Music lets the artist keep ownership + all ongoing revenue for a
  flat distribution fee; Vvltvre Flix has the platform **acquire**
  exclusive rights via a real, one-time payment TO the creator, with
  no ongoing per-view royalty after that. `ownershipRetainedPercent: 0`
  on every title is the deliberate mirror of Vvltvre Music's own `100`.
- `acquisitionFee` is caller-supplied per title, not a fixed schedule
  — real Original deals are individually negotiated per project
  budget, unlike Vvltvre Music's real flat per-format rate card.
- Access is subscription-gated, never per-title — the other real,
  defining Netflix mechanic. `watchTitle` moves zero money; the
  creator was already paid in full at acquisition.
- `isExclusive` is date-driven and computed, not a stored status — the
  real "leaving soon" Netflix UX mechanic, distinct from the
  action-driven `acquired → streaming → removed` lifecycle.

## Explicitly NOT in this task
Licensed non-exclusive content (a real, distinct Netflix content
category). Any UI. Real video delivery. Viewership-bonus/backend
participation clauses some real deals include on top of the flat fee.
Multiple subscription tiers. Co-production/multi-studio acquisitions.

## Verification approach
Plain-Node pass (24 checks): subscription gating (including a
non-subscriber rejected from an already-streaming title), the real
monthly charge, cancel/reactivate, acquisition proven paying the
creator via the transfer call's own arguments (not just a stored
field), validation, the full lifecycle including illegal transitions,
watching correctly blocked pre-streaming and post-removal, a real
watch event with **zero** money moved (proven via an empty
transfer-call log on that specific call), catalog/creator listing.
Then a live pass against the real, independently running V3 mock
ledger: a title acquired with the studio's real balance confirmed
increasing by the acquisition fee (platform → creator, the real
inverse of Vvltvre Music's flow), a viewer correctly blocked from
watching before subscribing, the real monthly subscription charge
confirmed via V3's own balance, then a successful watch confirmed to
move zero additional money.

## Done when
- The acquisition payment direction (platform → creator) and the
  subscription-only access gate are both proven against a real, live
  V3 ledger, not just asserted in isolation.
- A watch action is proven to move zero money.
- The real economic contrast with Vvltvre Music is documented, not
  just implemented silently.
