# Plan — real caller authorization on V3's money-moving routes

## Goal
Close the highest-severity finding from the ecosystem audit: `POST
/api/vcoin/transfer` had no check that the caller actually is the
account being debited.

## Real correction to the audit's own claim, made honestly
The audit said "no balance check enforced." Rereading `lib/vcoin.js`
directly disproved that: `transfer()` already throws
`'Insufficient VCoin balance.'` when `fromBalance < amount` — that
check was real all along. What was actually missing, and is the real
fix here, is caller *authorization*: nothing verified the request
came from the `fromUserId` it named. The audit's wording gets
corrected in the delivery summary rather than left standing.

## Real constraint discovered before writing the fix
Requiring a Shield session unconditionally would break real,
already-working, already-tested server-to-server transfers: pack-
opening charges, referral/spin bonus payouts, VEX buy/sell
settlement, and more all call this endpoint as trusted backend
services with no end-user session at all. A blanket
`requireSession()` (VXLLAGE's own existing pattern) would 401 all of
them.

## Design
`lib/shieldAuth.js`, adapted from `vxllage/lib/shieldAuth.js`:
`optionalOwnAccount(bodyField)` — if no `Authorization` header is
present, the request passes through unauthenticated (unchanged
behavior, real backward compatibility for every existing server-to-
server caller). If a header *is* present, its session must be valid
*and* its real `userId` must equal the request's own `bodyField`
(`fromUserId` on transfer, `userId` on cashout) or the request is
rejected with 403. This closes exactly the fixable half of the gap —
a browser or external caller can no longer claim to be a user whose
session it doesn't hold — while being honest that the other half (a
trusted-service allowlist so unauthenticated calls are provably
internal, not just currently-always-internal) is real, remaining
scope, not silently solved.

## Verification approach
Live, against real Shield sessions, not simulated: registered two
real users (alice, bob) via Shield's own `/api/shield/register`.
Confirmed, in order: (1) an unauthenticated server-to-server transfer
still succeeds unchanged; (2) bob's real session attempting to
transfer *from* alice's account is rejected 403; (3) alice's own
session transferring from her own account succeeds 201; (4) a bogus
token is rejected 401. Repeated (2)/(3) against `/api/vash/cashout`.

## Explicitly NOT in this task
No change to `GET /api/vcoin/balance/:userId` or
`/api/vcoin/transactions/:userId` (reads, left open, matching this
ecosystem's existing posture elsewhere). No trusted-service allowlist
for the unauthenticated path — flagged as real follow-up, not built.

## Done when
Both real money-moving routes reject impersonation while every
existing real integration keeps working unauthenticated, verified
live against real Shield sessions, not assumed from the code alone.
