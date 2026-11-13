# Plan — real caller authorization on real VCoin-moving routes

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to CVNVO's own two real money-moving routes:
`POST /api/gift-dating/request` (`requesterId`) and
`POST /api/blind-date/token` (`userId`).

No Authorization header -> unchanged passthrough (verified live: an
unauthenticated blind-date token purchase still succeeds, 201). A
header that's present must match the route's real acting-user field
or the request is rejected — verified live: a real second Shield
session (`dave`) claiming `requesterId`/`userId: "carol"` was rejected
403 on both routes.

**Corrected 13 Nov 2026**: this plan's own `optionalOwnAccount(bodyField)`
is gone from the shared `lib/shieldAuth.cjs` this app syncs from
`./sync-shared-runtime.sh` — checked directly, not assumed:
`shieldAuth.cjs`'s own header says it was deliberately removed, "not
deprecated," across the whole ecosystem. The real guard on both routes
today is `requireActor(...fields)`, and it is a strictly stronger,
unconditional check, not the optional passthrough this plan describes:
`requireActor` calls `resolveSession`, which now answers 401 on a
request with **no** Authorization header at all. Live-verified just
now: an unauthenticated `POST /api/blind-date/token` gets a real 401
(`serviceAuth: this route requires either a user session...`), not the
201 this plan's own verification step recorded. The mismatched-actor
behavior this plan documents (403 on a wrong `requesterId`/`userId`)
is still accurate — that part of `requireActor` kept the same shape —
only the "no header is fine" half is obsolete.
