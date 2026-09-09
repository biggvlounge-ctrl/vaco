# Plan — Phase 6: real per-collaborator label deals

## Goal
Close `labelDeals.js`'s own previously-flagged gap: "Multiple
simultaneous per-release label deals recouping against a co-writer
split with a label deal of their own — `applyLabelDeal` only ever runs
against the primary `artistId`'s own share; a co-writer with their own
separate label deal isn't modeled." Part of a broader ecosystem sweep,
confirmed with the user before starting.

## Real investigation before any code
Traced the actual root cause rather than assuming: `signLabelDeal`'s
own per-release branch hard-rejected any `artistId` that didn't
exactly equal `release.artistId`, meaning a co-writer literally
couldn't sign a per-release deal on a release they collaborate on at
all. Separately, `findActiveDealForRelease` matched by `releaseId`
alone with no `artistId` filter -- so even if that block were lifted,
two collaborators' deals on the same release would collide. And in
`releases.js`, the label-deal lookup itself was gated behind
`if (isPrimaryArtist)`, so even a co-writer with a valid, already-signed
blanket deal (blanket deals were never release-restricted) was never
actually checked during `reportStreamingRevenue`.

## Design
Three real, coordinated fixes:
1. `signLabelDeal`'s per-release branch now allows the artistId to be
   the release's primary artist OR any of its real `coWriters`.
2. `findActiveDealForRelease` now filters by both `releaseId` AND
   `artistId`, so each collaborator's own per-release deal is
   genuinely independent -- two co-writers can each hold their own
   deal on the same release without collision.
3. `reportStreamingRevenue`'s label-deal lookup now runs once per
   collaborator in its payout loop (`getActiveLabelDealForRelease(store,
   release.id, userId)` for whichever `userId` the loop is currently
   on), not gated behind `isPrimaryArtist` -- so a co-writer's own
   deal (per-release or blanket) is found and applied against their
   own share, completely independently of the primary artist's own
   deal (or lack of one).

Management commissions deliberately stay primary-artist-only --
unrelated to this gap, and a manager genuinely represents only the
primary artist's career, not every collaborator on their releases.

## Explicitly NOT in this task
Cross-collateralization (a deal recouping across multiple releases
beyond blanket's already-existing "everything this artist releases"
scope) -- a separate, still-flagged gap. Any change to management
commission scoping.

## Verification approach
6 plain-Node checks (a co-writer signing their own deal, a
non-collaborator rejected, two co-writers each recouping independently
on the same report, cross-collaborator isolation confirmed both ways,
a co-writer's blanket deal applying, and duplicate-deal rejection). A
live pass against the real running server and the real standalone V3:
a real two-co-writer release, each signing their own separate
per-release deal, one revenue report correctly recouping both
independently, all four resulting balances (two artists, two labels)
confirmed against V3's own ledger.

## Done when
A co-writer's own label deal is genuinely, independently modeled and
applied, confirmed by both isolated and live tests, and the README's
own "Not yet built" list no longer names this gap.
