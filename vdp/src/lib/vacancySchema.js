// VDP -> VACANCY: which shared table each of VDP's world objects is.
//
// **The instruction this answers**, from
// `vdp/VDP_VACANCY_SHARED_ENGINE_COST_REDUCTION.md`, verbatim: "when
// building VDP's own systems, check whether VACANCY's schema already
// covers the same real entity type before creating a new, parallel
// table or system. The casino, Venus Resort properties, and VDP's NPCs
// should be real rows in the same properties/entities/organizations
// tables already specified — not a second, separate VDP-specific
// schema."
//
// **What is actually true today, checked rather than assumed.**
// `vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql` is real: 760 lines, 60+
// tables, including every one named below. `vacon-c/server/` is a real
// engine and `server.js` requires it. But `server/db.js` says plainly
// in its own header that the engine still reads an in-memory
// WorldState and that converting every function to query Postgres "is
// explicitly flagged as NOT done in this pass." So there is a real
// schema, a real engine, and a real one-way migration -- and no live
// table anything currently reads from.
//
// That means the instruction cannot be executed literally yet: there
// are no rows to be a row in. Writing VDP code that pretended
// otherwise would be the same failure this repo keeps finding.
//
// **So this is the half that can be true now.** Every VDP world object
// declares which existing VACANCY table it belongs to, and
// `scripts/test/vacancy-schema-alignment.test.mjs` fails if any of
// those names is not a real `CREATE TABLE` in the schema file. Nothing
// here creates a table or a parallel model. When the engine's Postgres
// conversion lands, the mapping is already stated and checked, and the
// casino's venues become `properties` rows rather than a second
// VDP-specific design somebody has to reconcile.
//
// The cost argument in the source document is the reason this matters:
// the schema, API, trait system and Key framework get built once. A
// mapping that drifts silently is how "once" quietly becomes twice.

// Keys are VDP's own object kinds; values are table names that must
// exist in vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql.
export const VACANCY_ENTITY_MAP = {
  // Venus Resort Complex (`venusResort.js`)
  resortVenue: 'properties',        // the land casino and the riverboat
  resortOperator: 'organizations',  // whoever holds the licence
  resortStaff: 'npcs',              // dealers, hosts, security

  // Combat Sports District (`combatSports.js`)
  fighter: 'entities',              // a person, not a role
  fightPromotion: 'organizations',
  match: 'events',

  // Backdrop simulation (`worldExpansion.js`)
  simulatedArea: 'cities',
  areaEconomy: 'economy_snapshots',
};

// Deliberately NOT mapped, and each for a stated reason -- an
// unmapped-by-omission list is indistinguishable from an oversight.
export const NOT_SHARED = {
  resortTable: 'furniture inside a property, not an entity in its own right',
  waterTaxiCrossing: "a player's transient position, not world state",
  broadcastChannel: 'owned by Vavlt Stvdios, which has its own model',
  playbackGrant: 'owned by vaco-media, deliberately its own service',
};

export function tableFor(kind) {
  return VACANCY_ENTITY_MAP[kind] ?? null;
}

export function describeAlignment() {
  return {
    schema: 'vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql',
    mapped: Object.keys(VACANCY_ENTITY_MAP).length,
    tables: [...new Set(Object.values(VACANCY_ENTITY_MAP))].sort(),
    // Said out loud so nobody reads this module as "VDP is on Postgres".
    status: 'readable-not-persisted: every shared table is now served over VACON-C\'s '
      + 'API and vdp/src/lib/vacancyClient.js reads it, so VDP can consume live '
      + 'properties, organizations, entities, cities and events instead of modelling '
      + 'them again. The engine still reads an in-memory WorldState (see '
      + 'vacon-c/server/db.js), so no VDP object is a database ROW yet — the mapping '
      + 'is for when they are.',
    // What changed and when, because "declared-only" was true for a real
    // reason and stopped being true on a specific date.
    readableSince: '2026-08-29',
  };
}
