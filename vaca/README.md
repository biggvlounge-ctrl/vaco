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

## Not yet built
- Real reviewer/dashboard UI for working a verification queue — this
  phase is the real API and data model only.
- Wiring VACA into VEX (VOKEN's own trading floor) or anywhere else in
  the ecosystem "VACA-verified" is referenced but not yet backed by a
  real call.
