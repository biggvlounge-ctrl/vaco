# Phase 13 — VENVM and VACO Analytics districts

## Goal
VENVM (real script engine, cross-platform reformat, production
pipeline) and VACO Analytics (the real unified ecosystem dashboard)
were both built and fully server-side tested this session, but neither
had any UI surface anywhere in this walkable world — confirmed at a
real 0% VDP presence, not assumed. Give both a real district, matching
the exact same client/view pattern every other district already uses.

## Design
Two new districts fill the two open slots the 6th row (`WORLD_HEIGHT`
already grown to fit CHOPZ Shorts) had left, at `x:20` and `x:580`,
`y:1420`:
- **VENVM Studio** (`venvm-embed`) — `venvmClient.js` +
  `VenvmView.jsx`, a live client of VENVM's own real reformat math
  (a duration input + a "compute" button showing real fit/trim results
  across all 4 platforms), real production-pipeline stage machine (a
  "start job" button, then "advance stage" through the real
  `script-ready → storyboard-ready → render-queued → rendered`
  progression, honestly showing `videoUrl: null` at the end since
  VENVM cannot produce pixels), and a real script-generation request
  (routed through v4-proxy, honestly surfacing the real failure when
  no `ANTHROPIC_API_KEY` is configured rather than hiding the button).
- **VACO Analytics** (`vaco-analytics-embed`) — `vacoAnalyticsClient.js`
  + `VacoAnalyticsView.jsx`, a live client of VACO Analytics' own real
  `GET /api/dashboard`, rendering whatever real revenue metrics the
  ecosystem's own apps have actually pushed in (as of this phase: vago,
  chopz-shop, vulture-music, void, vulture-flix, voken) as a real
  table, with an honest empty state when nothing has been ingested yet
  since the last restart — no mocked or hardcoded numbers.

## Verification approach
- `vite build` — confirms no build errors across all 76 modules.
- Live, via Playwright, against real running `venvm`, `vaco-analytics`,
  `shield`, `v3`, and `vdp` (dev server) instances:
  1. Log in via a real Shield session (the walkable world only renders
     post-login).
  2. Walk to VENVM Studio's exact position, confirm the real "Enter"
     button appears, enter, run the real reformat calculator, create
     a real production job, advance its real stage, and trigger a
     real script-generation request — confirming the honest failure
     message renders when v4-proxy has no key.
  3. Walk to VACO Analytics' exact position, confirm the real "Enter"
     button appears, enter, and confirm the honest empty-state message
     when nothing has been ingested — then push one real metric via
     curl and confirm a fresh visit to the district shows that exact
     real row and value.
  4. Regression check: VEX (the very first district built) is still
     enterable — the new districts didn't disturb existing ones.

## Done when
- `vite build` succeeds.
- All district-entry, reformat, production-job, script-request, and
  dashboard-data Playwright checks pass against real running servers.
- The VEX regression check passes.
- README documents both new districts.
