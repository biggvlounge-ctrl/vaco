# Tasks — Territory/Community

- [x] Create `server/territory.js`: `generateCity`, `generateCommunity`
      (tier defaults to `'block'`), `generateTerritoryBlock`,
      `resolveTerritoryControl`.
- [x] Wire `tick.js`'s Organization phase to call
      `resolveTerritoryControl()` for every `territoryBlocks` entry,
      replacing the step-8 no-op; emits a `territory_status_change`
      event on any actual transition.
- [x] Wire `engine.js`: `cities`/`communities`/`territoryBlocks`
      arrays added to `WorldState`; `generateCity()`/
      `generateCommunity()`/`generateTerritoryBlock()` exposed as bound
      wrappers.
- [x] Updated stale comments in `tick.js`'s file header and Organization
      phase that pre-dated this system existing.
- [x] Verify:
      - `generateCity({})` throws (no `name`).
      - `generateCommunity({ cityId })` defaults `tier` to `'block'`
        correctly.
      - `generateTerritoryBlock({ factionId: <nonexistent> })` throws
        with a specific message.
      - `generateTerritoryBlock({ factionId: <non-faction org id> })`
        throws — confirmed a plain Organization (`isFaction`
        unset/false) is correctly rejected, only real Factions can
        hold territory, matching the schema's own
        `REFERENCES factions(organization_id)`.
      - **All three status transitions**, not just one direction:
        directly set a faction's live `organization.territory`/
        `organization.power` trait rows low (10/10) — next tick moved
        the block `controlled -> contested`, correctly stamping
        `contested_since_tick`; set them high (90/90) — next tick moved
        it `contested -> fortified`; set them mid-range (55/55) — next
        tick moved it back to `controlled`. Each transition correctly
        emitted a `territory_status_change` event with the right
        `severity`/`note`.
      - Regression: NPC generation (20 families/114 traits) unaffected.
- [x] Commit as its own change.

## Next
Wiring the drought cascade itself into faction territory (a resource
shortage actually pressuring a faction's `territory`/`power` values,
rather than requiring a manual trait override to demonstrate the
mechanic, as this verification did) is a believable next step — not
done here. `resolveTerritoryControl()` already reads whatever the live
trait values are; nothing currently writes to organization-tier traits
from the tick pipeline the way individual traits get written to via
the 7 Key resolvers.
