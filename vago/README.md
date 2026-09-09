# VAGO

The ecosystem's wagering, prediction, and casino platform. A standalone
VACO app (its own Shell tile/entry point, not a room inside VENVS —
an earlier brief had that backwards and VAGO_CLAUDE.md explicitly
corrects it). Blends three real product shapes: Kalshi-style
peer-to-peer prediction markets (spanning far beyond sports, including
the genuinely unique "predict on events happening inside VDP/VACON-C
itself" surface no outside competitor can replicate), DraftKings/
FanDuel-style house-odds sportsbook, and a sweepstakes-casino model
(Stake.us-style) built on a real, non-redeemable Gold Coin currency —
plus an esports lounge with 1v1Me-style skill-based staking. Uses the
same shared avatar and VCoin wallet as every other VACO app.

Source docs: `VAGO_ARCHITECTURE.md` (data models + API map),
`VAGO_CLAUDE.md` (the real feature inventory, scope decisions, and the
explicit real-vs-mocked breakdown from the existing prototype),
`VAGO_COMPARABLES.md` (the real Kalshi/DraftKings/Stake/1v1Me research
underlying the design, plus Venus Resort & Casino's world-layer
design).

**Scope note, read this before touching anything here**: real-money
gambling of any kind is out of scope, and unlike VOKEN's VEX/
fractional-ownership pattern, this isn't even "build the real code
path behind a closed compliance gate" — VAGO_CLAUDE.md §7 is explicit
that real-money settlement code isn't to be built at all without an
actual legal go-ahead (jurisdictions picked, gaming counsel engaged,
licensed, age/geo/KYC/AML built first). Real-money Iowa sports betting
specifically stays pending a real state license decision. VCoin-settled
financial-market predictions (stocks, rates) are flagged as closer to
securities-adjacent territory than VAGO's other prediction types and
are deliberately parked, not blocking current work. Everything actually
built here settles in VCoin or Gold Coin only.

## Run
```
cd vago && npm install && npm start   # localhost:8795
```

## Test
```
curl http://localhost:8795/api/health
curl -X POST http://localhost:8795/api/amoe-entry -H "Content-Type: application/json" \
  -d '{"userId":"player-1"}'
curl -X POST http://localhost:8795/api/casino/sessions -H "Content-Type: application/json" -d '{
  "userId":"player-1","gameType":"originals","currency":"gold-coin","stakeAmount":100,"amoeEntryUsed":true
}'
```

## What's here
- `lib/goldCoin.js` — **the real, isolated Gold Coin ledger (Phase
  1)**: the doc's own non-negotiable requirement implemented literally
  — "genuinely separate, non-interchangeable currencies from day one,"
  enforced architecturally by the simple fact that no function
  anywhere in this project converts between Gold Coin and VCoin, in
  either direction.
- `lib/amoe.js` — the real, required Alternate Method of Entry: a
  genuinely usable, rate-limited free-play path (no exact grant amount
  or cooldown is given anywhere in the docs — both are real,
  deterministic, bounded, flagged interpretive choices, matching a
  real daily cadence like Chumba/LuckyLand's own free-entry caps).
- `lib/casinoSession.js` — the real currency-routing enforcement
  point: a `gold-coin` session can only ever debit the local Gold Coin
  ledger; a `vcoin` session can only ever call the injected
  `transferFn` (the same real pattern VOID and VOKEN use to reach V3
  through `venvs-mock-backend`). The two branches share no code path.
  Game outcomes (live-dealer results, game-show results) are
  deliberately not built yet. **Originals RNG now built (Phase 5)**:
  `session.roundStarted` is the real guard that stops one staked
  session from funding more than one round. **Real, host-configurable
  table limits now enforced for Originals (Phase 7)** — closes the
  README's own previously-flagged gap; `ORIGINALS_MIN_STAKE`/
  `ORIGINALS_MAX_STAKE` are real, flagged, interpretive numbers (a real
  casino's own limits are always host-set, not a law of the game).
- `lib/predictionMarkets.js` — **prediction markets (Phase 2)**: real,
  demand-driven pricing (a brand-new market bootstraps at a real 50c
  price; buying/selling genuinely moves it, bounded to Kalshi's own
  cited $0.01-$0.99 range), a real probability-weighted trading fee
  that peaks at a 50c price, and `vdp-in-world`/`vacancy-in-game`-
  sourced markets for the doc's own confirmed "genuinely unique
  differentiator." Settlement is **pari-mutuel-style pooled
  distribution** (the entire real collected pool split proportionally
  among winning-side holders) — solvent by construction, deliberately
  not a fixed $1/contract promise, which a live test proved insolvent
  in this project's simplified (no real matching engine) design before
  the fix; see `dev-docs/phase-2-prediction-markets/` for the full
  account.
- `lib/sportsbook.js` — **sportsbook (Phase 3)**: real, standard
  American odds math (favorite/underdog), odds locked in at bet time
  per the real, standard sportsbook rule — a bet's payout never
  changes even if the posted line moves afterward, a deliberate
  contrast with `predictionMarkets.js`'s live-price contracts.
  Settlement pays directly from the house account rather than a
  pooled reserve, matching how real bookmakers actually manage risk.
- `lib/esportsStaking.js` — **esports staking (Phase 3)**, 1v1Me-model:
  no house odds, real pari-mutuel pooled settlement (mirroring
  `predictionMarkets.js`'s own solvent-by-construction pattern). Flash
  Stakes are real and structural — `isFlashStake` is derived
  automatically from the match's live state, never trusted from the
  caller. LANDuel's self-staking precedent works naturally (nothing
  prevents backing yourself).
- `lib/provablyFair.js` — **provably-fair RNG (Phase 5)**: the real
  Stake-style commit-reveal scheme named directly in
  `VAGO_COMPARABLES.md` ("Stake Originals (provably-fair instant games
  like Plinko, Mines, HILO)") — a `serverSeed` is generated and
  committed to via `sha256(serverSeed)` before a round's outcome is
  determined, so the server can't pick a favorable seed after the fact.
  `HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")` derives each
  real, deterministic random float; the seed is revealed only once a
  round resolves, letting anyone independently recompute and verify
  the exact outcome.
- `lib/originals.js` — **Plinko + Mines (Phase 5)**: closes
  `VAGO_CLAUDE.md`'s own explicitly-flagged gap ("No real odds/
  settlement engine... Current settlement is a coin flip"). Neither
  VAGO doc cites an RTP/house-edge percentage anywhere, so
  `ORIGINALS_RTP = 0.99` is a real, flagged, interpretive choice
  grounded in Stake's own real, publicly-advertised 99% Originals RTP
  — the same comparable `VAGO_COMPARABLES.md` already cites twice as
  both the design and legal-model reference. **Mines**: a real 5x5
  board (Stake's own real size), mine positions drawn via a real
  Fisher-Yates shuffle over provably-fair floats, and a real
  combinatorial fair-multiplier formula (the inverse of the true
  probability of having safely revealed that many tiles) scaled by the
  same real RTP — reveal-as-you-go, cash out any time after at least
  one safe reveal, hit a mine and the stake stays with the house.
  **Plinko**: a real 16-row board (Stake's own real default), each
  row's left/right a genuine 50/50 draw from the provably-fair
  sequence; the payout table itself is computed, not invented —
  Stake's own exact numbers are proprietary and undisclosed, so this
  derives its own from the real binomial bucket probabilities, shaped
  edges-pay-more-than-center, then normalized so the table's true
  expected value equals `ORIGINALS_RTP` exactly. Both games pay out
  through the exact same currency-correct path `casinoSession.js`
  already established — `creditGoldCoin` for gold-coin sessions, the
  injected `transferFn` from `VAGO_HOUSE_ACCOUNT` for vcoin ones —
  never crossing the Gold Coin/VCoin boundary. **HILO now built (Phase
  7)** — the comparable doc's own third named Originals game
  ("provably-fair instant games like Plinko, Mines, HILO"): a real
  13-value card rank (Ace low through King), guess higher/lower than
  the current value, correct guesses compound a real fair multiplier
  (same non-compounding-rounding-error formula shape as
  `computeMinesMultiplier`), a tie is a real push (voids that one
  guess only), and a guaranteed-loss guess (e.g. "higher" from 13) is
  rejected outright rather than let through to a certain loss.
- `lib/fantasy.js` — **Fantasy Contests (Phase 6)**: closes the
  README's own previously-flagged gap, grounded in
  `VAGO_COMPARABLES.md`'s own real, named precedent — "DraftKings
  Pick6 is... a peer-to-peer daily fantasy product, not house odds...
  the direct precedent for VAGO's fantasy-contest-style predictions
  specifically." Built structurally accurate to Pick6 itself, not a
  re-skin of `predictionMarkets.js`'s pari-mutuel pattern: real
  DraftKings Pick6 pays a real, fixed multiplier table keyed only by
  pick count, not a pooled/pari-mutuel split — `PERFECT_PAYOUT_TABLE`
  (2 through 6 picks) is a real, flagged, interpretive stand-in
  grounded in DraftKings' own real, publicly advertised Pick6
  structure. Real, named DraftKings mechanic included, not invented: a
  PUSH (the real outcome lands exactly on a prop's line) voids that
  one leg rather than failing the whole entry — the entry grades on
  its remaining real picks, and a push dropping an entry below the
  real minimum pick count refunds the stake rather than forcing it
  through a table with no entry for it. Settlement pays directly from
  `VAGO_HOUSE_ACCOUNT`, mirroring `sportsbook.js`'s own pattern (no
  pooling, since Pick6 isn't pari-mutuel). VCoin only, same posture as
  `sportsbook.js`. **DraftKings' own "Flex Play" now built alongside
  "Perfect" (Phase 7)**: a real, separate entry type chosen at entry
  time (`playType: 'perfect' | 'flex'`), available only on 3+ pick
  entries (DK's own real reasoning — a 2-pick miss-one result is too
  weak to price a payout against). `FLEX_PAYOUT_TABLE` pairs a real,
  lower "all correct" multiplier with a real, separate "miss exactly
  one" multiplier at each pick count — Flex prices in the miss-one
  protection, so its own perfect payout is deliberately lower than the
  straight Perfect table at the same count, the same real tradeoff
  DK's own product makes. Missing two or more still busts the entry.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
53 plain-Node checks across all three phases plus a full cross-phase
regression, plus live passes:
`vago/server.js` alone confirmed AMOE genuinely granting real Gold
Coin and genuinely rejecting a second entry inside the real cooldown
window; a gold-coin casino session's local debit confirmed directly; a
vcoin casino session's real $75 payout **independently confirmed
against the mock V3 ledger** on both the player and house accounts;
live cross-checks confirming each currency's balance is genuinely
untouched by the other currency's session; a VDP-sourced prediction
market created and correctly surfaced on its dedicated feed endpoint;
two real trades' costs and fees **independently confirmed** across
both traders and the house account; and resolution's real payout
independently confirmed, with the house's post-resolution balance
matching exactly its collected fee revenue — live proof the
pari-mutuel settlement is solvent and the fee never leaks into the
payout pool; a sportsbook bet's real $250 payout independently
confirmed against the mock ledger with odds correctly locked in at bet
time; and an esports match's real pari-mutuel payout independently
confirmed, including live proof that a spoofed `isFlashStake: false`
in the request body is genuinely overridden to `true` by the server's
own real match state once the match has gone live. A final **Phase 4
cross-phase regression** then ran every module above together in one
shared store (9 accounts, every module deliberately touching a
different set of users so cross-contamination would surface as a
wrong-balance assertion), with a global VCoin conservation invariant —
summing every account's real balance after the entire regression
equals exactly the total seeded — holding exactly, proving no VCoin
was created or destroyed anywhere across all four independently-built
modules. See `dev-docs/` for the full record.

Phase 5 (Originals: Plinko + Mines): 10 plain-Node checks (serverSeed
commit/reveal round-trips and tamper detection, `deriveFloat`
determinism and cursor-sensitivity, the real Mines combinatorial
multiplier formula matched exactly, the real Plinko multiplier table
proven symmetric/edge-weighted/hitting its target RTP, a full Mines
round proving the commitment hash is shown up front with the seed and
mine positions genuinely absent until resolution, a real forced-loss
path with zero payout, real vcoin payout through the injected
`transferFn`, a full Plinko round proving the exact same outcome is
independently reproducible by re-deriving from the revealed seed, the
one-round-per-session guard enforced on both games, and a non-
`originals` session rejected), plus a live pass against the real
running server and the real V3 mock: a real gold-coin Mines round
(commitment hash returned with nothing else, two real safe reveals,
real cash-out paying out from the actual Gold Coin ledger, the
revealed seed independently verified, double-cash-out and a second
round on the same session both rejected), a real gold-coin Plinko drop
paying out correctly against the exact stake/multiplier math, and a
real vcoin Plinko round **independently confirmed against the mock V3
ledger on both the player and `vago-house` accounts** — plus unknown-
round, invalid-`minesCount`, and duplicate-tile-reveal all confirmed
rejected over real HTTP. See `dev-docs/` for the full record.

Phase 6 (Fantasy Contests): 10 plain-Node checks (a perfect 3-pick
entry paying the real fixed multiplier, one wrong pick losing the
whole entry with no payout, a push voiding one leg so the entry grades
on the remaining real picks, a push dropping an entry below the
minimum valid pick count correctly refunding the stake, pick-count
bounds enforced, duplicate propId within one entry rejected, picking
an already-resolved prop rejected, grading with an unresolved prop
rejected, double-grading rejected, and every real pick-count
multiplier from 2 through 6 confirmed paying correctly), plus a live
pass against the real running server and the real V3 mock: a real
4-pick perfect entry (stake `25`) paid out exactly `250` (the real
10x multiplier) against V3's own live balance; a real 2-pick entry
with one wrong pick confirmed losing with zero further money moved; a
real push-refund case confirmed net zero against V3; and fewer-than-
minimum picks, double-grading, and an unknown entry all confirmed
rejected over real HTTP.

Phase 7 (HILO, Flex Play, Originals table limits): 8 plain-Node checks
(table limits rejecting both an under-minimum and over-maximum
Originals stake, a real HILO win step compounding the correct
multiplier and cashing out for the exact stake-times-multiplier
payout, a guaranteed-loss guess correctly rejected while the real
opposite guess from the same state remains legal, a Flex entry's clean
sweep paying the real flex-perfect multiplier, a Flex entry missing
exactly one pick still paying its real reduced multiplier, a Flex
entry missing two busting with zero payout, Flex rejected outright on
a 2-pick entry, and the pre-existing Perfect-play math confirmed
unaffected by the Flex addition), plus a live pass against the real
running server and the real standalone V3 (not the mock — this phase
was built after V3's ecosystem cutover): a real HILO round staked,
guessed, lost, and independently confirmed against V3's own balance
endpoint with the revealed seed verified; and a real 3-pick Flex entry
missing exactly one pick paid its real `100` reduced payout
(`stakeAmount 100 × oneMiss multiplier 1`), confirmed against V3's own
balance returning to its exact starting value.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8795) — VAGO's own real state now survives a
restart. Live-verified: submitted a real AMOE entry (Gold Coin grant),
killed the running process, restarted it, and confirmed the same real state
came back from a real GET. See `dev-docs/phase-8-real-persistence/`.

## Real metrics feed
Every real Mines/Plinko/Hi-Lo cash-out pushes a real `casino_payout`
metric to VACO Analytics (fail-soft — a real cash-out is never held up
if VACO Analytics is down). See `vaco-analytics/dev-docs/phase-5-live-metric-feeds/`.

## Not yet built
- Brackets/tournament structures, live video/stream integration
  (Rivalry's stream-alongside-slip pattern) — later work,
  and some of it (live streams) is a different layer entirely, not
  this backend.
- Casino game outcome logic for live-dealer results and game shows —
  Originals (Plinko, Mines, and now HILO) is real (Phases 5 and 7);
  live-dealer needs a real human-dealer video stream, genuinely
  different infrastructure from a provably-fair RNG.
- The Venus Resort & Casino world layer (GTA-style walkable floor with
  real session-type density control, the floating riverboat casino,
  casino-side/maritime-side jobs) — a VENVS/VDP-side build, not this
  backend.
- Any real-money gambling code of any kind — deliberately not started,
  per VAGO_CLAUDE.md §7's explicit legal-decision-first requirement.
- Gold Coin purchase flow — no real payment processing exists anywhere
  in this ecosystem's build; AMOE is the sole real acquisition path so
  far.
- A named VAGO agent — unlike Gibson (VOID) or Kenji (VOKEN), no
  VAGO-specific agent is confirmed in any of the three source docs.
