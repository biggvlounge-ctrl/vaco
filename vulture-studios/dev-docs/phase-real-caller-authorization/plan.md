# Plan — real caller authorization on project investment

Same `optionalOwnAccount(bodyField)` pattern established for V3/VOKEN/
VAGO, applied to `POST /api/projects/:id/invest` (`investorId`) — the
single most sensitive route in this whole batch: real financing
raised from real investors for real proportional equity.
Impersonating an investor here isn't just a wrong VCoin balance, it's
a false equity claim.

Verified live: a real second Shield session (`dave`) claiming
`investorId: "carol"` was rejected 403.
