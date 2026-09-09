# Tasks — Phase 2: NPC Genesis Engine

- [x] Add `npcs: []`, `nextNpcId: 1` to `createWorldLayer()` in
      `locations.js`.
- [x] Create `world-layer/npcGenesis.js`: `generateNPC`, `getNPC`,
      `getNPCsAtLocation`, `assignRole`, `relocateNPC`, `ROLES`,
      `MIGRATION_STATUSES`.
- [x] Wire `world-layer/index.js` to export both `locations.js` and
      `npcGenesis.js`.
- [x] Add `world_npcs` table to `schema.sql`, with a comment flagging
      the open reconciliation question against VACON-C's own
      `entities`/`npcs` tables.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `generateNPC` throws on missing `locationId`.
      - `generateNPC` throws when `locationId` doesn't reference a
        real location.
      - `generateNPC` throws on missing `demographics`.
      - `generateNPC` throws on an invalid `migrationStatus`.
      - A real NPC generates correctly with `locationId`,
        `occupation`, `skills`; `roles` starts empty,
        `migrationStatus` defaults to `'resident'`.
      - `assignRole` adds a role; assigning a second, different role
        to the same NPC accumulates (not replaces); re-assigning an
        already-held role is a no-op, not an error; an invalid role
        throws.
      - A second NPC generates with `migrationStatus: 'displaced'` at
        a different (hero-tier) location.
      - `getNPCsAtLocation` returns the correct count per location.
      - `relocateNPC` moves an NPC and `getNPCsAtLocation` reflects it
        immediately; throws on a nonexistent NPC or destination
        location.
      - Regression: Phase 1 `generateLocation` used in the same run,
        unaffected.
- [x] Commit as its own change.

## Next
Populating `relationships` on a generated NPC, and deriving a
location's `populationData` slice from `getNPCsAtLocation()`, are both
believable next steps — not done here. The bigger open item is the
VACON-C reconciliation question flagged in `plan.md`: that needs an
explicit decision before any further wiring (e.g. having VACON-C's
Citizen-mode dashboard read from `world_npcs`) makes sense to build.
