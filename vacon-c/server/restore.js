// server/restore.js
//
// The other half of step 9: read a world back out of Postgres.
//
// `migrate.js` has always been a one-way export. That made the
// database a copy of the simulation and never a source for it, so a
// restart still lost everything — which is what `dev-docs/
// COMPLETION_BY_APP.md` has been reporting as vacon-c's one shortfall
// ("missing: persists to disk").
//
// ---------------------------------------------------------------------
// **Why this is a restore and not the async rewrite step 9 describes**
//
// Step 9's wording is "migrate off in-memory WorldState". Taken
// literally that means converting every read in engine.js, economy.js,
// keys.js and tick.js into an async Postgres query — which migrate.js's
// own header flags as "a much larger rewrite" and declines. Having now
// built the inverse, that literal reading looks like the wrong design
// as well as the larger one, for three reasons worth writing down:
//
//   1. **A tick reads the whole world.** The 11-phase pipeline sweeps
//      every npc, organization, family, resource and listing on every
//      tick. As per-row round-trips that is thousands of queries per
//      tick to compute something the process could hold in memory.
//   2. **It buys no durability.** What loses the simulation is that
//      nothing reads the database back, not that reads are synchronous.
//      Fixing the reads without fixing that fixes nothing.
//   3. **Async breaks determinism.** CLAUDE.md's standing position is
//      that core decision-making stays deterministic and a settled
//      contest can be re-verified. Interleaved async reads through a
//      tick pipeline is exactly how that stops being true.
//
// So: Postgres is the durable record, memory is the working set. Load
// at boot, write a checkpoint after. This is how tick-based simulations
// normally persist, and it leaves the engine synchronous and
// deterministic.
//
// **This is a deliberate departure from step 9's literal wording and
// should be read as one**, not as the rewrite quietly relabelled.
//
// ---------------------------------------------------------------------
// What restore has to get right beyond loading rows
//
//   * **Id sequences.** Sixteen counters live as module-level `let`s
//     across nine files and all start at 1. Restoring 500 memories and
//     then adding one gives the new memory id 1. See
//     server/idSequences.js — this file calls reseedAll() and refuses
//     to return a world without it.
//   * **Derived fields.** `traits` on every entity is a denormalisation
//     of entity_traits, `entityType` is entities.type, `isFaction` is
//     "there is a factions row". None of them are stored twice; all are
//     rebuilt here, which is standing rule 3 applied to the read side.

'use strict';

const db = require('./db.js');
const { traitsToSheet } = require('./entityTraits.js');
const { reseedAll } = require('./idSequences.js');

// Turn `SELECT *` rows into what the engine expects. Postgres returns
// NUMERIC as a string, which is correct of it and wrong for an engine
// that does arithmetic on these — `'50' + 1` is `'501'`. Every numeric
// column has to come back as a number.
function num(value) {
  if (value === null || value === undefined) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function nums(row, fields) {
  for (const f of fields) if (f in row) row[f] = num(row[f]);
  return row;
}

async function restoreWorldStateFromPostgres(worldState) {
  const summary = {};
  const q = async (sql) => (await db.query(sql)).rows;

  // -------------------------------------------------------------------
  // entity_traits first — every entity's `traits` sheet is rebuilt from
  // these, so they have to be in hand before the entities are shaped.
  // -------------------------------------------------------------------
  // `trait_id` belongs in this list and was left out of it once. The
  // symptom is worth recording because it is the shape most of these
  // bugs take: nothing threw. traitsToSheet() looks each row's
  // trait_id up in the definition catalog, the string "1" does not
  // match the number 1, every row was skipped, and every entity came
  // back with `traits: {}` — a world of people with no traits at all,
  // restored without a single error.
  const traitRows = (await q('SELECT * FROM entity_traits ORDER BY entity_id, trait_id')).map((r) =>
    nums(r, ['entity_id', 'trait_id', 'current_value', 'base_value', 'temporary_modifier',
      'permanent_modifier', 'experience_modifier', 'environmental_modifier',
      'relationship_modifier', 'key_modifier', 'last_updated_tick']));
  worldState.entityTraits = traitRows;
  summary.entity_traits = traitRows.length;

  const traitsFor = new Map();
  for (const row of traitRows) {
    if (!traitsFor.has(row.entity_id)) traitsFor.set(row.entity_id, []);
    traitsFor.get(row.entity_id).push(row);
  }
  const sheetFor = (id) => traitsToSheet(traitsFor.get(id) || []);

  // -------------------------------------------------------------------
  // entities + subtypes
  // -------------------------------------------------------------------
  const entities = new Map();
  for (const e of await q('SELECT * FROM entities')) {
    entities.set(Number(e.id), nums(e, ['id', 'created_tick', 'updated_tick']));
  }

  const npcRows = await q('SELECT * FROM npcs');
  worldState.npcs = npcRows.map((n) => {
    const e = entities.get(Number(n.entity_id)) || {};
    return {
      id: Number(n.entity_id),
      type: 'npc',
      status: e.status ?? 'active',
      // From server/schema-extensions.sql. Before that column existed
      // this was unrecoverable — generateName() is Math.random(), so a
      // name that was not stored could not be derived from anything.
      name: n.name ?? null,
      role: n.role ?? null,
      education: n.education ?? null,
      religion: n.religion ?? null,
      generation: num(n.generation) ?? 1,
      traits: sheetFor(Number(n.entity_id)),
      createdTick: e.created_tick ?? 0,
      updatedTick: e.updated_tick ?? 0,
    };
  });
  summary.npcs = worldState.npcs.length;

  // A factions row is what makes an organization a faction — there is
  // no `isFaction` column and there should not be one, since the row's
  // existence already says it.
  const factions = new Map();
  for (const f of await q('SELECT * FROM factions')) {
    factions.set(Number(f.organization_id), nums(f, ['morale']));
  }

  worldState.organizations = (await q('SELECT * FROM organizations')).map((o) => {
    const e = entities.get(Number(o.id)) || {};
    const faction = factions.get(Number(o.id));
    const org = {
      ...nums(o, ['id', 'founder_id', 'leader_id', 'members', 'assets', 'income',
        'expenses', 'influence', 'security', 'innovation', 'reputation']),
      entityType: 'organization',
      status: e.status ?? 'active',
      traits: sheetFor(Number(o.id)),
      createdTick: e.created_tick ?? 0,
      updatedTick: e.updated_tick ?? 0,
    };
    if (faction) {
      org.color = faction.color ?? null;
      org.morale = faction.morale;
      org.factionStatus = faction.status;
      org.isFaction = true;
    }
    return org;
  });
  summary.organizations = worldState.organizations.length;

  worldState.families = (await q('SELECT * FROM families')).map((f) => {
    const e = entities.get(Number(f.id)) || {};
    const family = {
      ...nums(f, ['id', 'founder_id', 'generation', 'head_npc_id', 'total_members',
        'reputation', 'unity', 'conflict', 'political_influence']),
      entityType: 'family',
      traits: sheetFor(Number(f.id)),
      createdTick: e.created_tick ?? 0,
      updatedTick: e.updated_tick ?? 0,
    };
    // Family wealth is computed by engine.js#getFamilyWealth() and
    // never stored (standing rule 3). migrate.js writes the computed
    // value into the column for readers of the database; reading it
    // back onto the object would create the stored copy the rule
    // forbids, and it would go stale on the first tick.
    delete family.wealth;
    return family;
  });
  summary.families = worldState.families.length;

  worldState.familyMemberships = (await q('SELECT * FROM family_memberships')).map((m) =>
    nums(m, ['entity_id', 'family_id', 'generation_number']));
  summary.family_memberships = worldState.familyMemberships.length;

  // -------------------------------------------------------------------
  // The three Key write-back targets
  // -------------------------------------------------------------------
  worldState.memories = (await q('SELECT * FROM memories ORDER BY id')).map((m) =>
    nums(m, ['id', 'entity_id', 'importance', 'emotion_level', 'tick', 'reinforcement_count']));
  summary.memories = worldState.memories.length;

  worldState.relationships = (await q('SELECT * FROM relationships ORDER BY id')).map((r) =>
    nums(r, ['id', 'entity_a_id', 'entity_b_id', 'trust', 'respect', 'fear', 'love',
      'hatred', 'influence', 'debt', 'communication', 'alliance', 'competition',
      'shared_history', 'conflict', 'loyalty', 'interaction_count', 'relationship_age']));
  summary.relationships = worldState.relationships.length;

  worldState.entityKnowledge = (await q('SELECT * FROM entity_knowledge ORDER BY id')).map((k) =>
    nums(k, ['id', 'entity_id', 'subject_entity_id', 'confidence_level', 'source_entity_id',
      'spread_rate', 'distortion_level', 'acquired_tick']));
  summary.entity_knowledge = worldState.entityKnowledge.length;

  // -------------------------------------------------------------------
  // Economy
  // -------------------------------------------------------------------
  worldState.resources = (await q('SELECT * FROM resources ORDER BY id')).map((r) =>
    nums(r, ['id', 'city_id', 'quantity', 'quality', 'owner_entity_id', 'supply',
      'demand', 'production_rate', 'consumption_rate']));
  summary.resources = worldState.resources.length;

  worldState.marketListings = (await q('SELECT * FROM market_listings ORDER BY id')).map((l) =>
    nums(l, ['id', 'city_id', 'price', 'supply', 'demand', 'quality', 'popularity', 'tick']));
  summary.market_listings = worldState.marketListings.length;

  worldState.individualFinances = (await q('SELECT * FROM individual_finances')).map((f) =>
    nums(f, ['entity_id', 'income', 'savings', 'debt', 'assets', 'tick']));
  summary.individual_finances = worldState.individualFinances.length;

  // **Every numeric column named, including the ids.** Postgres returns
  // BIGINT and NUMERIC as strings, and a missed conversion here does
  // not throw — it produces a world that looks restored and is wrong.
  // That is CLAUDE.md's tenth standing rule, learned when `trait_id`
  // came back as the string "1", matched no definition, and restored
  // every entity with an empty trait sheet and no error anywhere.
  // `wage` is the one that would bite: a string wage makes
  // `wage > assets` a string comparison, so payroll would silently
  // start paying or refusing on lexicographic order.
  worldState.employmentRecords = (await q('SELECT * FROM employment_records ORDER BY id')).map((e) =>
    nums(e, ['id', 'entity_id', 'employer_organization_id', 'wage', 'start_tick']));
  summary.employment_records = worldState.employmentRecords.length;

  // Politics. **Every id and numeric column named in `nums`** —
  // Postgres returns BIGINT and NUMERIC as strings, and a missed
  // conversion does not throw, it produces a world that looks restored
  // and is wrong (standing rule 10). `approval_score` is the one that
  // would bite hardest: a string approval makes
  // `approval >= approvalFloor` a lexicographic comparison, so "9"
  // would read as above a floor of 35 and a collapsing government
  // would restore as a stable one.
  worldState.governments = (await q('SELECT * FROM governments')).map((g) =>
    nums(g, ['organization_id']));
  summary.governments = worldState.governments.length;

  worldState.elections = (await q('SELECT * FROM elections ORDER BY id')).map((e) =>
    nums(e, ['id', 'organization_id', 'start_tick', 'end_tick']));
  summary.elections = worldState.elections.length;

  worldState.votes = (await q('SELECT * FROM votes')).map((v) =>
    nums(v, ['election_id', 'voter_entity_id', 'candidate_entity_id', 'tick']));
  summary.votes = worldState.votes.length;

  worldState.laws = (await q('SELECT * FROM laws ORDER BY id')).map((l) =>
    nums(l, ['id', 'jurisdiction_city_id', 'enacted_tick']));
  summary.laws = worldState.laws.length;

  worldState.publicOpinion = (await q('SELECT * FROM public_opinion')).map((o) =>
    nums(o, ['city_id', 'approval_score', 'tick']));
  summary.public_opinion = worldState.publicOpinion.length;

  worldState.revolutions = (await q('SELECT * FROM revolutions ORDER BY id')).map((r) =>
    nums(r, ['id', 'target_government_organization_id', 'trigger_tick',
      'new_government_organization_id']));
  summary.revolutions = worldState.revolutions.length;

  // -------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------
  worldState.events = (await q('SELECT * FROM events ORDER BY id')).map((e) =>
    nums(e, ['id', 'tick']));
  summary.events = worldState.events.length;

  worldState.historicalRecords = (await q('SELECT * FROM historical_records ORDER BY id')).map((h) =>
    nums(h, ['id', 'who', 'when_tick', 'where_location_id', 'significance']));
  summary.historical_records = worldState.historicalRecords.length;

  // -------------------------------------------------------------------
  // Territory / Property
  // -------------------------------------------------------------------
  worldState.cities = (await q('SELECT * FROM cities ORDER BY id')).map((c) =>
    nums(c, ['id', 'region_id', 'population', 'mayor_npc_id', 'economy', 'infrastructure',
      'safety', 'health', 'education', 'culture', 'employment', 'housing', 'pollution',
      'corruption', 'tick']));
  summary.cities = worldState.cities.length;

  worldState.communities = (await q('SELECT * FROM communities ORDER BY id')).map((c) =>
    nums(c, ['id', 'city_id', 'population', 'housing', 'crime', 'safety', 'employment',
      'education', 'health', 'culture', 'cohesion', 'tick']));
  summary.communities = worldState.communities.length;

  worldState.territoryBlocks = (await q('SELECT * FROM territory_blocks ORDER BY id')).map((b) =>
    nums(b, ['id', 'faction_id', 'city_id', 'community_id', 'contested_since_tick', 'tick']));
  summary.territory_blocks = worldState.territoryBlocks.length;

  worldState.properties = (await q('SELECT * FROM properties ORDER BY id')).map((p) =>
    nums(p, ['id', 'land_size', 'value', 'condition', 'occupants', 'floors', 'units',
      'age', 'construction_date', 'operating_organization_id']));
  summary.properties = worldState.properties.length;

  worldState.ownershipRecords = (await q('SELECT * FROM ownership_records ORDER BY id')).map((o) =>
    nums(o, ['id', 'entity_id', 'owner_entity_id', 'acquired_tick', 'released_tick', 'price']));
  summary.ownership_records = worldState.ownershipRecords.length;

  // -------------------------------------------------------------------
  // Artifact / Mission / Player
  // -------------------------------------------------------------------
  worldState.artifacts = (await q('SELECT * FROM artifacts ORDER BY id')).map((a) =>
    nums(a, ['id', 'location_id']));
  summary.artifacts = worldState.artifacts.length;

  worldState.missions = (await q('SELECT * FROM missions ORDER BY id')).map((m) =>
    nums(m, ['id', 'artifact_id', 'reward', 'controlling_faction_id', 'tick_generated',
      'assigned_entity_id', 'tick_accepted', 'tick_resolved']));
  summary.missions = worldState.missions.length;

  worldState.players = (await q('SELECT * FROM players ORDER BY id')).map((p) =>
    nums(p, ['id', 'linked_entity_id']));
  summary.players = worldState.players.length;

  // -------------------------------------------------------------------
  // Culture / Flows / Behavior
  // -------------------------------------------------------------------
  worldState.cultures = (await q('SELECT * FROM cultures ORDER BY id')).map((c) => {
    const row = nums(c, ['id', 'entity_id']);
    // culture.js keeps the eight scored families in a `traits` object
    // and the styles/lists beside it. The table flattens all of them
    // into columns, so the object has to be put back together.
    const culture = {
      id: row.id,
      entity_id: row.entity_id,
      name: row.name,
      era: row.era,
      traits: {
        trustLevel: num(row.trust_level),
        tradition: num(row.tradition),
        innovation: num(row.innovation),
        competition: num(row.competition),
        cooperation: num(row.cooperation),
        education: num(row.education),
        art: num(row.art),
        religion: num(row.religion),
      },
      communicationStyle: row.communication_style,
      leadershipStyle: row.leadership_style,
      conflictResolution: row.conflict_resolution,
      // `values` is reserved in SQL, hence values_held in the column.
      values: row.values_held ?? [],
      customs: row.customs ?? [],
      language: row.language ?? [],
      cuisine: row.cuisine ?? [],
      fashion: row.fashion ?? [],
    };
    return culture;
  });
  summary.cultures = worldState.cultures.length;

  worldState.cultureMemberships = (await q('SELECT * FROM culture_memberships')).map((m) =>
    nums(m, ['culture_id', 'entity_id']));
  summary.culture_memberships = worldState.cultureMemberships.length;

  worldState.flowTemplates = (await q('SELECT * FROM flow_templates ORDER BY id')).map((f) =>
    nums(f, ['threshold']));
  summary.flow_templates = worldState.flowTemplates.length;

  worldState.entityState = (await q('SELECT * FROM entity_state')).map((s) =>
    nums(s, ['entity_id', 'stress_level', 'tick']));
  summary.entity_state = worldState.entityState.length;

  worldState.habits = (await q('SELECT * FROM habits ORDER BY id')).map((h) =>
    nums(h, ['id', 'entity_id', 'strength', 'formed_tick', 'last_reinforced_tick']));
  summary.habits = worldState.habits.length;

  worldState.scheduleEvents = (await q('SELECT * FROM schedule_events ORDER BY id')).map((e) =>
    nums(e, ['id', 'entity_id', 'tick']));
  summary.schedule_events = worldState.scheduleEvents.length;

  // -------------------------------------------------------------------
  // The tick, and the sequences
  // -------------------------------------------------------------------
  //
  // The world's tick is the high-water mark of what is in it. There is
  // no `world` table to read it from, and inventing one to hold a
  // single integer would be a table outside the source of truth for the
  // sake of a number every row already implies.
  let tick = 0;
  for (const row of [...worldState.events, ...worldState.entityTraits]) {
    const t = num(row.tick ?? row.last_updated_tick);
    if (Number.isFinite(t) && t > tick) tick = t;
  }
  worldState.tick = tick;
  summary.tick = tick;

  // nextEntityId lives ON WorldState, so unlike the other sixteen it
  // survives a structured clone — but not a process restart, and a
  // restored world has to continue its numbering rather than restart it.
  let maxEntity = 0;
  for (const id of entities.keys()) if (id > maxEntity) maxEntity = id;
  worldState.nextEntityId = maxEntity + 1;
  summary.nextEntityId = worldState.nextEntityId;

  // **Not optional, and not last for tidiness.** Without this every
  // module's counter is still at 1 and the next thing the world creates
  // collides with something it just loaded.
  summary.sequences = reseedAll(worldState);

  return summary;
}

module.exports = { restoreWorldStateFromPostgres };
