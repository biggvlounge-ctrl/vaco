# VEX

The real Robinhood-style Cvltvre Card brokerage — extracted out of
VOKEN (Phase 1) into its own standalone app: owns broker accounts,
trade orders, and the vex-brokerage compliance gate; calls VOKEN's own
live API for the Cvltvre Card catalog it trades against (never keeps
its own copy), the same way every other real cross-app client in this
ecosystem works. A sibling of Vex Business inside the Vex Trading
shell — see `VEX_BROKERAGE_COMPARABLES.md` for the real comparable
landscape (Robinhood, Webull, Public, Fidelity/Schwab) and why none of
their monetization routes are available to VEX on day one.

**This is a brokerage.** `lib/complianceGate.js`'s `vex-brokerage` gate
holds live trading closed pending real broker-dealer registration —
nothing in this app, including the frontend coverage below, is a green
light or a claim that the registration work is done.

## Run
```
cd vex && npm install && npm start   # localhost:8816
```

## Test
```
node --test test/*.test.js   # package.json defines no "test" script yet
curl http://localhost:8816/api/health
```

## What's here
- `lib/complianceGate.js` — two real gates: `vex-brokerage` (card
  trading) and `vex-coin-trading` (VXC, see below), deliberately
  separate. Setting either is a real admin action ("not a routine
  toggle" per its own header) that fires only after actual
  legal/registration work clears.
- `lib/brokerage.js` — the real net-capital model (`introducing-broker`)
  and order mechanics: a buy mints/acquires `quantity` real digital
  Cvltvre Card editions for the account's owner and pays the platform
  account; a sell requires the account to genuinely already hold
  `quantity` editions, transferring them to the platform and paying
  the account. Settlement is atomic (`POST /api/vcoin/settle` in
  `server.js`) — every leg moves or none does.
- `lib/coinMarket.js` — VXC, a second, separate tradeable coin with its
  own constant-product liquidity pool (price from real trade flow, not
  a fame score or a fixed rate). See "VXC" below for the full picture.
- `lib/vokenClient.js` — the real HTTP client into VOKEN's own running
  server for card reads/mints/transfers; Cvltvre Cards stay VOKEN's
  product.
- `lib/shieldAuth.cjs` / `lib/serviceAuth.cjs` / `lib/operatorAuth.cjs`
  — the three real guard shapes this app uses: a live Shield session,
  a trusted internal-service credential, and a human vaco-operator
  credential (for the compliance gate specifically — no service-token
  fallback is allowed on that route).
- `lib/decisionLog.cjs` / `lib/tracing.cjs` — audit trail for every
  gate decision, and a trace id attached to every request (including
  refused ones) before any auth middleware runs.
- `lib/store.js`, `lib/storeBackend.js`, `lib/persistence*.js` — the
  JSON-file or Postgres-backed store (broker accounts, trade orders,
  the gate's own state).

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` calling only 4 of this app's 7
real routes, and two of those 4 calls were themselves broken — found
by checking every field against the real route handler rather than
assuming the existing frontend was correct.

**Bugs fixed in existing tabs:**
- **Place an order** sent `side`/`limitPrice`; `lib/brokerage.js`'s
  `placeTradeOrder()` has only ever read `orderType`/`pricePerUnit`.
  Every order submitted through this form landed with
  `orderType: undefined`, failed the `ORDER_TYPES.includes(orderType)`
  check, and was refused. This UI could not place a single trade until
  the field names were corrected.
- **Check a gate**'s status badge read `gate.open || gate.passed`,
  but `GET /api/compliance-gate/:gateName` has only ever returned
  `{gateName, cleared}`. The badge showed "closed" for every gate,
  including an actually-cleared one — a status display that is wrong
  in the dangerous direction is worse than no display, in a brokerage
  app. Fixed to read `gate.cleared`.

**New coverage, all 7 routes now have a real frontend caller:**
- **Look up an order** (Trade tab) — `GET /api/order/:id`, previously
  called by nothing.
- **System status** (Compliance tab) — `GET /api/health`'s real
  net-capital models, order types, and gate names, previously called
  by nothing.
- **Set a gate (operator only)** (Compliance tab) —
  `POST /api/compliance-gate/:gateName`, `requireOperator('vex:compliance')`
  -gated. This is VEX's live-trading interlock, so the card carries an
  explicit warning that it is the real interlock and not a demo
  toggle, and takes a real pasted `X-Operator-Credential` (same shape
  `cvnvo/yap`'s moderation tab already uses for its own operator-only
  routes) — never stored, never faked. There is no operator login in
  this frontend, same as every other app's operator tooling in this
  ecosystem; a real credential from vaco-operator is required and a
  service token is explicitly refused by the route itself.

**Left for a follow-up round, deliberately:** nothing route-level —
all 7 registered routes now have a real frontend caller. Not attempted:
a richer order book / position view (there is no such route to call;
`GET /api/order/:id` is the only read VEX exposes for trade orders),
and a dedicated account-holdings display, since the only card-holding
data lives in VOKEN, not here, and surfacing it would mean either a
second cross-app client this pass didn't verify live or guessing at a
shape — left to whoever next touches the Account tab with time to
verify VOKEN's edition-listing route directly.

## VXC — a new, separate tradeable coin (31 Oct 2026)

**Not VCoin, and not a tweak to card trading.** VCoin is documented
elsewhere (`v3/VASH_BAAS_VCOIN_ADVANCEMENT.md`) as a deliberately
stable, auditable unit of account — every other app in this ecosystem
already settles real money through it, so letting VCoin itself float
in price would undo that stability everywhere, not just here. VXC is
a second, independent digital coin that trades *for* VCoin (VCoin is
this market's quote currency, the way USD quotes BTC on a real
exchange) and moves on its own, leaving VCoin's peg untouched.

**Why VXC needs its own pricing mechanism.** VOKEN's Cvltvre Cards get
a real market-relative price from an external signal — each card's
own real-world fame score, read against every other card's score
(`voken/lib/cardMarketPrice.js`). VXC has no such external signal: it
is not a record of anyone's real-world standing, so its price has to
come from trading itself.

**The mechanism — `lib/coinMarket.js`: a constant-product automated
market maker.** The same real, well-understood design real
decentralized exchanges use (Uniswap's `x*y=k`): a platform-held pool
holds VXC and VCoin reserves; price is `vcoinReserve / coinReserve`;
every trade shifts both reserves so their product stays constant, and
a larger order moves its own price more — real slippage, not a static
quoted rate. This is deliberately **not** an order book: VXC trades
settle against the pool, the same way card trades already settle
against `VEX_PLATFORM_ACCOUNT`, never against another trader directly.
The pool opens seeded at 1,000,000 VXC / 10,000 VCoin (price 0.01) —
a flagged, invented seed, not a claim about what VXC "should" be
worth, the same discipline every other invented constant in this
session carries.

**A second compliance gate, deliberately separate from
`vex-brokerage`.** Trading a platform-native coin against VCoin is a
different regulatory question (money transmission / virtual-asset
posture) from brokering real Cvltvre Card editions (securities /
broker-dealer posture). `vex-coin-trading` is its own gate in
`lib/complianceGate.js`; clearing one must never silently clear the
other, and a test proves it (`test/complianceGate.test.js`).

**Routes, all under the same auth model the card routes already use:**
- `GET /api/coin/price` — the pool's live price and both reserves.
  Open, like `GET /api/health`.
- `POST /api/coin/orders` — `requireAccountOwner('accountId')`, same
  guard as `POST /api/order`. Buy/sell are quoted and filled in the
  same call; the quote already reflects this order's own price impact.
- `GET /api/coin/orders/:id` — look up a filled order.
- `GET /api/coin/holdings/:accountId` — the account owner's real VXC
  balance.

**"Refused, never partly applied" holds here too, proved live and in
tests:** a sell for more VXC than the holder actually owns is refused
before the pool, the holding, or any money moves — not partway
through. A failed settlement (confirmed live, with V3 not running)
leaves the pool and the holder's balance completely untouched;
`test/coinMarket.test.js` proves the same with a stubbed settlement.
Two distinct orders of the same shape get two distinct settlement
idempotency keys, the same discipline `test/brokerage.test.js` already
proved for card orders — scoped by `vex_coin_${orderType}:VXC:${orderId}`
in `placeCoinOrder`.

**Verification performed:** `test/coinMarket.test.js` (AMM math, the
constant-product invariant, price moving with real trade flow, a
larger order producing real slippage, the gate, insufficient-holding
refusal, idempotency-key uniqueness) and new guard-proof tests in
`test/server.test.js` (anonymous refusal, the open `/api/coin/price`
read, `/api/health`'s new fields) — 37/37 passing. Also run live
against a real Shield + VEX pair on isolated ports: a real session,
a real broker account, an order refused with the real "not cleared"
message while the gate was closed, the gate opened through the real
`requireOperator`-gated route, and a buy that reached the real
`settleVCoin` call and failed cleanly (V3 wasn't running in that
check) with the pool and holdings provably untouched afterward — not
just asserted in a unit test.

**Left for a follow-up round, deliberately:** no order-book view (VXC
has none, by design — see above), no price history/candles (nothing
currently records one), and no liquidity-provider role (the pool is
platform-seeded and platform-owned only; letting other accounts add
to it is a real, separate feature this pass did not build).
