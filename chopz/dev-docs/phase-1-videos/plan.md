# Plan — Phase 1: Videos (CHOPZ core)

## Goal
The smallest real slice of CHOPZ's own video/social feed: the
`ChopzVideo` record itself, optionally linked to a CHOPZ SHOP product.

## Design
`ChopzVideo { id, creatorId, mediaUrl, linkedProductId: string | null }`
per `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`. `linkedProductId` is
deliberately not validated against CHOPZ SHOP's product list here —
CHOPZ SHOP is a separate standalone app (`chopz-shop/`) now, per
explicit instruction, and forcing every video upload to synchronously
round-trip to it would block the primary content-creation path on a
dependency it doesn't strictly need at creation time.

## Explicitly NOT in this phase
Feed ranking, likes/comments/shares/duets, live cross-app validation
of `linkedProductId` — all deferred, same as CHOPZ SHOP's own deferred
list.

## Verification approach
4 plain-Node checks (with/without a linked product, round-trip,
required-field rejection), plus a live pass creating a real video
linking to a real product actually created in CHOPZ SHOP, confirming
the two now-separate apps interoperate over real ids.

## Done when
`ChopzVideo` creation and lookup work, and a real video can reference a
real, independently-created CHOPZ SHOP product id.
