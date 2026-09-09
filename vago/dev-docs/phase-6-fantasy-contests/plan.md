# Plan — Phase 6: Fantasy Contests (DraftKings Pick6 model)

## Goal
Close the README's own previously-flagged gap: "Fantasy contests...
later work." `VAGO_COMPARABLES.md` names the exact real mechanism to
build toward directly: "DraftKings Pick6 is... a peer-to-peer daily
fantasy product, not house odds... the direct precedent for VAGO's
fantasy-contest-style predictions specifically."

## Real investigation before any code
Confirmed via direct question from the user that VAGO already has
real Kalshi (`predictionMarkets.js`) and DraftKings/FanDuel sportsbook
(`sportsbook.js`) comparables built, but fantasy specifically was
still open — matching the README's own "Not yet built" list exactly.

Real DraftKings Pick6 mechanics (well-known, public): players build an
entry from 2-6 player-prop picks (each a "more"/"less" call against a
line), and the entry pays a real, FIXED multiplier keyed only by how
many picks were in the entry -- not a pooled/pari-mutuel split like
this project's own Kalshi-model and 1v1Me-model peer-to-peer modules.
A PUSH (the real result lands exactly on the line) is a real, separate
DraftKings mechanic that voids just that one leg rather than failing
the whole entry.

## Design
`lib/fantasy.js`, structurally accurate to Pick6 itself: `createProp`/
`resolveProp` (real, one-time-resolvable prop records with a numeric
line); `createFantasyEntry` (2-6 picks, no duplicate props, no picking
an already-resolved prop, real stake charged via the injected
`transferFn`); `gradeFantasyEntry` (grades every pick, applies the
real push rule -- pushes reduce the effective pick count, and any real
loss fails the whole entry regardless of pushes). `PERFECT_PAYOUT_TABLE`
is a real, flagged, interpretive stand-in grounded in DraftKings' own
real, publicly advertised Pick6 payout structure (2 through 6 picks).
A push dropping an entry below the real minimum pick count refunds the
stake rather than forcing it through a table entry that doesn't exist.
Settlement pays directly from `VAGO_HOUSE_ACCOUNT`, mirroring
`sportsbook.js`'s own pattern (no pooling, since real Pick6 isn't
pari-mutuel) -- VCoin only, same posture as `sportsbook.js`.

## Explicitly NOT in this task
DraftKings' own separate "Flex Play" (a reduced payout for missing
exactly one pick on 3+ pick entries) -- a real, distinct DraftKings
feature, flagged as a real, deferred gap. Brackets/tournament
structures and live-stream integration -- pre-existing, still-real,
still-deferred gaps.

## Verification approach
10 plain-Node checks (perfect entry payout, a wrong pick losing the
whole entry, a push voiding one leg, a push dropping below the
minimum refunding the stake, pick-count bounds, duplicate-prop and
already-resolved-prop rejections, ungraded-prop and double-grading
rejections, and every real 2-through-6 pick-count multiplier). A live
pass against the real running server and V3 mock: a real 4-pick
perfect entry paying exactly the real 10x multiplier against V3's own
live balance, a real losing entry, a real push-refund case confirmed
net zero, and invalid-input/double-grade/unknown-entry rejections over
real HTTP.

## Done when
Real, DraftKings-Pick6-accurate fantasy contests exist, grounded in
the comparable doc's own real, named precedent, tested and
live-verified against the actual running server.
