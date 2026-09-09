# Plan — Phase 10: Split VENVS/VDP into two real, separate apps

## Goal
Per explicit instruction: VENVS is the real, analog/physical commerce
layer (Amazon-style Shop, Facebook-Marketplace-style resale,
Publishing, VEX, VADO). VDP is the real, digital/virtual layer (land
ownership, avatar economy, the walkable world). They'd been built as
one blended app (one repo, one `App.jsx`); split them into two real,
distinct projects, sharing V3/Shield infrastructure where it genuinely
makes sense, keeping the actual commerce/world logic separate.

## What was actually blended, and what wasn't
Investigation found the blending was narrower than "everything's
mixed": the `lib/` layer was already cleanly separated by concern —
`shop.js`/`marketplace.js`/`catalog.js`/`royalties.js`/`vex.js`/
`vado.js` (real analog commerce) never imported or referenced
`world.js`/`chopz.js`/`degvchi.js` (the digital/virtual layer), and
vice versa. `chopz.js` (leasable *virtual* retail units) and
`degvchi.js` (avatar wearables) were already correctly on the VDP side
conceptually, even though they use commerce-like mechanics (leasing,
purchasing) -- their subject (virtual land, avatar cosmetics) is what
makes them VDP's, not VENVS's.

The actual blending was entirely in `WorldView.jsx` (VDP's own
walkable-world component) directly importing and rendering VENVS's
`PublishingView`/`VexView`/`VadoView` React components, and in both
living in one repo/`App.jsx`/process, sharing in-memory JS store
objects (`catalog`, `vex`, `vado` created once in `App.jsx`, per
Phase 8's fix) so a purchase in one "view" was visible in the other.

## Design
- Move `world.js`, `chopz.js`, `degvchi.js` and their view components
  to a new, separate project (`../vdp/`), its own `package.json`,
  its own Vite dev server (port 5174).
- VDP gets its own, separate copies of the thin client wrappers
  (`v3Client.js`, `shieldAuth.js`, `persistence.js`) -- same real
  contract, not a shared file, matching this session's established
  precedent (CHOPZ/CHOPZ SHOP, CVNVO/Yap) of duplicating small,
  genuinely stateless client files per app rather than sharing a
  package.
- Real user decision, asked directly rather than picked silently: once
  the two apps can no longer share an in-memory store (separate
  processes/origins now), what happens when a player walks into a
  VENVS-owned building? Chosen: a real, inline `<iframe>` embed, not a
  navigate-away link -- preserves the "walk into a building, see the
  store" feel without needing a shared store.
- This requires VENVS to gain real, deep-linkable routing it never had
  (`?view=<name>`), since an iframe needs a URL that renders just one
  screen. Built as a real query-param route alongside a real tab
  switcher for VENVS's own standalone use (closing the "no real
  mode-switcher/tabs exist yet" gap flagged since Phase 9 at the same
  time, since the iframe use case required solving it anyway).
- A real ambiguity in VENVS's own `CLAUDE.md`, resolved directly by
  the user's fresh instruction rather than left unresolved: §4's
  5-tab analog list never included DEGVCHI, but the same doc's
  digital-mode district list calls Fashion District "real content
  matching analog" (implying an analog DEGVCHI view should exist).
  Settled: avatar economy is VDP's, full stop -- Fashion District
  renders DEGVCHI natively inside VDP, no VENVS iframe, no analog
  DEGVCHI tab in VENVS at all.

## Explicitly NOT in this task
- Real cross-origin Shield SSO between VENVS and VDP -- flagged
  directly as a real, known limitation (a user logs in separately on
  each origin, including inside the iframe), not solved here.
- Placing CHOPZ in VDP's world district grid -- a real, pre-existing
  gap from before the split, not introduced or fixed here.
- Any visual/behavioral change to VENVS's or VDP's actual commerce
  logic -- this is a structural split, not a feature change.

## Verification approach
Both apps confirmed to build clean (`npm run build`, zero errors).
Then a real, live, in-browser pass (Playwright + this environment's
pre-installed Chromium, run against all three real servers together --
VENVS, VDP, and the shared V3/Shield mock): VENVS's own tab switcher
and `?view=vex` embedded-mode route (zero chrome) confirmed
standalone; VDP login and world canvas confirmed; walking to VEX and
entering it confirmed to render a real iframe pointed at VENVS's own
running server, VENVS's real login screen confirmed inside the frame,
a real purchase made inside that embedded frame confirmed to complete
against VENVS's own server and the shared V3 mock ledger with no
error; walking to Fashion District confirmed to render DEGVCHI
natively with zero iframes present; zero browser console/page errors
across the entire pass.

## Done when
- Both apps are real, separate, independently runnable projects with
  no shared code beyond duplicated thin client wrappers.
- A purchase made through VDP's embedded VENVS iframe is proven, live,
  to be a genuine transaction against VENVS's own server, not a stub.
- The DEGVCHI/CHOPZ-are-VDP's ambiguity from the original source doc
  is resolved and documented, not left silently unresolved.
