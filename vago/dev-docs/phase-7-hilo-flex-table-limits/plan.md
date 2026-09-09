# Plan — Phase 7: HILO, Flex Play, Originals table limits

## Goal
An ecosystem-wide sweep of small, self-flagged "Not yet built" gaps
picked three genuinely codeable, self-contained VAGO items with no
external infra dependency and a real, already-named comparable:
HILO (the third named Originals game), DraftKings' "Flex Play" (fantasy
contests), and host-configurable Originals table limits. Confirmed with
the user as part of a broader sweep before starting.

## Real investigation before any code
Re-read `originals.js`'s own header (Plinko/Mines' real formulas),
`fantasy.js`'s own header (the Perfect mechanic and its explicit Flex
Play scope note), and `casinoSession.js`'s own real currency-routing
guard, to build all three additions in the exact same style already
established rather than inventing a new pattern.

## Design
**HILO**: real 13-value card rank (Ace low–King). Each guess derives
its next draw via `deriveFloat(serverSeed, clientSeed, roundId, cursor)`
-- the same commit-reveal primitive Mines/Plinko already use, just with
`cursor` incrementing per sequential guess instead of drawing all 25
tile positions at once. The fair multiplier is recomputed fresh from
the full guess history each time (`computeHiloMultiplier`), mirroring
`computeMinesMultiplier`'s own non-compounding-rounding-error approach
rather than repeatedly multiplying an already-rounded running total. A
tie is a real push (reuses the exact push concept `fantasy.js` already
established for prop grading) -- voids that one guess, round stays
active. A guess with zero favorable outcomes (e.g. "higher" from 13)
is rejected outright, matching how a real game disables that button.

**Flex Play**: `playType: 'perfect' | 'flex'` on `createFantasyEntry`,
gated to 3+ picks per DK's own real product rule. `FLEX_PAYOUT_TABLE`
pairs a real, lower "all correct" multiplier with a real "miss exactly
one" multiplier at each pick count, both flagged interpretive (same
posture as `PERFECT_PAYOUT_TABLE`). Missing two or more busts the
entry exactly like Perfect. A push-driven edge case (pushes drop the
effective pick count below FLEX_MIN_PICKS) is handled explicitly and
documented inline rather than left to fall through silently.

**Table limits**: `ORIGINALS_MIN_STAKE`/`ORIGINALS_MAX_STAKE` in
`casinoSession.js`, enforced only for `gameType === 'originals'` (not
a global change to every game type, since only Originals was flagged).

## Explicitly NOT in this task
Live-dealer/game-show outcome logic (needs real video infra). Any
change to Plinko/Mines' own existing behavior. Any UI.

## Verification approach
8 plain-Node checks (table limits, a real HILO win-step + cashout, the
guaranteed-loss guard via a white-box forced round state, Flex clean
sweep/miss-one/miss-two/reject-under-3-picks, and a Perfect-play
regression check). A live pass against the real running server and the
real standalone V3 (not the mock, since this phase was built after the
ecosystem cutover): a real HILO round played to a loss with the seed
independently verified, and a real Flex entry missing exactly one pick
paying its real reduced payout, both confirmed against V3's own
balance endpoint.

## Done when
All three gaps are closed with real, tested, live-verified code, and
`vago/README.md`'s own "Not yet built" list no longer names any of
them.
