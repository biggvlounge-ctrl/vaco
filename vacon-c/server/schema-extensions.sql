-- server/schema-extensions.sql
--
-- Additive DDL applied AFTER VACANCY_POSTGRESQL_SCHEMA.sql.
--
-- **Why this is a separate file.** The base schema is a source
-- artifact: CLAUDE.md names it as the source of truth for database
-- shape, and `server/migrate.js` has refused since it was written to
-- invent columns in it. That refusal is right and stays. But a schema
-- that cannot hold a field the engine genuinely uses is a gap
-- somebody has to close before a restore can work, and closing it by
-- editing the locked file would erase the distinction between what
-- the package specified and what this project added.
--
-- So: base schema unmodified, additions here, each one with the
-- engine field it carries and why the base has no home for it.
--
-- The bar for adding something here is deliberately high. A field the
-- engine SETS is not enough; it has to be a field the engine READS,
-- so that losing it on restore changes behaviour rather than just
-- dropping a value nothing consumes. Two fields were considered and
-- only one met it — see the note at the bottom.

-- ---------------------------------------------------------------------
-- npcs.name
-- ---------------------------------------------------------------------
-- Carries: `npc.name`, set by engine.js#generateNPC.
--
-- Neither `entities` nor `npcs` has ever had a name column.
-- migrate.js's header flagged this on the day it was written — "npc.name
-- has no home in the real schema. Not invented here; `name` stays an
-- in-memory-only field and is simply not inserted anywhere" — which was
-- the right call for a one-way export. It stops being sufficient for a
-- restore.
--
-- It cannot be regenerated either: `generateName()` picks from
-- FIRST_NAMES/LAST_NAMES with Math.random(), so it is not derivable
-- from the id or from anything else that survives.
--
-- And it is load-bearing, not decoration. engine.js, tick.js and
-- keys.js all put `npc.name` into event descriptions and historical
-- records. Without it a restored world's entire event log reads
-- "undefined did X to undefined" — or, worse, every NPC silently
-- becomes a different person on restart, which in a simulation whose
-- subject is generational continuity and word-of-mouth reputation is
-- not a cosmetic loss.
--
-- Organizations already have `organizations.name` and families
-- `families.surname`; npcs are the only tier the base schema left
-- nameless.
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS name TEXT;

-- ---------------------------------------------------------------------
-- properties.community_id and properties.city_id
-- ---------------------------------------------------------------------
-- Carries: `property.community_id` / `property.city_id`, set by
-- property.js#generateProperty and now READ by
-- server/statistics.js#propertiesIn.
--
-- **This file carried these two as "considered and deliberately NOT
-- added" from the day it was written, with the reason stated as a
-- condition rather than a verdict:** the bar here is a field the engine
-- READS, nothing read them, and closing the gap properly was a design
-- decision about the Property/Territory relationship rather than a
-- column this file could add on its own authority. `test/restore.test.js`
-- held that as a self-checking exemption — if anything ever started
-- reading a property's community, the exemption stopped being true and
-- the test would say so.
--
-- That is what happened. Every housing statistic in
-- `server/statistics.js` — condition, value, vacancy, residential mix,
-- land size — has to know which properties are in an area, and there is
-- no other path: the base schema gives a property land_size, type,
-- value, condition, occupants, floors, units, age, construction_date,
-- utilities, operating_organization_id, density_tier, lifecycle_stage
-- and history_ref, and no FK to a community, a city or a block.
--
-- So the design decision is made here and stated: **a property belongs
-- to a community, and a community belongs to a city.** That is the same
-- containment the rest of the schema already uses — `communities.city_id`,
-- `territory_blocks.community_id`, `entities.community_id` — and it
-- keeps a property's location a single FK rather than a geometry, which
-- is what the engine actually needs and all it can currently fill in.
--
-- `city_id` is redundant with `community_id -> communities.city_id` for
-- any placed property and is added anyway, because a property can exist
-- in a city before any community is drawn around it — which is how a
-- world is generated, cities first.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_id BIGINT REFERENCES communities(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id);

-- ---------------------------------------------------------------------
-- `deceased` as an entity status — a value, not a column
-- ---------------------------------------------------------------------
-- Recorded here rather than by editing the locked base schema, and
-- recorded at all because it is a genuine divergence from what that
-- file documents.
--
-- `entities.status` is TEXT with its permitted values in a comment:
--
--     status TEXT NOT NULL DEFAULT 'active',
--         -- active|inactive|destroyed|archived|hidden
--
-- `server/mortality.js` writes a sixth, **`deceased`**, and no DDL is
-- needed for it: the column is TEXT and there is no CHECK constraint
-- or enum type, so the database already accepts it. What would
-- otherwise be wrong is the base schema's comment, which would quietly
-- stop being a complete list.
--
-- **Why none of the five existing values would do.** `destroyed` is
-- for objects and reads as demolition. `inactive` and `archived` both
-- imply reversibility — an inactive account comes back. `hidden` is a
-- visibility state. A dead person is none of those: the status has to
-- be terminal and has to be distinguishable from every other reason an
-- entity might stop participating, because inheritance, lineage and
-- `npcs.generation` all key off it.
--
-- The spec's §17 lists an NPC's status as `active|imprisoned|deceased`,
-- so the base schema and the spec already disagreed here and BOTH of
-- the values that matter were missing. This adds the one that has an
-- implementation. `imprisoned` stays absent, which is why §7's Prison
-- system is still marked `absent` in server/urbanSystems.js.
--
-- No `npcs.died_tick` and no `npcs.death_cause`. Both were in the
-- first draft of mortality.js and both were removed: nothing READS
-- them, which is this file's stated bar, and the tick and cause are
-- already in `historical_records` (who/what/when_tick/why), which is
-- where a death belongs. `mortality.js#deathRecordFor` is the read
-- path, so the historical record is the durable answer rather than a
-- write nobody consults.

-- ---------------------------------------------------------------------
-- crime_incidents — the one new TABLE in this file
-- ---------------------------------------------------------------------
-- Carries: `worldState.crimeIncidents`, written by server/crime.js from
-- inside the Security phase.
--
-- **The bar for a new table is higher than the bar for a column, and
-- this is how it was cleared.** §9's MASTER BLOCK KEY asks for seven
-- crime categories per area — "violent crime, property crime, drug
-- crime, theft, gun crime, fraud, domestic incidents". The base schema
-- answers that with two aggregate NUMERIC columns, `communities.crime`
-- and `territory_blocks.crime_rate`, both seeded by their generators
-- and updated by nothing. A single number cannot be broken down by
-- category, so the statistic §9 specifies was not merely unimplemented,
-- it was unrepresentable.
--
-- **Three existing tables were considered first:**
--
--   `events` — no roles. `affected_entity_ids` is a flat JSONB array,
--   so an offender and a victim are the same field, and the category
--   would live in a free-text `note`. Counting crimes by type would
--   mean parsing English.
--
--   `historical_records` — this is where a DEATH goes, so it was the
--   strongest candidate. It fails on attribution: `where_location_id`
--   references `properties`, and a property has no city, community or
--   block (see the note above, which this file has carried since it was
--   written). A crime filed there can never be summed by neighbourhood,
--   which is the only thing §9 asks of it. `who` is also role-less,
--   same as `events`.
--
--   `keys_log` — records that an aggression key resolved, not what the
--   resolution was in the world.
--
-- So the row carries four things no existing table holds together:
-- **category, perpetrator, victim, and the community it happened in.**
--
-- History is not duplicated. An incident at or above severity 60 also
-- writes a `historical_records` row exactly as a death does, so §41's
-- "the world remembers" still has one place to read; the incident row
-- is the count, the history row is the memory.
CREATE TABLE IF NOT EXISTS crime_incidents (
    id                      BIGSERIAL PRIMARY KEY,
    category                TEXT NOT NULL, -- violent|property|drug|theft|gun|fraud|domestic|sex_offense
    perpetrator_entity_id   BIGINT REFERENCES entities(id),
    victim_entity_id        BIGINT REFERENCES entities(id),
    community_id            BIGINT REFERENCES communities(id),
    tick                    BIGINT NOT NULL,
    severity                NUMERIC,
    detail                  TEXT
);

-- Both nullable on purpose. A property offence has no victim entity,
-- and an incident whose parties are both unplaced has no community —
-- recorded with a null rather than assigned to an arbitrary one, so it
-- is visibly excluded from per-area counts instead of quietly
-- corrupting one. Same rule `areaStats.unplaced` follows for residents.
CREATE INDEX IF NOT EXISTS idx_crime_incidents_community ON crime_incidents (community_id);
CREATE INDEX IF NOT EXISTS idx_crime_incidents_category ON crime_incidents (category);

-- ---------------------------------------------------------------------
-- crime_incidents.investigated_tick / .cleared
-- ---------------------------------------------------------------------
-- Carries the outcome server/policing.js writes. Added to this file's
-- own table rather than to the base schema, same as the table itself.
--
-- **Three states, not two, and that is the whole reason `cleared` is
-- nullable.** A case nobody has looked at yet is neither solved nor
-- failed; defaulting it to false would make every incident ever
-- recorded count against the clearance rate from the moment it
-- happened, so an area's clearance rate would fall every time somebody
-- committed a crime rather than every time one went unsolved.
--
-- Both clear this file's stated bar — the engine READS them:
-- `policing.clearanceRate` and `policing.caseload` are built entirely
-- on these two columns, and `runPolicing` skips an incident that
-- already has an `investigated_tick`, so losing them on restore would
-- re-investigate the entire history of the world on the next tick.
ALTER TABLE crime_incidents ADD COLUMN IF NOT EXISTS investigated_tick BIGINT;
ALTER TABLE crime_incidents ADD COLUMN IF NOT EXISTS cleared BOOLEAN;


-- ---------------------------------------------------------------------
-- inventory — the second new TABLE in this file
-- ---------------------------------------------------------------------
-- Carries: `worldState.inventory`, written by server/inventory.js.
--
-- **Four systems had already run into its absence**, which is what
-- cleared this file's deliberately high bar:
--
--   `crime.js` declares the `gun` category ungeneratable in its own
--   words — "no weapon exists anywhere in the schema ... so nothing
--   distinguishes an armed offence from an unarmed one".
--
--   `barter.js` could not make a trade conservative: with nothing to
--   represent goods, the seller's side had to reduce
--   `individual_finances.assets` as a stand-in, and a seller holding
--   none minted value out of nothing until a check was added.
--
--   A deprivation theft moved no object at all — the victim lost
--   nothing and the offender gained nothing.
--
--   And `GAME_LANGUAGE_AND_REFERENCES.md` names "an item that raises a
--   trait" as one of four missing edges in the growth loop.
--
-- **Three existing tables were considered and each fails differently:**
--
--   `individual_finances.assets` is a single NUMERIC. It cannot say
--   WHICH goods, so it answers none of the four questions above.
--
--   `properties.occupants` is JSONB about people in a building.
--
--   `ownership_records` is the closest and is genuinely wrong for
--   this. It is an append-only history keyed to an `entities(id)`, and
--   an item in a satchel is not an entity — there is no entities row
--   for the third hammer somebody is carrying, and minting one per
--   item would put hundreds of thousands of rows into the table every
--   other system iterates.
--
-- No `item_definitions` table alongside it, deliberately: the item
-- catalogue lives in server/barter.js as data (§27's seventeen sourced
-- values plus whatever a world adds), following the precedent flows.js
-- set, and inventory refuses an item that catalogue does not know. One
-- place to define an item means the two cannot drift.
CREATE TABLE IF NOT EXISTS inventory (
    id                  BIGSERIAL PRIMARY KEY,
    holder_entity_id    BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    item_name           TEXT NOT NULL,
    quantity            NUMERIC NOT NULL,
    condition           NUMERIC DEFAULT 100,
    equipped            BOOLEAN DEFAULT false,
    acquired_tick       BIGINT NOT NULL
);

-- No `value` column, and that is standing rule 3 rather than an
-- oversight: what a thing is worth is its base value against local
-- scarcity and population, all of which move. A stored value would be
-- the price on the day it was picked up, forever — standing rule 9's
-- frozen-field failure in a new place. `inventory.valueOf` computes it
-- through `barter.barterScore`.
CREATE INDEX IF NOT EXISTS idx_inventory_holder ON inventory (holder_entity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory (item_name);

-- ---------------------------------------------------------------------
-- npcs.ethnicity
-- ---------------------------------------------------------------------
-- Carries: `npc.ethnicity`, set by engine.js#generateNPC and inherited
-- by births.js#bearChild.
--
-- The base schema models language, religion and education as an NPC's
-- demographic dimensions and has no fourth. `statistics.js` declared
-- the missing one "deliberately absent rather than missing" and named
-- what it was waiting for: §9 permits demographic modelling while
-- forbidding demographics determining an NPC's morality, criminality,
-- intelligence or worth, "which makes adding one a decision to take
-- explicitly, not a side effect of wanting a composition statistic."
-- The owner took that decision on 17 Sep 2026.
--
-- Meets this file's bar — a field the engine READS, not merely sets:
-- `demographics.compositionOf` reads it and two statistics report it,
-- so a restore that dropped it would change what a world can say about
-- itself rather than silently discarding a value nothing consumes.
--
-- **What may NOT read it is enforced by `test/ethnicity.test.js`**: no
-- generator of crime, policing, employment, wages, mortality or trait
-- values. The column exists to be counted, not to decide anything.
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS ethnicity TEXT;
