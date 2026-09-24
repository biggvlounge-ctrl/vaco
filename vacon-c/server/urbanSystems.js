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
    functions: ['hireEntity', 'endEmployment', 'runPayroll', 'runLabour', 'getEmploymentRate'],
    note: '**Built 12 Sep 2026, and it was the first `slot` taken off this list.** It was '
      + '`partial` on the strength of a table definition, then `slot` once the citation was '
      + 'checked — `economy.js` said in its own header that employment_records was "NOT built '
      + 'here... a natural follow-up". Payroll now runs inside the Economy phase and moves '
      + 'real money: a wage leaves the employer organization\'s `assets`, lands in the '
      + 'employee\'s `individual_finances`, and is recorded in the employer\'s `expenses`. An '
      + 'employer that cannot cover it does not pay and emits `payroll_missed`. '
      + '**And there is a labour market now, added 17 Sep 2026 after a playtest rather than a '
      + 'test.** `hireEntity` was called exactly once in the whole engine — by `worldgen`, at '
      + 'generation — while `justice.imprison` and death both took people out of work, so '
      + 'employment could only ever shrink: a child born into the world could never hold a '
      + 'job and a released prisoner could never work again. Measured over 400 ticks, 55 jobs '
      + 'down to 51 with the only direction down. `runLabour` hires whoever can cover their '
      + 'own wage — `1 / WAGE_TO_OUTPUT`, the reciprocal of a constant this file already had '
      + 'rather than a threshold chosen for the occasion — and lays somebody off wherever '
      + 'payroll was missed, so the unemployment rate falls out of the population\'s own trait '
      + 'distribution. 55 jobs to ~105 and then steady across the same 400 ticks. '
      + '**And the jobs have names now, 17 Sep 2026.** `employment_records.position` was '
      + 'accepted by `hireEntity`, named in its signature, migrated and restored — and '
      + 'written by no caller anywhere, so every job in every world this engine ever ran was '
      + 'untitled. `server/occupations.js` is §25\'s own subject lists turned into the people '
      + 'who practise them, gated on attainment for the TIER and never for the hire, and '
      + 'drawn against a `1 / tier` pyramid: the first version handed everybody the best post '
      + 'they qualified for and built a settlement of eight engineers, eight navigators and '
      + 'no labourers at all (mean tier 3.44), which is standing rule 12\'s third clause. '
      + 'Measured after: 24/17/9/4 across Tiers 1-4, mean 1.95, 19 of 34 positions held at '
      + 'generation.',
  },
  {
    n: 5,
    name: 'Education',
    level: 'partial',
    tables: ['infrastructure'],
    traitFamilies: ['educational'],
    infrastructureTypes: ['schools'],
    functions: ['runSchooling'],
    note: 'Schools exist as infrastructure with a capacity and a condition that decays, '
      + 'educational ATTAINMENT is a real per-area statistic (npcs.education, via '
      + 'demographics.compositionOf), and **attainment now moves** — `statecraft.runSchooling` '
      + 'walks residents of school age up `demographics.EDUCATION_LEVELS` at a rate set by '
      + 'what the state funded that city\'s schools at, and stops entirely while the schools '
      + 'are failed. Until 17 Sep 2026 `npcs.education` was decided at generation and never '
      + 'changed, which is why `infrastructure.js` had to DECLARE that it could give `schools` '
      + 'no outage effect: there was no per-tick education mechanism for an outage to '
      + 'interrupt. There is now. **§25\'s seven knowledge tiers are no longer absent** — '
      + '`occupations.KNOWLEDGE_TIERS` carries them with the spec\'s own subject lists, every '
      + 'occupation sits on one, attainment is what makes a tier reachable, and '
      + '`mean_knowledge_tier` measures where an area\'s work actually sits. A city\'s school '
      + 'is also an ORGANIZATION now (`CITY_INSTITUTIONS` in worldgen) and it employs a '
      + 'teacher, which is the first teacher this engine has ever had. **And §24 KNOWLEDGE '
      + 'RECOVERY is built, 18 Sep 2026** — `server/knowledge.js` carries its ten named '
      + 'sources and nine unlockable fields, a generated world contains nine of the ten, and '
      + 'studying moves three things that already had readers: the field\'s `skills` trait, '
      + 'the `educational` family that `technology.learningOf` averages to decide whether a '
      + 'civilization can recover an era, and `npcs.education` for the self-taught. That last '
      + 'one is the gap that mattered: `runSchooling` refuses anybody outside 5-30 or in a '
      + 'city whose schools are unfunded, so an adult in a collapsed settlement could never '
      + 'learn anything again for the rest of their life however many books were lying '
      + 'around. Still partial: no enrolment roll and nobody to drop out OF.',
  },
  {
    n: 6,
    name: 'Health',
    level: 'modelled',
    traitFamilies: ['health'],
    infrastructureTypes: ['hospitals'],
    functions: ['vitalityOf', 'addDiseaseOutbreak', 'diseasePressure', 'annualDeathRisk',
      'meanHealthTrait', 'chronicConditionShare', 'meanExertion'],
    note: '**Built 12 Sep 2026 with mortality, and made visible 17 Sep with server/health.js.** '
      + 'All four health traits — Immune Response, Nutrition Status, Chronic Conditions, Sleep '
      + 'Quality — drive mortality AND can now be reported: for a long time `vitalityOf` was '
      + 'their only reader anywhere, so a population\'s health existed as a number nobody could '
      + 'see. Disease is an epidemic expressed as an environmental condition, so '
      + '`runEnvironmentPhase` ages and clears it like a drought. Still missing: medical '
      + 'knowledge loss and recovery, and hospitals as anything but an infrastructure slot — '
      + 'and body composition, which is a DECLARED absence rather than a gap (see '
      + '`statistics.js`\'s `body_composition` for the measurements that took it back out).',
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
    level: 'modelled',
    infrastructureTypes: ['electricity'],
    tables: ['resources'],
    functions: ['failInfrastructure', 'repairInfrastructure', 'repairTicks',
      'productivityOf', 'energyFactor'],
    note: 'Was `slot`, then `partial` once a grid could fail and the outage moved `resources` '
      + 'supply for `energy` — and stopped there, because nothing consumed it: a city at zero '
      + 'supply behaved exactly like one at full supply. `economy.energyFactor` is the first '
      + 'reader, 24 Sep 2026, folded into `productivityOf` as an economic input the way health '
      + 'and focus already are — centred at 1.0 for supply meeting demand, the same 0.75..1.25 '
      + 'band, for the same reason: a modifier off-centre from the trait scale\'s own centre '
      + 'silently revalues the ordinary case. It is a production term rather than a sixteenth '
      + '`motivation.js` need, because that vocabulary is a closed, documented fifteen and '
      + 'electricity is not one of them. Measured end to end on a generated world: failing a '
      + 'city\'s grid and running 20 ticks took a real worker\'s productivity from 1.556 to '
      + '1.156. §40 names electricity as the head of the whole bottleneck chain; this is the '
      + 'first link a person actually feels.',
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
    level: 'modelled',
    tables: ['resources'],
    infrastructureTypes: ['water_systems'],
    functions: ['advanceResourceTick', 'failInfrastructure', 'repairInfrastructure'],
    note: '**The one utility that is felt end to end.** The resource has supply, demand and '
      + 'scarcity; `motivation.SATISFIERS.water` reads it, so how much water a settlement has '
      + 'reaches every person in it; drought moves it through the condition channel; and the '
      + 'pipes themselves can now fail, which takes the supply off for as long as the city '
      + 'takes to repair them. Measured: a burst main in an underfunded city ran 40 ticks and '
      + 'took the supply from 100 to 72 in the first seven. What is still absent is a '
      + 'distribution network — water is a city-wide quantity, so one neighbourhood cannot go '
      + 'dry while the next one does not.',
  },
  {
    n: 12,
    name: 'Waste',
    level: 'partial',
    infrastructureTypes: ['waste_management'],
    functions: ['failInfrastructure', 'addDiseaseOutbreak'],
    note: 'Was `slot`. Sanitation failing is the oldest epidemic there is, and it goes through '
      + 'the channel that already exists — `mortality.addDiseaseOutbreak`, whose '
      + '`mortalityMultiplier` `diseasePressure` reads — so a waste system going down actually '
      + 'kills people rather than emitting an event. Measured: disease pressure 1.0 to 1.4 '
      + 'while the system is down. Partial rather than modelled because there is no waste '
      + 'VOLUME: nothing produces refuse, so the system has a condition and a failure and '
      + 'nothing flowing through it.',
  },
  {
    n: 13,
    name: 'Law Enforcement',
    level: 'modelled',
    phases: ['runSecurityPhase'],
    tables: ['infrastructure', 'beliefs', 'court_cases'],
    infrastructureTypes: ['public_safety'],
    functions: ['investigate', 'clearanceRate', 'trustIn', 'runJustice'],
    note: 'Investigations, clearance rates and patrol presence are real — capacity is the '
      + 'public_safety infrastructure a city has, in the condition it is in, so a city that '
      + 'lets it decay clears fewer crimes with no second mechanism. Trust is measured from '
      + 'residents\' beliefs rather than derived from the clearance rate. **The boundary this '
      + 'entry named as deliberate is crossed**: it said "clearance is NOT arrest ... raids, '
      + 'arrests and sentencing would need somewhere to put people first", and '
      + 'server/justice.js is the somewhere — a cleared incident with a named perpetrator is '
      + 'charged, judged against the city\'s actual laws, and sentenced. What is still not '
      + 'modelled is patrol TARGETING: capacity is city-wide, so no block is policed harder '
      + 'than another, and the heat model system 14 asks for is the same absence.',
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
      + 'role_in_org is open TEXT and no document names the tiers. **A faction now pays '
      + 'an enforcer**, which is a different fact from membership — `worldgen` gives each '
      + 'one a founding hire, so `occupations.OCCUPATIONS.enforcer` has an employer and '
      + 'the takeover key\'s composition requirement, which is written in enforcers, can '
      + 'actually be met (server/control.js).',
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
    level: 'modelled',
    tables: ['laws', 'court_cases'],
    functions: ['enactLaw', 'repealLaw', 'listLaws', 'lawCovering', 'judge', 'describeCase'],
    note: 'Laws are enacted, repealed and queried by jurisdiction, and since server/justice.js '
      + 'they are APPLIED: a case cites an active law of the matching category in the '
      + 'jurisdiction the offence happened in, and is dismissed where the city legislated '
      + 'none. This entry read "nothing applies a law to anybody, so this is legislation '
      + 'without adjudication" and `runSecurityPhase` does read `laws` now. **What is '
      + 'deliberately absent is doubt**: this engine records ground truth — '
      + '`crime_incidents.perpetrator_entity_id` is who did it — so there is no evidence, '
      + 'testimony or witness reliability for a verdict to weigh, and a coin dressed as a '
      + 'trial would produce an acquittal rate somebody would read as meaning something. So '
      + 'no wrongful conviction, plea, appeal, bail, probation or parole.',
  },
  {
    n: 18,
    name: 'Prison',
    level: 'partial',
    tables: ['court_cases'],
    functions: ['imprison', 'release', 'incarcerationRate', 'servingCase'],
    note: 'This entry read "§17 lists `imprisoned` as an NPC status. Searched: the string '
      + 'appears nowhere in the schema or under server/. Nothing incarcerates anybody." '
      + 'server/justice.js incarcerates people: the status is real, a sentence runs its '
      + 'length and ends, and being inside costs the job, the routine and a place in the '
      + 'household until release. **Partial rather than modelled because there is no '
      + 'CAPACITY.** infrastructure.INFRASTRUCTURE_TYPES is a fixed ten and none of them is '
      + 'a prison, so nothing can overflow, queue or release early for want of a cell — and '
      + 'PRISON_POPULATION_CENTERS_BREAKS_SCHOOLS.md, which VACANCY_MASTER_SESSION_INDEX.md '
      + '§4 names, is not in this repository, so the numbers that would make capacity real '
      + 'are not available to read. An eleventh infrastructure type invented on a guess '
      + 'would put a made-up capacity under every incarceration statistic.',
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
    level: 'partial',
    tables: ['civilizations', 'infrastructure', 'communities'],
    phases: ['runOrganizationPhase'],
    traitFamilies: ['civilization'],
    infrastructureTypes: ['hospitals', 'schools', 'public_safety'],
    functions: ['budgetOf', 'sharesOf', 'fundingFor', 'deliverTo', 'runSchooling',
      'setPriority', 'runStatecraft'],
    note: '**Built 17 Sep 2026, and it needed no new design.** `VACANCY_TRAIT_DATABASE_'
      + 'ATTACHMENT.md` defines five tier-level trait sheets and the engine had built four; '
      + 'CIVILIZATION_TRAIT_FAMILIES names `healthcare`, `education` and `security` among '
      + 'twenty-one dimensions that existed only in a document. They are the state\'s spending '
      + 'priorities on one budget (`server/tierTraits.js` reconciles all twenty-one against '
      + 'the columns and rollups that already answered seventeen of them), and delivery writes '
      + '`funding` and `maintenance_level` onto each city\'s hospitals, schools and stations '
      + '— **scaled by the mean writ across that city\'s communities**, so the state delivers '
      + 'where it governs and a lawless city\'s services are funded at close to nothing. '
      + 'Partial rather than modelled: `education` reaches an outcome through '
      + '`runSchooling`, and `healthcare` does not. A per-tick treatment mechanism would have '
      + 'to move `health.Chronic Conditions` downward, and nothing in the engine moves it '
      + 'upward, so it would be the sixth one-way ratchet rather than the first health '
      + 'service — declared instead of guessed. Sanitation, public records, licensing and '
      + 'welfare have no substrate at all.',
  },
  {
    n: 21,
    name: 'Fire & Emergency',
    level: 'slot',
    infrastructureTypes: ['public_safety'],
    note: '**Still slot, and deliberately so after the utility pass of 17 Sep 2026.** It shares '
      + 'the `public_safety` row with policing and nothing in the schema separates them — '
      + '`INFRASTRUCTURE_TYPES` is the schema column\'s own enumerated ten and inventing an '
      + 'eleventh would put a made-up capacity under every reading of it, which is the same '
      + 'reason §7 Prison stops at partial for want of a cell count. A public_safety failure '
      + 'also has no outage effect on purpose: `authority.reachTerm` already reads that row\'s '
      + 'condition directly, so a station falling apart already thins the state\'s writ, and '
      + 'an outage condition on top would count it twice.',
  },
  {
    n: 22,
    name: 'Communication',
    level: 'partial',
    tables: ['entity_knowledge'],
    infrastructureTypes: ['internet'],
    phases: ['runSocialPhase'],
    functions: ['addKnowledge', 'getKnowledge', 'runWordOfMouth'],
    note: 'The genuine word-of-mouth layer: per-entity facts with confidence_level, '
      + 'spread_rate, distortion_level and a source. **This entry used to end "radio and '
      + 'networks are not modelled", and two of those four columns had never been written by '
      + 'anything** — `worldStore.addKnowledge` accepted `spreadRate` and `distortionLevel` '
      + 'and no caller anywhere passed either, so no fact in any world had ever been passed '
      + 'from one person to another. `media.runWordOfMouth` moves facts along real '
      + 'relationships now, seeded per telling, degrading with every hand and re-typed as '
      + '`rumor` because a thing a neighbour told you is not a thing you verified. Radio and '
      + 'networks are §7 systems 23 and 24. **And a fact can now be told on purpose, 18 Sep '
      + '2026**: `server/meetings.js` is the spec\'s own `negotiate` / `teach` / `recruit` / '
      + '`form alliance` vocabulary, none of which had a home anywhere in the engine, and a '
      + 'meeting passes what anybody at the table knows to everybody else at it — the one '
      + 'place information moves because people CHOSE to move it rather than leaking outward '
      + 'from a broadcast. Facts about the people in the room are deliberately excluded: a '
      + 'meeting is not an interrogation, and "everybody now knows everything about everybody '
      + 'present" is the total-information sweep that made `computeApproval`\'s spread a '
      + 'constant 1.0. Still partial: there is no telephone, no post and no letter, and a fact '
      + 'told outside a meeting still has no addressee — it spreads to whoever you speak to '
      + 'rather than to whoever you meant to tell.',
  },
  {
    n: 23,
    name: 'Media',
    level: 'modelled',
    tables: ['entity_knowledge', 'organizations'],
    phases: ['runSocialPhase'],
    functions: ['availableChannels', 'bestChannel', 'audienceFor', 'broadcast',
      'runWordOfMouth', 'awarenessOf', 'seatOf'],
    note: '**Built 17 Sep 2026, and it was worth more than a system.** '
      + '`politics.broadcastGovernmentKnowledge` wrote one knowledge row per NPC '
      + 'unconditionally, so the share of a population who had heard of their own government '
      + 'was a constant 1.0 — measured, 153 of 153 — and `assessRevolutions`, which needs '
      + 'approval below 35 AND spread at or above 0.25, had one condition that could never '
      + 'fail. §63\'s "Public Opinion + Information Spread + Government" mechanic was a '
      + 'public-opinion mechanic with a decorative second term. '
      + '`server/media.js` is §61\'s own channel list — word of mouth, bulletins, local news, '
      + 'radio, networks — each gated on the `technology.ERA_NAMES` entry that makes it '
      + 'possible, which is §61\'s sentence "in the reset era, communication should begin '
      + 'locally and reemerge technologically over time" needing no invented tech tree. An '
      + 'outlet is an `organizations.type = media` row (standing rule 4; the type was already '
      + 'in the schema\'s own enumeration) and its `influence` sets how much of a channel\'s '
      + 'audience it reaches. A government announces from the building it operates — '
      + '`properties.operating_organization_id`, the schema\'s own link — and the news '
      + 'travels. Measured on one world: awareness 0.2 at founding, still 0.2 fifty ticks '
      + 'later, 1.0 once radio came back.',
  },
  {
    n: 24,
    name: 'Social Media',
    level: 'partial',
    tables: ['entity_knowledge'],
    infrastructureTypes: ['internet'],
    functions: ['availableChannels', 'runWordOfMouth'],
    note: '**The restoration this entry said nobody modelled is modelled now.** It was '
      + '"correctly absent in a collapse setting until §39 reemergence restores networks — '
      + 'but nothing models that restoration either", and the restoration turned out to need '
      + 'nothing new: `media.CHANNELS.social_media` requires the `computing` era AND a '
      + 'standing, unfailed `internet` site, so §39 reemergence climbing the era ladder is '
      + 'what brings it back. World reach, and the only channel besides word of mouth that '
      + 'carries a `spread_rate` — a network where every recipient is also a repeater is '
      + 'structurally retelling, which is also why its distortion sits above print\'s. '
      + 'Partial rather than modelled: there is no platform, no account, no feed and no post. '
      + 'A fact reaches a population through it; nobody publishes, follows or replies, and '
      + '§7\'s Media half is where the outlet actually lives.',
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
    functions: ['runLabour'],
    note: 'Businesses are entities that trade, they hire and lay off through `runLabour`, and '
      + 'their takings and wage bill move real money. **Still partial, and for the reason this '
      + 'entry always gave: formation, growth and failure are not driven.** No business is '
      + 'ever founded or wound up in a running world — `worldgen` makes them all and the set '
      + 'never changes. Note what did NOT close this: `server/trade.js` reached '
      + '`barter.exchange` for the first time in any generated world, but that is trade '
      + 'between PEOPLE. A business is not a party to it.',
  },
  {
    n: 29,
    name: 'Real Estate',
    level: 'modelled',
    tables: ['properties', 'ownership_records'],
    functions: ['currentPropertyValue', 'recordOwnership', 'getOwnershipHistory', 'getHoldings',
      'compositionFor', 'attempt'],
    note: 'Value, transfer and full ownership history. One of the most complete systems here. '
      + '**And property now changes hands by force as well as by purchase, 17 Sep 2026** — '
      + '`server/control.js` is COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md\'s takeover key, '
      + 'and a successful one writes an `ownership_records` row with the schema\'s own '
      + '`stolen` acquisition method. Note what this does NOT close: the same file has to '
      + 'DECLARE that `infrastructure`, `cities` and `civilizations` have no control column '
      + 'anywhere in the schema, and that `territory_blocks.faction_id` references '
      + '`factions(organization_id)` specifically — so a FAMILY taking a block has nowhere '
      + 'to be written. Real estate is the one rung of the six where the record exists. '
      + '**And taking a place now comes with what is in it, 18 Sep 2026** — '
      + '`server/merchandise.js` honours COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md\'s '
      + '`merchandiseAccessGranted: true`, which was stated as confirmed and built '
      + 'nowhere, so a captured hardware store yielded a hardware store and not one '
      + 'hammer. Measured: a tribe went from 3 tools to 15 by taking one shop, which '
      + 'is read straight back by this file\'s own materiel requirement.',
  },
  {
    n: 30,
    name: 'Construction',
    level: 'partial',
    functions: ['advancePropertyLifecycle', 'stripProperty'],
    note: 'Condition advances over time. **Nothing is built by anyone — but as of 18 Sep 2026 '
      + 'something is deliberately UNbuilt.** `salvage.stripProperty` is the first thing in the '
      + 'engine that changes a building\'s condition by somebody\'s decision rather than by the '
      + 'calendar: an empty building is where glass, timber, cloth and stone come from, and a '
      + 'trip costs it 10 condition and refuses once there is nothing left. Deliberately NOT '
      + 'raised to modelled on the strength of that, because demolition is half a construction '
      + 'system and the half that matters less: no property is ever founded, and '
      + '`lifecycle_stage` still walks its stages on a timer nobody influences. Measured '
      + 'against a world with salvage switched off, over 200 ticks: 96 properties at zero '
      + 'condition without it, 101 with — the collapse of the housing stock is the '
      + 'pre-existing decay, not this.',
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
    level: 'partial',
    tables: ['civilizations', 'territory_blocks'],
    phases: ['runOrganizationPhase'],
    traitFamilies: ['civilization'],
    functions: ['garrisonOf', 'garrisonIn', 'gripTerm'],
    note: '**Built 17 Sep 2026 as the CIVILIZATION dimension `military`** — one of the '
      + 'twenty-one in VACANCY_TRAIT_DATABASE_ATTACHMENT.md that had no module. It buys a '
      + 'garrison, 0..1 per city, out of the same budget as the hospitals and the schools, so '
      + 'guns and butter compete by arithmetic rather than by a rule saying they do. The '
      + 'garrison folds into `authority.gripTerm` as `1 - held * (1 - garrison)`: it contests '
      + 'somebody else\'s hold on the ground and touches neither `trustTerm` nor `reachTerm`, '
      + 'because a garrison does not make people trust the police. **Centred at zero** — a '
      + 'state that spends nothing on soldiers leaves the term bit-identical to what it was '
      + 'before the military existed, which is standing rule 12\'s first clause and is held by '
      + 'a test. Partial rather than modelled: there are no soldiers. Nobody is enlisted, no '
      + 'entity has a rank, no unit is deployed to a named block and no war exists to fight — '
      + 'the garrison is a funded capability, not a body of men, and §7\'s National Guard half '
      + '(a reserve mobilised for a disaster) has no mechanism at all.',
  },
  {
    n: 36,
    name: 'Tourism',
    level: 'partial',
    tables: ['cities'],
    phases: ['runOrganizationPhase'],
    traitFamilies: ['city'],
    functions: ['tourismAppeal', 'driftTourism', 'drawDna'],
    note: '**Built 17 Sep 2026 as the CITY dimension `tourism`**, one of twelve in '
      + 'VACANCY_TRAIT_DATABASE_ATTACHMENT.md and the only one of the twelve that needed '
      + 'storing — `server/tierTraits.js` reconciles the other eleven against columns, '
      + 'rollups and the Transportation deferral. A STOCK rather than a rollup: '
      + '`tourismAppeal` is what a city currently deserves (safety, what is standing, whether '
      + 'there is a culture here to come for, biased by §49 CITY DNA) and the stored number is '
      + 'what it currently has, closing at 2% of the gap a tick. That lag is the point — a '
      + 'city that cleans itself up does not have visitors the same afternoon. It feeds '
      + '`cities.economy` through `territory.cityConditionsOf`. **§49 CITY DNA arrives with '
      + 'it**: nine identities, verbatim from the spec, drawn per city on its position in the '
      + 'generation loop. Partial rather than modelled: §49 says City DNA modifies nine things '
      + 'and only two are wired — visitor appeal and the upkeep of the one system the identity '
      + 'cares about. The other seven are left unwired rather than given invented '
      + 'coefficients. There are also no visitors: nobody travels, spends or goes home, so '
      + 'tourism is a reputation with an economic consequence and not a population flow.',
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
      + 'computing in a single tick. **And the learning term stopped being frozen on 18 Sep '
      + '2026.** `learningOf` averages the `educational` family across a civilization and '
      + 'lowers the reemergence bar by up to 30% for a people who can read — but nothing in '
      + 'the engine had ever MOVED an educational trait, so that term was the population\'s '
      + 'birth draw for the life of every world. `server/knowledge.js` is §24 KNOWLEDGE '
      + 'RECOVERY, and reading raises exactly those four traits: "knowledge is a civilization '
      + 'resource" is this wire, and it had nothing pushing current through it.',
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
    tables: ['decision_log', 'keys_log'],
    functions: ['dispatchAction', 'listActions', 'getEntityState', 'applyStress', 'runBehavior',
      'keyIdFor'],
    note: 'Decisions read the live trait sheet, and two in-code assertions '
      + '(assertBehaviorReadsRealTraits, assertDisciplinesReadRealTraits) fail if that stops '
      + 'being true — which is what keeps §82 honest. '
      + '**`keys_log` is now written too, and the first thing it measured is a gap.** That '
      + 'table had no store at all — partly because `keys_log.key_id` references '
      + '`key_definitions`, which `completeness.js` declared "a module constant (keys.js)" '
      + 'while the constant did not exist. `keys.KEY_DEFINITIONS` is that constant now, and '
      + 'every resolution records its numeric result plus a snapshot of what it read, so it '
      + 'can be re-derived later — the property `contest.verifyContest` had to be rebuilt for '
      + 'after it turned out to verify only what was happening in that same instant. '
      + '**Measured over 300 ticks: Aggression 4555, ScarcityResponse 2398, Fear 2398, '
      + 'Adaptability 1530, Resilience 2, Trust 0, Territory 0.** Territory is deliberately '
      + 'unwired and `tick.js` says so; **Trust is not** — one of the seven Keys, the entire '
      + 'Social category, never resolves in a generated world. `runSocialPhase` only runs it '
      + 'when the actor holds a knowledge row ABOUT the other party, and nothing in this '
      + 'engine writes a fact whose `subject_entity_id` is a person: measured, 0 of 600. That '
      + 'is the same gate that made `resolveAggression` unreachable, and it is recorded here '
      + 'rather than patched, because the fix is a mechanism (a robbery victim learns '
      + 'something about whoever robbed them) and not a threshold. '
      + '**Three player verbs were added on 18 Sep 2026** — `call-meeting`, `assess-takeover` '
      + 'and `attempt-takeover` — taking the dispatcher from five to eight. All three route '
      + 'to things that exist, which is the rule this registry was built on; and all three '
      + 'refuse to be told who is acting, because a player acts as themselves and, for a '
      + 'takeover, for their own family.',
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
