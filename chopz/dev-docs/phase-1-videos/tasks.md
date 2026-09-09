# Tasks — Phase 1: Videos (CHOPZ core)

- [x] Create `lib/store.js`: `createChopzStore()` (video state only).
- [x] Create `lib/videos.js`: `createChopzVideo`, `getChopzVideo`.
- [x] Wire `server.js`: `POST /chopz/videos`, `GET /chopz/videos/:id`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 4 checks, part of the combined 33-check run also
      covering CHOPZ SHOP): video without a product creates fine,
      video with an (unvalidated, cross-app) `linkedProductId` still
      creates, round-trip via `getChopzVideo`, missing `creatorId`
      rejected.
- [x] Verify live: a real video created via `chopz/server.js` linking
      to a real product id actually returned by
      `chopz-shop/server.js`, running independently on its own port.
- [x] Commit as its own change.

## Next
Feed depth (likes/comments/shares), live cross-app validation of
`linkedProductId` against CHOPZ SHOP.
