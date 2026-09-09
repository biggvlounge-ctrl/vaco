# Plan — Phase 15: Vvltvre Studios district

## Goal
Close one of Vvltvre Studios' own two self-flagged README gaps: "A
VDP district... not yet built as of Phase 1/2." (The other gap, real
music/podcast distribution, was closed on Vvltvre Studios' own side —
see that app's own `dev-docs/phase-2-music-podcast-distribution/`.)

## Design
Same real shape as every other cross-app district since Phase 11
(`contentType: '<app>-embed'`): a thin client
(`lib/vultureStudiosClient.js`) with zero financing/production/
distribution logic of its own — every real investor transfer, status
transition, and cross-app distribution hand-off comes back from
Vvltvre Studios' own server — and a component (`VultureStudiosView.jsx`)
that renders whatever that server returns.

**Placement**: rather than growing `WORLD_HEIGHT` again for an 8th
row, reused the 7th row's second open slot (`x: 300, y: 1700` — the
Beat Marketplace district already occupies `x: 20` on that row, and
`x: 580` stays open). No `WORLD_HEIGHT` change needed this phase.

**UI scope**: covers Vvltvre Studios' full real loop — greenlight,
invest, view real computed equity, start production, complete,
distribute, and report revenue for a project not already distributed
through Vvltvre Music (which has its own real payout path; the UI
hides the report-revenue control for a `vulture-music`-distributed
project and explains why, mirroring the same guard added on Vvltvre
Studios' own server side).

## Verification approach
`vite build` to catch any JSX/syntax error before running anything
live. Then a full live Playwright pass against real running Shield,
V3, Vvltvre Music, and Vvltvre Studios servers: log in, walk from
spawn straight down to the new district (96 `ArrowDown` presses land
within the real 40px entry radius), enter, greenlight a real music
project through the real form, invest the full budget as the session
user, advance through production and completion, distribute (a real
cross-app call into Vvltvre Music), and view equity — every step
confirmed via the real rendered UI text, not assumed from a successful
click. The distribution result was independently re-confirmed via
direct `curl` against both apps' own separate APIs afterward, not
just trusted from the UI's own success message. Finished with a full
30-app ecosystem boot to confirm no regression anywhere else in the
walkable world.
