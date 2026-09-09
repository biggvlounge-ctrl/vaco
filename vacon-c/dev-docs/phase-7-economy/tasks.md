# Tasks — Real Resource Tracking + Economy

- [x] Create `server/economy.js`: `generateResource`,
      `advanceResourceTick`, `getScarcity`, `generateMarketListing`,
      `resolveMarketPrice`, `generateIndividualFinances`,
      `getLatestFinances`, `getNetWorth`.
- [x] Add `resources`/`marketListings` to `engine.js`'s `WorldState`
      (`individualFinances` already existed from step 6).
- [x] Wrap all 8 `economy.js` functions in `engine.js` as bound
      `engine.generateX({...})`-style calls.
- [x] Refactor `engine.js#getFamilyWealth()` to call
      `economy.getNetWorth()` instead of its own private
      `latestFinances()` — cleanup, formula unchanged from step 6.
- [x] Verify against a live `WorldState`:
      - `generateResource({})` throws (no `resourceType`, no schema
        default).
      - Generated a `water` resource (`supply: 40, demand: 90,
        production_rate: 5, consumption_rate: 15`); `getScarcity()`
        correctly read high (demand exceeds supply); 5 ticks of
        `advanceResourceTick()` reduced `quantity` by exactly the net
        rate (1000 -> 950); 200 more ticks clamped at `0`, never
        negative.
      - `generateMarketListing({...})` throws without `price` (no
        schema default). A high-demand/low-supply listing's price rose
        after `resolveMarketPrice()` (2.00 -> 2.40); a
        low-demand/high-supply listing's price fell (5.00 -> 4.55) —
        confirmed the feedback model moves the correct direction both
        ways, not just one.
      - Seeded `individual_finances` for 2 NPCs (including an
        older + newer row for one, to re-confirm "most recent wins"
        still holds through the refactor) and confirmed
        `getFamilyWealth()` returns the exact expected total (2160),
        matching step 6's already-verified formula/behavior exactly.
      - Regression: NPC (20 families/114 traits), Organization (9
        traits), Family (5 traits) generation all unaffected; re-ran
        an existing Key resolver (`resolveScarcityResponse`) against
        the new water-resource scenario — still works correctly.
- [x] Commit as its own change, separate from steps 1-6.

## Note on scope
This step deliberately stops short of connecting resource scarcity to
`entity_knowledge` automatically (so a Key resolver would "hear about"
a real drought without it being manually seeded, as step 4's
verification did by hand). That connection is a tick-pipeline concern
— step 8 — not a resource-tracking one. The pieces now exist
(`getScarcity()` on the resource side, `resolveScarcityResponse()` on
the Key side); step 8 is what wires them together automatically.

## Next task after this one
Step 8 (rebuild `advanceTick()` into the 11-phase pipeline) per
`CLAUDE.md`'s locked order — this is what actually calls the 7 Key
resolvers, resource ticks, and market price resolution automatically
each simulation tick, in the Environment -> Resource -> Economy ->
Social -> Decision -> Migration -> Organization -> Security -> Event ->
History -> Reemergence order (Build Prompt). This is also the step
that would make the locked Definition of Done ("a drought-style
cascade running through at least 4 of the 10 locked systems")
literally runnable end to end, rather than demonstrable by manually
chaining function calls the way every verification so far has done.
