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
//   slot      **Storage exists and nothing reads it.** Two shapes, and
//             both were found by checking rather than by reading:
//
//             `infrastructure.type` carries a comment enumerating
//             roads, bridges, rail, water_systems, electricity,
//             internet, hospitals, schools, public_safety and
//             waste_management. A row CAN carry any of those and
//             nothing in the engine reads the distinction — it is a
//             TEXT column with a comment, not an enum or a CHECK.
//
//             And **18 of the tables cited in the first version of
//             this file are not touched by any engine code at all**,
//             with `migrate.js`/`restore.js` excluded (they handle
//             every table by definition) and comments stripped (so a
//             header saying "X is NOT built" does not count as using
//             X). Those are the `schemaOnly` field below.
//   absent    No representation. Must cite nothing — the test enforces
//             that, so "absent" cannot be a lazy label on something
//             that does exist.
//
// A `slot` is closer to absent than to built, and the summary counts
// it separately rather than folding it either way.
//
// ---------------------------------------------------------------------
// `tables` vs `schemaOnly`, and why the split had to exist
//
// **The first version of this file cited table definitions as evidence
// that a system was built, and the test could not catch it** — checking
// that a table exists in `VACANCY_POSTGRESQL_SCHEMA.sql` proves the
// schema defines it, not that anything uses it. Political was marked
// `modelled` on the strength of six tables (governments, elections,
// votes, laws, public_opinion, revolutions) and **no engine code
// touches any of them.** Technology was marked `modelled`, and with it
// a claim that §40's bottleneck chain was built; `technology_eras` and
// `civilization_technology_progress` are equally untouched.
//
// So: `tables` means the engine reads or writes it, and `schemaOnly`
// means the schema defines it and nothing does. The test asserts both
// directions — a `tables` entry no code touches fails, and a
// `schemaOnly` entry that code DOES touch fails too, so the label
// cannot rot as the engine grows into a table.
//
// `environment_state` is the instructive one. It is `schemaOnly`, yet
// Environmental is still `modelled`: `runEnvironmentPhase` is real and
// mutates resources every tick — it just works on
// `worldState.activeConditions` rather than that table. The mechanics
// were never in doubt; the citation was simply wrong.

'use strict';

const SYSTEMS = [
  {
    n: 1,
    name: 'Population',
    level: 'modelled',
    tables: ['npcs', 'entities', 'families', 'historical_records', 'households', 'migration_events'],
    phases: ['runMigrationPhase'],
    functions: [
      'generateNPC', 'generateFamily', 'addFamilyMember',
      'ageInYears', 'runMortality', 'recordDeath', 'killEntity',
      'bearChild', 'runBirths', 'fertilePartnerships',
    ],
    note: '**Aging and death built 12 Sep 2026.** Before that `property.age` was the only '
      + 'thing in the engine that incremented — buildings decayed and people were immortal. '
      + 'Age is computed from `createdTick` (a tick is a day); death moves the row out of '
      + '`worldState.npcs` rather than setting a flag, so a corpse is structurally incapable '
      + 'of working or voting; and every death is a seeded draw, so §88\'s world seed still '
      + 'replays. **Births followed on 12 Sep 2026** and closed the other end: a population that '
      + 'could only shrink now bears children who inherit their parents\' live traits, and '
      + '`npcs.generation` — 1 for every NPC in every world because nothing could advance it '
      + '— moves. **`households` became live on 16 Sep 2026** — and building it found that '
      + 'nobody in any generated world had ever lived with anybody, because homes were handed '
      + 'out one per person by array index: 40 households of size 1, a solo rate of 100%. '
      + '**`migration_events` became live on 16 Sep 2026** — the phase computed a risk '
      + 'from two traits and said in its own event text that no relocation system was built. '
      + 'Now driven by unmet needs rather than disposition.',
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
    tables: ['market_listings', 'individual_finances', 'resources'],
    schemaOnly: ['economy_snapshots', 'investments'],
    phases: ['runEconomyPhase'],
    traitFamilies: ['economic'],
    functions: ['resolveMarketPrice', 'getScarcity', 'getNetWorth'],
  },
  {
    n: 4,
    name: 'Employment',
    level: 'modelled',
    tables: ['employment_records'],
    phases: ['runEconomyPhase'],
    functions: ['hireEntity', 'endEmployment', 'runPayroll', 'getEmploymentRate'],
    note: '**Built 12 Sep 2026, and it was the first `slot` taken off this list.** It was '
      + '`partial` on the strength of a table definition, then `slot` once the citation was '
      + 'checked — `economy.js` said in its own header that employment_records was "NOT built '
      + 'here... a natural follow-up". Payroll now runs inside the Economy phase and moves '
      + 'real money: a wage leaves the employer organization\'s `assets`, lands in the '
      + 'employee\'s `individual_finances`, and is recorded in the employer\'s `expenses`. An '
      + 'employer that cannot cover it does not pay and emits `payroll_missed`.',
  },
  {
    n: 5,
    name: 'Education',
    level: 'partial',
    tables: ['infrastructure'],
    traitFamilies: ['educational'],
    infrastructureTypes: ['schools'],
    note: 'Schools now exist as infrastructure with a capacity and a condition that decays, '
      + 'and educational ATTAINMENT is a real per-area statistic (npcs.education, via '
      + 'demographics.compositionOf). Still partial: no teachers, no enrolment, nobody to '
      + 'drop out OF, and the knowledge tiers of §25 are absent entirely.',
  },
  {
    n: 6,
    name: 'Health',
    level: 'modelled',
    traitFamilies: ['health'],
    infrastructureTypes: ['hospitals'],
    functions: ['vitalityOf', 'addDiseaseOutbreak', 'diseasePressure', 'annualDeathRisk'],
    note: '**Built 12 Sep 2026 with mortality.** All four health traits — Immune Response, '
      + 'Nutrition Status, Chronic Conditions, Sleep Quality — now drive something: they were '
      + 'generated on every NPC and read by nothing, exactly like `combat` and `sports` before '
      + '`contest.js`. Disease is an epidemic expressed as an environmental condition, so '
      + '`runEnvironmentPhase` ages and clears it like a drought. Still missing: medical '
      + 'knowledge loss and recovery, and hospitals as anything but an infrastructure slot.',
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
    tables: ['infrastructure', 'beliefs'],
    infrastructureTypes: ['public_safety'],
    note: 'Investigations, clearance rates and patrol presence are real — capacity is the '
      + 'public_safety infrastructure a city has, in the condition it is in, so a city that '
      + 'lets it decay clears fewer crimes with no second mechanism. Trust is measured from '
      + 'residents\' beliefs rather than derived from the clearance rate. Still partial, and '
      + 'the boundary is deliberate: clearance is NOT arrest. §7 Prison is absent and '
      + '`imprisoned` was not added as an entity status, so raids, arrests and sentencing '
      + 'would need somewhere to put people first.',
  },
  {
    n: 14,
    name: 'Crime',
    level: 'modelled',
    phases: ['runSecurityPhase'],
    tables: ['crime_incidents'],
    traitFamilies: ['criminal'],
    note: 'Typed incidents with a category, a perpetrator, a victim and a community — '
      + '§9\'s seven categories are countable per area and four of them are generated. '
      + 'Density is derivable (crime.ratePer1k); retaliation and hotspots are not, and '
      + 'both want the heat model Law Enforcement is still missing.',
  },
  {
    n: 15,
    name: 'Gang',
    level: 'partial',
    tables: ['factions', 'organizations', 'entity_organization_memberships'],
    traitFamilies: ['faction'],
    note: 'Factions are real and carry a full trait sheet, and membership is now a live '
      + 'table rather than a schema-only one — so gang membership PER AREA is derivable '
      + '(membership.gangMembershipRate), not just faction control of a block. The '
      + 'hierarchy of §14 (shot callers through juveniles) is still not enumerated: '
      + 'role_in_org is open TEXT and no document names the tiers.',
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
    functions: ['enactLaw', 'repealLaw', 'listLaws'],
    note: 'Laws are enacted, repealed and queried by jurisdiction. **No courts, cases or '
      + 'judgements** — nothing applies a law to anybody, so this is legislation without '
      + 'adjudication. `runSecurityPhase` does not read `laws`.',
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
    tables: [
      'governments', 'elections', 'votes', 'laws', 'public_opinion', 'revolutions', 'beliefs',
    ],
    phases: ['runOrganizationPhase'],
    functions: [
      'foundGovernment', 'enactLaw', 'repealLaw', 'scheduleElection', 'castVote',
      'closeElection', 'computeApproval', 'assessRevolutions', 'resolveRevolution', 'runPolitics',
    ],
    note: '**Built 12 Sep 2026 — it was the largest dead spot in the schema.** Six tables, no '
      + 'code: marked `modelled` on their definitions alone, corrected to `slot` once the '
      + 'citations were checked, and now real. `server/politics.js`, running inside the '
      + 'Organization phase because a government is an organization subtype (standing rule 4, '
      + 'and the schema\'s own primary key). Approval is a rollup computed from '
      + '`entity_knowledge` exactly as `public_opinion`\'s schema comment demands, and a '
      + 'revolution needs low approval AND enough of the population informed — the '
      + '"Public Opinion + Information Spread + Government" mechanic `revolutions` asks for. '
      + 'What is still not built is §63\'s six-stage progression from informal rules upward.',
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
    functions: ['adoptBelief', 'shiftBelief', 'getBeliefs', 'summariseBelief',
      'generateValues', 'rankValues', 'topValue'],
    note: '`beliefs` became live on 12 Sep 2026 — `religious` is one of its six types, so a '
      + 'religious conviction is now a real thing an entity holds, at a strength that moves. '
      + '**Still partial**: no religious institutions, no practice, no clergy, and nothing '
      + 'religious drives a decision. '
      + '`values_db` was schema-only here on the stated grounds that "no source document gives '
      + 'value distributions, so a generator would be fifteen invented numbers per person" — '
      + 'and that objection was wrong twice over. The fifteen VALUE NAMES are given outright by '
      + '`VACANCY_TRAIT_DATABASE_ATTACHMENT.md` under "Value System DNA", and a distribution is '
      + 'invented for every trait in this engine too: `randomTraitValue` draws them from a '
      + 'flagged range, and values now draw the same way from the seeded generator. Live since '
      + '`server/motivation.js`. The LEVEL stays partial, because a person having values does '
      + 'not give this world a religion.',
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
    phases: ['runEnvironmentPhase'],
    traitFamilies: ['environmental'],
    tables: ['environment_state'],
    functions: ['addEnvironmentalCondition', 'runEnvironment'],
    note: 'Was modelled despite its table being schema-only — the phase was real and mutated '
      + 'resource supply every tick, working on `worldState.activeConditions`, a global '
      + 'in-memory list with no table. **The table became real on 17 Sep 2026** and closed a '
      + 'durability hole rather than a cosmetic one: a world checkpointed mid-drought came '
      + 'back with the drought gone and the resources still depressed.',
  },
  {
    n: 32,
    name: 'Weather',
    level: 'partial',
    tables: ['environment_state'],
    phases: ['runEnvironmentPhase'],
    functions: ['runEnvironment', 'drawWeather', 'describeEnvironment'],
    note: 'Every city now has a climate it keeps and a weather that turns on a weekly spell, '
      + 'and severe weather produces the SAME condition a drought or an epidemic does rather '
      + 'than a second effect channel. **Still partial**: there is no temperature, no snow '
      + 'depth and no season — §45 has no seasons either, which is also why '
      + '`migration_type: seasonal` is declared unmodelled. Calibration is worth recording: '
      + 'the first weights made severe weather three spells in five, which produced nine real '
      + 'scarcity crossings and ninety fear spikes in 120 ticks and tripped the event-noise '
      + 'guard. Roughly one in five now.',
  },
  {
    n: 33,
    name: 'Disaster',
    level: 'partial',
    tables: ['events'],
    phases: ['runEventPhase'],
    functions: ['addDiseaseOutbreak'],
    note: 'Drought is real and cascades; epidemics are real and kill people. Fires, floods '
      + 'and blackouts are still not distinct.',
  },
  {
    n: 34,
    name: 'Supply Chain',
    level: 'slot',
    schemaOnly: ['trade_routes'],
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
    tables: ['technology_eras', 'civilization_technology_progress', 'civilizations'],
    phases: ['runReemergencePhase'],
    traitFamilies: ['technology'],
    functions: ['seedTechnologyEras', 'canUnlock', 'unlockEra', 'nextEraFor', 'runTechnology'],
    note: '**Built 12 Sep 2026, after two wrong labels.** Said "modelled" first because ten '
      + 'eras with a `requirements` column are defined; corrected to `partial` when the '
      + 'citations were checked and neither table turned out to be read by anything — so §40\'s '
      + 'bottleneck logic was a column where a dependency chain could go. Now real: an era '
      + 'needs its prerequisite era AND a population whose reemergence index clears the level '
      + 'it asks for, and `canUnlock` returns WHY it refused rather than a bare boolean. One '
      + 'era per tick, so a world that crosses a threshold does not jump from stone tools to '
      + 'computing in a single tick.',
  },
  {
    n: 38,
    name: 'Migration',
    level: 'modelled',
    tables: ['migration_events', 'regions'],
    phases: ['runMigrationPhase'],
    functions: ['pushFor', 'destinationFor', 'relocate', 'runMigration', 'netRatePer1k'],
    note: '**Modelled since 16 Sep 2026, and the previous note was wrong in its first three '
      + 'words.** It said "The phase moves people" — the phase computed a migration RISK from '
      + 'Volatility and Resource Hoarding and its own event text ended "no relocation system '
      + 'built yet". Nobody went anywhere, and `migration_events` recorded nothing because '
      + 'there was nothing to record. Now: unmet housing, safety, income or food pushes; a '
      + 'destination is scored on danger AND work, so an income move goes somewhere with jobs; '
      + 'traits decide only WHO goes under equal pressure; and residency is rewritten, which '
      + '`households` and `areaStats` both follow. Three of the seven `migration_type` values '
      + 'are declared unmodelled rather than faked — there is no commute, no season and no '
      + 'return. `migration_rate` was a declared statistics gap and is now computed.',
  },
  {
    n: 39,
    name: 'Reputation',
    level: 'partial',
    tables: ['public_opinion'],
    traitFamilies: ['reputation'],
    functions: ['computeApproval', 'latestOpinion'],
    note: '`public_opinion` became live when politics was built — approval is computed per '
      + 'topic from `entity_knowledge` and snapshotted per tick. Still partial: the four '
      + 'reputation traits drive nothing, and the influence RADIUS and DECAY §15 asks for '
      + 'specifically are absent, so reputation does not spread or fade with distance.',
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
  const out = {
    tables: new Set(), schemaOnly: new Set(), phases: new Set(),
    traitFamilies: new Set(), functions: new Set(), infrastructureTypes: new Set(),
  };
  for (const s of SYSTEMS) {
    for (const key of Object.keys(out)) {
      for (const value of s[key] || []) out[key].add(value);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

module.exports = { SYSTEMS, LEVELS, summarise, byLevel, getSystem, citations };
