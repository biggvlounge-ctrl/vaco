# VASH TAP

The physical-to-digital interaction layer: a physical Tap (a chair, a
wristband, an object) resolves to whoever or whatever it currently
represents, and a payment routes through VACO's existing VCoin ledger
with revenue attributed back to the Tap.

## The personal wearable line: Bracelet and Ring

§53's own definition of "VASH TAP PERSONAL" ("Personal wearable/card")
never named which physical products that covers; every personal Tap
built so far has been described only generically ("a wristband," or,
in VDP's own onboarding, "a band"). Two real, named products now exist,
both registering the exact same `tapType: 'personal'` Tap underneath —
the difference is the physical form, not the software:

- **VASH TAP Bracelet** — the existing default: a wristband, presented
  face-up to a reader. Unnamed until now; this is simply giving the
  thing that already existed a real product name alongside its new
  sibling.
- **VASH Ring** — a smaller, cheaper comparable: a basic rubber band
  with the NFC inlay set on the underside, against the palm, so the
  whole gesture is resting a hand flat over the reader rather than
  turning a wrist to present a face. Real, current (2025–2026) market
  comparables confirming a rubber/ceramic ring carrying a passive NFC
  payment inlay is a real, shipped hardware category, not a
  speculative one: **Circular's Ring 3 Pro/Slim** (NFC Visa/Mastercard
  tap-to-pay, announced at IFA Berlin, Sep 2026) and **Banco Inter's
  "Inter Ring"** (passive, battery-free NFC, already shipping in the
  US). Neither is VASH TAP-specific — they ground the form factor, not
  the ecosystem.

Both are `objectType` values on a `tapType: 'personal'` registration
(`lib/tap.js`'s `PERSONAL_WEARABLE_FORM_FACTORS`, also `card` for §53's
third personal form — a VASH TAP card carried in a wallet, no wearable
at all). The catalog is queryable from `GET /api/health` rather than
left as undocumented prose. `objectType` is optional and, if omitted,
stays the same legacy `null` a personal Tap has always defaulted to —
naming a form factor is additive, not a required migration for taps
already issued.

**What is not built here:** the physical ring itself (manufacturing,
BOM, sourcing a rubber/ceramic band and an NFC inlay) is real hardware
product work, not code — the same honest boundary this repo draws
everywhere else between a real software slice and a real physical
product (see §51's "VASH TAP READY MANUFACTURER SYSTEM" for the
general pattern this already follows: software prepares the
registration path, a manufacturer supplies the physical object).

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
- **A dimensioned analytics UI.** `public/index.html` covers resolve,
  pay, spender history, and business taps/revenue against the app's own
  14 routes — real data, no invented dashboards. What it does not add is
  anything the API itself doesn't compute: no charts, no time series,
  since the audit found no dimensioned analytics schema underneath.
- **Lock/unlock as routes.** Distinct from freeze/unfreeze (§40, wired
  below) — the freeze spec's own security section names them
  separately, and no lock semantics beyond "frozen" were designed here.
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
# idempotencyKey is required, not optional: it is what makes a retried
# tap (a timeout, a double-tap, a flaky connection) safe to repeat
# instead of charging twice. Generate a fresh one per real payment.
curl -X POST http://localhost:8825/api/taps/VT-000001/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <a real Shield session token for fromUserId>" \
  -d '{"fromUserId":"ada","amount":40,"tip":8,"message":"great fade","idempotencyKey":"<a fresh uuid per payment>"}'

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
| `GET /api/taps/:tapCode/resolve` | none | §6 resolution (steps 1-6: id, status, assignment, VACA, business); fails soft, not hard, if VACA or HVNTZ is unreachable |
| `POST /api/taps/:tapCode/assignments` | session, HVNTZ business owner (via the tap) | §5 dynamic assignment |
| `POST /api/taps/:tapCode/freeze` | session, HVNTZ business owner (via the tap) | §40 lost/stolen Tap — stops payability immediately |
| `POST /api/taps/:tapCode/unfreeze` | session, HVNTZ business owner (via the tap) | refuses if the Tap is not currently frozen |
| `POST /api/taps/:tapCode/dreams-screen` | session, HVNTZ business owner (via the tap) | links a real DREAMS screen id to a `business`-type Tap — a reference, never a copy of the screen's own record; requires the screen to exist |
| `POST /api/taps/:tapCode/dreams-screen/unlink` | session, HVNTZ business owner (via the tap) | clears the link |
| `POST /api/taps/:tapCode/pay` | session, must be `fromUserId` | §7's flow — calls V3's real ledger, never a second one; requires `idempotencyKey` |
| `GET /api/taps/:tapCode/transactions` | session, HVNTZ business owner (via the tap) | transaction detail for one Tap is the business's own data |
| `GET /api/spenders/:userId/history` | session, own history only | §18 |
| `GET /api/business/:businessId/revenue` | session, HVNTZ business owner | §16 revenue-by-tap |

## Why some things fail with 502, not a hang

Cross-app dependencies (HVNTZ ownership checks, Shield session
verification) are asked over real HTTP with no retry. On the
session-gated, owner-only routes (registration, assignment, freeze/
unfreeze, revenue), an unreachable dependency answers 502 rather than
hanging the request forever — the same distinction `shieldAuth.cjs`
already draws for Shield ("Shield being unreachable is 502, not 401"),
applied here to HVNTZ too (`resolveHvntzBusiness` in `server.js`).

The public resolve route is the one exception, on both of its
dependencies: VACA identity verification (`assigneeVerified: null`)
and HVNTZ business resolution (`business: null`) both fail *soft*,
matching VOID's own standing rule ("VACA verification... fail soft,
never block a real job") — resolution identifies the object, it
doesn't authorize a payment, and the one route with no session
requirement must not go down on a dependency it doesn't strictly need.

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` making real calls against only 8
of this app's 14 routes — Resolve, Pay, My history, and Business
covered resolution, payment, spender history, and taps/revenue, but
every write-side route that actually manages a Tap (registering one,
assigning one, linking a DREAMS screen) had no frontend client at
all, and neither did the plain record lookup or the personal-wearable
line's own registration. All six gaps are real, derived directly from
grepping `server.js`'s route table against every literal path already
called by the page — nothing here invents a field, a response shape,
or a computation `lib/tap.js` doesn't already perform.

Three owner-only actions added to the **Business** tab, alongside the
existing freeze/unfreeze:

- **Register a new tap** (`POST /api/taps`, `tapType: 'business'`) —
  the one route that creates a Tap Point had no form anywhere; every
  seeded chair went through `registerTap()` in `seedDemoData.js`, but
  nothing let a real owner do it live.
- **Assign a tap** (`POST /api/taps/:tapCode/assignments`) — §5's
  dynamic assignment, surfacing `assignTap()`'s real
  VACA-verification refusal as the server's own error message rather
  than guessing at it client-side.
- **Link / unlink a DREAMS screen**
  (`POST /api/taps/:tapCode/dreams-screen` and its `/unlink`) — the
  optional reference link from a business Tap Point to a real DREAMS
  ad screen at the same physical location; a reference only, neither
  record is copied.

`renderBusiness`/`loadBusiness` were also refactored to mount lookup
results into their own dedicated container instead of a fragile
`out.childNodes.length > N` splice — the owner-only section now holds
four cards instead of one, and the old count would have had to be
kept in sync by hand on every future addition.

A new **My Tap** tab, separate from Business because registering a
personal Tap is a self-service action (the caller names themself as
`ownerIdentityId`), not an owner-of-a-business action:

- **Register your personal Tap** (`POST /api/taps`,
  `tapType: 'personal'`) — §53's VASH TAP PERSONAL line
  (bracelet/ring/card, see the section above) had zero frontend
  presence despite this README dedicating real text to naming the
  product line. Form-factor options are read live from
  `GET /api/health`'s `personalWearableFormFactors` rather than
  hardcoded, so a fourth form factor added server-side needs no
  frontend change.
- **Look up any Tap** (`GET /api/taps/:tapCode`) — the plain record
  lookup, distinct from §6 resolution (no assignment, no VACA check,
  no business join): confirms a registration took, and works as a
  generic lookup for any tap code.

The tab says plainly, in its own copy, what this build does not yet
support for a personal Tap: assignment and freeze both require
`tap.businessId` server-side (`requireTapBusinessOwner` in
`server.js` 400s without one), so a personal Tap is registration-only
today — the same honesty this README already holds about the rest of
this app's scope, not a gap this pass tried to quietly close.

**Left for a follow-up round, named rather than silently skipped:**
`GET /api/taps/:tapCode/transactions` (per-tap transaction detail) is
still only ever called from the Resolve tab's own best-effort fetch;
a dedicated owner-facing transaction browser on the Business tab
would be a reasonable next addition, but didn't fit this pass's time
budget alongside the six gaps above.

Live-verified rather than assumed: registering a business tap and a
personal tap both succeeded against a running vash-tap + Shield +
HVNTZ, round-tripped through `GET /api/taps/:tapCode`, and an invalid
personal `objectType` ("watch") was correctly refused by
`registerTap()`'s own validation. The assignment and DREAMS-link
routes were confirmed live down to their real auth/error shape
(401 with no session, 502 once a session exists but a dependency is
unreachable) — the same two services this environment could not keep
running long enough to also test a real VACA-verified assignment, so
those two still rest on this app's own passing `npm test` plus
`lib/tap.js`'s existing unit coverage for the full success path.

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
