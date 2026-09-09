# Tasks — Phase 15: Vvltvre Studios district

- [x] Built `src/lib/vultureStudiosClient.js` — thin client, no
      financing/production/distribution logic of its own.
- [x] Built `src/components/VultureStudiosView.jsx` — greenlight form,
      per-project invest/start-production/complete/distribute/report-
      revenue controls (state-gated on the project's own real
      `status`/`distributionApp`), and a real equity view.
- [x] Added the `vulture-studios` district to `src/lib/world.js`,
      reusing the 7th row's second open slot (`x: 300, y: 1700`) —
      confirmed no `WORLD_HEIGHT` growth was needed.
- [x] Updated `world.js`'s own header comment documenting the new
      `'vulture-studios-embed'` `contentType`.
- [x] Wired the import, `DISTRICT_COLORS` entry, and render-switch
      branch into `src/components/WorldView.jsx`; updated its own
      header comment.
- [x] `node --check` on the new client and `world.js`; `npx vite
      build` to catch any JSX/syntax error across the whole project —
      both passed clean.
- [x] Started real Shield, V3, Vvltvre Music, and Vvltvre Studios
      servers plus the VDP dev server.
- [x] Ran a real Playwright pass against a real Chromium: logged in
      via Shield, walked from spawn to the new district (96
      `ArrowDown` presses), entered, greenlit a real music project,
      invested the full budget as the session user, confirmed
      auto-advance to `funded`, advanced through `start-production` →
      `complete`, clicked "Distribute," confirmed the UI rendered the
      real `distributed via vulture-music` result, and viewed the real
      computed equity row.
- [x] Independently re-confirmed the distribution result via direct
      `curl` against Vvltvre Music's own `GET /api/releases/:id` and
      Vvltvre Studios' own `GET /api/projects/:id` — not just trusted
      the UI's own success message.
- [x] Ran a full 30-app ecosystem boot (`start-ecosystem.sh`) — 29/30
      up, same pre-existing, unrelated `v4-proxy` gap as always.
- [x] Killed all test server processes; removed every touched app's
      test `data/` directory.
- [x] Updated `README.md` with a new "Phase 15 — Vvltvre Studios
      district" entry.

## Next
Nothing further planned for this district specifically. Vvltvre
Studios' README now has no remaining self-flagged distribution/UI
gaps — its own "Not yet built" section covers only real production-
financing safeguards (funding-deadline refunds, a minimum-investment
floor, pre-completion stake resale) and real content
delivery/rendering, both genuinely separate, larger pieces of work.
