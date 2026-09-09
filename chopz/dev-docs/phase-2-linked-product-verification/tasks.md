# Tasks — Phase 2: real linkedProductId verification

- [x] Investigate: re-read `videos.js`'s own header reasoning for
      deferred validation; read CHOPZ SHOP's own real product shape
      and lookup route directly.
- [x] `lib/videos.js` — `createChopzVideo` gained
      `linkedProductVerified: false`; added `verifyLinkedProduct`.
- [x] `server.js` — added `CHOPZ_SHOP_API_URL` + `fetchChopzShopProduct`
      client, wired into a new `POST /chopz/videos/:id/verify-linked-product`
      route.
- [x] 7 plain-Node checks — all passing.
- [x] Live pass against `chopz-shop` + `chopz`: real product created,
      real video linked to it, live verification confirmed storing the
      real seller/price, a video linked to a nonexistent product
      confirmed rejected.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
CHOPZ's own larger, real gaps: likes/comments/shares/duets, a real
ranking algorithm, live shopping formats.
