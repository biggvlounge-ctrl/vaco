# Phase 14 — Beat Marketplace district

## Goal
Vvltvre Music's real beat marketplace (list, browse, preview,
purchase, license delivery — built directly against BeatStars/Airbit,
producer keeps 100%) had no UI surface anywhere in this walkable
world. Give it a real district, covering the full real loop rather
than a read-only view.

## Design
A new 19th district, `beat-marketplace-embed`, fills a new 7th row
(`WORLD_HEIGHT` grown from 1700 to 1980), at `x:20, y:1700`.
`beatMarketplaceClient.js` reuses the same `VITE_VULTURE_MUSIC_API_URL`
`vultureMusicClient.js` already uses — the beat marketplace lives
inside Vvltvre Music's own server/store, not a separate backend, so
this is a sibling district of the existing `vulture-music-embed`, not
a new integration.

`BeatMarketplaceView.jsx` covers the full real loop the feature was
built for:
- **List** — a real form lets the session user list a beat as a
  producer (title, price, license type).
- **Browse** — real active listings render, each showing a real
  `<audio>` preview player when the beat has a real `previewUrl`, or
  an honest "no preview" label when it doesn't.
- **Purchase** — a real "Buy" button per beat not owned by the current
  session user (a beat the session user listed shows "your listing"
  instead, matching `purchaseBeat`'s own real self-purchase block).
- **License delivery** — the real purchase record returned from the
  API renders directly as the delivered license (title, license type,
  price paid, purchase id), plus a running "Your real licenses" list
  fed by a real `GET /api/beat-purchases/buyer/:userId` call.

## Verification approach
- `vite build` — confirms no build errors.
- Live, via Playwright, against real running `vulture-music`, `v3`,
  `shield`, and `vdp` (dev server) instances:
  1. Log in via a real Shield session, walk to the district's exact
     computed position, confirm the honest empty state.
  2. List a real beat as the session user through the real form,
     confirm it renders and is correctly marked non-buyable by its own
     lister.
  3. List a second real beat under a *different* real producer
     directly against the API (VDP's demo login always authenticates
     as the same user, so a genuine second-party listing has to come
     in this way to test the buy path honestly), confirm its real
     `<audio>` preview renders, click the real "Buy" button in the
     browser, and confirm the real license-delivery message renders
     with the correct details.
  4. Confirm directly against V3 that the real balance actually moved
     as a result of the browser click, not just local UI state.
  5. Regression: VEX still enters correctly.

## Done when
- `vite build` succeeds.
- All district-entry, listing, browse-preview, purchase, and
  license-delivery Playwright checks pass against real running
  servers, including the real V3 balance check.
- The VEX regression check passes.
- README documents the new district.
