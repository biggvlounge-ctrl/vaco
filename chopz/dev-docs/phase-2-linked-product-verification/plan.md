# Plan — Phase 2: real linkedProductId verification

## Goal
Close a real, already-named gap: `videos.js`'s own header already
said live cross-app validation of `linkedProductId` against CHOPZ SHOP
was "the real next step, not built yet." Build it.

## Real investigation before any code
Re-read the existing header's own reasoning before designing anything:
forcing every video upload to synchronously round-trip to CHOPZ SHOP
(a separate app/process) would block the primary content-creation
path on a dependency it doesn't strictly need at creation time — the
same real precedent TikTok itself follows (no synchronous shop-link
validation at upload time). That reasoning still holds; the fix is a
real, separate, deferred verification step, not forcing validation
into `createChopzVideo` itself.

Checked CHOPZ SHOP's own real product shape (`{id, sellerId, price,
affiliateCommissionPercent}`) and its real `GET /chopz-shop/products/:id`
route directly before designing the client, rather than guessing the
shape.

## Design
`createChopzVideo` gains one new field, `linkedProductVerified: false`
— always present, honest by default. `verifyLinkedProduct(store,
{videoId, chopzShopFetchFn})` is the real, separate, opt-in check:
requires the video to actually have a `linkedProductId`, fetches the
real product from CHOPZ SHOP, and stores its real `sellerId`/`price`
on the video (not just re-confirming the caller's own id) — the same
"store the real response, don't just re-validate the input" posture
established elsewhere this session (Hunts Dates, CVNVO's BarBuddy,
VOID's Affiliate Network).

## Explicitly NOT in this task
Forcing verification into the video-creation path. Any of CHOPZ's
other real, larger gaps (likes/comments/shares/duets, ranking,
live shopping) — separate, much larger scope.

## Verification approach
7 plain-Node checks. A live pass with `chopz-shop` and `chopz` both
running: a real product created, a real video linked to it, live
verification confirmed storing the real seller/price, and a second
video linked to a nonexistent product confirmed rejected with CHOPZ
SHOP's own real error message.

## Done when
A CHOPZ video's linked product can be genuinely, live-verified against
CHOPZ SHOP without ever blocking the upload path itself.
