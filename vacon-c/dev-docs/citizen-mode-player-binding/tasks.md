# Tasks — Citizen-Mode Player Binding

Not one of `CLAUDE.md`'s 9 numbered "Order of operations" steps (all
of which are complete as of `dev-docs/phase-9-postgres/`) — this is
the other half of the locked Definition of Done: "...with a
Citizen-mode player able to observe and be affected by it," flagged as
open in both `dev-docs/phase-8-tick-pipeline/tasks.md` and
`dev-docs/phase-9-postgres/tasks.md`.

Scoped to Citizen mode only, per `CLAUDE.md`'s explicit deferral of
Leader/Simulation/Multiplayer modes and the Build Prompt's own
instruction: "Build Citizen mode first — cheapest, a thin interaction
layer over existing NPC data."

- [x] Create `server/players.js`: `generatePlayer(worldState, options)`
      (requires `linkedEntityId`, throws if it doesn't reference an
      existing NPC — Citizen mode binds to an `npc` entity per the
      schema's own comment on `players.linked_entity_id`) and
      `getCitizenDashboard(worldState, playerId)`.
- [x] `getCitizenDashboard()` pulls together: live traits (via
      `getLiveEntity()`, the step-8 correctness fix — not the
      generation-time snapshot), career (`role`/`education`),
      relationships, family (with wealth computed inline, same formula
      as `engine.js#getFamilyWealth()` — standing rule 3 held here
      too), net worth, recent memories, recent events affecting this
      NPC, and current migration-risk status. Throws if the player
      isn't in `'citizen'` mode (that's the only mode anything here
      supports).
      - `propertySummary` is always `null`, explicitly, with a header
        comment explaining why: no Property system exists anywhere in
        any handoff (not even a minimum — `CLAUDE.md` defers "Property
        beyond the minimum," but there is no minimum built either).
- [x] Wire `engine.js`: `WorldState.players` array added,
      `generatePlayer()`/`getCitizenDashboard()` exposed as bound
      wrappers (same convention as `economy.js`/`tick.js`).
- [x] Verify:
      - `generatePlayer({})` throws (no `linkedEntityId`).
      - `generatePlayer({ linkedEntityId: <nonexistent> })` throws with
        a specific, useful message.
      - `getCitizenDashboard()` throws for a player in a non-`citizen`
        mode, with a message explaining why (mode not built).
      - Full scenario: bound a player to an NPC, built out a family +
        relationship + individual finances, triggered a 3-tick drought
        (same pattern as step 8's verification) — **traced one trait
        (`emotional.Volatility`) through `entity_traits` directly,
        tick by tick, confirming it climbed 90 -> 91 -> 92 -> 93
        exactly as the Fear resolver's `key_modifier` writes predict**,
        then confirmed `getCitizenDashboard()`'s returned `traits`
        object shows that same live value (93), not the stale
        generation-time snapshot.
      - Confirmed `family.wealth` in the dashboard matches the same
        computation `engine.js#getFamilyWealth()` would produce
        independently.
- [x] Commit as its own change.

## What this does NOT include
- Any actual HTTP route (`GET /api/players/:id/citizen-dashboard`,
  per `VACANCY_API_ENDPOINT_MAP.md`) — no routes file has existed in
  any handoff to this project since step 1; `getCitizenDashboard()` is
  the function such a route would call.
- Leader/Simulation/Multiplayer modes — explicitly deferred by
  `CLAUDE.md`.
- A `players.id`-keyed action dispatcher (`POST /api/players/:id/action`
  in the endpoint map) — not required for "observe," only "act," and
  not part of what was asked for here.
