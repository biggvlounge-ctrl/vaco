# VACO Passport

The Business Passport layer of the VACO Verified Business Network: a
business registers, gets verified through VACA's already-generic
identity check, and earns real, objective network-activity history
read straight from V3's own ledger — Levels 1 through 3 of the
freeze's five-tier progression.

Source doc: `dev-docs/on-deck/VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md`
— the full, frozen spec (~1200 lines: five business tiers, tokenization,
community treasury, an interoperability gateway, an SDK, a developer
portal). This app is **the narrowest real slice of it**, not the whole
thing.

## Scope note, read this before touching anything here

`VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` §30 mandates an audit
against existing VACO infrastructure before any code — see
`dev-docs/on-deck/README.md`, "The VACO Verified Business Network §30
audit, 25 Sep 2026". That audit found real infrastructure to build on
(VACA's identity verification is already generic — `subjectType` is a
free-form string, nothing stopped a caller from using
`subjectType: 'business'` except that nobody did — HVNTZ's real
business records, and V3's real ledger and transaction history) and
confirmed what does not exist yet: Business Passport as a rich record
(VACA today is a flat boolean), the five-tier progression as a staged
status concept, multi-tenant employee/role permissions, business-
distinct wallets or treasury authorization, Community Treasury/
Proof-of-Impact, tokenization (Levels 4-5), and a real developer
portal/SDK/Interoperability Gateway (one narrow precedent exists — VOID
Direct's API-key system — but no portal, sandbox, or scoping layer).
Building any of those is its own undertaking, not a Passport detail —
so this build does not attempt them.

What's here: **Levels 1-3 only** — Network Member, Verified Business,
Network Business — for one real HVNTZ business, proving the loop
**register → VACA-verify → real V3 activity → Level 3** end to end.
Not built in this pass (all named explicitly rather than silently
skipped):

- **Levels 4-5 (Tokenized Business, Tokenized Assets).** No legal/
  compliance review process exists, and VOKEN's minting is hardcoded to
  a card/collectible domain model (`mintCultureCard`'s required fields
  are card-specific, not a parameterized token schema) — building
  toward these now would mean inventing both the legal gate and the
  token factory, not reusing either.
- **A rich Business Passport record.** VACA's own store is one flat
  array of `{subjectType, subjectId, claimType, evidence (free text),
  status, grade}` reduced to a boolean by `isIdentityVerified`. This
  app's own Passport record (`lib/passport.js`) stores only what Levels
  1-3 need — `businessId`, `level`, `verifiedAt`, `networkActivity` —
  not the fuller legal-name/registration/license/document fields §3
  envisions, since nothing downstream reads them yet.
- **Multi-tenant employee/role permissions.** No substrate exists
  anywhere in the ecosystem (confirmed by the audit) — HVNTZ's own
  access control is single-`ownerId`-equality, nothing more granular.
- **Business-distinct wallets or role-based treasury authorization.**
  V3 is `userId`-keyed throughout with no `ownerType` discriminator —
  a business's money is its owner's personal balance. §6's "employees
  must not automatically control company treasury" has no gate to
  extend yet.
- **Community Treasury / Proof-of-Impact.** Zero real code found
  anywhere in the ecosystem for a community-fund concept.
- **A rich Passport UI.** `public/index.html` covers lookup and the
  register → verify → assess loop against the app's own five routes —
  real data, no invented fields beyond what `lib/passport.js` stores.
- **`decisionLog`.** Deliberately not wired — same coupling-cost
  reasoning as VASH TAP's own README.

## Run it

```
npm install
npm start
curl http://localhost:8826/api/health
```

Boots with real seed data (`lib/seedDemoData.js`) when the store is
empty: a Level 2 (Verified) Passport for HUNT Barber Shop — the same
demo business VASH TAP already seeds under `businessId: 9001` — so the
two apps' demos tell one coherent story: the same real business has
both a live Tap Point (VASH TAP) and a Business Passport (here).

## Demo it end to end

```bash
# 1. Read the Passport — no session needed.
curl http://localhost:8826/api/passports/9001

# 2. Register a Passport for a different business you own (requires a
#    live HVNTZ and a real Shield session matching that business's
#    ownerId).
curl -X POST http://localhost:8826/api/passports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <the business owner's session token>" \
  -d '{"businessId":9002}'

# 3. Verify it — requires a live VACA that actually confirms the
#    business (POST /api/verifications + operator approve there first).
curl -X POST http://localhost:8826/api/passports/9002/verify \
  -H "Authorization: Bearer <the business owner's session token>"

# 4. Advance to Level 3 — requires real V3 transactions where the
#    business owner is fromUserId or toUserId.
curl -X POST http://localhost:8826/api/passports/9002/network-activity \
  -H "Authorization: Bearer <the business owner's session token>"
```

Steps 2-4 need the rest of the ecosystem actually running (HVNTZ for
ownership, VACA for verification, V3 for transaction history) — step 1
works standalone once seeded.

## Routes

| Route | Auth | Notes |
|---|---|---|
| `GET /api/health` | none | |
| `POST /api/passports` | session, HVNTZ business owner | Level 1 — registers against a real HVNTZ business |
| `GET /api/passports/:businessId` | none | fails soft to `business: null` if HVNTZ is unreachable |
| `POST /api/passports/:businessId/verify` | session, HVNTZ business owner | Level 1→2 — calls VACA's real, already-generic verification |
| `POST /api/passports/:businessId/network-activity` | session, HVNTZ business owner | Level 2→3 — reads V3's real transaction history, never a second copy |

## Why some things fail with 502, not a hang

Same reasoning as VASH TAP's own README: HVNTZ ownership checks and
Shield session verification are asked over real HTTP with no retry, and
an unreachable dependency answers 502 rather than hanging the request
forever (`shieldAuth.cjs`'s own precedent, extended to HVNTZ via
`resolveHvntzBusiness` in `server.js`). The one public read route
(`GET /api/passports/:businessId`) fails *soft* instead — `business:
null` — since it has no session to fall back on and identifying a
Passport's stored level doesn't require a live HVNTZ.

## No second ledger, no second credit score

`assessNetworkActivity` (`lib/passport.js`) never calls
`/api/vcoin/transfer` — it only reads `/api/vcoin/transactions/:userId`,
the same real records V3 already serves. The summary it stores is
`{transactionCount, totalVolume, firstTransactionAt,
lastTransactionAt}` — a count and a sum, nothing derived or weighted.
§4's own rule: "Do NOT create an arbitrary subjective credit score...
track objective network activity."

## Test

```
npm test
```

`test/passport.test.js` covers `lib/passport.js` against injected fake
cross-app functions — no network, including the Level-2-before-Level-3
ordering rule and the objective-fields-only assertion on
`networkActivity`. `test/routes.test.js` spawns the real server with
every cross-app URL pointed at a closed port, asserting the guards
refuse anonymous callers, a junk session token gets a clean 502 from an
unreachable Shield, and the public read route degrades safely when
HVNTZ is unreachable.
