# Plan — real caller authorization on show subscriptions

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to `POST /api/shows/:id/subscribe` (`userId`), the real
VCoin-charging route.

Verified live: a real second Shield session (`dave`) claiming
`userId: "carol"` was rejected 403.
