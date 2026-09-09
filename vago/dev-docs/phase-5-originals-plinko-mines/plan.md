# Plan — Phase 5: Originals outcome/settlement (Plinko + Mines)

## Goal
Close `VAGO_CLAUDE.md`'s own explicitly-flagged gap: "No real odds/
settlement engine. Current settlement is a coin flip." Build real
outcome logic for the two Originals games `VAGO_COMPARABLES.md` names
directly: "Stake Originals (provably-fair instant games like Plinko,
Mines, HILO)."

## Real investigation before any code
Read `lib/casinoSession.js` in full: `startCasinoSession` already
enforces the real Gold Coin/VCoin currency split and debits the stake
at session start; its own header comment explicitly flags that game
outcomes were "NOT built in this phase." No `result`/`outcome`/
`payoutMultiplier` field exists anywhere on `CasinoSession` in
`VAGO_ARCHITECTURE.md`'s own data model.

Grepped both `VAGO_COMPARABLES.md` and `VAGO_ARCHITECTURE.md` for
RTP/payout/multiplier/house-edge figures — none exist. Confirmed
"provably-fair" itself (not just "random") is the real named mechanic
Stake uses and the comparable doc calls out specifically.

## Design
`lib/provablyFair.js` — a real HMAC-SHA256 commit-reveal scheme:
generate `serverSeed`, commit via `sha256(serverSeed)` before the
outcome is determined, derive each real random float from
`HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")`, reveal the seed
only at resolution so any player can independently recompute and
verify.

`lib/originals.js` — `ORIGINALS_RTP = 0.99`, a real, flagged,
interpretive choice grounded in Stake's own real, publicly-advertised
99% Originals RTP (the same comparable already cited twice in
`VAGO_COMPARABLES.md`). **Mines**: 5x5 board (Stake's real size),
mine positions via a real Fisher-Yates shuffle over provably-fair
floats, real combinatorial fair-multiplier formula (inverse
probability of that many safe reveals in a row) scaled by
`ORIGINALS_RTP`. **Plinko**: 16 rows (Stake's real default), each row
a genuine 50/50 provably-fair draw; the multiplier table is computed
from real binomial bucket probabilities (Stake's own exact table is
undisclosed/proprietary), shaped edges-pay-more-than-center, then
normalized so its true expected value equals `ORIGINALS_RTP` exactly.

A `CasinoSession` (gameType `originals`) is the real stake commitment;
a new `roundStarted` flag on the session (set in `casinoSession.js`,
checked/set in `originals.js`) stops one stake funding more than one
round. Payout routes through the exact same currency-correct path
`casinoSession.js` already established.

## Explicitly NOT in this task
HILO (the comparable doc's third named Originals game) — a real,
deferred gap, flagged in the README. Live-dealer and game-show
outcomes — genuinely different infrastructure (a real video stream /
scripted show format), not a provably-fair RNG. Host-configurable
table limits (min/max stake) — flagged as a separate real gap.

## Verification approach
10 plain-Node checks covering the provably-fair primitives, the real
Mines multiplier formula, the real Plinko table's symmetry/edge-
weighting/target-RTP, full win/loss/cash-out flows for both games in
both currencies, the one-round-per-session guard, and rejection of a
non-`originals` session. A live pass against the real running server
and the real V3 mock: real gold-coin Mines (commitment hash only up
front, real reveals, real cash-out, seed verified after), real
gold-coin Plinko, real vcoin Plinko independently confirmed against
the mock V3 ledger on both the player and `vago-house` accounts, plus
unknown-round/invalid-input/duplicate-reveal rejections over real
HTTP.

## Done when
Both named Originals games have real, provably-fair outcome and
payout logic, grounded in a real, cited RTP comparable rather than an
invented number, tested and live-verified against the actual running
server.
