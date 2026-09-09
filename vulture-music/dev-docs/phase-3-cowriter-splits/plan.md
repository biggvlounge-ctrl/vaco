# Plan — Phase 3: co-writer/collaborator royalty splits

## Goal
Close the README's own previously-flagged gap: "Co-writer/collaborator
royalty splits on a single release — every release here has exactly
one `artistId`; a real multi-party split (common on real collaborative
releases) isn't modeled."

## Real investigation before any code
Read `lib/releases.js` in full: `reportStreamingRevenue` currently
pays 100% (minus an optional management commission) to a single
`release.artistId`. No multi-party concept exists anywhere. This
module's own cited real comparables are DistroKid and TuneCore —
DistroKid specifically has a real, well-known feature named "Splits":
the uploader adds every collaborator with a percentage, the total must
equal exactly 100%, and each collaborator is paid directly by
DistroKid, not routed through the uploader. That's the real mechanism
this phase builds toward.

## Design
`Release` gains an optional `coWriters: [{ userId, splitPercent }]`.
`validateCoWriters` enforces the real DistroKid rule: every entry has
a unique `userId`, every `splitPercent` is in `(0, 1]`, and the sum
equals exactly 1 (within float tolerance). Omitting `coWriters` keeps
the original single-payee behavior byte-for-byte — it defaults to a
single implicit `{ userId: artistId, splitPercent: 1 }` entry.

`reportStreamingRevenue` now loops the real `coWriters` list, paying
each collaborator their own real share directly. Rounding discipline
matches this session's other multi-way splits (CHOPZ SHOP's
`createOrder`): every share but the last is rounded independently, the
last absorbs the remainder, so payouts always sum to exactly the
reported `amount`. A management deal (`lib/managers.js`) applies only
to the primary `artistId`'s own resulting share — collaborators have
no relationship with that manager at all.

`getArtistSummary` is corrected to reflect only the artist's own real
`grossShare`/`netShare` from each report's `payouts`, not the full
release amount — honest under a real split. A new
`getCollaboratorEarnings(store, userId)` is the real, necessary
addition for a collaborator who isn't a release's own `artistId`: they
never appear in `listReleasesForArtist`, so this scans every real
report's `payouts` across all releases to find them.

## Explicitly NOT in this task
Label-level deal shapes (advances, recoupment, per-release vs. blanket
deals) — a real, different, still-flagged gap. A manager's commission
on income streams other than streaming revenue — still out of scope
per the existing README bullet.

## Verification approach
8 plain-Node checks. A live pass against the real running server and
V3 mock: a real 3-way-split release, a real management deal on the
primary artist, real streaming revenue reported — V3's own live
balances confirmed exactly for all four real accounts (artist,
producer, featured collaborator, manager), proving the manager's
commission never touched the other collaborators' shares. The real
`/api/collaborators/:userId/earnings` endpoint confirmed finding a
non-owning collaborator, and an invalid-split submission confirmed
rejected over real HTTP.

## Done when
Real, multi-party royalty splits exist, grounded in DistroKid's own
real named "Splits" feature, tested and live-verified against the
actual running server, with no change to existing single-payee
behavior.
