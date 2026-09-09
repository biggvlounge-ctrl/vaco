# Plan — real caller authorization on tier subscriptions

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to `POST /api/tiers/:id/subscribe` (`userId`), the real
route that moves VCoin via the real 80/20 creator split.

Verified live: a real second Shield session (`dave`) claiming
`userId: "carol"` was rejected 403.
