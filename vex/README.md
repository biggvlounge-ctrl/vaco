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
- `lib/complianceGate.js` — the real `vex-brokerage` compliance gate.
  Setting it is a real admin action ("not a routine toggle" per its
  own header) that fires only after actual legal/registration work
  clears.
- `lib/brokerage.js` — the real net-capital model (`introducing-broker`)
  and order mechanics: a buy mints/acquires `quantity` real digital
  Cvltvre Card editions for the account's owner and pays the platform
  account; a sell requires the account to genuinely already hold
  `quantity` editions, transferring them to the platform and paying
  the account. Settlement is atomic (`POST /api/vcoin/settle` in
  `server.js`) — every leg moves or none does.
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
