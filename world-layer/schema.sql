-- ============================================================
-- World Layer — world_locations
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md.
-- One row per real-world location. Follows the same conventions as
-- VACANCY_POSTGRESQL_SCHEMA.sql: BIGSERIAL primary keys, BIGINT tick
-- columns, JSONB only for the fields the architecture doc itself
-- described as variable-shape (the nine data slices — no external
-- import has defined a fixed shape for any of them yet).
-- ============================================================

CREATE TABLE world_locations (
    id                      BIGSERIAL PRIMARY KEY,
    name                    TEXT NOT NULL,
    lat                     DOUBLE PRECISION NOT NULL,
    lng                     DOUBLE PRECISION NOT NULL,
    tier                    TEXT NOT NULL DEFAULT 'filler', -- hero|regional|filler
    terrain_type            TEXT,
    geography_data          JSONB,
    building_data           JSONB,
    business_data           JSONB,
    landmark_data           JSONB,
    population_data         JSONB,
    transportation_data     JSONB,
    economic_data           JSONB,
    ownership_data          JSONB,
    created_tick            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT world_locations_tier_check
        CHECK (tier IN ('hero', 'regional', 'filler'))
);

CREATE TABLE world_location_events (
    id                      BIGSERIAL PRIMARY KEY,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id) ON DELETE CASCADE,
    event_data              JSONB NOT NULL,
    tick                    BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- World Layer — world_npcs (NPC Genesis Engine)
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 1.
-- One shared NPC creation system. `roles` is a text array rather than
-- a fixed set of boolean columns because a single NPC can hold
-- multiple roles simultaneously and the doc's own point is that role
-- is an assignment on top of a person, not a separate entity type.
--
-- Reconciliation with VACON-C's own entities/npcs tables: linked, not
-- replaced. This table stays a separate shared layer; VACON-C's own
-- tables remain authoritative for VACON-C. See
-- dev-docs/phase-8-vacon-c-reconciliation/plan.md.

CREATE TABLE world_npcs (
    id                      BIGSERIAL PRIMARY KEY,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id),
    demographics            JSONB NOT NULL,
    occupation              TEXT,
    skills                  JSONB NOT NULL DEFAULT '[]',
    language                TEXT NOT NULL DEFAULT 'en',
    personality             JSONB NOT NULL DEFAULT '{}',
    relationships           JSONB NOT NULL DEFAULT '[]',
    goals                   JSONB NOT NULL DEFAULT '[]',
    migration_status        TEXT NOT NULL DEFAULT 'resident',
    economic_role           TEXT,
    roles                   TEXT[] NOT NULL DEFAULT '{}',
    created_tick            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT world_npcs_migration_status_check
        CHECK (migration_status IN ('resident', 'migrating', 'displaced', 'arrived'))
);

-- ============================================================
-- World Layer — world_businesses (Real World Commerce Layer)
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 3.
-- `world_business_employees` is a real join table, not an array
-- column on either side — same cardinality fix VACON-C's own
-- entity_organization_memberships table already made (a business has
-- many employees, an NPC can work more than one job).

CREATE TABLE world_businesses (
    id                      BIGSERIAL PRIMARY KEY,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id),
    owner_id                BIGINT REFERENCES world_npcs(id),
    building                TEXT,
    industry                TEXT NOT NULL,
    economic_value          NUMERIC NOT NULL DEFAULT 0,
    supply_needs            JSONB NOT NULL DEFAULT '[]',
    security_requirement    TEXT NOT NULL DEFAULT 'none',
    created_tick            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT world_businesses_security_check
        CHECK (security_requirement IN ('none', 'low', 'medium', 'high')),
    CONSTRAINT world_businesses_economic_value_check
        CHECK (economic_value >= 0)
);

CREATE TABLE world_business_employees (
    business_id             BIGINT NOT NULL REFERENCES world_businesses(id) ON DELETE CASCADE,
    npc_id                  BIGINT NOT NULL REFERENCES world_npcs(id) ON DELETE CASCADE,
    PRIMARY KEY (business_id, npc_id)
);

-- ============================================================
-- World Layer — world_transport_nodes (Transportation Network)
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 4.
-- vehicle_types is JSONB (variable-shape list), not a join table —
-- unlike employees, there's no second entity on the other side of
-- this relationship to join against, just a list of type strings.

CREATE TABLE world_transport_nodes (
    id                      BIGSERIAL PRIMARY KEY,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id),
    owner_id                BIGINT REFERENCES world_npcs(id),
    vehicle_types           JSONB NOT NULL DEFAULT '[]',
    fuel_availability       NUMERIC NOT NULL DEFAULT 0,
    repair_difficulty       TEXT NOT NULL DEFAULT 'moderate',
    control_status          TEXT NOT NULL DEFAULT 'uncontrolled',
    operational_status      TEXT NOT NULL DEFAULT 'operational',
    created_tick            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT world_transport_nodes_fuel_check
        CHECK (fuel_availability >= 0 AND fuel_availability <= 100),
    CONSTRAINT world_transport_nodes_repair_check
        CHECK (repair_difficulty IN ('easy', 'moderate', 'hard', 'extreme')),
    CONSTRAINT world_transport_nodes_control_check
        CHECK (control_status IN ('uncontrolled', 'contested', 'controlled')),
    CONSTRAINT world_transport_nodes_operational_check
        CHECK (operational_status IN ('operational', 'damaged', 'destroyed'))
);

-- ============================================================
-- World Layer — world_information_events / _propagations
-- (Information Propagation Engine)
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 5.
-- Propagations are a real log table (one row per event x target
-- location), not a JSONB array on the event — same reasoning as
-- world_location_events: an append-only per-target log, not a
-- variable-shape blob.

CREATE TABLE world_information_events (
    id                      BIGSERIAL PRIMARY KEY,
    event_type              TEXT NOT NULL,
    origin_location_id      BIGINT NOT NULL REFERENCES world_locations(id),
    description             TEXT,
    created_tick            BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE world_information_propagations (
    id                      BIGSERIAL PRIMARY KEY,
    event_id                BIGINT NOT NULL REFERENCES world_information_events(id) ON DELETE CASCADE,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id),
    spread_probability      NUMERIC NOT NULL,
    time_delay              BIGINT NOT NULL,
    arrives_tick            BIGINT NOT NULL,
    CONSTRAINT world_information_propagations_probability_check
        CHECK (spread_probability >= 0 AND spread_probability <= 100)
);

-- ============================================================
-- World Layer — world_assets / world_asset_usages
-- (Persistent Asset Library)
-- ============================================================
-- Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 6.
-- quality_level reuses the same hero/regional/filler vocabulary as
-- world_locations.tier (see propagation.js's sibling comment in
-- assetLibrary.js) rather than a separate scale.

CREATE TABLE world_assets (
    id                      BIGSERIAL PRIMARY KEY,
    asset_type              TEXT NOT NULL,
    generated_model         TEXT NOT NULL,
    variants                JSONB NOT NULL DEFAULT '[]',
    quality_level           TEXT NOT NULL DEFAULT 'filler',
    usage_count             BIGINT NOT NULL DEFAULT 0,
    created_tick            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT world_assets_quality_level_check
        CHECK (quality_level IN ('hero', 'regional', 'filler'))
);

CREATE TABLE world_asset_usages (
    id                      BIGSERIAL PRIMARY KEY,
    asset_id                BIGINT NOT NULL REFERENCES world_assets(id) ON DELETE CASCADE,
    location_id             BIGINT NOT NULL REFERENCES world_locations(id),
    tick                    BIGINT NOT NULL DEFAULT 0
);
