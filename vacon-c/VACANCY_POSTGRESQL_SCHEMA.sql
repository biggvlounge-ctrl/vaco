-- ============================================================
-- VACANCY — Complete PostgreSQL Schema
-- Document 2 of 7 — Final Handoff Package
-- ============================================================
-- Source of truth: VACANCY-MASTER-ARCHITECTURE.md, Section 5.
-- This file is the literal, runnable version of that section.
-- Where comments reference "Part 15X" they trace back to the
-- architecture document's reconciliation notes — read there for
-- the reasoning behind a given design choice.
--
-- Conventions:
--   - All primary keys are BIGSERIAL unless the table is a pure
--     join/log table, in which case a composite key is used.
--   - All "tick" columns are BIGINT (simulation time, not wall-clock).
--   - entity_id columns reference entities.id everywhere an entity
--     can be any type (npc, family, organization, city, etc.).
--   - JSONB is used only where the architecture doc explicitly
--     described a flexible/variable-shape field (context_json,
--     requirements, inputs/outputs on key_definitions).
-- ============================================================

-- ============================================================
-- LAYER 1-2: CORE ENTITY + TRAIT (definition/instance split, 5.1)
-- ============================================================

CREATE TABLE entities (
    id                  BIGSERIAL PRIMARY KEY,
    type                TEXT NOT NULL, -- npc|family|organization|city|region|civilization|vehicle|building|land|artifact|resource|player|ai|world_object
    status              TEXT NOT NULL DEFAULT 'active', -- active|inactive|destroyed|archived|hidden
    owner_id            BIGINT REFERENCES entities(id),
    parent_entity_id    BIGINT REFERENCES entities(id),
    location_id         BIGINT, -- FK added after properties table exists
    region_id           BIGINT, -- FK added after regions table exists
    community_id        BIGINT, -- FK added after communities table exists
    family_id           BIGINT, -- FK added after families table exists
    civilization_id     BIGINT, -- FK added after civilizations table exists
    created_tick        BIGINT NOT NULL DEFAULT 0,
    updated_tick         BIGINT NOT NULL DEFAULT 0
);

-- Individual specialization (5.5) — role/education/religion don't belong
-- on the generic entities table since Vehicles/Buildings have neither.
CREATE TABLE npcs (
    entity_id           BIGINT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
    role                TEXT,
    education           TEXT,
    religion            TEXT,
    generation          INTEGER DEFAULT 1,
    home_property_id    BIGINT -- FK added after properties table exists
);

-- Many-to-many org membership (5.6) — fixes the wrong-cardinality bug
-- where entities.organization_id only allowed one org per entity.
CREATE TABLE entity_organization_memberships (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    organization_id     BIGINT NOT NULL, -- FK added after organizations table exists
    role_in_org         TEXT,
    joined_tick         BIGINT NOT NULL,
    PRIMARY KEY (entity_id, organization_id)
);

-- Trait definition/instance split (5.1) — definitions are the trait
-- "type" (Leadership, Strength, etc.); entity_traits is the per-entity value.
CREATE TABLE trait_definitions (
    trait_id            BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    family              TEXT NOT NULL, -- physical|mental|emotional|psychological|behavioral|social|economic|educational|criminal|combat|sports|health|technology|environmental|leadership|reputation|faction|special|skills
    description         TEXT,
    min_value           NUMERIC NOT NULL DEFAULT 0,
    max_value           NUMERIC NOT NULL DEFAULT 100,
    default_value       NUMERIC NOT NULL DEFAULT 50,
    mutation_chance     NUMERIC NOT NULL DEFAULT 0.05,
    inheritance_chance  NUMERIC NOT NULL DEFAULT 0.5,
    growth_rate         NUMERIC NOT NULL DEFAULT 0.01,
    decay_rate          NUMERIC NOT NULL DEFAULT 0.005,
    visible             BOOLEAN NOT NULL DEFAULT true,
    stackable           BOOLEAN NOT NULL DEFAULT false,
    locked              BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE entity_traits (
    entity_id               BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    trait_id                BIGINT NOT NULL REFERENCES trait_definitions(trait_id),
    current_value           NUMERIC NOT NULL,
    base_value              NUMERIC NOT NULL,
    temporary_modifier      NUMERIC NOT NULL DEFAULT 0,
    permanent_modifier      NUMERIC NOT NULL DEFAULT 0,
    experience_modifier     NUMERIC NOT NULL DEFAULT 0,
    environmental_modifier  NUMERIC NOT NULL DEFAULT 0,
    relationship_modifier   NUMERIC NOT NULL DEFAULT 0,
    key_modifier            NUMERIC NOT NULL DEFAULT 0, -- Keys write here, never to base_value directly (Section 4.3)
    last_updated_tick       BIGINT NOT NULL,
    PRIMARY KEY (entity_id, trait_id)
);

-- ============================================================
-- LAYER 3: KEY RESOLVER (definition/instance split, 5.1)
-- ============================================================

CREATE TABLE key_definitions (
    key_id              BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL, -- human|social|economic|power|world
    inputs              JSONB, -- list of trait/relationship/knowledge fields this Key reads
    outputs             JSONB, -- list of fields this Key writes back to (memory/relationship/world, per 4.3)
    probability_curve   TEXT,
    priority            INTEGER DEFAULT 0,
    dependencies        JSONB -- other key_ids this one depends on
);

CREATE TABLE keys_log (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    key_id              BIGINT NOT NULL REFERENCES key_definitions(key_id),
    resolved_value      NUMERIC,
    context_json        JSONB, -- snapshot of entity_knowledge/relationships read at resolution time
    tick                BIGINT NOT NULL
);

-- ============================================================
-- VALUES, PREFERENCES, BELIEFS, LANGUAGE (Sections 3.5, 3.9a, 3.9b, 3.9c)
-- ============================================================

CREATE TABLE values_db (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    value_name          TEXT NOT NULL, -- family_first|freedom|power|wealth|knowledge|security|community|religion|adventure|fame|innovation|tradition|justice|competition|peace
    priority            INTEGER,
    current_strength    NUMERIC,
    change_rate         NUMERIC,
    influence_weight    NUMERIC,
    PRIMARY KEY (entity_id, value_name)
);

-- Personal taste, distinct from Values (weights decisions) and Culture DNA (tier-level)
CREATE TABLE preferences (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    category            TEXT NOT NULL, -- music|food|fashion|hobby|entertainment|learning_style
    value               TEXT,
    tick                BIGINT NOT NULL,
    PRIMARY KEY (entity_id, category)
);

-- Upgrades npcs.religion from a flat string to a real typed system
CREATE TABLE beliefs (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    belief_type         TEXT NOT NULL, -- religious|philosophical|political|scientific|cultural|personal
    belief_name         TEXT NOT NULL,
    strength            NUMERIC,
    tick                BIGINT NOT NULL
);

CREATE TABLE languages (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    parent_language_id  BIGINT REFERENCES languages(id),
    region_id           BIGINT -- FK added after regions table exists
);

CREATE TABLE entity_languages (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    language_id         BIGINT NOT NULL REFERENCES languages(id),
    proficiency         NUMERIC,
    is_primary          BOOLEAN DEFAULT false,
    PRIMARY KEY (entity_id, language_id)
);

-- ============================================================
-- BEHAVIOR ENGINE: Archetypes, Needs, Goals, Mood/Stress, Habits, Schedule
-- (Sections 3.7, 4.4, 4.5)
-- ============================================================

-- Derived tags from trait thresholds — NOT raw data, computed from entity_traits.
-- e.g. leadership.commandPresence > 75 -> "Natural Leader"
CREATE TABLE archetypes (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    archetype_name      TEXT NOT NULL,
    derived_from_traits JSONB,
    tick                BIGINT NOT NULL
);

CREATE TABLE needs (
    entity_id            BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    need_type            TEXT NOT NULL, -- food|water|sleep|safety|income|housing|healthcare|education|love|friendship|respect|status|purpose|freedom|legacy
    current_level        NUMERIC,
    priority             INTEGER,
    last_satisfied_tick  BIGINT,
    PRIMARY KEY (entity_id, need_type)
);

CREATE TABLE goals (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    goal_description    TEXT NOT NULL,
    timeframe           TEXT NOT NULL, -- immediate|daily|weekly|monthly|lifetime|legacy|generational
    status              TEXT NOT NULL DEFAULT 'active',
    created_tick        BIGINT NOT NULL
);

-- Subjective knowledge — Keys read THIS, never raw world state (Section 4.4)
CREATE TABLE entity_knowledge (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    subject_entity_id   BIGINT REFERENCES entities(id),
    fact_type           TEXT NOT NULL, -- known|unknown|rumor|false|assumption|prediction|verified
    fact_content        TEXT,
    confidence_level    NUMERIC,
    source_entity_id    BIGINT REFERENCES entities(id),
    spread_rate         NUMERIC,
    distortion_level    NUMERIC,
    acquired_tick       BIGINT NOT NULL
);

-- Mood/Stress: volatile per-tick state, distinct from stable entity_traits
CREATE TABLE entity_state (
    entity_id           BIGINT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
    current_mood        TEXT,
    stress_level         NUMERIC,
    tick                BIGINT NOT NULL
);

CREATE TABLE habits (
    id                    BIGSERIAL PRIMARY KEY,
    entity_id             BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    habit_name            TEXT NOT NULL,
    strength              NUMERIC,
    harmful               BOOLEAN DEFAULT false, -- addiction = harmful habit, not a separate table
    first_observed_tick   BIGINT,
    last_reinforced_tick  BIGINT
);

CREATE TABLE schedule_events (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    event_type              TEXT NOT NULL,
    frequency               TEXT NOT NULL, -- daily|weekly|monthly|yearly
    time_slot               TEXT,
    location_property_id    BIGINT, -- FK added after properties table exists
    tick_last_occurred      BIGINT
);

-- ============================================================
-- MEMORY & HISTORY (Sections 3.3, 5.6, 5.7)
-- ============================================================

CREATE TABLE memories (
    id                   BIGSERIAL PRIMARY KEY,
    entity_id            BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    memory_type          TEXT NOT NULL, -- positive|negative|neutral
    category             TEXT, -- relationship|achievement|failure|trauma|discovery|conflict|business|family
    description          TEXT,
    importance           NUMERIC,
    emotion_level        NUMERIC,
    related_entity_ids   JSONB,
    tick                 BIGINT NOT NULL,
    expiration           TEXT DEFAULT 'temporary', -- never|temporary|permanent
    reinforcement_count  INTEGER DEFAULT 0
);

-- Richer relationship weight (5.7) — Love/Hatred/Debt/Communication/Alliance/
-- Competition added to the original Trust/Respect/Fear/Influence list.
CREATE TABLE relationships (
    id                  BIGSERIAL PRIMARY KEY,
    entity_a_id         BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_b_id         BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type   TEXT NOT NULL, -- family|friend|enemy|business|political|romantic|educational|military|neighbor|mentor|student
    trust               NUMERIC DEFAULT 50,
    respect             NUMERIC DEFAULT 50,
    fear                NUMERIC DEFAULT 0,
    love                NUMERIC DEFAULT 0,
    hatred              NUMERIC DEFAULT 0,
    influence           NUMERIC DEFAULT 0,
    debt                NUMERIC DEFAULT 0,
    communication       NUMERIC DEFAULT 50,
    alliance            NUMERIC DEFAULT 0,
    competition         NUMERIC DEFAULT 0,
    shared_history      NUMERIC DEFAULT 0,
    conflict            NUMERIC DEFAULT 0,
    loyalty             NUMERIC DEFAULT 50,
    interaction_count   INTEGER DEFAULT 0,
    relationship_age    BIGINT DEFAULT 0
);

CREATE TABLE historical_records (
    id                  BIGSERIAL PRIMARY KEY,
    who                 JSONB, -- participant entity_ids
    what                TEXT NOT NULL,
    when_tick           BIGINT NOT NULL,
    where_location_id   BIGINT, -- FK added after properties table exists
    why                 TEXT,
    result              TEXT,
    consequences        TEXT,
    future_effects      TEXT,
    significance        NUMERIC
);

CREATE TABLE decision_log (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    situation           TEXT,
    available_options   JSONB,
    selected_option      TEXT,
    expected_result      TEXT,
    confidence           NUMERIC,
    traits_used          JSONB,
    keys_used            JSONB,
    memory_used          JSONB,
    outcome              TEXT,
    tick                 BIGINT NOT NULL
);

-- ============================================================
-- FAMILY & HOUSEHOLD (Sections 3.10, 3.11)
-- ============================================================

CREATE TABLE families (
    id                    BIGSERIAL PRIMARY KEY,
    surname               TEXT NOT NULL,
    founder_id            BIGINT REFERENCES entities(id),
    generation             INTEGER DEFAULT 1,
    head_npc_id            BIGINT REFERENCES entities(id),
    total_members          INTEGER DEFAULT 0,
    wealth                 NUMERIC DEFAULT 0, -- computed rollup from individual_finances of members, not independently tracked
    reputation             NUMERIC DEFAULT 50,
    unity                  NUMERIC DEFAULT 50,
    conflict               NUMERIC DEFAULT 0,
    traditions             JSONB,
    religion               TEXT,
    political_influence    NUMERIC DEFAULT 0
);

-- Household ≠ Family — a household is a physical living unit, can span
-- multiple families or unrelated people (Part 15J).
CREATE TABLE households (
    id                  BIGSERIAL PRIMARY KEY,
    property_id         BIGINT, -- FK added after properties table exists
    member_entity_ids   JSONB
);

-- families.head_npc_id only captures ONE role; this captures every member's role
CREATE TABLE family_memberships (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    family_id           BIGINT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    role                TEXT, -- parent|child|grandparent|sibling|partner|guardian|mentor|founder|heir|black_sheep|leader|protector|caregiver
    generation_number   INTEGER,
    PRIMARY KEY (entity_id, family_id)
);

-- ============================================================
-- ORGANIZATION / FACTION / BUSINESS / GOVERNMENT
-- (Section 5.2 — parent/subtype pattern, not separate root entities)
-- ============================================================

CREATE TABLE organizations (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL, -- business|government|club|religion|gang|corporation|military|school|hospital|research|media|sports|library|museum
    founder_id          BIGINT REFERENCES entities(id),
    leader_id           BIGINT REFERENCES entities(id),
    members             INTEGER DEFAULT 0,
    assets              NUMERIC DEFAULT 0,
    income              NUMERIC DEFAULT 0,
    expenses            NUMERIC DEFAULT 0,
    influence           NUMERIC DEFAULT 0,
    security            NUMERIC DEFAULT 0,
    innovation          NUMERIC DEFAULT 0,
    reputation          NUMERIC DEFAULT 50
);

ALTER TABLE entity_organization_memberships
    ADD CONSTRAINT fk_eom_org FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Faction = territorial-conflict subtype of Organization, not a synonym for it
CREATE TABLE factions (
    organization_id     BIGINT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    color               TEXT,
    morale              NUMERIC DEFAULT 50,
    status              TEXT DEFAULT 'controlled' -- contested|controlled|fortified
);

-- Business = another Organization subtype, same pattern
CREATE TABLE businesses (
    organization_id     BIGINT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    industry            TEXT,
    revenue             NUMERIC DEFAULT 0,
    profit              NUMERIC DEFAULT 0,
    market_share        NUMERIC DEFAULT 0,
    brand_value         NUMERIC DEFAULT 0,
    lifecycle_stage     TEXT DEFAULT 'idea' -- idea|startup|growth|expansion|maturity|decline|transformation|legacy
);

-- Government = another Organization subtype
CREATE TABLE governments (
    organization_id     BIGINT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    system_type         TEXT -- democracy|monarchy|council|corporate|tribal|technocracy|military|religious|hybrid
);

CREATE TABLE elections (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL REFERENCES organizations(id),
    election_type       TEXT,
    start_tick          BIGINT,
    end_tick            BIGINT,
    status              TEXT DEFAULT 'scheduled'
);

CREATE TABLE votes (
    election_id         BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    voter_entity_id     BIGINT NOT NULL REFERENCES entities(id),
    candidate_entity_id BIGINT NOT NULL REFERENCES entities(id),
    tick                BIGINT NOT NULL,
    PRIMARY KEY (election_id, voter_entity_id)
);

CREATE TABLE laws (
    id                  BIGSERIAL PRIMARY KEY,
    jurisdiction_city_id BIGINT, -- FK added after cities table exists
    category            TEXT, -- criminal|business|property|environmental|technology|family|financial|trade|international
    description         TEXT,
    enacted_tick        BIGINT,
    status              TEXT DEFAULT 'active'
);

-- Rollup from beliefs/entity_knowledge on a topic, not new source data
CREATE TABLE public_opinion (
    city_id             BIGINT, -- FK added after cities table exists
    topic               TEXT NOT NULL,
    approval_score      NUMERIC,
    tick                BIGINT NOT NULL,
    PRIMARY KEY (city_id, topic, tick)
);

-- Ties Public Opinion + Information Spread + Government into a real
-- regime-change mechanic, not just a lower stability number.
CREATE TABLE revolutions (
    id                              BIGSERIAL PRIMARY KEY,
    target_government_organization_id BIGINT NOT NULL REFERENCES organizations(id),
    trigger_tick                    BIGINT NOT NULL,
    outcome                         TEXT,
    new_government_organization_id  BIGINT REFERENCES organizations(id)
);

-- ============================================================
-- ECONOMY (Section 13.5, tier-scoped per Section 6.1's Reemergence pattern)
-- ============================================================

CREATE TABLE individual_finances (
    entity_id           BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    income              NUMERIC DEFAULT 0,
    savings             NUMERIC DEFAULT 0,
    debt                NUMERIC DEFAULT 0,
    assets              NUMERIC DEFAULT 0,
    tick                BIGINT NOT NULL,
    PRIMARY KEY (entity_id, tick)
);

CREATE TABLE employment_records (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    employer_organization_id BIGINT NOT NULL REFERENCES organizations(id),
    wage                    NUMERIC,
    position                TEXT, -- structured wage relationship, distinct from npcs.role (narrative descriptor)
    start_tick              BIGINT NOT NULL,
    status                  TEXT DEFAULT 'active'
);

-- Distinct from ownership_records — a capital stake, not necessarily full ownership
CREATE TABLE investments (
    id                  BIGSERIAL PRIMARY KEY,
    investor_entity_id  BIGINT NOT NULL REFERENCES entities(id),
    target_entity_id    BIGINT NOT NULL REFERENCES entities(id),
    category            TEXT, -- businesses|property|resources|infrastructure|technology|education|transportation|energy|healthcare
    amount               NUMERIC,
    tick                 BIGINT NOT NULL
);

-- Distinct from resources (raw inputs) — finished goods actually bought/sold
CREATE TABLE market_listings (
    id                  BIGSERIAL PRIMARY KEY,
    city_id             BIGINT, -- FK added after cities table exists
    product_name        TEXT NOT NULL,
    -- The raw input this finished good is made from, nullable for goods
    -- with no single input. Added after the Definition-of-Done cascade
    -- test proved a drought in the water RESOURCE could not reach the
    -- price of a water ration LISTING: the two tables had no join to
    -- traverse. Same column and type as trade_routes.resource_type,
    -- deliberately -- resource_type is how this schema already refers
    -- to a resource by kind rather than by row.
    resource_type       TEXT,
    price               NUMERIC,
    supply              NUMERIC,
    demand              NUMERIC,
    quality             NUMERIC,
    popularity          NUMERIC,
    tick                BIGINT NOT NULL
);

CREATE TABLE trade_routes (
    id                      BIGSERIAL PRIMARY KEY,
    origin_city_id          BIGINT, -- FK added after cities table exists
    destination_city_id     BIGINT, -- FK added after cities table exists
    resource_type           TEXT,
    volume                  NUMERIC,
    safety_score            NUMERIC,
    tick                     BIGINT NOT NULL
);

CREATE TABLE migration_events (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id),
    from_location_id    BIGINT,
    to_location_id      BIGINT,
    migration_type       TEXT, -- daily|temporary|seasonal|permanent|forced|economic|exploration
    reason               TEXT,
    tick                 BIGINT NOT NULL
);

CREATE TABLE economy_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT REFERENCES entities(id), -- tier-scoped: individual/family/business/community/city/region/civ
    tick                BIGINT NOT NULL,
    vcoin               NUMERIC,
    resource_type       TEXT,
    supply              NUMERIC,
    demand              NUMERIC,
    price               NUMERIC
);

-- ============================================================
-- GEOGRAPHY: Community, City, Region, Civilization
-- (Section 5.6 fixes the missing Region tier; 5.8 clarifies two
-- distinct hierarchies — social vs. physical/spatial)
-- ============================================================

CREATE TABLE communities (
    id                  BIGSERIAL PRIMARY KEY,
    city_id             BIGINT, -- FK added after cities table exists
    population          INTEGER DEFAULT 0,
    tier                TEXT, -- apartment|neighborhood|town|district|block (extend enum, don't add new tables)
    housing             NUMERIC,
    crime               NUMERIC DEFAULT 0,
    safety              NUMERIC DEFAULT 50,
    employment          NUMERIC,
    education           NUMERIC,
    culture             TEXT,
    reputation          NUMERIC DEFAULT 50,
    leadership_npc_id   BIGINT REFERENCES entities(id)
);

CREATE TABLE regions (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    civilization_id     BIGINT, -- FK added after civilizations table exists
    geography_key       TEXT,
    climate_key         TEXT
);

CREATE TABLE civilizations (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    era                 TEXT,
    stability_index     NUMERIC DEFAULT 50
);

ALTER TABLE regions ADD CONSTRAINT fk_regions_civ FOREIGN KEY (civilization_id) REFERENCES civilizations(id);

CREATE TABLE cities (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    region_id           BIGINT REFERENCES regions(id), -- was a plain string, now a real FK (5.6 fix)
    real_world_geo_ref  TEXT,
    population          INTEGER DEFAULT 0,
    mayor_npc_id        BIGINT REFERENCES entities(id),
    economy             NUMERIC,
    infrastructure      NUMERIC, -- computed rollup from the infrastructure table below
    safety              NUMERIC,
    growth              NUMERIC,
    reemergence_index   NUMERIC DEFAULT 34 -- the founding mechanic since Volume 1
);

ALTER TABLE communities ADD CONSTRAINT fk_communities_city FOREIGN KEY (city_id) REFERENCES cities(id);
ALTER TABLE laws ADD CONSTRAINT fk_laws_city FOREIGN KEY (jurisdiction_city_id) REFERENCES cities(id);
ALTER TABLE public_opinion ADD CONSTRAINT fk_public_opinion_city FOREIGN KEY (city_id) REFERENCES cities(id);
ALTER TABLE market_listings ADD CONSTRAINT fk_market_city FOREIGN KEY (city_id) REFERENCES cities(id);
ALTER TABLE trade_routes ADD CONSTRAINT fk_trade_origin FOREIGN KEY (origin_city_id) REFERENCES cities(id);
ALTER TABLE trade_routes ADD CONSTRAINT fk_trade_dest FOREIGN KEY (destination_city_id) REFERENCES cities(id);
-- territory_blocks is created further below, after factions/communities exist as FK targets

-- Discrete tech eras (Part 15N) — ties to Reemergence: a collapsed
-- civilization can regress an era and re-climb it during reemergence.
CREATE TABLE technology_eras (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL, -- stone_tools|agriculture|metalworking|writing|engineering|industrialization|electricity|computing|ai|advanced_robotics
    era_order           INTEGER NOT NULL,
    requirements        JSONB
);

CREATE TABLE civilization_technology_progress (
    civilization_id     BIGINT NOT NULL REFERENCES civilizations(id),
    era_id              BIGINT NOT NULL REFERENCES technology_eras(id),
    unlocked_tick        BIGINT NOT NULL,
    PRIMARY KEY (civilization_id, era_id)
);

-- Same spatial unit as Part 15K's "Block Engine" — do not build a
-- separate blocks table, this one has tracked faction control since
-- Volume 1 and was already accidentally flattened into a column once.
CREATE TABLE territory_blocks (
    id                      BIGSERIAL PRIMARY KEY,
    faction_id              BIGINT NOT NULL REFERENCES factions(organization_id),
    city_id                 BIGINT REFERENCES cities(id),
    community_id            BIGINT REFERENCES communities(id),
    status                  TEXT DEFAULT 'controlled', -- contested|controlled|fortified
    contested_since_tick    BIGINT,
    building_count           INTEGER DEFAULT 0,
    crime_rate               NUMERIC DEFAULT 0,
    traffic_level            NUMERIC,
    maintenance_status       TEXT
);

-- ============================================================
-- PROPERTY, OWNERSHIP, RESOURCES, ENVIRONMENT, INFRASTRUCTURE
-- (Sections 5.3, 5.7, 5.8 — Property was never one of the original
-- 20 layers despite being specified in full; flagged, then built)
-- ============================================================

CREATE TABLE properties (
    id                          BIGSERIAL PRIMARY KEY,
    land_size                   NUMERIC,
    type                        TEXT, -- residential|commercial|industrial|government|agricultural|mixed|farm|historical_site|digital_property|virtual_location
    value                       NUMERIC,
    condition                   NUMERIC DEFAULT 100,
    occupants                   JSONB,
    floors                      INTEGER,
    units                       INTEGER,
    age                         INTEGER,
    construction_date           BIGINT,
    utilities                   JSONB,
    operating_organization_id   BIGINT REFERENCES organizations(id), -- building != the org operating in it
    density_tier                TEXT,
    lifecycle_stage             TEXT DEFAULT 'planning', -- planning|construction|operation|maintenance|renovation|expansion|historical_legacy
    history_ref                 BIGINT REFERENCES historical_records(id)
);

-- Now that properties exists, wire up the deferred FKs
ALTER TABLE entities ADD CONSTRAINT fk_entities_location FOREIGN KEY (location_id) REFERENCES properties(id);
ALTER TABLE entities ADD CONSTRAINT fk_entities_region FOREIGN KEY (region_id) REFERENCES regions(id);
ALTER TABLE entities ADD CONSTRAINT fk_entities_community FOREIGN KEY (community_id) REFERENCES communities(id);
ALTER TABLE entities ADD CONSTRAINT fk_entities_family FOREIGN KEY (family_id) REFERENCES families(id);
ALTER TABLE entities ADD CONSTRAINT fk_entities_civ FOREIGN KEY (civilization_id) REFERENCES civilizations(id);
ALTER TABLE npcs ADD CONSTRAINT fk_npcs_home FOREIGN KEY (home_property_id) REFERENCES properties(id);
ALTER TABLE schedule_events ADD CONSTRAINT fk_schedule_location FOREIGN KEY (location_property_id) REFERENCES properties(id);
ALTER TABLE historical_records ADD CONSTRAINT fk_history_location FOREIGN KEY (where_location_id) REFERENCES properties(id);
ALTER TABLE households ADD CONSTRAINT fk_households_property FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE languages ADD CONSTRAINT fk_languages_region FOREIGN KEY (region_id) REFERENCES regions(id);

CREATE TABLE ownership_records (
    id                  BIGSERIAL PRIMARY KEY,
    entity_id           BIGINT NOT NULL REFERENCES entities(id), -- the thing being owned (property, business, artifact, etc.)
    owner_entity_id     BIGINT NOT NULL REFERENCES entities(id),
    owner_type          TEXT NOT NULL, -- individual|family|organization|government|civilization|shared|community|none|corporation|investment_group|digital_owner
    acquired_method     TEXT, -- purchased|inherited|gifted|won|discovered|built|stolen|recovered
    acquired_tick       BIGINT NOT NULL
);

CREATE TABLE resources (
    id                  BIGSERIAL PRIMARY KEY,
    city_id             BIGINT REFERENCES cities(id),
    resource_type       TEXT NOT NULL, -- food|water|energy|oil|gold|minerals|timber|agricultural_land|rare_materials|...
    quantity            NUMERIC,
    quality             NUMERIC,
    owner_entity_id     BIGINT REFERENCES entities(id),
    supply              NUMERIC,
    demand              NUMERIC,
    production_rate     NUMERIC,
    consumption_rate    NUMERIC
);

CREATE TABLE environment_state (
    city_id             BIGINT PRIMARY KEY REFERENCES cities(id),
    weather             TEXT,
    climate             TEXT,
    active_disasters    JSONB,
    tick                BIGINT NOT NULL
);

-- Per-infrastructure-type tracking; cities.infrastructure is a rollup from this
CREATE TABLE infrastructure (
    id                  BIGSERIAL PRIMARY KEY,
    city_id             BIGINT NOT NULL REFERENCES cities(id),
    type                TEXT NOT NULL, -- roads|bridges|rail|water_systems|electricity|internet|hospitals|schools|public_safety|waste_management
    age                 INTEGER,
    condition           NUMERIC,
    capacity            NUMERIC,
    maintenance_level   NUMERIC,
    funding             NUMERIC,
    failure_risk        NUMERIC
);

-- ============================================================
-- ARTIFACTS, MISSIONS, EVENTS (already built since Volume 1)
-- ============================================================

CREATE TABLE artifacts (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    origin              TEXT,
    era                 TEXT, -- e.g. 'pre-collapse' — remnants of a prior civilization, discoverable by the current one
    rarity              TEXT,
    condition           TEXT,
    energy_class        TEXT,
    location_id         BIGINT REFERENCES properties(id)
);

CREATE TABLE missions (
    id                          BIGSERIAL PRIMARY KEY,
    artifact_id                 BIGINT REFERENCES artifacts(id),
    objective                   TEXT,
    reward                      NUMERIC,
    controlling_faction_id      BIGINT REFERENCES factions(organization_id),
    status                      TEXT DEFAULT 'available', -- available|accepted|completed|failed|abandoned
    tick_generated               BIGINT NOT NULL,
    -- Added 29 Aug 2026 with the mission state machine. Until then a
    -- mission was created 'available' and nothing in the engine could
    -- ever change it: no accept, no completion, no assignee. The quest
    -- RECORD existed and the quest LOOP did not.
    assigned_entity_id          BIGINT REFERENCES entities(id), -- who took it; NULL while available
    tick_accepted               BIGINT,
    tick_resolved               BIGINT, -- completed, failed or abandoned
    outcome_note                TEXT
);

CREATE TABLE events (
    id                      BIGSERIAL PRIMARY KEY,
    type                    TEXT NOT NULL,
    severity                TEXT, -- low|moderate|high
    note                    TEXT,
    tick                    BIGINT NOT NULL,
    affected_entity_ids     JSONB,
    global_effects          JSONB
);

-- ============================================================
-- ANALYTICS, PLAYERS, ECOSYSTEM LINKS
-- ============================================================

CREATE TABLE analytics_snapshots (
    tick                BIGINT PRIMARY KEY,
    population          INTEGER,
    gdp                 NUMERIC,
    crime_rate           NUMERIC,
    birth_rate           NUMERIC,
    death_rate           NUMERIC,
    migration            INTEGER,
    education_index      NUMERIC,
    technology_index     NUMERIC
);

-- The player is a thin reference, never a new entity type (Section 9)
CREATE TABLE players (
    id                  BIGSERIAL PRIMARY KEY,
    mode                TEXT NOT NULL, -- citizen|leader|simulation|multiplayer
    linked_entity_id    BIGINT REFERENCES entities(id) -- npc for Citizen mode, organization for Leader mode
);

-- ============================================================
-- CULTURE DNA AND NAMED FLOW TEMPLATES  (added 29 Aug 2026)
-- ============================================================
-- Both systems were built against documents that specify them fully
-- (VACANCY_TRAIT_DATABASE_ATTACHMENT.md's CULTURE_TRAIT_FAMILIES;
-- VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md's ten Named Flow Templates)
-- and neither had a table here, so server/migrate.js could not carry
-- them to Postgres at all. Flagged in server/culture.js when it was
-- written; closed here.

-- A culture is a thing tier entities BELONG to, never something an
-- individual carries — the attachment is explicit about that, and
-- culture_memberships below is what enforces it (there is no
-- `individual` tier).
--
-- `communities.culture` is TEXT and stays the culture's NAME: the
-- reference. The sheet lives here. One culture, many communities.
CREATE TABLE cultures (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               BIGINT REFERENCES entities(id), -- shared entity id, so other rows can point at a culture
    name                    TEXT NOT NULL,
    era                     TEXT,
    -- The eight SCORED families, 0-100. The other eight named families
    -- are not scores and are stored below as they actually are: three
    -- styles (one value from a named set) and five lists. Flattening
    -- all sixteen into numbers would produce a score for `cuisine`.
    trust_level             NUMERIC DEFAULT 50,
    tradition               NUMERIC DEFAULT 50,
    innovation              NUMERIC DEFAULT 50,
    competition             NUMERIC DEFAULT 50,
    cooperation             NUMERIC DEFAULT 50,
    education               NUMERIC DEFAULT 50, -- how much this culture VALUES education; communities.education is how educated a community IS
    art                     NUMERIC DEFAULT 50,
    religion                NUMERIC DEFAULT 50,
    -- The three STYLE dimensions: one value from a named set, not a magnitude.
    communication_style     TEXT, -- direct|indirect|formal|expressive|reserved
    leadership_style        TEXT, -- elder|elected|hereditary|militant|consensus|charismatic
    conflict_resolution     TEXT, -- mediation|duel|council|avoidance|restitution|exile
    -- The five DESCRIPTIVE dimensions: lists, empty rather than invented.
    values_held             JSONB DEFAULT '[]',
    customs                 JSONB DEFAULT '[]',
    language                JSONB DEFAULT '[]',
    cuisine                 JSONB DEFAULT '[]',
    fashion                 JSONB DEFAULT '[]'
);

-- A join, not a column on each tier's table: the same culture spans
-- many entities across several tiers. `tier` has no 'individual' value
-- on purpose — that is the rule the whole system exists to enforce.
CREATE TABLE culture_memberships (
    culture_id      BIGINT NOT NULL REFERENCES cultures(id) ON DELETE CASCADE,
    tier            TEXT NOT NULL, -- family|community|organization|city|civilization
    entity_id       BIGINT NOT NULL,
    PRIMARY KEY (tier, entity_id) -- one culture per entity per tier; re-attaching moves it
);

-- Named Flow Templates, held as DATA rather than as one function per
-- flow — VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md is explicit that this
-- is the requirement, not merely that ten flows exist.
--
-- The engine ships ten built-in templates; rows here are added to them,
-- and a row sharing an `id` with a built-in replaces that one. So this
-- table is empty in a default world and that is correct, not missing
-- data.
CREATE TABLE flow_templates (
    id              TEXT PRIMARY KEY,   -- 'economic-flow', etc. Matching a built-in id overrides it.
    name            TEXT NOT NULL,
    signal          TEXT NOT NULL,      -- must be one the engine reads; see server/flows.js SIGNALS
    comparator      TEXT NOT NULL,      -- above|below|atLeast|atMost
    threshold       NUMERIC NOT NULL,
    severity        TEXT DEFAULT 'low', -- low|moderate|high
    note            TEXT
);

-- Thin reference only — Vavlt Stvdios is a separate app; don't duplicate its data here
CREATE TABLE vault_studios_links (
    entity_id                  BIGINT PRIMARY KEY REFERENCES entities(id),
    vault_studios_creator_id   TEXT,
    subscription_tier          TEXT -- free|plus|pro|vault_creator|vault_elite (resolved naming, Section 14)
);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
