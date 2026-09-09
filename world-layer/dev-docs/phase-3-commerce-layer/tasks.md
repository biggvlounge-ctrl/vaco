# Tasks — Phase 3: Real World Commerce Layer

- [x] Add `businesses: []`, `nextBusinessId: 1` to `createWorldLayer()`
      in `locations.js`.
- [x] Create `world-layer/commerce.js`: `generateBusiness`,
      `getBusiness`, `getBusinessesAtLocation`, `addEmployee`,
      `setBusinessEconomicValue`, `SECURITY_LEVELS`.
- [x] Wire `world-layer/index.js` to also export `commerce.js`.
- [x] Add `world_businesses` + `world_business_employees` (join table)
      to `schema.sql`.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `generateBusiness` throws on missing/nonexistent `locationId`,
        missing `industry`, negative `economicValue`, invalid
        `securityRequirement`, nonexistent `ownerId`.
      - A business generated with a real `ownerId` automatically
        assigns that NPC the `business_founder` role.
      - A business generated without an owner defaults correctly
        (`ownerId: null`, `economicValue: 0`,
        `securityRequirement: 'none'`), no role side-effect.
      - `addEmployee` adds an employee, assigns the `employee` role,
        is idempotent on a duplicate add, and throws on a nonexistent
        npc or business.
      - `setBusinessEconomicValue` updates correctly and rejects a
        negative value.
      - `getBusinessesAtLocation` returns the correct count.
      - Regression: Phase 1 (`generateLocation`) and Phase 2
        (`generateNPC`, `getNPC`) both used in the same run,
        unaffected.
- [x] Commit as its own change.

## Next
Transportation Network and Information Propagation Engine are the
remaining bundled systems from the architecture doc (sections 4-5),
not started here. Supply chain resolution against `supplyNeeds`, and
rolling a location's businesses up into its `economicData` slice, are
both believable next steps but explicitly not done in this phase.
