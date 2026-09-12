// server/urbanSystems.js
//
// The 40 urban systems from the consolidated master spec (§7), written
// down as data so the question "how many of them are built?" can be
// answered by a command instead of by reading forty files and guessing.
//
// **Why this file exists at all.** §7 is a bare list of forty names.
// `dev-docs/VACANCY_SPEC_IMPLEMENTATION_MAP.md` had to mark it
// "PARTIAL, and the honest answer is that nothing enumerates them —
// roughly 25 of the 40", and "roughly" was doing real work there: it
// was an estimate from memory, not a measurement, and there was
// nothing in the repo it could be checked against. A spec section
// nothing can measure is a spec section that drifts silently.
//
// **Every claim in here is verified by `test/urban-systems.test.js`.**
// A system may only name a table that exists in
// `VACANCY_POSTGRESQL_SCHEMA.sql`, a tick phase that exists in
// `tick.js`, a trait family that exists in `traits.js`, a function that
// exists under `server/`, or an `infrastructure.type` value that
// appears in that column's own enumeration. A fictional citation fails
// the test. That is the whole point: without it this file would be a
// more precise-looking version of the same guess.
//
// ---------------------------------------------------------------------
// The four levels, and why three would have been dishonest
//
//   modelled  Real mechanics. Something advances, computes or decides
//             on this system's behalf every tick, or a route exposes
//             it. Covered by tests.
//   partial   The mechanism exists but is thin — usually a trait
//             family or a table with no behaviour driving it, or one
//             phase covering two systems' work.
//   slot      **A place to put data, and nothing else.** This level
//             exists because of `infrastructure.type`, whose comment
//             enumerates roads, bridges, rail, water_systems,
//             electricity, internet, hospitals, schools, public_safety
//             and waste_management. A row CAN carry any of those, and
//             nothing in the engine reads the distinction. Counting
//             those ten as built would have taken §7 from ~25 to ~33
//             on the strength of a comment on a TEXT column.
//   absent    No representation. Must cite nothing — the test enforces
//             that, so "absent" cannot be a lazy label on something
//             that does exist.
//
// A `slot` is closer to absent than to built, and the summary counts
// it separately rather than folding it either way.

'use strict';

const SYSTEMS = [
  {
    n: 1,
    name: 'Population',
    level: 'modelled',
    tables: ['npcs', 'entities', 'families', 'households', 'migration_events'],
    phases: ['runMigrationPhase'],
    functions: ['generateNPC', 'generateFamily', 'addFamilyMember'],
    note: 'Births, households and movement all advance. Aging and death are not modelled.',
  },
  {
    n: 2,
    name: 'Housing',
    level: 'modelled',
    tables: ['properties', 'ownership_records', 'households'],
    functions: ['generateProperty', 'advancePropertyLifecycle'],
    note: 'Occupancy and lifecycle are real. Vacancy and abandonment as distinct states are not.',
  },
  {
    n: 3,
    name: 'Economy',
    level: 'modelled',
    tables: ['economy_snapshots', 'market_listings', 'individual_finances', 'investments'],
    phases: ['runEconomyPhase'],
    traitFamilies: ['economic'],
    functions: ['resolveMarketPrice', 'getScarcity', 'getNetWorth'],
  },
  {
    n: 4,
    name: 'Employment',
    level: 'partial',
    tables: ['employment_records'],
    note: 'Records exist. No wage dynamics, no unemployment rate driving anything.',
  },
  {
    n: 5,
    name: 'Education',
    level: 'partial',
    traitFamilies: ['educational'],
    infrastructureTypes: ['schools'],
    note: 'Four traits and a slot. No schools, teachers, literacy or libraries as entities — '
      + 'and the knowledge tiers of §25 are absent entirely.',
  },
  {
    n: 6,
    name: 'Health',
    level: 'partial',
    traitFamilies: ['health'],
    infrastructureTypes: ['hospitals'],
    note: 'Four traits and a slot. No disease, no medical knowledge loss and recovery.',
  },
  {
    n: 7,
    name: 'Transportation',
    level: 'slot',
    infrastructureTypes: ['roads', 'bridges', 'rail'],
    deferred: true,
    note: 'Three infrastructure types and nothing that moves. **Deferred, not missed** — '
      + 'CLAUDE.md puts Transportation on its explicit do-not-touch list, and its Phase 2 note '
      + 'says movement/trade routes "stays deferred under Transportation rather than being an '
      + 'open gap". §44 of the spec asks for it and §94 needs it for "playable"; that tension '
      + 'is the owner\'s to resolve, not something to quietly build.',
  },
  {
    n: 8,
    name: 'Infrastructure',
    level: 'modelled',
    tables: ['infrastructure'],
    phases: ['runReemergencePhase'],
    functions: ['getCityReemergence'],
    note: 'Recovery is computed per city. Outages and failure_risk are stored, not driven.',
  },
  {
    n: 9,
    name: 'Energy',
    level: 'slot',
    infrastructureTypes: ['electricity'],
    note: 'One infrastructure type. §40 names electricity as the head of the whole '
      + 'bottleneck chain, and technology_eras carries that dependency instead.',
  },
  {
    n: 10,
    name: 'Food Supply',
    level: 'partial',
    tables: ['resources'],
    functions: ['advanceResourceTick'],
    note: 'Food is a resource with scarcity, and drought cascades to it — '
      + 'see test/drought-cascade.test.js. No production or distribution chain.',
  },
  {
    n: 11,
    name: 'Water',
    level: 'partial',
    tables: ['resources'],
    infrastructureTypes: ['water_systems'],
    functions: ['advanceResourceTick'],
  },
  {
    n: 12,
    name: 'Waste',
    level: 'slot',
    infrastructureTypes: ['waste_management'],
  },
  {
    n: 13,
    name: 'Law Enforcement',
    level: 'partial',
    phases: ['runSecurityPhase'],
    infrastructureTypes: ['public_safety'],
    note: 'One phase covers this and Crime together. No patrols, investigations, raids, '
      + 'arrests or clearance rates.',
  },
  {
    n: 14,
    name: 'Crime',
    level: 'partial',
    phases: ['runSecurityPhase'],
    traitFamilies: ['criminal'],
    note: 'Same phase as Law Enforcement. No crime density, retaliation or hotspots.',
  },
  {
    n: 15,
    name: 'Gang',
    level: 'partial',
    tables: ['factions', 'organizations', 'entity_organization_memberships'],
    traitFamilies: ['faction'],
    note: 'Factions are real and carry a full trait sheet. The hierarchy of §14 '
      + '(shot callers through juveniles) is not enumerated.',
  },
  {
    n: 16,
    name: 'Organized Crime',
    level: 'partial',
    tables: ['factions'],
    traitFamilies: ['criminal', 'faction'],
    note: 'Not distinguished from Gang in the model.',
  },
  {
    n: 17,
    name: 'Court',
    level: 'partial',
    tables: ['laws'],
    note: 'Laws exist. No courts, cases or judgements.',
  },
  {
    n: 18,
    name: 'Prison',
    level: 'absent',
    note: '§17 lists `imprisoned` as an NPC status. Searched: the string appears nowhere '
      + 'in the schema or under server/. Nothing incarcerates anybody.',
  },
  {
    n: 19,
    name: 'Political',
    level: 'modelled',
    tables: ['governments', 'elections', 'votes', 'laws', 'public_opinion', 'revolutions'],
    note: 'Six tables. The six-stage progression of §63 (informal rules upward) is not built.',
  },
  {
    n: 20,
    name: 'Government Services',
    level: 'absent',
  },
  {
    n: 21,
    name: 'Fire & Emergency',
    level: 'slot',
    infrastructureTypes: ['public_safety'],
    note: 'Shares the public_safety slot with policing; nothing separates them.',
  },
  {
    n: 22,
    name: 'Communication',
    level: 'partial',
    tables: ['entity_knowledge'],
    infrastructureTypes: ['internet'],
    functions: ['addKnowledge', 'getKnowledge'],
    note: 'This is the genuine word-of-mouth layer: per-entity facts with confidence_level, '
      + 'spread_rate, distortion_level and a source. Radio and networks are not modelled.',
  },
  {
    n: 23,
    name: 'Media',
    level: 'absent',
    note: 'No news, no radio, no bulletins. §61 describes it; nothing implements it.',
  },
  {
    n: 24,
    name: 'Social Media',
    level: 'absent',
    note: 'Correctly absent in a collapse setting until §39 reemergence restores networks — '
      + 'but nothing models that restoration either.',
  },
  {
    n: 25,
    name: 'Cultural',
    level: 'modelled',
    tables: ['cultures', 'culture_memberships'],
    functions: ['generateCulture', 'attachCulture', 'getCultureFor', 'getCultureMembers'],
  },
  {
    n: 26,
    name: 'Religion',
    level: 'partial',
    tables: ['beliefs', 'values_db'],
    note: 'Beliefs and values are per-entity. No religious institutions or practice.',
  },
  {
    n: 27,
    name: 'Community Organizations',
    level: 'modelled',
    tables: ['organizations', 'communities'],
    phases: ['runOrganizationPhase'],
    functions: ['generateOrganization', 'generateCommunity', 'getCommunityHealth'],
  },
  {
    n: 28,
    name: 'Business',
    level: 'partial',
    tables: ['businesses', 'market_listings'],
    note: 'Businesses are entities that trade. Formation, growth and failure are not driven.',
  },
  {
    n: 29,
    name: 'Real Estate',
    level: 'modelled',
    tables: ['properties', 'ownership_records'],
    functions: ['currentPropertyValue', 'recordOwnership', 'getOwnershipHistory', 'getHoldings'],
    note: 'Value, transfer and full ownership history. One of the most complete systems here.',
  },
  {
    n: 30,
    name: 'Construction',
    level: 'partial',
    functions: ['advancePropertyLifecycle'],
    note: 'Condition advances over time. Nothing is built by anyone.',
  },
  {
    n: 31,
    name: 'Environmental',
    level: 'modelled',
    tables: ['environment_state'],
    phases: ['runEnvironmentPhase'],
    traitFamilies: ['environmental'],
    functions: ['addEnvironmentalCondition'],
  },
  {
    n: 32,
    name: 'Weather',
    level: 'partial',
    tables: ['environment_state'],
    phases: ['runEnvironmentPhase'],
    note: 'Conditions exist and drive consequences. Temperature, rain, snow and season '
      + 'specifically are not modelled — §45 has no seasons either.',
  },
  {
    n: 33,
    name: 'Disaster',
    level: 'partial',
    tables: ['events'],
    phases: ['runEventPhase'],
    note: 'Drought is real and cascades. Fires, floods and blackouts are not distinct.',
  },
  {
    n: 34,
    name: 'Supply Chain',
    level: 'partial',
    tables: ['trade_routes'],
    deferred: true,
    note: 'A table. No routes, hubs, lanes or transport tiers — and trade routes fall under '
      + 'the same Transportation deferral as system 7.',
  },
  {
    n: 35,
    name: 'Military / National Guard',
    level: 'absent',
  },
  {
    n: 36,
    name: 'Tourism',
    level: 'absent',
  },
  {
    n: 37,
    name: 'Technology',
    level: 'modelled',
    tables: ['technology_eras', 'civilization_technology_progress'],
    phases: ['runReemergencePhase'],
    traitFamilies: ['technology'],
    note: 'Ten named eras with a requirements chain — this is §40 bottleneck logic, built.',
  },
  {
    n: 38,
    name: 'Migration',
    level: 'modelled',
    tables: ['migration_events'],
    phases: ['runMigrationPhase'],
  },
  {
    n: 39,
    name: 'Reputation',
    level: 'partial',
    tables: ['public_opinion'],
    traitFamilies: ['reputation'],
    note: 'Four traits and public opinion. The influence radius and decay §15 asks for '
      + 'specifically are absent.',
  },
  {
    n: 40,
    name: 'AI Decision',
    level: 'modelled',
    phases: ['runDecisionPhase'],
    traitFamilies: ['behavioral', 'psychological'],
    functions: ['dispatchAction', 'listActions', 'getEntityState', 'applyStress', 'runBehavior'],
    note: 'Decisions read the live trait sheet, and two in-code assertions '
      + '(assertBehaviorReadsRealTraits, assertDisciplinesReadRealTraits) fail if that stops '
      + 'being true — which is what keeps §82 honest.',
  },
];

const LEVELS = ['modelled', 'partial', 'slot', 'absent'];

// The counts, derived rather than written down. Quoted by the
// implementation map, and the test asserts the map is not stale.
function summarise() {
  const counts = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  for (const s of SYSTEMS) counts[s.level] += 1;
  // `deferred` is reported alongside the levels rather than as one of
  // them, because it answers a different question. A level says how
  // much exists; deferred says whether the project has decided not to
  // build it. A reader planning work needs both, and conflating them
  // would make a closed scope decision look like an open gap.
  return {
    total: SYSTEMS.length,
    ...counts,
    deferred: SYSTEMS.filter((s) => s.deferred).length,
  };
}

function byLevel(level) {
  return SYSTEMS.filter((s) => s.level === level);
}

function getSystem(n) {
  return SYSTEMS.find((s) => s.n === n) || null;
}

// Every identifier this file claims, flattened, so the test can check
// each one against the thing that actually defines it.
function citations() {
  const out = { tables: new Set(), phases: new Set(), traitFamilies: new Set(), functions: new Set(), infrastructureTypes: new Set() };
  for (const s of SYSTEMS) {
    for (const key of Object.keys(out)) {
      for (const value of s[key] || []) out[key].add(value);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

module.exports = { SYSTEMS, LEVELS, summarise, byLevel, getSystem, citations };
