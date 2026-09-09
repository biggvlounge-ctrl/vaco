# Tasks — Phase 11: real HTTP API + the Artifact/Mission system

- [x] Investigate: read `VACANCY_API_ENDPOINT_MAP.md` and CLAUDE.md's
      own required-5 contract directly; confirmed the Artifact/Mission
      "already built" claim was false by grepping `server/*.js` and
      reading `WorldState` directly.
- [x] `server/missions.js` — new file: `generateArtifact`, `getArtifact`,
      `generateMission` (requires a real artifactId, validates a given
      `controllingFactionId` against a real faction), `getMission`,
      `listMissions`.
- [x] `server/engine.js` — added `artifacts`/`missions` arrays to
      `WorldState`; wired 5 new bound wrapper functions.
- [x] `server.js` — new file: `GET /api/state`, `POST /api/tick`,
      `POST /api/npc/generate`, `POST /api/mission`, `GET /api/health`
      (the required 5), plus `POST /api/artifacts` and
      `GET /api/artifacts/:id` (the real, necessary completion).
- [x] `package.json` — added `express`/`cors`/`dotenv`; real
      `start`/`dev` scripts; removed the broken `test` script.
- [x] 14 plain-Node checks on `missions.js` — all passing.
- [x] `npm install` — confirmed clean, 71 packages.
- [x] Live pass against the real running server (port 8809): health,
      state, NPC generation (state reflects it), tick advance, real
      artifact creation, real mission generation linked to it, a
      rejected mission request against a nonexistent artifact.
- [x] Shut down the test server; confirmed via port check.
- [x] `vaco-shell/lib/registry.js` — updated `vacon-c`'s own entry from
      `url: null` to the real `http://localhost:8809`, checked against
      the registry's own complete port map to confirm it was unused.
- [x] Update `README.md` (the "No routes exist" section rewritten,
      Run/Test/Verified added).
- [x] Write this plan/tasks pair.

## Next
The API map's own further ~40 endpoints across Phases 1-5 remain
unbuilt — entities, keys, families, organizations, economy,
properties, communities, cities, players, multiplayer. A real,
separate, much larger body of future work.
