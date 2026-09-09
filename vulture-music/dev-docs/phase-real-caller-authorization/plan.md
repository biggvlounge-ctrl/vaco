# Plan — real caller authorization on release submission

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to `POST /api/releases` (`artistId`), the real route
that charges the flat-fee distribution charge.

No Authorization header -> unchanged passthrough (verified live:
reached real business logic, failed for an unrelated pre-existing
reason — missing `targetPlatforms` — confirming the auth layer let it
through). A real second Shield session (`dave`) claiming
`artistId: "carol"` was rejected 403.
