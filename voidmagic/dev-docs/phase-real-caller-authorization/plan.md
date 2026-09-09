# Plan — real caller authorization on booking

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to `POST /api/bookings` (`customerId`), the real
VCoin-charging route.

No Authorization header -> unchanged passthrough (verified live:
reached real business logic, failed for an unrelated pre-existing
reason — no experience with that id — confirming the auth layer let
it through). A real second Shield session (`dave`) claiming
`customerId: "carol"` was rejected 403.
