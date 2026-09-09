# Plan — Phase 9: Shop, VEX, VADO (completing the 5-tab analog mode)

## Goal
`CLAUDE.md` §1 names 5 analog-mode tabs: Shop, Marketplace, Publishing,
VEX, VADO. Marketplace (Phase 3) and Publishing (Phase 2) were done;
this phase completes the set with the remaining 3, each a genuinely
distinct real mechanic rather than a third repetition of "catalog +
buy":
- **Shop** — VENVS's own first-party retail (Amazon-style), distinct
  from Marketplace's third-party peer resale: single catalog, instant
  buy, full price to the platform, no cart, no seller split.
- **VEX** — Robinhood-style trading floor: live/adjustable share
  prices, real portfolio holdings valued at the current price, real
  buy/sell against the wallet.
- **VADO** — art gallery/auctions: real timed bidding (strictly-
  increasing bids, no money moves until close) and a real close-out
  that pays the artist from the winning bid.

VEX and VADO are also two of `CLAUDE.md`'s named walkable-world
districts that previously showed "no analog view built yet" (Phase 5).
This phase gives them real views, wired into the shared-store pattern
**from the start** — applying Phase 8's lesson up front instead of
re-discovering the same bug a second time.

## Design
- `src/lib/shop.js`, `vex.js`, `vado.js` — mirror this project's
  established conventions: injected `transferFn` for all real-money
  functions, explicit validation, no invented defaults where a real
  number isn't specified anywhere (flagged inline).
- `adjustPrice()` (VEX) is a real, deterministic percentage-change
  function, not random — verified it clamps at `0.01` (never zero or
  negative) even under a -100% adjustment.
- `placeBid()`/`closeAuction()` (VADO) take an overridable `now`, same
  determinism pattern as Phase 3's abandoned carts and Phase 6's CHOPZ
  cooldowns. Bids don't move money — no escrow/hold concept exists in
  this wallet model — only `closeAuction()` does, winner → artist.
- `App.jsx` now owns `shop`/`vex`/`vado` alongside the existing
  `catalog`/`degvchiStore`, seeded once, passed to both the standalone
  views and `WorldView`'s nested `VexView`/`VadoView` — no separate-
  store bug this time, confirmed directly in the live pass (see
  Verification).
- `world.js`: `vex`/`vado` districts' `hasAnalogView` flipped from
  `false` to `true`, now accurate.

## Two real bugs caught and fixed during this phase
1. **Test-script bug** (the 8th this session, same species as every
   prior one): two `closeAuction()` calls in the plain-Node
   verification script were missing `await` inside sync `try` blocks.
2. **Real app bug, found live, not by guessing**: `VadoView`'s
   render list was built from `getActiveListings(vado, now)` (which
   excludes a listing once `now >= endsAt`) concatenated with
   already-closed listings — but a listing that has just ended and is
   awaiting `closeAuction()` is in neither set: still `status: 'open'`
   but no longer "active." It vanished from the UI entirely, so the
   "Close auction" button never had a chance to render, and a live
   `page.waitForSelector` for that button timed out at 7 real seconds.
   Fixed by rendering `vado.listings` directly (every listing,
   regardless of status) and leaving the status/`ended` checks to
   decide which button to show per item, not whether the item renders
   at all.
3. **A second test-script bug** (the 9th): after fixing the above, the
   walk-to-VEX navigation used `ArrowRight` when VEX's building
   (center at 150,150) is to the *left* of spawn (430,290) — should
   have been `ArrowLeft`. Caught by the resulting position check
   failing directly, not assumed.

## Verification approach
Plain-Node pass first (27 checks across all three modules, hand-
computed math throughout: percentage price adjustments, portfolio
value at both a starting and an adjusted price, exact auction proceeds
routing). Then a live browser pass — including a genuine ~5.5-second
real wall-clock wait for VADO's short-duration demo auction to
actually end, not a backdating trick, since the whole point here was
proving a real timed close works, and this duration is short enough to
just wait out directly. The VADO render bug was caught by this live
wait timing out, not by a shortcut assumption that shorter demo
durations "probably work." Final pass confirms the VEX district's
world-nested view shows the identical (in this case, correctly empty)
portfolio state as the standalone view, proving the shared-store
wiring is correct from the start this time.

## Explicitly NOT in this task
- No automated/continuous VEX price-walk driver — `adjustPrice()`
  exists and is tested, but nothing calls it on a timer; the demo UI
  doesn't expose a "simulate market move" trigger either.
- VADO's demo seeds exactly one 5-second auction — no ongoing auction
  creation flow, no bid-increment configurability in the UI.
- Shop isn't placed in the walkable world (it isn't one of
  `CLAUDE.md`'s listed world districts at all, so this is a faithful
  read of the source doc, not a gap).

## Done when
- All 3 modules validate correctly and compute exact, hand-checked
  amounts for every operation (purchase, buy/sell shares including a
  live price change between them, bid placement including the
  must-strictly-exceed rule, auction close including the unsold case).
- VEX portfolio value updates correctly when the underlying asset
  price changes between valuations, not just at purchase time.
- VADO enforces real auction timing: cannot close early, cannot bid
  after the end, cannot close twice, an unsold auction moves no money.
- Live browser: all three real, distinct purchase flows work through
  actual clicks with exact wallet balance changes; VADO's auction is
  watched through an actual real-time close, not simulated; VEX/VADO's
  world-nested views correctly share state with the standalone ones
  from first implementation, no follow-up fix needed.
