// server/engine.js
//
// VACON-C — simulation engine, Phase 0/1 foundation. (Correct,
// official name; earlier docs call this project VACANCY.)
//
// Built from scratch against:
//   - VACANCY_CLAUDE_CODE_BUILD_PROMPT.md   (role, entity shape, tick counter)
//   - VACANCY_TRAIT_DATABASE_ATTACHMENT.md  (TRAIT_FAMILIES, ORGANIZATION_TRAIT_FAMILIES)
//   - VACANCY_POSTGRESQL_SCHEMA.sql         (entities/npcs/organizations/factions/
//                                             trait_definitions/entity_traits column
//                                             shapes — traits are generated here in
//                                             the 0-100, default-50 range those
//                                             tables expect, even though this file
//                                             is in-memory for now)
//
// Trait family/name data and raw value generation (TRAIT_FAMILIES,
// randomTraitValue(), generateTraitSheet()) live in traits.js — locked
// Day 1 step 1 (see dev-docs/phase-1-trait-split/).
//
// Trait STORAGE follows the trait_definitions/entity_traits
// definition/instance split from the schema — locked Day 1 step 2 (see
// dev-docs/phase-2-trait-definitions-migration/). traitDefinitions.js
// holds the definition catalog (spanning individual, organization —
// step 5, and family — step 6 tiers); entityTraits.js generates and
// serializes entity_traits rows for any of them.
//
// WorldState also carries the three Key write-back targets (Section
// 4.3 / standing rule 1) — memories, relationships, entityKnowledge —
// via worldStore.js, plus applyKeyModifier() below for the "World
// state" leg specifically (entity_traits.key_modifier). Locked Day 1
// step 4 (see dev-docs/phase-4-key-resolvers/).
//
// Real resource tracking + supply/demand economy (resources,
// marketListings, individualFinances) live in economy.js — locked Day
// 1 step 7 (see dev-docs/phase-7-economy/); engine.js wraps its
// functions the same way it wraps entityTraits.js/worldStore.js.
//
// The 11-phase tick pipeline (Environment -> ... -> Reemergence) lives
// in tick.js — locked Day 1 step 8 (see dev-docs/phase-8-tick-pipeline/).
// tick.js does NOT require this file (avoids a circular dependency,
// since this file requires tick.js to expose advanceTick()) — it goes
// straight to entityTraits.js/keys.js/worldStore.js/economy.js.
//
// All of these are flat arrays mirroring their literal tables, so the
// eventual Postgres migration (step 9) is a straight data copy, not a
// reshape. generateNPC()'s public output (npc.traits, the nested
// { family: { name: value } } shape) is unchanged for existing
// consumers throughout all of this — only internal storage moved.
//
// Do not add actual Postgres persistence in this file — that's step 9,
// intentionally separate.

'use strict';

const { TRAIT_FAMILIES, generateTraitSheet } = require('./traits.js');
const {
  TRAIT_DEFINITIONS, INDIVIDUAL_DEFINITIONS, ORGANIZATION_DEFINITIONS, FAMILY_DEFINITIONS,
} = require('./traitDefinitions.js');
const {
  generateEntityTraits, traitsToSheet, getEntityTraitsForEntity,
  applyKeyModifier: applyKeyModifierTo, getLiveEntity: getLiveEntityFrom,
} = require('./entityTraits.js');
const economy = require('./economy.js');
const tick = require('./tick.js');
const players = require('./players.js');
const territory = require('./territory.js');
const missions = require('./missions.js');
const property = require('./property.js');
const culture = require('./culture.js');
const flows = require('./flows.js');
const contest = require('./contest.js');
const behavior = require('./behavior.js');
const actions = require('./actions.js');

// ---------------------------------------------------------------------------
// In-memory WorldState
// ---------------------------------------------------------------------------
// This mirrors what the Build Prompt/Roadmap call "Phase 0 — Repo prep":
// an in-memory WorldState that /api/* reads and writes (no such routes
// file exists in any handoff yet — flagged since step 1). Every array
// here is a flat, row-shaped mirror of its literal table, not a
// per-entity map — server/migrate.js (step 9) copies them straight
// into a real Postgres instance for exactly that reason.
const WorldState = {
  tick: 0,
  npcs: [],
  organizations: [],
  families: [],
  familyMemberships: [],
  // Real resource tracking + supply/demand economy, step 7 — resources
  // and marketListings start empty until generateResource()/
  // generateMarketListing() populate them; individualFinances likewise
  // via generateIndividualFinances() (getFamilyWealth(), step 6, was
  // waiting on this).
  resources: [],
  marketListings: [],
  individualFinances: [],
  // Employment, added 12 Sep 2026 when `employment_records` stopped
  // being a table nothing touched. Payroll runs inside the Economy
  // phase — the pipeline stays at eleven.
  employmentRecords: [],
  // Politics, same day and the same reason: six tables the schema
  // defined and no engine module touched. A government is an
  // organization subtype (standing rule 4, and the schema's own
  // primary key), so `governments` keys off an organization id rather
  // than owning one. `server/politics.js`; runs inside the
  // Organization phase.
  // What people believe, and how strongly. Built after politics,
  // because `public_opinion`'s schema comment asks for a rollup from
  // "beliefs/entity_knowledge" and beliefs was a dead table at the
  // time. `server/beliefs.js`.
  // **The dead leave `npcs` for here.** Not a status flag: 17 call
  // sites across 7 modules iterate `worldState.npcs`, and a flag would
  // need all 17 to check it forever — the first one anybody forgets is
  // a dead person drawing a wage or casting a vote. Moving the row
  // makes that structurally impossible. `server/mortality.js`.
  deceased: [],
  beliefs: [],
  // Civilizations and the technology ladder. Four dead tables built
  // together on 12 Sep 2026 because they are one system:
  // `civilizations`, `technology_eras`, its `requirements` chain, and
  // `civilization_technology_progress`. This is §40's bottleneck
  // logic, which an earlier revision of the implementation map claimed
  // was built on the strength of the requirements COLUMN existing.
  // `server/technology.js`; runs inside the Reemergence phase.
  civilizations: [],
  technologyEras: [],
  civilizationTechnologyProgress: [],
  governments: [],
  elections: [],
  votes: [],
  laws: [],
  publicOpinion: [],
  revolutions: [],
  entityTraits: [],
  memories: [],
  relationships: [],
  entityKnowledge: [],
  // 11-phase tick pipeline, step 8. activeConditions/events/
  // historicalRecords are flat arrays mirroring their literal tables
  // (events, historical_records) or, for activeConditions, a minimal
  // in-memory mechanism with no schema table of its own (see tick.js's
  // header comment). migrationRisk/reemergenceIndex have nowhere to
  // live in the schema yet either (no Property/Territory/City tier) —
  // both explicitly flagged stand-ins in tick.js, overwritten each
  // tick rather than accumulated as history.
  activeConditions: [],
  events: [],
  historicalRecords: [],
  migrationRisk: [],
  reemergenceIndex: null,
  // Citizen-mode player binding — the "observe and be affected by"
  // half of the locked Definition of Done, alongside step 8's cascade.
  players: [],
  // Territory/Community (block-tier, Section 11) — the other flagged
  // locked-scope gap. cities is minimal (the Build Prompt's own target
  // is "one living city"); communities defaults to tier='block';
  // territoryBlocks are faction-controlled, resolved each tick by
  // tick.js's Organization phase via territory.js#resolveTerritoryControl().
  cities: [],
  communities: [],
  territoryBlocks: [],
  // Artifact/Mission system -- real, added here despite CLAUDE.md's
  // own claim that this was "already built": checked directly, it
  // wasn't (see missions.js's own header for the full finding).
  artifacts: [],
  missions: [],
  // Property Engine (Phase 2). `properties` mirrors the literal table;
  // `ownershipRecords` is append-only by shape, which is why there is
  // no owner column on a property to keep in sync -- "who owns this"
  // is a read over the history. See property.js.
  properties: [],
  ownershipRecords: [],
  // Culture DNA (Phase 2). Tier-level: entities BELONG to a culture
  // through cultureMemberships rather than each carrying their own.
  // Neither array has a table in the schema yet -- flagged in
  // culture.js, and the first system here whose backing table has to be
  // written before migrate.js can carry it.
  cultures: [],
  cultureMemberships: [],
  // Named Flow Templates (Phase 2). EMPTY on purpose: flows.js falls
  // back to its own ten named templates when this is empty, and a row
  // put in here runs with no code change -- which is the entire
  // requirement the architecture document states for this system.
  flowTemplates: [],
  // The Behavior Engine's three tables (architecture document 4.5 /
  // Part 15F: "Genuinely new: schedule_events, entity_state, habits").
  // All three were in the schema from the start and had zero code until
  // 29 Aug 2026. See server/behavior.js.
  //
  // entityState is keyed one-row-per-entity (entity_state.entity_id is
  // the PRIMARY KEY, not a plain FK) and is MUTATED in place rather than
  // appended to — the only array here that works that way, because mood
  // and stress are volatile state, not history. The history of what
  // stressed somebody lives in `memories`.
  entityState: [],
  habits: [],
  scheduleEvents: [],
  // Observations queued the moment they happen and drained by the next
  // tick. Not a table and deliberately not one: these are in flight for
  // at most one tick before becoming real `events` rows, which IS the
  // durable record. Same shape of stand-in as activeConditions.
  pendingObservations: [],
  nextEntityId: 1,
};

// Shared id counter across every entity type — mirrors entities.id
// being one BIGSERIAL PK shared by every entities.type value ("npc" and
// "organization" both listed there), even though no separate WorldState
// .entities array exists yet (same precedent generateNPC() already set:
// entities+npcs columns merged into one object, not two).
function nextId() {
  return WorldState.nextEntityId++;
}

// Placeholder name generation — no name-generation system is specified in
// the handoff docs yet, so this is intentionally minimal, not a real system.
const FIRST_NAMES = ['Marcus', 'Dana', 'Theo', 'Priya', 'Jamal', 'Ines',
                      'Colton', 'Yara', 'Beckett', 'Mara'];
const LAST_NAMES = ['Whitfield', 'Okafor', 'Reyes', 'Nakamura', 'Boone',
                     'Delgado', 'Kowalski', 'Osei', 'Marsh', 'Levi'];

function generateName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

// entity_traits rows for one entity — mirrors a
// `SELECT * FROM entity_traits WHERE entity_id = ?` query. Works for
// any tier since it only filters by id. Thin wrapper: the real
// implementation moved to entityTraits.js in step 8 so server/tick.js
// (the 11-phase pipeline) can use it without a circular dependency on
// this file. Same name, same arguments (minus WorldState, closed over
// here) — no change for any existing caller.
function getEntityTraits(entityId) {
  return getEntityTraitsForEntity(WorldState, entityId);
}

// The "World state" leg of a Key's three-way write-back (Section 4.3)
// — see entityTraits.js#applyKeyModifier() for the full explanation.
// Same relocation-for-tick.js reasoning as getEntityTraits() above.
function applyKeyModifier(entityId, family, name, delta, tickNumber) {
  return applyKeyModifierTo(WorldState, entityId, family, name, delta, tickNumber);
}

// A live-traits view of an entity (see entityTraits.js#getLiveEntity()
// for why this differs from reading npc.traits/org.traits directly).
function getLiveEntity(entityId) {
  return getLiveEntityFrom(WorldState, entityId);
}

// ---------------------------------------------------------------------------
// generateNPC()
// ---------------------------------------------------------------------------
// Matches the entities + npcs column shapes in VACANCY_POSTGRESQL_SCHEMA.sql
// (id/type/status/created_tick on entities; role/education/religion/
// generation on npcs) even though this is in-memory today — so the later
// Postgres migration (step 9) is a straight data copy, not a reshape.
//
// options:
//   name        - string, defaults to a generated placeholder name
//   role        - string|null
//   education   - string|null
//   religion    - string|null
//   generation  - integer, defaults to 1
function generateNPC(options = {}) {
  const id = nextId();
  const traitRows = generateEntityTraits(id, WorldState.tick, INDIVIDUAL_DEFINITIONS);
  WorldState.entityTraits.push(...traitRows);

  const npc = {
    id,
    type: 'npc',
    status: 'active',
    name: options.name || generateName(),
    role: options.role || null,
    education: options.education || null,
    religion: options.religion || null,
    generation: options.generation || 1,
    // **Where this person lives.** `entities.community_id` and
    // `npcs.home_property_id` were both in the schema from the start
    // and set by NOTHING — so no person was associated with any area,
    // and every per-area statistic was not merely missing but
    // uncomputable. `home_property_id` was read in exactly one place
    // (mortality.js, for a death's location) and was therefore always
    // null.
    //
    // Null is still allowed and still means unplaced: a world can
    // generate people before it has anywhere to put them, and
    // `areaStats.js` counts the unplaced separately rather than
    // assigning them to an arbitrary community.
    communityId: options.communityId ?? null,
    home_property_id: options.homePropertyId ?? null,
    traits: traitsToSheet(traitRows),
    createdTick: WorldState.tick,
    updatedTick: WorldState.tick,
  };

  WorldState.npcs.push(npc);
  return npc;
}

// ---------------------------------------------------------------------------
// generateOrganization()
// ---------------------------------------------------------------------------
// Matches the entities + organizations column shapes in
// VACANCY_POSTGRESQL_SCHEMA.sql — same merge-into-one-object convention
// generateNPC() already established. Gives the organization its full
// tier-level trait sheet (13 dimensions, step 5).
//
// NOTE: the schema declares organizations.id as its own independent
// BIGSERIAL, not `REFERENCES entities(id)` the way npcs.entity_id is —
// but entities.type explicitly lists 'organization' as a valid value,
// and entity_traits/relationships/memories all FK to entities(id), so
// an organization needs a real entities-space id to be usable by any of
// those. Treated here as sharing the same id space as NPCs (both drawn
// from the same nextId() counter) — flagged as a likely schema gap in
// dev-docs/phase-5-organization-trait-sheet/tasks.md, not silently
// worked around. `entityType` holds entities.type ('organization');
// `type` holds organizations.type (the org's own category) — named
// apart specifically because the schema has both as real, different
// columns and merging them under one key would silently drop one.
//
// options:
//   name        - string, defaults to a placeholder ("Org <id> (<type>)"
//                 — no org-name generator is specified anywhere in the
//                 handoff package, same honesty as generateName()'s own
//                 "intentionally minimal, not a real system" placeholder)
//   type        - organizations.type; one of business|government|club|
//                 religion|gang|corporation|military|school|hospital|
//                 research|media|sports|library|museum. Required — no
//                 schema default, and guessing one would be inventing
//                 data the schema doesn't supply.
//   founderId   - entity id | null
//   leaderId    - entity id | null
function generateOrganization(options = {}) {
  if (!options.type) {
    throw new Error('generateOrganization requires options.type (organizations.type has no schema default).');
  }

  const id = nextId();
  const traitRows = generateEntityTraits(id, WorldState.tick, ORGANIZATION_DEFINITIONS);
  WorldState.entityTraits.push(...traitRows);

  const organization = {
    id,
    entityType: 'organization',
    status: 'active',
    name: options.name || `Org ${id} (${options.type})`,
    type: options.type,
    founder_id: options.founderId ?? null,
    leader_id: options.leaderId ?? null,
    members: 0,
    assets: 0,
    income: 0,
    expenses: 0,
    // influence/security/innovation/reputation are set from the
    // organizations table's own schema defaults (0/0/0/50), not
    // generated as entity_traits — those 4 ORGANIZATION_TRAIT_FAMILIES
    // dimensions already have a dedicated column here (see
    // organizationTraits.js's header comment); generating them again
    // as traits would be a second, disagreeing source of truth for the
    // same concept.
    influence: 0,
    security: 0,
    innovation: 0,
    reputation: 50,
    traits: traitsToSheet(traitRows),
    createdTick: WorldState.tick,
    updatedTick: WorldState.tick,
  };

  WorldState.organizations.push(organization);
  return organization;
}

// ---------------------------------------------------------------------------
// generateFaction()
// ---------------------------------------------------------------------------
// Faction is an Organization subtype (standing rule 4) — creates the
// underlying Organization (full trait sheet via generateOrganization(),
// which is the actual content of "upgrade factions to the full trait
// sheet") and merges the factions subtype's own columns (color/morale/
// status) on top of that same object, same merge convention as
// generateNPC()/generateOrganization(). `factionStatus` (not `status`)
// holds factions.status specifically — merging it as `status` would
// silently overwrite entities.status, a real, different column.
// `isFaction` is a JS-layer convenience marker only, not a schema
// column — a real Postgres migration decides whether to insert a
// `factions` row from this flag, not store the flag itself.
//
// options: same as generateOrganization(), plus:
//   color   - string | null
//   type    - defaults to 'gang' (the only concrete faction example in
//             the handoff package — Section 13.5's HOLLOW SAINTS gang
//             faction), overridable to any valid organizations.type.
function generateFaction(options = {}) {
  const organization = generateOrganization({ ...options, type: options.type || 'gang' });
  organization.color = options.color ?? null;
  organization.morale = 50;
  organization.factionStatus = 'controlled'; // contested|controlled|fortified, schema default
  organization.isFaction = true;
  return organization;
}

// ---------------------------------------------------------------------------
// generateFamily()
// ---------------------------------------------------------------------------
// Matches the `families` columns in VACANCY_POSTGRESQL_SCHEMA.sql.
// Locked Day 1 step 6 — "the minimal Family Engine" (the architecture
// doc's own System Map calls this layer "None — Entire layer missing";
// no prior Family code existed in any handoff to extend). Gives the
// family its 5-dimension tier-level trait sheet — the
// FAMILY_TRAIT_FAMILIES dimensions with no dedicated `families` column
// (see familyTraits.js). `wealth` is deliberately NOT a field on the
// returned object at all — standing rule 3 requires it stay computed;
// call getFamilyWealth(family.id) for the current value.
//
// options:
//   surname     - string, required (families.surname is NOT NULL, no
//                 schema default)
//   founderId   - entity id | null
//   headNpcId   - entity id | null
//   religion    - string | null
function generateFamily(options = {}) {
  if (!options.surname) {
    throw new Error('generateFamily requires options.surname (families.surname is NOT NULL with no default).');
  }

  const id = nextId();
  const traitRows = generateEntityTraits(id, WorldState.tick, FAMILY_DEFINITIONS);
  WorldState.entityTraits.push(...traitRows);

  const family = {
    id,
    entityType: 'family',
    surname: options.surname,
    founder_id: options.founderId ?? null,
    generation: 1,
    head_npc_id: options.headNpcId ?? null,
    total_members: 0,
    reputation: 50,
    unity: 50,
    conflict: 0,
    traditions: [],
    religion: options.religion ?? null,
    political_influence: 0,
    traits: traitsToSheet(traitRows),
    createdTick: WorldState.tick,
    updatedTick: WorldState.tick,
  };

  WorldState.families.push(family);
  return family;
}

// ---------------------------------------------------------------------------
// addFamilyMember()
// ---------------------------------------------------------------------------
// Matches family_memberships (entity_id, family_id, role,
// generation_number). total_members is a real, directly-stored column
// on families (not a rollup like wealth), so it's correct to increment
// it here rather than compute it on read.
//
// role: one of parent|child|grandparent|sibling|partner|guardian|
// mentor|founder|heir|black_sheep|leader|protector|caregiver per the
// schema's own comment — not validated here, same permissive approach
// generateNPC() already takes with role/education/religion.
function addFamilyMember(familyId, entityId, role, generationNumber) {
  const family = WorldState.families.find((f) => f.id === familyId);
  if (!family) {
    throw new Error(`addFamilyMember: no family with id ${familyId}`);
  }

  const membership = {
    entity_id: entityId,
    family_id: familyId,
    role: role ?? null,
    generation_number: generationNumber ?? family.generation,
  };
  WorldState.familyMemberships.push(membership);
  family.total_members += 1;
  family.updatedTick = WorldState.tick;
  return membership;
}

// families.wealth is explicitly a computed rollup, never independently
// stored — the schema's own comment on that column, and standing rule
// 3 verbatim ("Never duplicate computable rollups... Family Wealth are
// all computed, never stored"). This is that computation; no `wealth`
// field exists anywhere on the family object itself. Each member's net
// worth (economy.js#getNetWorth() — assets + savings - debt from their
// most recent individual_finances row) is summed across every member
// via family_memberships. Returned 0 for every member until step 7
// (this step) actually populates individualFinances — now that
// generateIndividualFinances() exists, this can return real numbers.
function getFamilyWealth(familyId) {
  const memberIds = WorldState.familyMemberships
    .filter((m) => m.family_id === familyId)
    .map((m) => m.entity_id);

  let total = 0;
  for (const entityId of memberIds) {
    total += economy.getNetWorth(WorldState, entityId);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Economy — real resource tracking + supply/demand (step 7)
// ---------------------------------------------------------------------------
// Thin bound wrappers around economy.js, closing over the module-level
// WorldState — same relationship entityTraits.js/worldStore.js already
// have to engine.js, so callers keep using the same
// `engine.generateX({...})` convention as generateNPC()/generateFamily().
function generateResource(options) {
  return economy.generateResource(WorldState, options);
}

function advanceResourceTick(resourceId) {
  const resource = WorldState.resources.find((r) => r.id === resourceId);
  if (!resource) throw new Error(`advanceResourceTick: no resource with id ${resourceId}`);
  return economy.advanceResourceTick(resource);
}

function getScarcity(resourceId) {
  const resource = WorldState.resources.find((r) => r.id === resourceId);
  if (!resource) throw new Error(`getScarcity: no resource with id ${resourceId}`);
  return economy.getScarcity(resource);
}

function generateMarketListing(options) {
  return economy.generateMarketListing(WorldState, options);
}

function resolveMarketPrice(listingId) {
  const listing = WorldState.marketListings.find((l) => l.id === listingId);
  if (!listing) throw new Error(`resolveMarketPrice: no market listing with id ${listingId}`);
  // Resolves the input's scarcity the same way the Economy phase does,
  // so calling this directly and letting a tick call it cannot produce
  // two different prices for the same listing.
  const input = listing.resource_type == null
    ? null
    : WorldState.resources.find((r) => r.resource_type === listing.resource_type);
  return economy.resolveMarketPrice(
    listing, WorldState.tick, input ? economy.getScarcity(input) : null,
  );
}

function generateIndividualFinances(entityId, options) {
  return economy.generateIndividualFinances(WorldState, entityId, options);
}

function getNetWorth(entityId) {
  return economy.getNetWorth(WorldState, entityId);
}

// ---------------------------------------------------------------------------
// Tick pipeline — 11-phase advanceTick() (step 8)
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as economy.js above.
function addEnvironmentalCondition(condition) {
  return tick.addEnvironmentalCondition(WorldState, condition);
}

function advanceTick() {
  return tick.advanceTick(WorldState);
}

// ---------------------------------------------------------------------------
// Players — Citizen-mode binding
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as economy.js/tick.js above.
function generatePlayer(options) {
  return players.generatePlayer(WorldState, options);
}

function getCitizenDashboard(playerId) {
  return players.getCitizenDashboard(WorldState, playerId);
}

// ---------------------------------------------------------------------------
// Territory/Community (block-tier)
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as economy.js/tick.js/players.js above.
function generateCity(options) {
  return territory.generateCity(WorldState, options);
}

function generateCommunity(options) {
  return territory.generateCommunity(WorldState, options);
}

function generateTerritoryBlock(options) {
  return territory.generateTerritoryBlock(WorldState, options);
}

// Computed rollups, Phase 2. Never stored -- standing rule 3 names
// Community Health and Reemergence explicitly. See territory.js.
function getCommunityDetail(communityId) {
  return territory.getCommunityDetail(WorldState, communityId);
}

function getCityDetail(cityId) {
  return territory.getCityDetail(WorldState, cityId);
}

function getCityReemergence(cityId) {
  return territory.getCityReemergence(WorldState, cityId);
}

// ---------------------------------------------------------------------------
// Artifact/Mission system
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as economy.js/tick.js/players.js/
// territory.js above.
function generateArtifact(options) {
  return missions.generateArtifact(WorldState, options);
}

function getArtifact(artifactId) {
  return missions.getArtifact(WorldState, artifactId);
}

// Listing. `VACANCY_API_ENDPOINT_MAP.md`'s own Phase 1 list names
// `GET /api/artifacts`, and it was the one endpoint in that list never
// built -- so artifacts could be created and fetched by id but never
// discovered.
function listArtifacts() {
  return WorldState.artifacts;
}

function generateMission(options) {
  return missions.generateMission(WorldState, options);
}

function getMission(missionId) {
  return missions.getMission(WorldState, missionId);
}

function listMissions(options) {
  return missions.listMissions(WorldState, options);
}

// ---------------------------------------------------------------------------
// The mission state machine — accept, and resolve
// ---------------------------------------------------------------------------
// The reward is paid by writing a NEW individual_finances row rather
// than mutating the last one. That table is keyed (entity_id, tick) and
// getLatestFinances() reads the highest tick, so the payment becomes
// part of a person's financial history instead of quietly overwriting
// it — the same append-only reasoning ownership records follow.
function payMissionReward(entityId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const current = economy.getLatestFinances(WorldState, entityId);
  const record = economy.generateIndividualFinances(WorldState, entityId, {
    income: current?.income ?? 0,
    savings: Math.round(((current?.savings ?? 0) + amount) * 100) / 100,
    debt: current?.debt ?? 0,
    assets: current?.assets ?? 0,
    tick: WorldState.tick,
  });
  return { entityId, amount, newSavings: record.savings };
}

function acceptMission(missionId, entityId) {
  return missions.acceptMission(WorldState, missionId, entityId);
}

// ---------------------------------------------------------------------------
// The Behavior Engine — bound to this WorldState
// ---------------------------------------------------------------------------
// Mood, habits and routine. The `runBehavior` pass itself is NOT
// re-exported here: it belongs to the tick, and exposing a way to
// advance behavior without advancing the tick would let a caller age
// somebody's habits without time passing.
function getEntityState(entityId) {
  return behavior.getEntityState(WorldState, entityId);
}

function applyStress(entityId, delta) {
  return behavior.applyStress(WorldState, entityId, delta);
}

function reinforceHabit(entityId, name, options) {
  return behavior.reinforceHabit(WorldState, entityId, name, options);
}

function listHabits(entityId) {
  return behavior.listHabits(WorldState, entityId);
}

function addScheduleEvent(entityId, options) {
  return behavior.addScheduleEvent(WorldState, entityId, options);
}

function listScheduleEvents(entityId) {
  return behavior.listScheduleEvents(WorldState, entityId);
}

function describeBehavior(entityId) {
  return behavior.describeBehavior(WorldState, entityId);
}

// ---------------------------------------------------------------------------
// The player action dispatcher
// ---------------------------------------------------------------------------
// The map's "generic action dispatcher, routes to the right
// Key/decision". A registry over verbs that already exist, not a new
// system -- see actions.js.
// The verb set the dispatcher acts through. These are THIS FILE's bound
// wrappers, not the raw modules -- resolveMission here supplies the
// payReward callback that makes a completed mission actually pay, and
// the dispatcher calling missions.js directly is exactly the bug that
// made it pay nothing.
const ACTION_VERBS = {
  acceptMission: (...args) => acceptMission(...args),
  resolveMission: (...args) => resolveMission(...args),
  addScheduleEvent: (...args) => addScheduleEvent(...args),
  reinforceHabit: (...args) => reinforceHabit(...args),
  resolveContest: (...args) => resolveContest(...args),
};

function dispatchAction(playerId, body) {
  return actions.dispatchAction(WorldState, playerId, body, ACTION_VERBS);
}

function listActions(mode) {
  return actions.listActions(mode);
}

// Missions an entity could actually take on right now. The map names
// this GET /api/missions/available/:entityId.
//
// Status alone is the whole answer, and the first version of this
// carried a second `.filter((m) => m.assigned_entity_id == null)` on
// top of it. That filter could never fire: `acceptMission` sets
// `status = 'accepted'` and `assigned_entity_id` in the same two lines,
// so an available mission is never a held one. A mutation deleting the
// filter broke no test, which is how it was found — unreachable
// defensive code is code nobody has ever checked, and it reads as if
// the two fields could disagree.
//
// Takes an entityId and does not filter on it, deliberately: the route
// is per-entity because the map made it per-entity, and validating that
// the entity is real is worth more than pretending missions are
// targeted when nothing in the schema targets them.
function availableMissions(entityId) {
  if (!getLiveEntity(entityId)) throw new Error(`no entity with id ${entityId}`);
  return missions.listMissions(WorldState, { status: 'available' });
}

// ---------------------------------------------------------------------------
// Contest resolution
// ---------------------------------------------------------------------------
// The engine owns who wins, because it owns the people and their
// ratings. VDP owns the card, VAGO owns the market, Vavlt Stvdios owns
// the stream — that split is unchanged; this fills the hole in the
// middle of it where a winner used to be supplied by hand.
function rateEntity(entityId, discipline) {
  return contest.rateEntity(WorldState, entityId, discipline);
}

function resolveContest(options) {
  return contest.resolveContest(WorldState, options);
}

function verifyContest(result) {
  return contest.verifyContest(WorldState, result);
}

function resolveMission(missionId, options = {}) {
  return missions.resolveMission(WorldState, missionId, {
    ...options,
    payReward: payMissionReward,
  });
}

// ---------------------------------------------------------------------------
// Property Engine
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as economy.js/tick.js/players.js/
// territory.js/missions.js above.
function generateProperty(options) {
  return property.generateProperty(WorldState, options);
}

function getProperty(propertyId) {
  return WorldState.properties.find((p) => p.id === Number(propertyId)) ?? null;
}

function listProperties() {
  return WorldState.properties;
}

// Derived, never stored -- takes the property, not an id, because it is
// a pure function of the row. See property.js's header.
function currentPropertyValue(prop) {
  return property.currentValue(prop);
}

function recordOwnership(options) {
  return property.recordOwnership(WorldState, options);
}

function getCurrentOwner(entityId) {
  return property.getCurrentOwner(WorldState, entityId);
}

function getOwnershipHistory(entityId) {
  return property.getOwnershipHistory(WorldState, entityId);
}

function getHoldings(ownerEntityId) {
  return property.getHoldings(WorldState, ownerEntityId);
}

// ---------------------------------------------------------------------------
// Culture DNA
// ---------------------------------------------------------------------------
// Same bound-wrapper relationship as every other subsystem module.
function generateCulture(options) {
  return culture.generateCulture(WorldState, options);
}

function attachCulture(options) {
  return culture.attachCulture(WorldState, options);
}

function getCulture(cultureId) {
  return culture.getCulture(WorldState, cultureId);
}

function listCultures() {
  return culture.listCultures(WorldState);
}

function getCultureFor(entityId) {
  return culture.getCultureFor(WorldState, entityId);
}

function getCultureMembers(cultureId) {
  return culture.getCultureMembers(WorldState, cultureId);
}

// ---------------------------------------------------------------------------
// Named Flow Templates
// ---------------------------------------------------------------------------
function describeFlows() {
  return flows.describeFlows(WorldState);
}

function addFlowTemplate(template) {
  flows.validateTemplate(template);
  WorldState.flowTemplates.push(template);
  return template;
}

module.exports = {
  TRAIT_FAMILIES,
  TRAIT_DEFINITIONS,
  WorldState,
  generateTraitSheet,
  generateNPC,
  generateOrganization,
  generateFaction,
  generateFamily,
  addFamilyMember,
  getFamilyWealth,
  generateResource,
  advanceResourceTick,
  getScarcity,
  generateMarketListing,
  resolveMarketPrice,
  generateIndividualFinances,
  getNetWorth,
  getEntityTraits,
  applyKeyModifier,
  getLiveEntity,
  addEnvironmentalCondition,
  advanceTick,
  generatePlayer,
  getCitizenDashboard,
  generateCity,
  generateCommunity,
  generateTerritoryBlock,
  getCommunityDetail,
  getCityDetail,
  getCityReemergence,
  generateArtifact,
  getArtifact,
  listArtifacts,
  generateMission,
  getMission,
  listMissions,
  MISSION_STATUSES: missions.MISSION_STATUSES,
  ACTION_NAMES: actions.ACTION_NAMES,
  dispatchAction,
  listActions,
  availableMissions,
  TICK_INTERVALS: behavior.TICK_INTERVALS,
  SCHEDULE_FREQUENCIES: behavior.FREQUENCIES,
  getEntityState,
  applyStress,
  reinforceHabit,
  listHabits,
  addScheduleEvent,
  listScheduleEvents,
  describeBehavior,
  DISCIPLINES: contest.DISCIPLINES,
  DISCIPLINE_NAMES: contest.DISCIPLINE_NAMES,
  rateEntity,
  resolveContest,
  verifyContest,
  acceptMission,
  resolveMission,
  PROPERTY_TYPES: property.PROPERTY_TYPES,
  PROPERTY_LIFECYCLE: property.LIFECYCLE,
  OWNER_TYPES: property.OWNER_TYPES,
  ACQUIRED_METHODS: property.ACQUIRED_METHODS,
  generateProperty,
  getProperty,
  listProperties,
  currentPropertyValue,
  recordOwnership,
  getCurrentOwner,
  getOwnershipHistory,
  getHoldings,
  CULTURE_TRAIT_FAMILIES: culture.CULTURE_TRAIT_FAMILIES,
  CULTURE_SCORED_FAMILIES: culture.CULTURE_SCORED_FAMILIES,
  CULTURE_STYLES: culture.CULTURE_STYLES,
  CULTURE_TIERS: culture.CULTURE_TIERS,
  generateCulture,
  attachCulture,
  getCulture,
  listCultures,
  getCultureFor,
  getCultureMembers,
  FLOW_TEMPLATES: flows.FLOW_TEMPLATES,
  FLOW_SIGNALS: Object.keys(flows.SIGNALS),
  describeFlows,
  addFlowTemplate,
};
