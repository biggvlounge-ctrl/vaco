# Plan — Phase 17: VACON-C district (closing the audit's one confirmed gap)

## Goal
VACON-C was the one parent app among the ecosystem's 16 with zero
frontend, confirmed by the earlier audit. Build a real VDP district
for it, same "-embed" client pattern every other district already
uses.

## Real investigation before any code
Checked whether any VACON-C-related code already existed in VDP
before writing anything new (`grep -rli` across `src/` for
vacon/vacancy/civilization/npc/tick) — the only hits were incidental
(a React re-render counter also named `tick`, one passing mention of
"VACON" in a comment about session sharing). No overlap, confirmed
before building.

Read VACON-C's own `server.js` and `server/engine.js`/`missions.js`
directly for its real, current contract rather than assuming from its
README: exactly 5 live endpoints (`/api/state`, `/api/tick`,
`/api/npc/generate`, `/api/artifacts`, `/api/mission`) out of the ~40
its own locked Phase-1-onward roadmap eventually specifies. This
district covers exactly those 5, not a fabricated larger surface.

## Design
`vdp/src/lib/vacancyClient.js` — thin client, same shape as
`vagoClient.js`/`vacayClient.js`. `vdp/src/components/VacancyView.jsx`
— real world-state summary (tick/NPC/organization counts), a real
"advance tick" button, NPC generation with a live-updating recent-NPC
list, and a real artifact -> mission flow (mission generation
correctly requires a real `artifactId` first, matching VACON-C's own
`missions.js` validation). `world.js` gains a `vacancy` district;
`WorldView.jsx` gains the import, render branch, and district color.

## Verification approach
`npm run build` confirmed clean. Then a real, live end-to-end check
via a throwaway plain-Node script replicating the exact client calls
(not simulated): generated a real NPC and confirmed the world state's
NPC count actually increased; advanced a real tick and confirmed the
counter moved; generated a real artifact, then a real mission
referencing that artifact's own id, and confirmed the mission response
carried the correct `artifact_id` linkage rather than assuming it.

## Explicitly NOT in this task
No new VACON-C backend endpoints — this closes the frontend gap
against VACON-C's own real, current API, not its full future spec.
Trait detail (the 18-19 trait families NPCs actually carry) isn't
rendered in depth here; the recent-NPC list shows name/role/creation
tick only, a real but intentionally minimal first surface.

## Done when
VDP has a real, live, verified district for VACON-C, closing the
audit's one confirmed zero-frontend finding among the 16 real
parents.
