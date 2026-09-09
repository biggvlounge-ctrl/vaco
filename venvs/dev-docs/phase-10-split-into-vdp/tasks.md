# Tasks — Phase 10: Split VENVS/VDP into two real, separate apps

- [x] Investigate the actual current state of `venvs/src/lib` and
      `venvs/src/components` before making any changes -- confirmed
      the `lib/` layer was already cleanly separated by concern, and
      that the real blending was in `WorldView.jsx`'s direct component
      imports plus both apps sharing one process/store.
- [x] Ask the user directly (`AskUserQuestion`) how a VENVS-owned
      building entry should behave once the two apps can't share
      in-memory state -- answered: real inline iframe embed.
- [x] Scaffold `../vdp/` as a real, separate Vite+React project (own
      `package.json`, `vite.config.js` on port 5174, `index.html`,
      `main.jsx`).
- [x] Move `world.js`, `chopz.js`, `degvchi.js`,
      `WorldView.jsx`/`ChopzView.jsx`/`DegvchiView.jsx` to VDP via
      `git mv` (preserves history).
- [x] Give VDP its own real copies of `v3Client.js`/`shieldAuth.js`/
      `persistence.js`, with distinct `localStorage` key prefixes
      (`vdp.*` vs. `venvs.*`) and headers explaining the real
      cross-origin session limitation.
- [x] Replace `world.js`'s `hasAnalogView` boolean with a real,
      three-way `contentType` (`venvs-embed`/`vdp-native`/`none`),
      resolving the DEGVCHI/analog-view ambiguity directly.
- [x] Rewrite `WorldView.jsx`: VEX/VADO/Publisher render a real
      `<iframe src={VENVS_URL}/?view=<name>>`; Fashion District renders
      `DegvchiView` natively; Stage/Food unchanged.
- [x] Write `vdp/src/App.jsx`: real Shield login, real V3 balances,
      `WorldView` + `ChopzView` (standalone, matching the pre-existing
      "not in the grid" gap).
- [x] Update `venvs/src/App.jsx`: remove the DEGVCHI/World/CHOPZ
      imports and seeded state; add a real tab switcher (Shop/
      Marketplace/Publisher/VEX/VADO) and a real `?view=<name>`
      query-param route that hides chrome for embedded use.
- [x] Confirm both apps build clean (`npm run build`, zero errors).
- [x] Verify live in a real browser (Playwright, this environment's
      pre-installed Chromium) with all three real servers running
      together (VENVS 5173, VDP 5174, V3/Shield mock 8791):
      - VENVS: login, real tab switch to VEX confirmed.
      - VENVS: `?view=vex` confirmed to render with zero `<h1>`
        elements (embedded-mode chrome correctly hidden).
      - VDP: login, world canvas confirmed rendered.
      - VDP: walked to the real VEX building (position-readout-driven
        navigation, not guessed key counts), "Enter VEX" confirmed
        visible, entered it.
      - VDP: real `<iframe>` confirmed present, `src` confirmed
        exactly `http://localhost:5173/?view=vex`.
      - VDP iframe: VENVS's real login screen confirmed rendered
        inside the frame; logged in inside the frame; VexView's real
        "Buy 1" button confirmed rendered; clicked it; confirmed the
        purchase completed with no error banner -- a genuine
        transaction against VENVS's own running server and the shared
        V3 mock ledger.
      - VDP: walked to Fashion District, entered it, confirmed
        **zero** iframes present and DEGVCHI's real content rendered
        natively.
      - Confirmed zero browser console/page errors across the entire
        pass.
- [x] Shut down all three servers cleanly; confirmed via follow-up
      port check.
- [x] Update `venvs/README.md` and write `vdp/README.md` with the
      full split rationale, what moved, and the real, flagged
      cross-origin-SSO limitation.
- [x] Commit both projects.

## Bugs fixed during verification (test script, not the apps)
The first Playwright pass tried to click "Log in" a second time on an
already-logged-in VENVS page (Shield session persisted across
same-origin navigations, correctly) -- fixed by checking for the
button's presence first. The first attempt to walk to a district used
guessed arrow-key press counts and landed just outside the real
40px entry radius -- fixed by reading the app's own on-screen
"Position: (x, y)" text and stepping until within range, rather than
guessing movement math blind.

## Next
Real cross-origin Shield SSO between VENVS and VDP. Placing CHOPZ in
VDP's world district grid. Everything else already tracked in each
project's own README "Not yet built" section.
