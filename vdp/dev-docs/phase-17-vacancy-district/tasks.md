# Tasks — Phase 17: VACON-C district

- [x] Grepped VDP's `src/` for any pre-existing VACON-C overlap before
      writing anything — none found.
- [x] Read VACON-C's own `server.js`/`engine.js`/`missions.js`
      directly for its real, current 5-endpoint contract.
- [x] `vdp/src/lib/vacancyClient.js`: `getWorldState`, `advanceTick`,
      `generateNPC`, `generateArtifact`, `generateMission`.
- [x] `vdp/src/components/VacancyView.jsx`: tick/NPC/org counts, real
      tick-advance button, NPC generation + recent-NPC list, real
      artifact -> mission flow.
- [x] `world.js`: new `vacancy` district. `WorldView.jsx`: import,
      render branch, district color.
- [x] `npm run build`: clean.
- [x] Live end-to-end check via a throwaway plain-Node script
      replicating the real client calls: NPC generated and count
      verified increased; tick advanced and counter verified moved;
      artifact generated; mission generated against that artifact's
      real id, `artifact_id` linkage verified correct in the response.
