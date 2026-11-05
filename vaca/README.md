# VACA

The ecosystem's identity/authenticity verification layer — one of
V3's three real, distinct components (**VCoin**, **VASH**, **VACA**),
confirmed via direct investigation to have been the only one of the
three never actually built. VCoin and VASH were already genuinely
separate in `venvs-mock-backend` (distinct in-memory stores, distinct
`/api/vcoin/*`/`/api/vash/*` namespaces, a real explicit conversion
function between them) — VACA existed only as a name referenced across
VSAFE's own architecture doc ("V4 (AI), DREAMS (ads), and VACA
(identity)") and VOKEN's own docs/code ("VACA-verified" provenance,
`valueAlgorithm.js`'s "VACA-verified authenticity" grade input), with
zero real implementation anywhere. This is that real, standalone,
app-agnostic service.

**The gap this closes, concretely**: VOKEN's own
`POST /api/card/:id/value-score` endpoint, before this project
existed, computed a card's real value score using an
`authenticityGrade` taken directly from the request body — trusted
blindly, with nothing actually verifying it. VACA is now the real
authority; VOKEN calls it live.

## Run
```
cd vaca && npm install && npm start   # localhost:8804
```

## Test
```
curl http://localhost:8804/api/health
curl -X POST http://localhost:8804/api/verifications -H "Content-Type: application/json" -d '{
  "subjectType":"voken-card","subjectId":"1","claimType":"authenticity","evidence":"Signed COA from issuing house."
}'
```

## What's here
- `lib/verifications.js` — the real core loop: `submitVerification`
  (pending), `approveVerification` (real reviewer decision — a letter
  grade is required for `claimType: 'authenticity'`, rejected for
  every other claim type, since a grade doesn't mean anything for "is
  this person who they say they are"), `rejectVerification`,
  `listVerificationsForSubject`, and the real convenience query other
  apps actually call: `getAuthenticityGrade` — the most recent
  *verified* authenticity grade for a subject, or honestly `null` if
  there isn't one (unverified, rejected, and no-claim-at-all all
  resolve the same way — no fabricated default lives here; that policy
  choice belongs to each caller).
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Real cross-app integration: VOKEN
`../voken/server.js`'s value-score endpoint now calls VACA live
(`fetchAuthenticityGrade`) instead of trusting client input. A card
with no verified VACA claim resolves to grade `'C'` — a real,
deliberate, flagged default (unverified is the least-privileged tier,
never silently promoted to a better grade than it's earned). Verified
live: a lying request body (`"authenticityGrade":"A"` on an unverified
card) is now genuinely ignored, confirmed by the actual computed score
staying at grade C.

## Real cross-app integration: CVNVO
`../cvnvo/server.js`'s `POST /api/profiles` now calls VACA live
(`fetchIdentityStatus`, hitting the new `GET
/api/identity-status/:subjectType/:subjectId` route below) instead of
trusting a client-supplied `verifiedBadge` boolean — the exact same
"trusted client input" gap the VOKEN integration above already closed,
found in `lib/profiles.js`'s own field of the same name. Unlike
authenticity, an identity claim carries no grade, so the new
`isIdentityVerified` convenience query (mirroring `getAuthenticityGrade`'s
own shape) resolves to a plain boolean, honestly `false` for
unclaimed/pending/rejected alike. Verified live in both directions: a
profile created with a lying `verifiedBadge: true` for a user with no
VACA claim came back `false`; after submitting and approving a real
VACA identity claim for a different user, a profile created with a
lying `verifiedBadge: false` came back `true`.

## Verified
23 plain-Node checks (submission validation, the full authenticity-
claim approval lifecycle including double-approval rejection,
non-authenticity claims correctly rejecting a supplied grade, rejection
requiring a reason and rejecting a second attempt, per-subject
isolation, an unclaimed subject resolving honestly to `null`, a later
claim correctly superseding an earlier one), plus a live pass: VACA
and VOKEN running independently — a real card's value-score computed
before verification (authenticityScore 40, grade C), a real VACA
verification submitted and approved with grade A, the same card's
score recomputed live and genuinely changed (authenticityScore 100,
`combinedRealValueScore` 28.68 → 34.98), and a second, fresh card's
request with a lying grade in the body confirmed to still resolve to
grade C. See `dev-docs/` for the full record.

8 further plain-Node checks for `isIdentityVerified` (unclaimed →
false, pending → false, approved → true, an identity claim rejecting a
supplied grade at approval, a rejected claim → false, no cross-leak
across `subjectType` namespaces, `getAuthenticityGrade` unaffected by
identity claims sharing the same subject), plus a live pass against
VACA + CVNVO running independently proving the override in both
directions described above.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8804) — VACA's own real state now survives a
restart. Live-verified: submitted a real identity verification, killed the
running process, restarted it, and confirmed the same real state came back
from a real GET. See `dev-docs/phase-3-real-persistence/`.

## Frontend coverage pass (31 Oct 2026)
An audit found `public/index.html` making real calls against only 7 of
this app's 12 routes — the two original tabs (Lookup, Review) covered
the submit/approve/reject/lookup loop, but the real local blockchain
ledger (`lib/blockchain.js`) and public-chain anchoring
(`lib/publicChainAnchor.js`) had no frontend exposure at all, only
reachable by curl. A new **Chain** tab closes that, a real client of
the remaining four routes, every field checked against the real route
handler first:

- `GET /api/chain` — the chain itself plus its real integrity verdict
  (`verifyChainIntegrity`), rendered as a table (block index, decision
  timestamp, claim type/status/grade, truncated hash) with a refresh
  button.
- `GET /api/chain/block/:index` — looks up one block by index and
  shows its hash, previous hash, and real decision payload.
- `GET /api/chain/posture` — whether public-chain anchoring is
  configured (it is not, by default — no funded wallet or RPC
  provider exists yet).
- `POST /api/verifications/:id/anchor-on-chain` — operator-gated
  (`vaca:verify`); the form takes an `X-Operator-Credential` the same
  way `cvnvo/yap`'s moderation tab already does, since this route has
  no service-token fallback. Posts the verification's own block hash
  as a transaction on a real public chain once one is configured;
  until then it honestly refuses (never fabricates a transaction
  hash), and that refusal surfaces as the real error message.

The tab's own copy is deliberately careful about what this chain is
and is not, per `lib/blockchain.js`'s own header: a real,
cryptographically-linked chain of every approve/reject decision, with
no peer network and no consensus — one ledger inside VACA, not a
distributed one. Public anchoring is a separate, genuinely different
thing from that local chain, and the page never implies one is live
until `describeChainPosture()` says so.

**Left alone, not a gap this pass closes:** the existing Review tab's
Approve/Reject buttons (pre-existing code, not touched here) call
`requireOperator`-gated routes without sending
`X-Operator-Credential` at all, so they 401 against a real
vaco-operator the same way an anonymous caller would. The new Chain
tab's own anchor form does send the header and was verified against a
real running server; the Review tab's gap is a separate, pre-existing
issue worth a follow-up pass, not introduced or fixed here.

**Verified** against a running server (service-auth and operator-auth
relaxed to exercise the plumbing, since no vaco-operator/vaco-audit
instance was available in this environment): submit → approve →
`GET /api/chain` showed the one real block; `GET /api/chain/block/0`
returned its real hash/previousHash/data; `GET /api/chain/posture`
reported the real, honest unconfigured state; and
`anchor-on-chain` against an undecided verification returned the real
"has not been decided yet" refusal rather than a fabricated success.
vaca's own 38-test suite (`node --test test/*.test.js`) passes
unchanged.

## Reviewer queue (1 Nov 2026)

Closes the "real reviewer/dashboard UI for working a verification
queue" gap above. `GET /api/verifications/pending` (new, operator-gated
the same `vaca:verify` way approve/reject already are) returns every
`pending` claim across every subject, oldest first — a real FIFO
reviewer queue, not a per-subject history. Backed by
`listPendingVerifications(store)` in `lib/verifications.js`.

The frontend's "Review queue" card (`public/index.html`) renders this
list with inline Approve/Reject right in the table: Approve shows a
grade `<select>` only for an `authenticity` claim, populated live from
`/api/health`'s own `authenticityGrades` rather than hardcoded; Reject
prompts for a reason. Both require `VACO.userId()` to be set, since
`reviewedBy` is a real, required field, not a formality.

**Three real, pre-existing bugs found and fixed while building this**,
each one independently verified live against a spawned server:

- **Route-ordering bug**: `GET /api/verifications/:id` was declared
  before the new `/pending` route. Express matches by declaration
  order, so `GET /api/verifications/pending` was being swallowed by the
  `:id` route (`pending` as a literal id) and always 404'd. Fixed by
  moving `/pending` above `/:id` in `server.js`.
- **`lib/operatorAuth.cjs`'s `off` mode never set `req.operator`**, it
  just called `next()`. Every route that reads
  `req.operator.operatorName` unconditionally (the decision log on
  approve/reject) crashed instead of running locally with
  `VACO_OPERATOR_MODE=off`. Fixed to set the same
  `{ operatorName: 'unverified', ... }` stub the existing
  observe/unreachable branch already uses. **This file is duplicated
  verbatim across 13 apps in this ecosystem** (voken, vaco-notify,
  hvntz, vulture-music, vaco-shell, vulture-studios, vaca, vago, void,
  vacon-c, v3, cvnvo/yap, vex) — the same one-line fix was applied to
  every copy, since it is the same bug with the same fix everywhere it
  occurs. A regression test lives in `vaca/test/operatorAuth.test.js`.
- **Frontend contract drift**: the submit form sent `verificationType`
  (not a real field — `submitVerification` takes `claimType`) and never
  sent `evidence` at all, which `submitVerification` always refuses.
  The approve/reject buttons, in both the queue and the older
  lookup-by-id panel, POSTed empty bodies — `approveVerification`
  requires `reviewedBy` always and `grade` for an authenticity claim;
  `rejectVerification` requires `reviewedBy` and `reason`. None of this
  frontend's review actions could ever have succeeded against the real
  backend before this pass. All fixed in `public/index.html`.

### Verification
- `node --test test/*.test.js`: 42/42 passing (3 new tests for
  `listPendingVerifications`, 1 new test for the `operatorAuth.cjs`
  `off`-mode fix).
- Mutation-verified: breaking `listPendingVerifications`'s
  `status === 'pending'` filter turned exactly the two queue-contents
  tests red; breaking the `operatorAuth.cjs` fix turned exactly the new
  `operatorAuth.test.js` test red. Both restored and reconfirmed green.
- Live-verified against a real spawned server
  (`VACO_OPERATOR_MODE=off VACO_SERVICE_AUTH_MODE=off
  VACO_AUDIT_MODE=observe node server.js`): submitted an authenticity
  claim and an identity claim, confirmed both appeared in
  `GET /api/verifications/pending` oldest-first, approved the
  authenticity claim with a real grade, rejected the identity claim
  with a real reason, confirmed both left the pending queue, and
  confirmed `GET /api/authenticity-grade/...` returned the real
  approved grade. Also exercised the fixed lookup-by-id panel's
  approve path with the same real payload shape.

## Not yet built
- ~~Wiring VACA into VEX (VOKEN's own trading floor) or anywhere else
  in the ecosystem "VACA-verified" is referenced but not yet backed by
  a real call.~~ **Stale — this is done.** VOKEN is VEX's own canonical
  home (per `voken/README.md`'s own "VEX/VADO" note), and VOKEN's real
  value algorithm already fetches the card's real, live authenticity
  grade from here, not a caller-supplied value: `server.js`'s own
  `GET /api/card/:id/value-score` and `GET /api/card/:id/full` both
  call `fetchAuthenticityGrade` against this app's own
  `GET /api/authenticity-grade/:subjectType/:subjectId`, and
  `lib/valueAlgorithm.js`'s own header confirms `authenticityGrade` is
  "the real 'VACA-verified' part" of the card's actual trade-relevant
  value, not cosmetic — see VOKEN's own "Real, visible VACA
  verification badge (1 Nov 2026)" section for the fail-soft-on-outage
  design and its own verification record.
