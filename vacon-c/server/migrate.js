// server/migrate.js
//
// One-way export of the current in-memory WorldState into the real
// Postgres instance server/db.js connects to — locked Day 1 step 9's
// "migrate off in-memory WorldState" half, and the actual proof that
// every WorldState array built since step 2 really does mirror its
// table row-for-row, as every dev-docs phase along the way claimed.
//
// This is NOT a live, ongoing sync — it's a snapshot export, run once
// against whatever WorldState currently holds, in one transaction
// (rolled back whole on any failure). Converting every generate*()/
// tick-phase function in engine.js/economy.js/keys.js/tick.js to
// read/write Postgres directly instead of WorldState arrays (making
// all of them async in the process) is a substantially larger rewrite,
// explicitly NOT done here — flagged in dev-docs/phase-9-postgres/
// tasks.md, not silently skipped.
//
// GAP FOUND WHILE WRITING THIS: neither `entities` nor `npcs` has a
// `name` column anywhere in VACANCY_POSTGRESQL_SCHEMA.sql — `npc.name`
// (used throughout engine.js/tick.js/keys.js, e.g. event descriptions)
// has no home in the real schema. Not invented here; `name` stays an
// in-memory-only field and is simply not inserted anywhere.
//
// entities.family_id / organizations.id / families.id: this migration
// relies on the interpretive choices already made and flagged in
// dev-docs/phase-5-organization-trait-sheet/tasks.md and
// dev-docs/phase-6-family-engine/plan.md — organizations and families
// share the NPC id counter, standing in for the FK to entities(id)
// that npcs.entity_id has but organizations.id/families.id don't.
//
// Insert order respects every FK in the schema: entities before every
// subtype/dependent table; trait_definitions before entity_traits.

'use strict';

const db = require('./db.js');
const engine = require('./engine.js');
const { TRAIT_DEFINITIONS } = require('./traitDefinitions.js');

async function migrateWorldStateToPostgres(worldState) {
  const summary = {};

  await db.withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // ---------------------------------------------------------------
      // entities — one row per npc/organization/family. family_id is
      // deliberately left NULL here, not populated inline: entities
      // .family_id -> families(id) and families.founder_id/head_npc_id
      // -> entities(id) are circular FKs (each table needs a row in
      // the other to exist first). Real bug, only caught by testing
      // against the live database rather than reasoning about the
      // schema on paper. Fixed with the standard two-phase pattern —
      // insert entities.family_id NULL, insert families (which can now
      // reference existing npc entities via founder_id/head_npc_id),
      // then UPDATE entities.family_id afterward, once families exist.
      // ---------------------------------------------------------------
      let entityCount = 0;
      for (const npc of worldState.npcs) {
        await client.query(
          `INSERT INTO entities (id, type, status, created_tick, updated_tick) VALUES ($1, 'npc', $2, $3, $4)`,
          [npc.id, npc.status, npc.createdTick, npc.updatedTick]
        );
        entityCount++;
      }
      for (const org of worldState.organizations) {
        await client.query(
          `INSERT INTO entities (id, type, status, created_tick, updated_tick) VALUES ($1, 'organization', $2, $3, $4)`,
          [org.id, org.status, org.createdTick, org.updatedTick]
        );
        entityCount++;
      }
      for (const family of worldState.families) {
        await client.query(
          `INSERT INTO entities (id, type, status, created_tick, updated_tick) VALUES ($1, 'family', 'active', $2, $3)`,
          [family.id, family.createdTick, family.updatedTick]
        );
        entityCount++;
      }
      // properties — an entities row each.
      //
      // **Found by the first round-trip that included a property with
      // an owner (10 Sep 2026).** `ownership_records.entity_id`
      // REFERENCES entities(id), and the schema's own comment on it
      // says the referent is "the thing being owned (property,
      // business, artifact, etc.)". property.js already draws a
      // property's id from `worldState.nextEntityId`, exactly as
      // organizations and families do — so properties have always been
      // entities in the id space — but no entities row was ever
      // written for one. Any world where somebody owned a property
      // rolled the whole migration back on a foreign key violation.
      //
      // //: INTERPRETIVE — `entities.type` lists fourteen values and
      // two of them could hold a property: 'building' and 'land'. The
      // package does not say which, and PROPERTY_TYPES (residential,
      // commercial, agricultural, farm, digital_property, ...) does not
      // map onto that split cleanly — a farm is arguably land, a
      // digital_property is neither. 'building' is chosen because
      // `properties` carries floors, units, condition, occupants and a
      // construction_date, which describe a structure rather than a
      // parcel. Flagged rather than decided quietly; if the package
      // ever says otherwise, this is the line to change.
      for (const p of worldState.properties) {
        await client.query(
          `INSERT INTO entities (id, type, status, created_tick, updated_tick) VALUES ($1, 'building', 'active', $2, $3)`,
          [p.id, p.created_tick ?? 0, p.created_tick ?? 0]
        );
        entityCount++;
      }

      // cultures — an entities row each, for the same reason
      // properties need one directly above.
      //
      // culture.js draws `entity_id` from `worldState.nextEntityId`
      // and its own comment says why: "a culture is a tier-level
      // entity that other rows will need to reference, and the
      // property.js lesson was that a local counter collides the
      // moment something points at it from the entity id space." The
      // schema agrees — `cultures.entity_id BIGINT REFERENCES
      // entities(id)`, commented "shared entity id, so other rows can
      // point at a culture". No entities row was ever written for one,
      // so any world with a culture in it failed to migrate.
      //
      // //: INTERPRETIVE — `entities.type` has no 'culture'. Its
      // fourteen values are npc|family|organization|city|region|
      // civilization|vehicle|building|land|artifact|resource|player|
      // ai|world_object. 'civilization' is the nearest concrete one and
      // is wrong: a culture attaches at the family, community,
      // organization, city OR civilization tier, so calling every
      // culture a civilization would contradict culture.js's own tier
      // list. 'world_object' is the schema's generic, and that is what
      // this uses. Flagged, not decided quietly.
      for (const c of worldState.cultures) {
        await client.query(
          `INSERT INTO entities (id, type, status, created_tick, updated_tick) VALUES ($1, 'world_object', 'active', 0, 0)`,
          [c.entity_id]
        );
        entityCount++;
      }

      summary.entities = entityCount;

      // ---------------------------------------------------------------
      // npcs
      // ---------------------------------------------------------------
      for (const npc of worldState.npcs) {
        await client.query(
          // `name` is not in VACANCY_POSTGRESQL_SCHEMA.sql — this
          // file's own header has said so since it was written, and
          // refused to invent a column for it. That refusal was right
          // for a one-way export and insufficient for a restore:
          // generateName() uses Math.random(), so a name that is not
          // stored cannot be regenerated, and engine.js/tick.js/keys.js
          // all put npc.name into event descriptions.
          //
          // The column now exists, added by server/schema-extensions.sql
          // rather than by editing the locked base schema. See that
          // file for why it meets the bar and why property location
          // does not.
          `INSERT INTO npcs (entity_id, role, education, religion, generation, name) VALUES ($1,$2,$3,$4,$5,$6)`,
          [npc.id, npc.role, npc.education, npc.religion, npc.generation, npc.name ?? null]
        );
      }
      summary.npcs = worldState.npcs.length;

      // ---------------------------------------------------------------
      // organizations + factions
      // ---------------------------------------------------------------
      for (const org of worldState.organizations) {
        await client.query(
          `INSERT INTO organizations (id, name, type, founder_id, leader_id, members, assets, income, expenses, influence, security, innovation, reputation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [org.id, org.name, org.type, org.founder_id, org.leader_id, org.members, org.assets,
            org.income, org.expenses, org.influence, org.security, org.innovation, org.reputation]
        );
      }
      summary.organizations = worldState.organizations.length;

      let factionCount = 0;
      for (const org of worldState.organizations) {
        if (!org.isFaction) continue;
        await client.query(
          `INSERT INTO factions (organization_id, color, morale, status) VALUES ($1,$2,$3,$4)`,
          [org.id, org.color, org.morale, org.factionStatus]
        );
        factionCount++;
      }
      summary.factions = factionCount;

      // ---------------------------------------------------------------
      // families — wealth is computed (engine.js#getFamilyWealth()),
      // never inserted from a stored field; standing rule 3, same as
      // everywhere else this project touches it.
      // ---------------------------------------------------------------
      for (const family of worldState.families) {
        await client.query(
          `INSERT INTO families (id, surname, founder_id, generation, head_npc_id, total_members, wealth, reputation, unity, conflict, traditions, religion, political_influence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [family.id, family.surname, family.founder_id, family.generation, family.head_npc_id,
            family.total_members, engine.getFamilyWealth(family.id), family.reputation, family.unity,
            family.conflict, JSON.stringify(family.traditions), family.religion, family.political_influence]
        );
      }
      summary.families = worldState.families.length;

      // Backfill entities.family_id now that families exist — see the
      // circular-FK note above. An entity in more than one family
      // (family_memberships is many-to-many) gets whichever membership
      // sorts first; entities.family_id is a single-value column, so
      // it can't represent more than one anyway.
      for (const m of worldState.familyMemberships) {
        await client.query(
          `UPDATE entities SET family_id = $1 WHERE id = $2 AND family_id IS NULL`,
          [m.family_id, m.entity_id]
        );
      }

      // ---------------------------------------------------------------
      // family_memberships
      // ---------------------------------------------------------------
      for (const m of worldState.familyMemberships) {
        await client.query(
          `INSERT INTO family_memberships (entity_id, family_id, role, generation_number) VALUES ($1,$2,$3,$4)`,
          [m.entity_id, m.family_id, m.role, m.generation_number]
        );
      }
      summary.family_memberships = worldState.familyMemberships.length;

      // ---------------------------------------------------------------
      // trait_definitions + entity_traits
      // ---------------------------------------------------------------
      for (const def of TRAIT_DEFINITIONS) {
        await client.query(
          `INSERT INTO trait_definitions (trait_id, name, family, description, min_value, max_value, default_value, mutation_chance, inheritance_chance, growth_rate, decay_rate, visible, stackable, locked)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [def.trait_id, def.name, def.family, def.description, def.min_value, def.max_value,
            def.default_value, def.mutation_chance, def.inheritance_chance, def.growth_rate,
            def.decay_rate, def.visible, def.stackable, def.locked]
        );
      }
      summary.trait_definitions = TRAIT_DEFINITIONS.length;

      for (const row of worldState.entityTraits) {
        await client.query(
          `INSERT INTO entity_traits (entity_id, trait_id, current_value, base_value, temporary_modifier, permanent_modifier, experience_modifier, environmental_modifier, relationship_modifier, key_modifier, last_updated_tick)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [row.entity_id, row.trait_id, row.current_value, row.base_value, row.temporary_modifier,
            row.permanent_modifier, row.experience_modifier, row.environmental_modifier,
            row.relationship_modifier, row.key_modifier, row.last_updated_tick]
        );
      }
      summary.entity_traits = worldState.entityTraits.length;

      // ---------------------------------------------------------------
      // Territory and Property come BEFORE the economy and the event
      // log, not after.
      // ---------------------------------------------------------------
      // This block used to sit further down, and the header of this
      // file claimed "Insert order respects every FK in the schema"
      // while it did. It did not: resources.city_id and
      // market_listings.city_id both point at `cities`, and
      // historical_records.where_location_id points at `properties`.
      // Any world with a city that had a resource or a listing in it
      // rolled the whole migration back on a foreign key violation.
      //
      // Nothing caught it because nothing ran the migration. It
      // surfaced the first time a world was round-tripped through a
      // real database (10 Sep 2026). Three of this schema's FK
      // declarations that matter here are `ALTER TABLE ... ADD
      // CONSTRAINT` rather than inline REFERENCES, which is why
      // reading the CREATE TABLE blocks alone does not show it —
      // test/migrate.test.js now reads both forms and holds the
      // ordering.
      for (const c of worldState.cities) {
        await client.query(
          `INSERT INTO cities (id, name, region_id, real_world_geo_ref, population, mayor_npc_id,
                               economy, infrastructure, safety, growth, reemergence_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [c.id, c.name, c.region_id, c.real_world_geo_ref, c.population, c.mayor_npc_id,
            c.economy, c.infrastructure, c.safety, c.growth, c.reemergence_index]
        );
      }
      summary.cities = worldState.cities.length;

      for (const c of worldState.communities) {
        await client.query(
          `INSERT INTO communities (id, city_id, population, tier, housing, crime, safety,
                                    employment, education, culture, reputation, leadership_npc_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [c.id, c.city_id, c.population, c.tier, c.housing, c.crime, c.safety,
            c.employment, c.education, c.culture, c.reputation, c.leadership_npc_id]
        );
      }
      summary.communities = worldState.communities.length;

      for (const b of worldState.territoryBlocks) {
        await client.query(
          `INSERT INTO territory_blocks (id, faction_id, city_id, community_id, status,
                                         contested_since_tick, building_count, crime_rate,
                                         traffic_level, maintenance_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [b.id, b.faction_id, b.city_id, b.community_id, b.status, b.contested_since_tick,
            b.building_count, b.crime_rate, b.traffic_level, b.maintenance_status]
        );
      }
      summary.territory_blocks = worldState.territoryBlocks.length;

      // properties.value is the ASSESSED value and is the only one
      // stored. currentValue() is derived on read and deliberately not
      // inserted anywhere — writing it would be the exact drift
      // standing rule 3 forbids. `community_id`/`city_id` are in-memory
      // placement fields with no schema column (flagged in
      // property.js), so they are not inserted either.
      for (const p of worldState.properties) {
        await client.query(
          // history_ref is left out here and backfilled below. It is
          // the SECOND circular FK in this schema, after
          // entities.family_id: properties.history_ref ->
          // historical_records and historical_records.where_location_id
          // -> properties each need a row in the other to exist first.
          //
          // It happens to be null on every property today
          // (property.js sets it to null and nothing assigns it), so
          // this is ceremony against a value that is currently always
          // absent. It is here anyway, because the alternative is to
          // drop the column from the INSERT on the grounds that it is
          // "always null" — and a column quietly not written is
          // precisely the failure that lost four mission fields for
          // months. The day something sets it, it migrates.
          `INSERT INTO properties (id, land_size, type, value, condition, occupants, floors, units,
                                   age, construction_date, utilities, operating_organization_id,
                                   density_tier, lifecycle_stage)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [p.id, p.land_size, p.type, p.value, p.condition, JSON.stringify(p.occupants), p.floors,
            p.units, p.age, p.construction_date, JSON.stringify(p.utilities),
            p.operating_organization_id, p.density_tier, p.lifecycle_stage]
        );
      }
      summary.properties = worldState.properties.length;

      for (const o of worldState.ownershipRecords) {
        await client.query(
          `INSERT INTO ownership_records (id, entity_id, owner_entity_id, owner_type,
                                          acquired_method, acquired_tick)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [o.id, o.entity_id, o.owner_entity_id, o.owner_type, o.acquired_method, o.acquired_tick]
        );
      }
      summary.ownership_records = worldState.ownershipRecords.length;

      // ---------------------------------------------------------------
      // memories, relationships, entity_knowledge
      // ---------------------------------------------------------------
      for (const m of worldState.memories) {
        await client.query(
          `INSERT INTO memories (id, entity_id, memory_type, category, description, importance, emotion_level, related_entity_ids, tick, expiration, reinforcement_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [m.id, m.entity_id, m.memory_type, m.category, m.description, m.importance, m.emotion_level,
            JSON.stringify(m.related_entity_ids), m.tick, m.expiration, m.reinforcement_count]
        );
      }
      summary.memories = worldState.memories.length;

      for (const r of worldState.relationships) {
        await client.query(
          `INSERT INTO relationships (id, entity_a_id, entity_b_id, relationship_type, trust, respect, fear, love, hatred, influence, debt, communication, alliance, competition, shared_history, conflict, loyalty, interaction_count, relationship_age)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [r.id, r.entity_a_id, r.entity_b_id, r.relationship_type, r.trust, r.respect, r.fear, r.love,
            r.hatred, r.influence, r.debt, r.communication, r.alliance, r.competition, r.shared_history,
            r.conflict, r.loyalty, r.interaction_count, r.relationship_age]
        );
      }
      summary.relationships = worldState.relationships.length;

      for (const k of worldState.entityKnowledge) {
        await client.query(
          `INSERT INTO entity_knowledge (id, entity_id, subject_entity_id, fact_type, fact_content, confidence_level, source_entity_id, spread_rate, distortion_level, acquired_tick)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [k.id, k.entity_id, k.subject_entity_id, k.fact_type, k.fact_content, k.confidence_level,
            k.source_entity_id, k.spread_rate, k.distortion_level, k.acquired_tick]
        );
      }
      summary.entity_knowledge = worldState.entityKnowledge.length;

      // ---------------------------------------------------------------
      // resources, market_listings, individual_finances
      // ---------------------------------------------------------------
      for (const res of worldState.resources) {
        await client.query(
          `INSERT INTO resources (id, city_id, resource_type, quantity, quality, owner_entity_id, supply, demand, production_rate, consumption_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [res.id, res.city_id, res.resource_type, res.quantity, res.quality, res.owner_entity_id,
            res.supply, res.demand, res.production_rate, res.consumption_rate]
        );
      }
      summary.resources = worldState.resources.length;

      for (const listing of worldState.marketListings) {
        await client.query(
          // resource_type was missing here until 10 Sep 2026. It is
          // not decoration: it names the input resource whose scarcity
          // drives this listing's price, via resolveMarketPrice()'s
          // inputScarcity term. economy.js's own comment says a
          // listing with no resource_type "prices exactly as it did
          // before this existed" — so dropping it does not fail, it
          // quietly severs the coupling and the restored market prices
          // as if the resource economy were not there.
          `INSERT INTO market_listings (id, city_id, product_name, resource_type, price, supply, demand, quality, popularity, tick)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [listing.id, listing.city_id, listing.product_name, listing.resource_type ?? null,
            listing.price, listing.supply, listing.demand, listing.quality, listing.popularity,
            listing.tick]
        );
      }
      summary.market_listings = worldState.marketListings.length;

      for (const f of worldState.individualFinances) {
        await client.query(
          `INSERT INTO individual_finances (entity_id, income, savings, debt, assets, tick) VALUES ($1,$2,$3,$4,$5,$6)`,
          [f.entity_id, f.income, f.savings, f.debt, f.assets, f.tick]
        );
      }
      summary.individual_finances = worldState.individualFinances.length;

      // ---------------------------------------------------------------
      // events, historical_records
      // ---------------------------------------------------------------
      for (const e of worldState.events) {
        await client.query(
          `INSERT INTO events (id, type, severity, note, tick, affected_entity_ids, global_effects) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [e.id, e.type, e.severity, e.note, e.tick, JSON.stringify(e.affected_entity_ids), JSON.stringify(e.global_effects)]
        );
      }
      summary.events = worldState.events.length;

      for (const h of worldState.historicalRecords) {
        await client.query(
          `INSERT INTO historical_records (id, who, what, when_tick, where_location_id, why, result, consequences, future_effects, significance)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [h.id, JSON.stringify(h.who), h.what, h.when_tick, h.where_location_id, h.why, h.result,
            h.consequences, h.future_effects, h.significance]
        );
      }
      summary.historical_records = worldState.historicalRecords.length;

      // Second half of the properties.history_ref two-phase insert —
      // see the note on the properties INSERT above. Now that
      // historical_records exist, the FK can be satisfied.
      for (const p of worldState.properties) {
        if (p.history_ref == null) continue;
        await client.query('UPDATE properties SET history_ref = $1 WHERE id = $2',
          [p.history_ref, p.id]);
      }

      // ---------------------------------------------------------------
      // Everything below was NOT carried until 29 Aug 2026.
      // ---------------------------------------------------------------
      // This file was written at step 9, before Territory/Community,
      // Artifact/Mission, Citizen-mode binding, Property and Culture
      // existed. Nothing updated it as each landed, so the migration
      // carried 13 of WorldState's 26 arrays and **succeeded** —
      // reporting a clean run while silently leaving every property,
      // deed, city, ward, artifact, mission and player behind.
      //
      // A migration that loses half the world and exits 0 is worse than
      // one that fails, which is why `test/migrate.test.js` now asserts
      // coverage structurally rather than trusting this comment to be
      // kept up to date.
      //
      // Order below respects the FKs: cities -> communities ->
      // territory_blocks (needs both, plus factions, already inserted
      // above); properties before artifacts (artifacts.location_id ->
      // properties); artifacts before missions.


      for (const a of worldState.artifacts) {
        await client.query(
          `INSERT INTO artifacts (id, name, origin, era, rarity, condition, energy_class, location_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [a.id, a.name, a.origin, a.era, a.rarity, a.condition, a.energy_class, a.location_id]
        );
      }
      summary.artifacts = worldState.artifacts.length;

      for (const m of worldState.missions) {
        await client.query(
          // assigned_entity_id/tick_accepted/tick_resolved/outcome_note
          // were missing here until 10 Sep 2026, and the loss was
          // proven against a live database rather than argued: a
          // mission an NPC accepted and completed migrated with
          // status 'completed' and NULL in all four. The record said
          // the mission was done and nothing said who did it, when, or
          // how it turned out.
          //
          // All four are real state — missions.js#acceptMission sets
          // the first two, #resolveMission the last two — and all four
          // have had columns in the schema the whole time. This was a
          // column-level version of the array-level gap
          // test/migrate.test.js was written for, and it survived
          // because that test only checks that every column named here
          // EXISTS. It never asked the other direction.
          `INSERT INTO missions (id, artifact_id, objective, reward, controlling_faction_id, status,
                                 tick_generated, assigned_entity_id, tick_accepted, tick_resolved, outcome_note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [m.id, m.artifact_id, m.objective, m.reward, m.controlling_faction_id, m.status,
            m.tick_generated, m.assigned_entity_id ?? null, m.tick_accepted ?? null,
            m.tick_resolved ?? null, m.outcome_note ?? null]
        );
      }
      summary.missions = worldState.missions.length;

      for (const p of worldState.players) {
        await client.query(
          `INSERT INTO players (id, mode, linked_entity_id) VALUES ($1,$2,$3)`,
          [p.id, p.mode, p.linked_entity_id]
        );
      }
      summary.players = worldState.players.length;

      // Culture DNA. The sixteen named families are stored the three
      // ways they actually are — eight scored columns, three styles,
      // five JSONB lists — matching server/culture.js. `values` is a
      // reserved word in SQL, so the column is `values_held`.
      for (const c of worldState.cultures) {
        await client.query(
          `INSERT INTO cultures (id, entity_id, name, era, trust_level, tradition, innovation,
                                 competition, cooperation, education, art, religion,
                                 communication_style, leadership_style, conflict_resolution,
                                 values_held, customs, language, cuisine, fashion)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [c.id, c.entity_id, c.name, c.era, c.traits.trustLevel, c.traits.tradition,
            c.traits.innovation, c.traits.competition, c.traits.cooperation, c.traits.education,
            c.traits.art, c.traits.religion, c.communicationStyle, c.leadershipStyle,
            c.conflictResolution, JSON.stringify(c.values), JSON.stringify(c.customs),
            JSON.stringify(c.language), JSON.stringify(c.cuisine), JSON.stringify(c.fashion)]
        );
      }
      summary.cultures = worldState.cultures.length;

      for (const m of worldState.cultureMemberships) {
        await client.query(
          `INSERT INTO culture_memberships (culture_id, tier, entity_id) VALUES ($1,$2,$3)`,
          [m.culture_id, m.tier, m.entity_id]
        );
      }
      summary.culture_memberships = worldState.cultureMemberships.length;

      // Only a world's OWN templates. The engine's built-in ten are
      // code, not data, and inserting them would turn a default world
      // into ten rows that then look like deliberate overrides.
      for (const f of worldState.flowTemplates) {
        await client.query(
          `INSERT INTO flow_templates (id, name, signal, comparator, threshold, severity, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [f.id, f.name, f.signal, f.comparator, f.threshold, f.severity ?? 'low', f.note ?? null]
        );
      }
      summary.flow_templates = worldState.flowTemplates.length;

      // The Behavior Engine's three tables. entity_state is the one
      // table here whose PK is the entity itself -- one row per person,
      // mutated in place -- so there is no id column to carry.
      //
      // `current_mood` is deliberately NOT written. It is derived from
      // stress_level and Optimism on every read (behavior.js#moodFor),
      // and writing it here would be exactly the stored-rollup drift
      // standing rule 3 forbids -- the same call already made for
      // properties.currentValue. test/migrate.test.js asserts it.
      for (const s of worldState.entityState) {
        await client.query(
          `INSERT INTO entity_state (entity_id, stress_level, tick) VALUES ($1,$2,$3)`,
          [s.entity_id, s.stress_level, s.tick]
        );
      }
      summary.entity_state = worldState.entityState.length;

      for (const h of worldState.habits) {
        await client.query(
          `INSERT INTO habits (id, entity_id, habit_name, strength, harmful,
                               first_observed_tick, last_reinforced_tick)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [h.id, h.entity_id, h.habit_name, h.strength, h.harmful,
           h.first_observed_tick, h.last_reinforced_tick]
        );
      }
      summary.habits = worldState.habits.length;

      for (const e of worldState.scheduleEvents) {
        await client.query(
          `INSERT INTO schedule_events (id, entity_id, event_type, frequency, time_slot,
                                        location_property_id, tick_last_occurred)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [e.id, e.entity_id, e.event_type, e.frequency, e.time_slot,
           e.location_property_id, e.tick_last_occurred]
        );
      }
      summary.schedule_events = worldState.scheduleEvents.length;

      // NOT carried, and neither is an oversight:
      //   activeConditions — a minimal in-memory mechanism with no
      //     schema table of its own (tick.js's header explains why:
      //     environment_state is city-scoped and this is not).
      //   migrationRisk    — an explicitly flagged stand-in, overwritten
      //     every tick rather than accumulated as history.
      //   pendingObservations — in flight for at most one tick before
      //     the Event phase turns them into real `events` rows, which
      //     ARE carried. Migrating both would double-count every one.
      // Both are named in test/migrate.test.js so that "not carried"
      // stays a decision rather than becoming a gap again.

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });

  return summary;
}

module.exports = {
  migrateWorldStateToPostgres,
};
