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
-- `bedrooms`, and why `units` is not it
-- ---------------------------------------------------------------------
-- The base schema gives a property `floors` and `units`. `units` is how
-- many dwellings a building contains; bedrooms is how many rooms ONE
-- dwelling has, and they are different questions — a twelve-unit block
-- of one-bedroom flats and a twelve-bedroom house have the same `units`
-- reading under any encoding that tries to carry both in one integer.
--
-- It is added because "a one-bedroom apartment" is the smallest thing
-- anybody names when they describe where they live, and because the
-- maintain key in `server/control.js` reads a building's SIZE — a fact
-- that has to be legible to a person, not just to an area calculation.
--
-- NULL for anything that is not somewhere people live. A monument has
-- no bedrooms, and zero would be a claim that it has none rather than
-- that the question does not apply.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER;

-- ---------------------------------------------------------------------
-- `landmark_category` and `former_type` — which landmark, and what it was
-- ---------------------------------------------------------------------
-- `properties.type` is the schema's own ten-value enumeration and it is
-- COARSER than the two documents that name the things worth taking:
-- THE_KEY_BUILDING_TYPES.md's twenty-three hero-tier categories and
-- COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md's ten retail types. Five hero
-- categories collapse onto `historical_site` alone, so a row that
-- recorded only the type could not tell a mosque from a bridge.
--
-- `former_type` exists because a landmark's past does not fix its
-- future: `landmarks.repurpose` turns a monument into a fortress and
-- the row has to say what it was. The HISTORY survives separately, in
-- the `historical_records` row `history_ref` points at — this column is
-- just the previous use, so the sequence is readable rather than
-- inferred from the history log.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS landmark_category TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS former_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS repurposed_tick BIGINT;

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


-- ---------------------------------------------------------------------
-- npcs.status = 'imprisoned'
-- ---------------------------------------------------------------------
-- No DDL: `npcs.status` is already TEXT and already carried by
-- migrate/restore. This note exists because the file said the opposite
-- a few hundred lines above, and that note is now wrong:
--
--   "The spec's §17 lists an NPC's status as `active|imprisoned|
--    deceased` ... This adds the one that has an implementation.
--    `imprisoned` stays absent, which is why §7's Prison system is
--    still marked `absent` in server/urbanSystems.js."
--
-- `server/justice.js` is the implementation, so all three of the spec's
-- values are now real. An imprisoned NPC stays in `worldState.npcs` —
-- they are alive and still a resident — which is the opposite of the
-- choice made for the dead, who are MOVED to `worldState.deceased`
-- precisely so that seventeen call sites cannot forget to check a flag.
--
-- That difference is deliberate and is the riskier of the two, so it is
-- written down: being imprisoned is temporary and partial. A dead
-- person participates in nothing, ever, and moving the row makes that
-- structurally impossible to get wrong. A prisoner still ages, still
-- has traits that drift, still holds property and still belongs to a
-- family — they do not work, do not conceive, do not compete and do not
-- count as living in the house. So each system says for itself whether
-- being inside changes what it models, and `test/justice.test.js` holds
-- the list of the ones that must.

-- ---------------------------------------------------------------------
-- court_cases — the third new TABLE in this file
-- ---------------------------------------------------------------------
-- Carries: `worldState.courtCases`, written by server/justice.js from
-- inside the Security phase, after policing.
--
-- **Why a new table rather than an existing one.** Three were
-- considered first, the same way `crime_incidents` and `inventory`
-- were:
--
--   * `crime_incidents` already carries the offence and, since
--     policing, whether it was cleared. It cannot carry the case: one
--     incident produces at most one case here, but the case has a
--     DEFENDANT (who is not always the recorded perpetrator once
--     anything more than ground truth exists), a LAW it was brought
--     under, a judgement, a sentence length and a release tick. Adding
--     six columns about adjudication to the table that records the
--     offence conflates what happened with what was done about it.
--   * `laws` is the legislation, one row per statute per jurisdiction.
--     A case cites a law; it is not a kind of law.
--   * `historical_records` DOES get a row per conviction and per
--     release, and that is where the permanent record lives. It cannot
--     be the case itself: `justice.runJustice` has to find, every tick,
--     the sentences that are still running, and asking that of a
--     free-text event log means parsing prose to decide whether to let
--     somebody out of prison.
--
-- Both `sentence_ticks` and `released_tick` clear this file's bar — the
-- engine READS them every tick. A restore that dropped either would
-- leave everybody currently inside imprisoned forever with no sentence
-- to end, which is the worst failure available here: silent, permanent,
-- and invisible until somebody counts the population that is working.
CREATE TABLE IF NOT EXISTS court_cases (
    id                  BIGSERIAL PRIMARY KEY,
    incident_id         BIGINT NOT NULL REFERENCES crime_incidents(id) ON DELETE CASCADE,
    defendant_entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    community_id        BIGINT REFERENCES communities(id),
    city_id             BIGINT REFERENCES cities(id),
    category            TEXT NOT NULL, -- crime.CATEGORIES: violent|property|drug|theft|gun|fraud|domestic|sex_offense
    -- Null IS the dismissal: no active law of the matching category in
    -- this jurisdiction, so there was nothing to charge under.
    law_id              BIGINT REFERENCES laws(id),
    status              TEXT NOT NULL, -- charged|convicted|dismissed
    charged_tick        BIGINT NOT NULL,
    sentence_ticks      BIGINT,
    released_tick       BIGINT
);
CREATE INDEX IF NOT EXISTS idx_court_cases_defendant ON court_cases (defendant_entity_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_community ON court_cases (community_id);


-- ---------------------------------------------------------------------
-- Position and geo reference — cities, communities, infrastructure
-- ---------------------------------------------------------------------
-- Carries: the coordinates and hierarchical references written by
-- server/worldgen.js and read by server/geo.js.
--
-- **`dev-docs/LAND_AND_MAP_DATA.md` §1 named this as the single most
-- important thing to fix**, and its reasoning is this file's own bar
-- stated from the other side:
--
--   "Three of those are free-text keys with no format, no parser and no
--    reader. That is the single most important thing to fix before
--    importing anything, because a geo reference nothing can parse is a
--    string, not a location."
--
-- `cities.real_world_geo_ref` already exists in the base schema and is
-- not re-added here. What it lacked was a format, a parser and anything
-- that read it; `server/geo.js` is all three, and `geo_source` is what
-- makes a reference answerable about where it came from — §5 of that
-- document is titled "Provenance, and why it is not optional here".
--
-- **Latitude and longitude are EPSG:4326, and nothing in the engine
-- measures an area from them.** §7 step 2 names computing an area in
-- degrees as the classic silent error; `geo.distanceMetres` is
-- haversine and returns metres, so the only measurement taken from
-- these columns cannot be wrong in that direction.
--
-- All three clear this file's bar — the engine READS them.
-- `authority.reachTerm` reads the distance from a community to the
-- nearest `public_safety` site, which is what makes how far the state
-- reaches a fact about a NEIGHBOURHOOD rather than about its city; a
-- restore that dropped them would put every block back at the station
-- door and quietly make every area governed again.
ALTER TABLE cities ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS geo_source TEXT;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS geo_ref TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS geo_source TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS longitude NUMERIC;

ALTER TABLE infrastructure ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE infrastructure ADD COLUMN IF NOT EXISTS longitude NUMERIC;


-- ---------------------------------------------------------------------
-- infrastructure.failed_since_tick / .repair_ticks
-- ---------------------------------------------------------------------
-- Carries what server/infrastructure.js writes when a system actually
-- fails, and how long this city takes to put it back.
--
-- **`failureRisk` was computed, crossed and consumed by nothing.** It
-- had two readers — one statistic and one event that fires once when
-- the risk crosses 0.5 — so a grid at risk 0.95 behaved exactly like
-- one at 0.05, and §7 marked Energy and Waste `slot`: "storage exists
-- and nothing reads it". These two columns are the reading it lacked.
--
-- Both clear this file's bar. `advanceInfrastructure` reads
-- `failed_since_tick` every tick to decide whether a system is down and
-- reads `repair_ticks` to decide whether it is due back, so a restore
-- that dropped them would bring every failed utility back online
-- silently — and one that restored them as strings would leave every
-- one of them down forever, because `tick - "42"` is NaN and the repair
-- would never come due.
ALTER TABLE infrastructure ADD COLUMN IF NOT EXISTS failed_since_tick BIGINT;
ALTER TABLE infrastructure ADD COLUMN IF NOT EXISTS repair_ticks BIGINT;


-- ---------------------------------------------------------------------
-- cities.dna / cities.traits / civilizations.traits
-- ---------------------------------------------------------------------
-- The two tier-level trait sheets `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`
-- defines and the engine never built, plus §49's CITY DNA.
--
-- The attachment lists FIVE tier-level sheets — FAMILY, ORGANIZATION,
-- CITY, CIVILIZATION and CULTURE. Four had a module. CITY and
-- CIVILIZATION had none, so thirty-three named dimensions existed only
-- in a document, which is where §7's last three `absent` urban systems
-- were sitting: 20 Government Services, 35 Military / National Guard
-- and 36 Tourism.
--
-- **JSONB rather than a column per dimension, and not for brevity.**
-- `cultures.traits` already established this shape for a tier-level
-- entity, and the reason is the same: cities and civilizations draw
-- their ids from their own counters, not from `nextEntityId`, so they
-- have no `entities` row and an `entity_traits` row for them would
-- violate that table's own foreign key. That is exactly the defect the
-- restore pass found in `properties` and `cultures`.
--
-- Only the dimensions with no existing answer are stored — one of the
-- twelve city dimensions and four of the twenty-one civilization ones.
-- `server/tierTraits.js` reconciles every other name against the column,
-- rollup or system that already answers it, and refuses a caller who
-- passes one of them.
--
-- All three clear this file's bar. `statecraft.runStatecraft` reads
-- `civilizations.traits` every quarter to decide what each city's
-- hospitals, schools and stations are funded at, reads `cities.traits`
-- every tick to drift tourism, and reads `cities.dna` for §49's appeal
-- and upkeep biases. A restore that dropped them would put every state
-- back on an even split it never chose, blank every city's visitors,
-- and give every city the same characterless identity.
ALTER TABLE cities ADD COLUMN IF NOT EXISTS dna TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS traits JSONB;
ALTER TABLE civilizations ADD COLUMN IF NOT EXISTS traits JSONB;

-- ---------------------------------------------------------------------
-- What has been carried out of a landmark
-- ---------------------------------------------------------------------
-- `server/discovery.js` turns `landmarks.KEY_BUILDING_TYPES.discovery`
-- — thirty-three loot pools quoted verbatim from
-- KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md and
-- COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md, and read by nothing — into
-- real books, artifacts and items.
--
-- A landmark has to run out, or it is an infinite supply of books
-- (standing rule 13: a mechanism with no inverse has no equilibrium).
-- Capacity is computed from `landmarks.significanceOf`, so the only
-- thing that needs storing is how much has already gone. Stored rather
-- than derived because it is a fact about what happened, not a rollup
-- — standing rule 3 forbids storing what can be computed, and this
-- cannot be.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS discoveries_taken INTEGER DEFAULT 0;

-- Whether a captured location's stockroom has already been emptied.
-- `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`'s `KeyLocationCapture` says
-- "merchandiseAccessGranted: true" on capture, and `server/merchandise.js`
-- honours it — but a group that takes a shop, loses it and takes it
-- back must not get a second stockroom, or a takeover loop is an
-- infinite supply of food. Standing rule 13, same shape as
-- `discoveries_taken` above.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS merchandise_taken BOOLEAN DEFAULT FALSE;

-- What a place is called.
-- **`properties` had no name column at all**, so every landmark in
-- every world was an id and a category — `813, monument-memorial` —
-- and a cathedral was indistinguishable from the next cathedral. The
-- St. Louis demo this project's own documents point at names every
-- location it uses (Cahokia Mounds, the Gateway Arch, Confluence
-- Point); nothing in the engine named anything.
--
-- NULL for an ordinary building, because a house genuinely has no
-- name and zero-or-blank would claim it is called nothing.
-- `landmarks.designate` is the writer, and a caller-supplied name wins
-- so that an imported real place keeps the name it actually has.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS name TEXT;

-- What a neighbourhood is called.
-- `cities.name` is NOT NULL and a city's blocks were `community 3`,
-- which is fine while every area is interchangeable and stops being
-- fine the moment a landmark pack says the cathedral is in the Central
-- West End. `landmarkPacks.byArea` matches a real place to a real
-- neighbourhood on this column. NULL for a generated block: inventing
-- neighbourhood names is a different job from placing real ones.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS name TEXT;

-- The place a mission is about.
-- Carries: `mission.location_property_id`, set by
-- `missions.generateMission` and read by `tribeMissions.js`.
--
-- **`missions.artifact_id` is nullable in the base schema and
-- `generateMission` refused a null anyway**, on the stated grounds
-- that "a mission is always generated FROM a real artifact, not
-- created standalone". That was right while the only mission in the
-- engine was "Recover it", and it stopped being right when
-- `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` got built: that document's
-- mission is a TAKEOVER — "recruit someone with real water-treatment
-- experience, and the water plant takeover becomes a real,
-- newly-viable mission" — and a building is not an artifact.
--
-- Without this column the target of such a mission could only live in
-- the `objective` TEXT, which no code can read back. Measured on a
-- 120-tick world, the two sets barely meet on their own: 21 landmark
-- properties, 17 operated ones, 6 both, and every artifact discovery
-- so far landed in a `historical_site` with no operator — so gating
-- the whole mechanic on an artifact happening to turn up in a staffed
-- building made it fire by coincidence or not at all.
--
-- It clears the bar this file sets, which is that the engine must READ
-- the field rather than merely set it: `tribeMissions.missionForLocation`
-- reads it to decide whether a location already has a mission, and
-- that read is the memory that makes the unlock a CROSSING rather than
-- a condition firing every tick forever (seventh standing rule).
-- Losing it on restore would make every restored world re-open every
-- mission it already had.
--
-- NULL for an artifact-recovery mission, which is about a thing rather
-- than a place. A mission must name one or the other and
-- `generateMission` enforces exactly that.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS location_property_id BIGINT REFERENCES properties(id);
