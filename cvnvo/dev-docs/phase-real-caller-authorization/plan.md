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
