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

**On sports prediction markets specifically, added 12 Sep 2026.** The
sportsbook now shows each line as a percentage, and a sports event can
open a paired prediction market seeded from the de-vigged house line.
Neither is a new money path — the market mechanics, the pooled
settlement and the VCoin-only rule are all unchanged — but the framing
deserves one sentence so nobody reads the wrong thing into it:

> **"It is a prediction market, not a sportsbook" is not a regulatory
> shortcut.** Kalshi litigated the CFTC specifically over sports event
> contracts, and several states are contesting them now. For sports,
> the peer-to-peer framing is the contested question, not the settled
> one.

Nothing here is blocked by that today, because everything settles in
VCoin or Gold Coin and real-money settlement code is still not built.
It is recorded so that a future decision to take this to real money
starts from the actual legal position rather than from an assumption
that prediction markets are the lighter-touch path.

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
  **`voken-culture-card`, a fourth real market source, added by direct
  instruction**: "let's also add in our predictions on the culture
  card market as well." VOKEN opens these server-to-server the same
  way VDP already opens a `vdp-in-world` market — a real question
  about VOKEN's own Cvltvre Card market (e.g. whether a specific
  card's market price crosses a real threshold by a real date), priced
  and traded by this module exactly like every other source.
  `GET /api/predictions/voken` lists them with their live price
  attached on read, same reasoning as `/api/predictions/real-world`
  below (a stored price goes stale the moment anyone trades). See
  `test/vokenCultureCardMarkets.test.js`.
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
- `lib/groupWagers.js` — **Group Wagers, the narrowest real slice of
  `dev-docs/on-deck/VAGO_GROUP_WAGERS_FREEZE.md`** (see its own §29
  audit in `dev-docs/on-deck/README.md`). Not a second wagering
  engine: a Group Wager is a named, creator-owned, open-or-private
  wrapper (name, entry deadline, participant cap, invite list) around
  one real `predictionMarkets.js` market — joining is `buyContract`,
  resolving is `resolveMarket`, both already solvent and
  `settleOnce`-protected. Binary outcomes only, inherited from the
  underlying market. A group's own thread links a real VXLLAGE post
  (`vxllage/lib/posts.js`, per the freeze's own §9/§21 instruction to
  reuse VILLAGE's social infrastructure) rather than building a second
  comment system — the creator posts through VXLLAGE's own real flow
  with their own session and hands the post id back, since nothing
  here forwards a caller's session to another app. Resolution is
  `requireOperator('vago:settle')` plus a `decisionLog` entry, the same
  shape `/api/markets/:id/resolve` already uses, because it settles
  the same real pool.
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
- ~~Group Wager side wagers, team roles, a leaderboard, and QVAN-based
  group-risk monitoring — the §29 audit found no substrate for any of
  them anywhere in the ecosystem, and each needs a subsystem invented
  from nothing...~~ **Stale — checked directly, 5 Nov 2026.** Side
  wagers (`parentGroupWagerId`), team roles (`teamNames` over the
  existing yes/no sides), and the leaderboard (`groupWagerLeaderboard.js`,
  a pure recomputation) are all real and built — see `lib/groupWagers.js`
  and `lib/groupWagerLeaderboard.js`. So are Competitions (Leagues/
  Tournaments, `lib/groupWagerCompetitions.js`) and BLIND/
  Before-the-Answer (`lib/blindPredictions.js`), each real and now also
  wired into `public/index.html` with real seed data — see "Competitions
  and BLIND, seeded and wired (5 Nov 2026)" below. Only QVAN-based
  group-risk monitoring remains genuinely unbuilt: no real spec for it
  exists anywhere in this ecosystem (checked `v4-proxy/
  QVAN_SECURITY_RESILIENCE_SCOPE.md` directly — no mention of group-wager
  risk monitoring at all), so there is nothing yet to extend rather than
  invent from nothing. Multi-outcome group wagers are also still out of
  scope: `predictionMarkets.js` is binary only.
- **The invitation state machine, added 25 Sep 2026, is real** —
  `lib/groupWagers.js`'s `inviteToGroupWager`/`markInvitationViewed`,
  three real per-invitee states (`invited -> viewed -> funded`) plus
  the group wager's own already-live-computed locked/settled state read
  alongside rather than copied on. §13's freeze text names six states
  (`Invited -> Viewed -> Joined -> Funded -> Locked -> Settled`); this
  collapses Joined and Funded into one, since `joinGroupWager` already
  does JOIN+FUND as one atomic settlement — a system that cannot
  observe a joined-not-funded moment should not pretend to track one.

## Frontend coverage pass (30 Oct 2026)

An audit found `public/index.html` making real calls against only 12
of this app's 67 routes — the original 4 tabs (Casino, Fantasy,
Sportsbook, Markets) could *view* almost every surface but could only
ever actually *act* on Mines. Five changes close most of that gap,
each a real client of the routes named, never a fabricated payload
shape (every field was checked against the real route handler and its
`lib/*.js` function before being written, and every flow below was
exercised live against a running server with a mock Shield session and
a mock V3 ledger). Consistently left backend-only, by design: anything
gated to `requireCallingService` (fantasy prop creation, market/event/
match creation — a trusted-service credential this frontend has no
login for) or `requireOperator` (every resolve/settle/grade route — a
human operator credential, deliberately separate from a player session
so no player, and no compromised service token, can ever grade their
own bet).

- **Sportsbook tab** — showed events and odds but had no way to
  actually bet. Each open event now gets a real bet form
  (`POST /api/sports/:eventId/bet`), showing the odds-locked-in
  potential payout the moment it's placed. Verified live: a 10-VCoin
  bet at +195 odds returned `potentialPayout: 29.5` and debited the
  bettor's V3 balance by exactly 10.
- **Markets tab** — showed real-world/VDP/VACON-C markets but had no
  way to trade, and never surfaced VOKEN's own Cvltvre Card markets at
  all (`GET /api/predictions/voken` existed with no caller). Each
  source card now gets Buy/Sell forms keyed by market id
  (`POST /api/markets/:id/buy`, `.../sell`), plus a fourth source card
  for VOKEN's markets. Verified live: buying 2 YES contracts returned
  the real demand-driven `price`/`cost`/`fee`; selling 1 back returned
  `proceeds` with `capped: false`.
- **Fantasy tab** — could look up a prop and view past entries but
  never build one (`POST /api/fantasy/entries` existed with no
  caller). A real picks builder (prop id + more/less direction, 2-6
  picks, Flex gated to 3+ exactly like `fantasy.js` itself gates it)
  stakes a real entry; "Your entries" now also shows play type and
  payout. Verified live: a 3-pick Perfect entry for 10 VCoin posted
  correctly and debited V3 by exactly 10.
- **Casino tab** — played only Mines, even though `lib/originals.js`
  has three real provably-fair games. A game switcher adds Plinko
  (`POST /api/casino/plinko/start`, `.../drop`) and Hi-Lo
  (`POST /api/casino/hilo/start`, `.../guess`, `.../cash-out`) onto the
  same session+round flow and fairness panel Mines already used.
  Hi-Lo's Higher/Lower buttons disable themselves on a guaranteed-loss
  guess the same way the server itself rejects it. Verified live
  against real gold-coin sessions: a Plinko drop resolved bucket 8 at
  ×0.39 for a 19.50 payout; a Hi-Lo round won a guess (×1.6087) and
  cashed out for 32.17, both checked against the real round response.
- **Group Wagers tab, new** — the entire feature had zero frontend
  callers. Create one (`POST /api/group-wagers`), find/view one by id
  (`GET /api/group-wagers/:id`, which already merges the group's own
  fields with its market's live pools and participant count), join a
  side (`POST /api/group-wagers/:id/join`), and a platform-wide
  leaderboard (`GET /api/group-wagers/leaderboard`). Wiring the
  leaderboard card surfaced a real bug in `server.js`: that route was
  registered *after* the sibling `GET /api/group-wagers/:id`, so
  Express matched `"leaderboard"` as `:id` first and the real handler
  was never reachable — every request for it returned
  `{"error":"no group wager with id leaderboard"}`. Fixed by moving
  the literal route before the `:id` route. Verified live: creating
  and joining a group wager both settle exactly as `groupWagers.js`
  documents, and the leaderboard route now returns `200` with a real
  (empty, since nothing has settled yet) array instead of a 404.

**Deliberately left for a follow-up round:**
- **Blackjack** (`lib/originals.js`'s fourth real Originals game) — a
  real multi-step hand UI (hit/stand, dealer hole-card reveal, natural-
  blackjack settlement) is a meaningfully bigger build than Plinko/
  Hi-Lo's single-decision shape, and deserved its own pass rather than
  being rushed alongside four other tabs.
- **Group Wager invitations, thread-linking, and side wagers** — the
  private-invitation accept/view flow and side wagers are each a real,
  separate feature surface; linking a group's VXLLAGE thread
  specifically needs the creator's own live VXLLAGE session, which
  this frontend has no way to forward (`groupWagers.js`'s own header
  explains why VAGO cannot create that post server-to-server on the
  creator's behalf).
- ~~**Group Wager Competitions (Leagues/Tournaments) and BLIND/Before-
  the-Answer rounds** — each has real create/view/participate routes
  with no seed data anywhere...~~ **Closed, 5 Nov 2026** — see
  "Competitions and BLIND, seeded and wired" below.
- **Esports lounge** — `esportsStaking.js` is real and tested, but
  `POST /api/esports/matches` (the only way a match comes to exist) is
  `requireCallingService`-gated and nothing seeds one, so there is no
  real match id a player-facing tab could ever stake on today.
- **AMOE history and generic casino-session/round lookups**
  (`GET /api/amoe-entry/:userId`, `GET /api/casino/sessions/:id`,
  `GET /api/casino/rounds/:id`) — each is a real read with no new
  mechanic behind it; better woven into an existing card (e.g. an AMOE
  history list on the Casino tab's Gold Coin card) than given its own
  surface, and left for whichever pass does that polish.

## Competitions and BLIND, seeded and wired (5 Nov 2026)

Closes the one gap this file's own previous "Deliberately left for a
follow-up round" note named honestly: `lib/groupWagerCompetitions.js`
(Leagues/Tournaments) and `lib/blindPredictions.js` (BLIND/Before-the-
Answer) had real create/view/participate routes and zero frontend
callers and zero seed data, so a fresh boot showed either nothing or an
empty shell.

- **Two new tabs in `public/index.html`** — Competitions (create a
  league or tournament, find/view one by id, the creator adds a leg
  naming an existing group wager) and BLIND (create a BLIND or
  Before-the-Answer round, find/view one by id, submit an answer).
  Built against the exact real payload shapes `server.js`'s own routes
  take, not an invented shape — `competitionView`/`blindRoundView`
  already merge each record with its live standings/winners, so
  neither tab computes a second copy. `advance`/`finish`/`resolve` stay
  backend-only: each is `requireOperator('vago:settle')`-gated, and
  `public/index.html` already carries zero frontend exposure for any
  operator-gated action anywhere in this app (checked directly — no
  match for "operator" anywhere in the file before this pass), so no
  button was added for them here either.
- **Real seed data, `lib/seedDemoData.js`'s new `seedCompetitions`/
  `seedBlindRounds`** — a real League with one leg actually resolved
  (through the real `resolveGroupWager`, bypassing only the same
  operator-gated HTTP route every other seed function here already
  bypasses) so `pointsStandings` shows a real non-zero-points row on
  first boot, plus one open leg; a real resolved BLIND round with a
  real winner, plus a real open Before-the-Answer round with one
  submitted answer. Both guarded by the same emptiness check every
  other seed function in this file already uses, so a persisted
  `data/store.json` is never touched and restarting twice never
  double-seeds.
- **Tests** — `test/seedDemoData.test.js` (new, 3 tests): the seeded
  league shows a real non-zero points row, the seeded BLIND round is
  resolved with a real winner while Before-the-Answer stays open with
  one answer, and seeding twice never double-seeds. Full suite: 134 →
  137 tests, all passing. Mutation-verified: deleting the
  `seedCompetitions` idempotency guard turned the double-seed test red
  (1 competition expected, 2 seen); restoring it returned the suite to
  green.
- **Live-verified** against a real spawned Shield + V3 + VAGO stack
  (real Shield sessions, real V3 settlement with the service-token
  allowlist wired both directions): created a real tournament, added a
  leg naming a real group wager, confirmed a non-creator gets a real
  403 adding a leg; created a real BLIND round and submitted a real
  answer to it; confirmed the seeded League (`GET /api/competitions/1`)
  shows real standings (`demo-maya`: 1 point, 1-0) and the seeded BLIND
  round (`GET /api/blind-rounds/1`) is resolved with `winners:
  ["demo-maya"]`.
