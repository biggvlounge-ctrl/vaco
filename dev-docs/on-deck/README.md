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
| `VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` | frozen, audit begun and stopped; **text restored 23 Sep** | 17 Sep 2026 |
| `VAGO_GROUP_WAGERS_FREEZE.md` | frozen, audit begun and stopped; **text restored 23 Sep** | 17 Sep 2026 |
| `HVNTZ_CONNECTED_NETWORK_FREEZE.md` | frozen, **audit not started** | 23 Sep 2026 |
| `VASH_TAP_FREEZE.md` | frozen, **audit not started** | 23 Sep 2026 |

**More are expected.** The owner said on 23 Sep 2026 that three or four
add-ons were coming and that two had been sent; this folder holds those
two. A count stated here rather than remembered is the point — if a
third and fourth arrive and nothing records that they were expected,
their absence looks like a decision rather than a gap.

## The two restored on 23 Sep 2026, and why it is not a formatting note

**Both 17 Sep freezes said "Verbatim as frozen by the owner" and were
not verbatim.** The owner re-supplied the full text; comparing it
against what was on file:

- `VAGO_GROUP_WAGERS_FREEZE.md` had been condensed and reflowed. §17's
  seven payout formats were folded into a running sentence and the
  "BLIND GROUP — 10 PLAYERS" example was gone. 278 lines against 741.
- `VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md` **lost content, not just
  shape.** Missing entirely: **"BUSINESSES DO NOT JUMP DIRECTLY TO
  TOKENIZATION"** — the freeze's own stated fundamental principle, the
  sentence the whole five-level progression exists to enforce — and
  **"Do not invisibly pool separate hub allocations unless a documented
  community program explicitly authorizes pooling"**, a specific
  constraint on how community money may be handled. 472 lines against
  1,188.

Both now carry the full text with a note recording what was restored.

**Why this is the worst version of this repo's recurring failure.**
Everywhere else, a document drifted from code and the code was
authoritative, so the damage was bounded — you could always re-measure.
Here the document IS the authority. There was nothing to re-derive it
from. Had the audit resumed from the condensed copy, it would have
planned tokenisation without the rule that tokenisation is a graduation,
and community treasuries without the rule against pooling them — and
every downstream artefact would have been consistent, tested, and built
on a specification the owner never wrote.

The instruction at the top of each file was already correct: *an edited
copy is a different specification.* It was written and then not
followed, in the same commit, by whoever filed the condensed text.

**The rule this establishes: a frozen document is transcribed, never
summarised, and a summary lives beside it rather than replacing it.**
If a freeze is too long to file comfortably, that is not a reason to
shorten it — the length is the specification. Any future freeze filed
here should be diffed against the owner's message before the session
that received it ends, because after that the original is gone and the
copy becomes the truth by default.

## The two filed on 23 Sep 2026

Both arrived as additive freezes with the same mandatory first step as
the 17 Sep pair — inspect the existing implementation before writing
anything — and neither audit has begun. What the earlier audit already
established applies directly to both and is worth pointing at rather
than rediscovering:

**HVNTZ Connected Network.** HVNTZ has a real surface (40 routes) and
Vault Studios exists, so the freeze's "extend, do not rebuild"
instruction has something concrete to extend. Its §40 is an explicit
non-duplication rule naming Vault Studios, VACA, VASH/VCoin, V4, DREA
and VOID — all of which the earlier audit confirmed are real.

**VASH TAP.** Its §1 and §7 forbid a second wallet, ledger or payment
system, and the earlier audit already identified what that means in
practice: **V3 is the canonical VCoin/VASH ledger** — `/api/vcoin/
balance`, `transfer`, `settle`, `transactions`, `reconciliation`,
`/api/vash/cashout`, `/api/vash/balance` — with a row-level ledger
behind `DATABASE_URL` and idempotent settlement via `settleOnce.js`.
That is the system §7 means. Note also the unverified owner correction
below ("VACA is blockchain app in v3"), which bears on VASH TAP's
identity resolution in §6 and §10.

One thing in VASH TAP is worth flagging now because it is a claim about
physics rather than architecture, and the freeze itself gets it right:
§41 states that passive NFC does not continuously broadcast location
and "must not be falsely represented as an NFC capability". Any
geographic analytics built under §23 and §43 are therefore tap-event
analytics, not location tracking, and the distinction should survive
into whatever the dashboards say.

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
