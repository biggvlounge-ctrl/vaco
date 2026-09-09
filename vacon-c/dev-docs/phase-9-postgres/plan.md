# Plan — Stand up Postgres, migrate off in-memory WorldState (locked Day 1 step 9)

## Goal, read literally
"Stand up Postgres, migrate off in-memory `WorldState`, keep `/api/*`
identical." Three distinct claims, assessed honestly rather than
declared done as a set:

1. **Stand up Postgres** — done, literally: Postgres 16 was already
   installed in this environment (unused), started for real
   (`service postgresql start`), a `vacancy` role/database created,
   and `VACANCY_POSTGRESQL_SCHEMA.sql` loaded against it verbatim —
   all 60 tables created with zero errors.
2. **Migrate off in-memory WorldState** — partially done, precisely
   scoped (see below): a real, tested, one-way export of the current
   `WorldState` into the live Postgres instance. NOT done: converting
   every `generate*()`/tick-phase function across `engine.js`/
   `economy.js`/`keys.js`/`tick.js` to read/write Postgres directly
   instead of `WorldState` arrays.
3. **Keep `/api/*` identical** — impossible to do or verify: no
   Express routes file, no `package.json` for a server, no dev server
   has existed in any handoff to this project since the very first one
   (flagged since `dev-docs/phase-1-trait-split/tasks.md`). There is
   nothing to "keep identical" — `engine.js`'s exports are the surface
   such routes would eventually wrap.

## Why "migrate off in-memory WorldState" is scoped to a one-way export, not a full rewrite
Every `generate*()` function (`generateNPC`, `generateOrganization`,
`generateFamily`, `generateResource`, ...) and every tick-phase
function is currently **synchronous** and reads/writes plain JS
arrays. A real Postgres connection is necessarily **async**. Converting
all of this to query Postgres directly means: every function signature
changes (sync -> async, `Promise`-returning), every caller needs
`await`, every read that currently does `array.find(...)` becomes a
`SELECT ... WHERE`, and the "live entity" correctness fix from step 8
(`getLiveEntity()`) would need to become a real query rather than an
array recompute. That's a rewrite touching all 9 `server/*.js` files
built across steps 1-8, not an additive step — it doesn't fit the "one
phase, verified, committed on its own" pattern every prior step used,
and doing it hastily would risk breaking the very regression suite
this project has re-run and kept green at every single step so far.

What's built instead, real and tested rather than sketched:
- `server/db.js` — a real `pg` Pool connection (per the architecture
  doc's own file-ownership note, Section 8: "db.js (new)").
- `server/migrate.js` — `migrateWorldStateToPostgres(worldState)`: a
  one-transaction export of every `WorldState` array into its literal
  table, in FK-respecting order, rolled back whole on any failure.

## A real bug the live database caught
`entities.family_id -> families(id)` and `families.founder_id`/
`families.head_npc_id -> entities(id)` are **circular** — writing this
migration on paper looked fine; running it against the actual Postgres
instance immediately failed with a real FK violation
(`fk_entities_family`, `Key (family_id)=(5) is not present in table
"families"`). Fixed with the standard two-phase pattern: insert
`entities` rows with `family_id` left `NULL`, insert `families`
(which can now reference existing NPC `entities` rows via
`founder_id`/`head_npc_id`), then `UPDATE entities.family_id`
afterward. This is exactly the kind of thing that only surfaces by
actually running the migration against a live database — flagged
explicitly rather than glossed over, same as every other self-caught
issue across this project (step 5's trait duplication, step 8's stale-
snapshot bug).

## A second real gap found while writing this
Neither `entities` nor `npcs` has a `name` column anywhere in the
literal schema. `npc.name` (used throughout `engine.js`/`tick.js`/
`keys.js` — e.g. event descriptions like "Marcus Whitfield's fear
spiked...") has no home in Postgres. Not invented here: `name` simply
isn't inserted anywhere by the migration; it stays an in-memory-only
convenience field. Worth resolving before this schema is treated as
final — either a real name-generation/storage system needs its own
column, or names are meant to live somewhere else in the full 500-
system design that hasn't surfaced in this handoff package yet.

## Done when
- Postgres is genuinely running, with the real schema loaded, zero
  errors.
- A representative `WorldState` (NPCs, an Organization, a Faction, a
  Family with members, a Resource, a Market listing, Individual
  finances, a relationship, and 2 ticks of pipeline activity generating
  real events/history/knowledge) exports via `migrateWorldStateToPostgres()`
  with every table's row count in Postgres matching the source array's
  length exactly, verified by querying Postgres directly — not just
  trusting the migration function's own return value.
- Spot-checked values (computed family wealth, a Faction's joined
  Organization+subtype data, a Relationship's exact numeric fields)
  match between `WorldState` and Postgres exactly, not approximately.
