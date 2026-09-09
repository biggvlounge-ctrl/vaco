# Plan — Phase 13: CHOPZ Shorts district

## Goal
Close a long-carried, explicitly self-flagged gap: this project's own
README has said since before the VAGO/VACAY phase that "CHOPZ isn't
placed in the walkable world's district grid." Extend the same
`-embed` pattern used for every other district to the real, standalone
`chopz/` app.

## Real naming collision found and flagged, not silently resolved
While wiring this in, found that VDP already has a component called
`ChopzView.jsx` (`lib/chopz.js`) rendered directly in `App.jsx`,
outside the walkable world entirely -- but it's a genuinely different
real feature: 8 leasable retail kiosks, sourced from VENVS's own
CLAUDE.md §4, with its own local, client-side-only store that never
calls the real `chopz/server.js` API at all. The two share the name
"CHOPZ" purely because VENVS's own source doc independently used that
name for a retail-kiosk concept, unrelated to the later, separate
ecosystem app of the same name (a TikTok-style short-form-video app).

Neither was removed -- both are real, both are kept. The new district
and its view are deliberately named "CHOPZ Shorts"/`ChopzShortsView`,
not bare "CHOPZ", to keep the two apart in code and on screen; the
collision itself is documented in both files' own headers and here,
not silently reconciled.

## Design
Two thin clients, since a real shoppable-video demo genuinely spans
both real apps (`chopz/` has no product data of its own, `chopz-shop/`
has no video data of its own, and unlike Vvltvre Pods' publish-via-
Music call, CHOPZ's own server has no "create a product" proxy route
to go through): `chopzClient.js` (video creation + real, live
linked-product verification) and `chopzShopClient.js` (product
creation). `ChopzShortsView.jsx` composes both: create a real product,
post a real video linking to it, verify the link live against CHOPZ
SHOP.

New 6th row in `world.js` (`WORLD_HEIGHT` grown 1420 -> 1700, same
precedent as every earlier row growth in this file) -- a single
district, same precedent as VACAY being alone in the 4th row.

## Verification approach
`vite build` (clean, 72 modules), then a real Playwright browser pass
against V3, Shield, CHOPZ, and CHOPZ SHOP's real running servers: real
product created, real video created linking to it, real live
verification against CHOPZ SHOP confirmed (`seller demo-user, 24.99
VCoin`) -- and confirmed the pre-existing, unrelated `ChopzView`
(leasable kiosks) still renders untouched outside the world.

## Done when
CHOPZ (the real video app) is reachable and genuinely usable through
VDP's own walkable world, same bar as every other district.
