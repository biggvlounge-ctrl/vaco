# Tasks — Postgres

- [x] Confirm Postgres availability in this environment — found
      Postgres 16 already installed (client + server binaries), not
      running. Started it for real (`service postgresql start`),
      confirmed with `pg_isready`.
- [x] Create the `vacancy` role and database.
- [x] Load `VACANCY_POSTGRESQL_SCHEMA.sql` against it verbatim — all
      60 `CREATE TABLE`/`ALTER TABLE` statements succeeded, zero
      errors. Verified table count via `information_schema.tables`
      (60) and `\dt` listing every table by name.
- [x] Create `vacancy/package.json` (didn't exist in any handoff) and
      install the `pg` driver.
- [x] Create `server/db.js` — real `Pool` connection, `query()`/
      `withClient()`/`close()` helpers.
- [x] Create `server/migrate.js` —
      `migrateWorldStateToPostgres(worldState)`, one transaction,
      FK-respecting insert order, rollback on any failure.
- [x] First real run against the live database caught a genuine bug:
      circular FK between `entities.family_id` and `families
      .founder_id`/`head_npc_id`. Fixed with the standard two-phase
      insert-NULL-then-UPDATE pattern (see plan.md for detail).
- [x] Found and flagged (not silently worked around): neither
      `entities` nor `npcs` has a `name` column — `npc.name` stays
      in-memory-only, not inserted anywhere.
- [x] Full verification run, after the fix:
      - Built a representative world: 2 NPCs, an Organization, a
        Faction, a Family with 2 members, a Resource, a Market
        listing, Individual finances for both NPCs, a manually-adjusted
        Relationship, then triggered a 2-tick drought via
        `addEnvironmentalCondition()` + `advanceTick()` (same pattern
        as step 8's verification) to populate real events/history/
        knowledge, not just generation-time data.
      - Ran `migrateWorldStateToPostgres()` — succeeded, returned a
        per-table row-count summary.
      - **Independently queried Postgres directly** (not trusting the
        migration function's own summary) for all 16 populated tables
        — every single count matched the source `WorldState` array's
        length exactly, including `trait_definitions` (128, the exact
        step 5/6-corrected total) and the conditionally-populated
        `factions` (1, matching `isFaction: true` count).
      - Spot-checked: the migrated NPC's `family_id` was correctly
        backfilled to the real family's id; the migrated family's
        `wealth` column matched `engine.getFamilyWealth()`'s live
        computation exactly (proving the "computed, never stored"
        rule holds through the migration, not just in memory); a
        Faction's joined `organizations`+`factions` row matched;
        migrated `events` matched the pipeline's actual output
        (`scarcity`, `scarcity`, `fear_spike` — the same chain step 8
        verified); a migrated `relationships` row's `trust`/`conflict`
        fields matched the in-memory row exactly, field for field.
- [x] Commit as its own change, separate from steps 1-8.

## What this step does NOT include (see plan.md for the full reasoning)
- Converting `engine.js`/`economy.js`/`keys.js`/`tick.js` to read/write
  Postgres directly instead of `WorldState` arrays — a substantially
  larger, higher-risk rewrite than fits this pass; `migrate.js` is a
  one-time/one-way snapshot export, not a live sync.
- An `/api/*` routes file, or verifying any endpoint's shape stayed
  "identical" — none has existed in any handoff to compare against,
  flagged since step 1.
- Resolving the `npc.name` schema gap found while writing this.

> **Both open items below were closed after this pass, and this
> section was written before that.** It is left as it stood, because
> what was open *at the time* is the useful part of a build log — but
> read it as history, not as current state:
>
> - **Citizen-mode player binding** — done, see
>   `dev-docs/citizen-mode-player-binding/tasks.md` (5/5).
>   `getCitizenDashboard()` exists; the HTTP route it noted as absent
>   arrived in phase 11.
> - **Territory/Community** — done, see
>   `dev-docs/territory-community/tasks.md` (6/6).
>   `resolveTerritoryControl()` is real. Its own "Next" flags what
>   remains: nothing writes organization-tier traits from the tick
>   pipeline, so the drought cascade still needs a manual trait
>   override to pressure a faction's territory.
>
> Two phases also postdate this one entirely: `phase-10-rename-to-vacon-c`
> and `phase-11-real-http-api` (12/12), the latter closing the "no
> routes file has existed in any handoff" caveat that appears three
> times above.
>
> The one item in this section that is still true: `engine.js`,
> `economy.js`, `keys.js` and `tick.js` continue to read and write
> in-memory `WorldState` arrays, not Postgres. `migrate.js` is a
> one-way snapshot export, not a live sync — so a restart still loses
> the simulation. That is why `dev-docs/COMPLETION_BY_APP.md` scores
> `vacon-c` short on persistence.

## Status: locked Day 1 numbered order (steps 1-9)
All 9 steps in `CLAUDE.md`'s "Order of operations" now have real,
tested work behind them. The two items still genuinely open, both
flagged as NOT part of that numbered list (they're part of the
broader 10-item locked *scope* instead):
- **Citizen-mode player binding** — flagged since
  `dev-docs/phase-8-tick-pipeline/tasks.md`.
- **Territory/Community** — referenced as a dependency throughout
  (Organization phase's no-op, Migration phase's "nowhere to relocate
  to," `resources.city_id`/`market_listings.city_id` always `NULL`).

Both are needed before the Definition of Done's full sentence — "a
drought-style cascade running through at least 4 of the 10 locked
systems, **with a Citizen-mode player able to observe and be affected
by it**" — is true in its entirety, even though the cascade mechanism
itself has been real and verified since step 8.
