# On deck — accepted, not started

Architecture the owner has frozen and deliberately deferred. Nothing in
this folder is built, and nothing in it should be built without the
owner saying so.

**Why a folder rather than a branch or an issue.** Both documents here
arrived as complete freezes with their own mandatory first step — audit
before writing code — and the audit was stopped part-way by the owner
to prioritise VACON-C. Keeping the frozen text verbatim means the
audit restarts from what was actually specified rather than from
somebody's memory of it, which is the failure this repo keeps finding.

| document | status | parked |
|---|---|---|
| `VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` | frozen, audit begun and stopped | 17 Sep 2026 |
| `VAGO_GROUP_WAGERS_FREEZE.md` | frozen, audit begun and stopped | 17 Sep 2026 |

## What the partial audit established

Recorded because it is the expensive part and it is easy to redo badly.

**Real and reusable today.** V3 is the canonical VCoin/VASH ledger —
`/api/vcoin/balance`, `transfer`, `settle`, `transactions`,
`reconciliation`, `/api/vash/cashout`, `/api/vash/balance` — with a
row-level ledger behind `DATABASE_URL` and idempotent settlement.
VOKEN (64 routes), VAGO (41), VOID (161), VXLLAGE (64), VSAFE (43),
HVNTZ (40), V4-proxy (28) all have real surfaces. `settleOnce.js`,
`provablyFair.js`, `goldCoin.js`, `serviceAuth`, `shieldAuth` and the
shared persistence layer all exist and are what the freezes mean by
"do not duplicate".

**Named in the freezes and NOT present.** Measured by grep across every
non-`node_modules` JS file:

- `wager contract`, `wager graph`, `wager thread`, `side wager`,
  `escrow adapter`, `resolution engine` — **0 files each.** The VAGO
  Group Wagers freeze opens by requiring integration with "the existing
  VAGO Wager Contract Engine, Wager Graph, Wager Threads, Odds Layer,
  Escrow Adapter, Resolution Engine" and instructing that they not be
  duplicated. None of those exist. What VAGO actually has is casino
  (mines, plinko, hilo), fantasy props, prediction markets, a
  sportsbook, esports staking and AMOE — a different shape entirely.
  **Group wagers cannot be layered onto a wagering engine that has not
  been built**, so that engine is the real first task whenever this
  resumes, not the group layer.
- `KYB` / "know your business" — 0 files.
- `multi-tenant` / `multiTenant` — 0 files. VACO freeze §17 calls
  tenant isolation "a foundational requirement".
- `proof-of-impact`, `community allocation` — 0 files.
- `passport` — 1 file; `tenant` — 2; `blockchain` — 1.

**A correction the owner made mid-audit, not yet verified in code:**
"VACA is blockchain app in v3." The audit had VACA as a small
identity service (8 routes) and had not connected it to V3. Verify
this first when resuming — it changes where the blockchain substrate
for freeze §9, §10 and §24 is presumed to live.

**A measurement error worth keeping.** The first concept scan used
`grep -rliE "vcoin\|VCoin"` — `\|` is a literal in an extended regex,
so it searched for the string `vcoin|VCoin` and reported **0 files**
for the ledger the whole freeze is built on. Three of fourteen terms
were wrong the same way. A scan that finds nothing must be suspected
before it is believed.

## Compliance gates that stay shut regardless

These are legal gates, not scope decisions, and neither freeze
overrides them:

- Gambling/casino systems #291-305 remain closed pending compliance
  review.
- VAGO settles in VCoin or Gold Coin only; real-money gambling is out
  of scope.
- `isComplianceCleared(store, 'fractional-ownership')` stays shut,
  which bears directly on freeze §4, §5, §11 and §12 (tokenised
  businesses and assets).
- VEX `placeTradeOrder` is not cleared to move money.
- No standalone `/api/banking/*`; banking routes through VASH.
- VACANCY ownership stays in-simulation-only, permanently.

The freezes themselves say tokenisation "must follow applicable legal,
regulatory and compliance requirements" and that a group structure
"must never be used to bypass individual restrictions", so these gates
and the frozen architecture agree.
