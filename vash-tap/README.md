# VASH TAP

The physical-to-digital interaction layer: a physical Tap (a chair, a
wristband, an object) resolves to whoever or whatever it currently
represents, and a payment routes through VACO's existing VCoin ledger
with revenue attributed back to the Tap.

Source doc: `dev-docs/on-deck/VASH_TAP_FREEZE.md` — the full, frozen
spec (~2300 lines: tap types, the 16-step resolution pipeline, security
model, frontend). This app is **the narrowest real slice of it**, not
the whole thing.

## Scope note, read this before touching anything here

`VASH_TAP_FREEZE.md` itself mandates an audit against every other real
app in this ecosystem before any code — see
`dev-docs/on-deck/README.md`, "The VASH TAP §1/§55 audit, 25 Sep 2026".
That audit found real infrastructure to build on (V3's VCoin ledger,
VACA identity, HVNTZ business/location, vaco-notify dispatch) and named
what does not exist yet: real phone push, general messaging, a
security/fraud engine, employee/shift accounts, and dimensioned
analytics. Building any of those is its own undertaking, not a VASH TAP
detail — so this build does not attempt them.

What's here is the §46 required runnable demo, narrowed further: **HUNT
Barber Shop, Chair 1 through 5**, each with a demo barber assigned,
proving the loop **tap → resolve → pay → attribute** end to end against
real V3/VACA/HVNTZ/vaco-notify APIs. Not built in this pass (all named
explicitly rather than silently skipped):

- **Maya's five outfit Taps and the DEGVCHI Jacket embedded Tap** — §46's
  other two demo subjects. Both depend on a real entertainer/product
  model this ecosystem doesn't have yet; seeding them would fabricate
  data with nothing real underneath it.
- **Any frontend** — Tap profile, business dashboard, spender dashboard,
  analytics UI. This is an API-only build, verified by curl and by the
  test suite, matching the "narrowest real demo" scope decision.
- **Freeze/unfreeze and lock/unlock as routes.** The lib functions exist
  (`lib/tap.js`'s `freezeTap`/`unfreezeTap`) and are unit-tested, but a
  correct ownership check for exposing them over HTTP needs more design
  than this pass scoped in.
- **`decisionLog`.** Deliberately not wired — it hard-fails a route if
  `vaco-audit` is unreachable, and that coupling cost wasn't worth
  taking for a first slice.
- **Real phone push.** `vaco-notify`'s webhook/console channel stands in
  for §8's "immediate phone alert" — the audit found no real push
  delivery exists anywhere in this ecosystem yet.

## Run it

```
npm install
npm start
curl http://localhost:8825/api/health
```

Boots with real seed data (`lib/seedDemoData.js`) when the store is
empty: HUNT Barber Shop's five chairs, each already assigned a demo
barber, seeded through the same `registerTap`/`assignTap` functions
production uses — not hand-built store records.

## Demo it end to end

```bash
# 1. Tap resolution — no session needed, this is what tapping does.
curl http://localhost:8825/api/taps/VT-000001/resolve

# 2. Pay it — requires a live V3 and Shield session for fromUserId.
curl -X POST http://localhost:8825/api/taps/VT-000001/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <a real Shield session token for fromUserId>" \
  -d '{"fromUserId":"ada","amount":40,"tip":8,"message":"great fade"}'

# 3. Attribution — Chair 1's revenue, and the spender's own history.
curl http://localhost:8825/api/business/9001/revenue \
  -H "Authorization: Bearer <HUNT Barber Shop owner's session token>"
curl http://localhost:8825/api/spenders/ada/history \
  -H "Authorization: Bearer <ada's session token>"
```

Step 2 is the one step that needs the rest of the ecosystem actually
running (V3 for the transfer, VACA for identity, vaco-notify for the
alert) — steps 1 and 3's reads work standalone once seeded.

## Routes

| Route | Auth | Notes |
|---|---|---|
| `GET /api/health` | none | |
| `POST /api/taps` | session, HVNTZ business owner | registers a Tap against a real HVNTZ business |
| `GET /api/taps/:tapCode` | none | |
| `GET /api/business/:businessId/taps` | none | |
| `GET /api/taps/:tapCode/resolve` | none | §6 resolution; fails soft, not hard, if VACA is unreachable |
| `POST /api/taps/:tapCode/assignments` | session, HVNTZ business owner (via the tap) | §5 dynamic assignment |
| `POST /api/taps/:tapCode/pay` | session, must be `fromUserId` | §7's flow — calls V3's real ledger, never a second one |
| `GET /api/taps/:tapCode/transactions` | none | |
| `GET /api/spenders/:userId/history` | session, own history only | §18 |
| `GET /api/business/:businessId/revenue` | session, HVNTZ business owner | §16 revenue-by-tap |

## Why some things fail with 502, not a hang

Three cross-app dependencies (HVNTZ ownership checks, Shield session
verification, VACA identity) are asked over real HTTP with no retry.
An unreachable dependency answers 502 rather than hanging the request
forever — the same distinction `shieldAuth.cjs` already draws for
Shield ("Shield being unreachable is 502, not 401"), applied here to
HVNTZ too (`resolveHvntzBusiness` in `server.js`). VACA is the one
exception: identity verification on the public resolve route fails
*soft* (`assigneeVerified: null`), matching VOID's own standing rule
("VACA verification... fail soft, never block a real job") — resolution
identifies the object, it doesn't authorize a payment.

## Test

```
npm test
```

`test/tap.test.js` covers `lib/tap.js` against injected fake
cross-app functions — no network. `test/routes.test.js` spawns the
real server with every cross-app URL pointed at a closed port, and
asserts the guards refuse anonymous callers, a junk session token gets
a clean 502 from an unreachable Shield, and the public resolve route
degrades safely when VACA is unreachable — the regression its own fix
exists to hold.
