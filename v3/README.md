# V3

The ecosystem's canonical VCoin/VASH ledger — one of V3's own three
real, distinct components (**VCoin**, **VASH**, **VACA**). VACA was
already split out into its own real, standalone app earlier this
session; this closes the other real, largest-flagged remaining gap:
"V3 never getting its own standalone app — every app's `V3_API_URL`
default points at `venvs-mock-backend`."

**This is an extraction, not a redesign.** `venvs-mock-backend/server.js`
already implements a real, working, already-tested, already-relied-
upon VCoin+VASH contract — every route, every response shape, and the
real `STARTING_VCOIN_BALANCE` auto-grant behavior are preserved
byte-for-byte here on purpose. That mock's own header is honest that
its contract is **inferred**, not copied from a real V3 spec — neither
V3's nor Shield's real source exists anywhere in this session. That
caveat carries over unchanged: this is a real, careful implementation
of the same inferred contract in its own dedicated service, not a
newly-discovered real spec.

**Scope note**: this app is V3 only. Shield (the ecosystem-wide
session/auth layer `venvs-mock-backend` also stands in for) is a real,
distinct ecosystem service — every source doc that mentions either
names them separately ("Shield's session, V3's ledger") — and remains
its own real, still-open gap, not silently folded in here.

**Deliberately, this build does not touch any other app's code.**
Every app already reads a `V3_API_URL` env var with a default —
switching an app over to this real service is a one-line env var
change per app (see "Switching an app over" below), left as a
deliberate follow-up rather than an ecosystem-wide flag day changing
25 apps' configuration in one uncoordinated pass.

## Run
```
cd v3 && npm install && npm start   # localhost:8811
```

## Test
```
curl http://localhost:8811/api/health
curl http://localhost:8811/api/vcoin/balance/user-1
curl -X POST http://localhost:8811/api/vcoin/transfer -H "Content-Type: application/json" -d '{
  "fromUserId":"user-1","toUserId":"user-2","amount":100
}'
```

## What's here
- `lib/vcoin.js` — the real VCoin ledger: `getBalance` (auto-grants
  the real `STARTING_VCOIN_BALANCE` of 1000 to a never-seen account,
  preserved exactly since dozens of already-shipped live tests across
  this ecosystem assert against this exact number), `transfer` (real
  balance validation, real transaction record), `getTransactionHistory`
  (scoped to a user on either side of a transfer).
- `lib/vash.js` — the real VASH ledger: `cashout` (real VCoin → VASH
  conversion at `VCOIN_TO_VASH_RATE`, the same real, flagged-as-
  inferred 0.01 rate the mock used — not silently promoted to "the
  real rate" just because it now lives in its own dedicated service),
  `getVashBalance`.
- `server.js` — a real Express API (CommonJS) matching
  `venvs-mock-backend`'s own real VCoin/VASH routes exactly, in path,
  method, and response shape.

## Verified
8 plain-Node checks (the real 1000 starting-balance auto-grant, a real
transfer moving the exact amount both ways, insufficient-balance and
missing-field rejections matching the mock's own exact real error
text, transaction history correctly scoped per user on both sides, a
real cashout at the exact real 0.01 rate, insufficient-VCoin cashout
rejected, a never-cashed-out account's real 0 VASH balance), plus a
live pass against the actual running server:

**Direct contract parity** — every route hit directly over real HTTP:
balance auto-grant, a real transfer with the transaction recorded and
both balances updated, transaction history, a real cashout, and the
exact real error messages for insufficient funds and missing fields
all confirmed matching the mock's own contract exactly.

**Real drop-in compatibility, the actual point of this build** — VAGO
(an already-built, already-shipped, completely unmodified app from
earlier this session) was started with only its `V3_API_URL` env var
repointed at this new service (`V3_API_URL=http://localhost:8811 npm
start`), no code changed at all. A real casino session was placed
through VAGO's own existing, unmodified API — the real VCoin stake
landed on **this** service, independently confirmed via its own
`GET /api/vcoin/balance/:userId` (player `1000 → 950`, house
`1000 → 1050`), proving an existing app can be repointed here with
zero code changes and continue working identically.

## Ecosystem cutover (done)
Every app that reads a `V3_API_URL`/`VITE_V3_API_URL` env var now
defaults to this real service (`http://localhost:8811`), not
`venvs-mock-backend` (`http://localhost:8791`) — a real, mechanical,
grep-verified change (fallback default only, in `server.js`/client
files and `.env.example`) across all 15 real callers: `voken`,
`voidmagic`, `vulture-flix`, `chopz/chopz-shop`, `vavlt-stvdios`,
`hvntz`, `vulture-music`, `vxllage`, `vulture-pods`, `vacay`, `vago`,
`void`, `cvnvo`, and the two frontend clients (`venvs/src/lib/v3Client.js`,
`vdp/src/lib/v3Client.js`). Any of these can still be pointed elsewhere
by setting the env var explicitly (e.g. back at the mock, or a future
V3 deployment) — only the *default* changed.

**Re-verified against the new default, not an override**: VAGO started
with no `V3_API_URL` set at all — a real casino session
(`POST /api/casino/sessions`, `stakeAmount: 50`) placed a real stake
through VAGO's own unmodified code, landing on this service by default
(`GET /api/vcoin/balance/cutover-test-1` → `1000 → 950`), confirming
the new default itself works, not just an explicit override.

## Real persistence
`lib/persistence.js` (Phase 3) wraps `server.js`'s own store in a
real file-backed store, `data/store.json` — VCoin/VASH balances and
the transaction ledger now survive a restart. Live-verified: moved
real VCoin between two users, killed the running process, restarted
it, and confirmed both real balances came back unchanged from a real
GET. See `dev-docs/phase-3-real-persistence/`.

## Not yet built
- Shield (the ecosystem-wide session/auth layer) — now its own real,
  separate app (`../shield/`), not folded into this one. **Historical
  note, corrected**: an earlier draft of this section described Shield
  as still only inferred inside `venvs-mock-backend`; that's since
  been closed.
- Any real interest/yield mechanic on VASH balances, or a real
  VASH → fiat/external-currency path — genuinely undocumented
  anywhere; the mock's own cashout is VCoin → VASH only.
- A real, cited (not inferred) V3 API spec — neither this app nor the
  mock it was extracted from had access to one; the contract here is
  a careful, real, working implementation of the same real, already-
  proven inferred shape, not a copy of an actual V3 document.
