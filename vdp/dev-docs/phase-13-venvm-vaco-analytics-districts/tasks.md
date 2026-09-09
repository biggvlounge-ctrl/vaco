# Phase 13 — VENVM and VACO Analytics districts — tasks

- [x] `src/lib/venvmClient.js` — thin real client (reformat, script
      request/generate, production-job create/storyboard/queue-render/
      mark-rendered).
- [x] `src/lib/vacoAnalyticsClient.js` — thin real client
      (`getDashboard`).
- [x] `src/components/VenvmView.jsx` — reformat calculator, production
      job stage stepper, script-generation request with honest
      failure handling.
- [x] `src/components/VacoAnalyticsView.jsx` — real dashboard table +
      honest empty state + refresh.
- [x] `src/lib/world.js` — two new `DISTRICTS` entries filling the 6th
      row's open slots (`venvm` at `x:20`, `vaco-analytics` at `x:580`,
      both `y:1420`).
- [x] `src/components/WorldView.jsx` — imports, `DISTRICT_COLORS`,
      header comment, render switch for both new content types.
- [x] `vite build` — clean, 76 modules, no errors.
- [x] Live Playwright verification against real running venvm (8813),
      vaco-analytics (8790), shield (8812), v3 (8811), and vdp dev
      server (5174):
      - Real Shield login required before the world renders at all.
      - Walked to VENVM Studio's exact computed position (down 79,
        left 18 from spawn), confirmed the real "Enter VENVM Studio"
        button, entered, ran a real reformat (90s source → real
        fit/trim results across 4 platforms), created a real
        production job (`script-ready`), advanced it to
        `storyboard-ready` for real, and triggered a real
        script-generation request — confirmed the honest "no
        ANTHROPIC_API_KEY" failure message rendered correctly.
      - Walked to VACO Analytics' exact position (down 79, right 18),
        confirmed the real "Enter VACO Analytics" button, entered,
        confirmed the honest empty-state message, then pushed one real
        metric via curl and confirmed a fresh visit showed that exact
        real app/metric/value row.
      - Regression: VEX still enterable at its own position, unaffected.
- [x] Test/runtime artifacts cleaned up (all 5 apps' `data/` dirs,
      `vdp/dist`, logs).
- [x] README.md — new districts documented.
- [x] plan.md / tasks.md (this file).

## Next
- No further VDP work identified for these two districts. Both are now
  at parity with every other real backend app in this ecosystem: a
  real district, a real live client, no mocked content.
