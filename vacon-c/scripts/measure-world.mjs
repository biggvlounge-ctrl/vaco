#!/usr/bin/env node
//
// scripts/measure-world.mjs
//
// **What a world can actually tell you about itself.**
//
// `server/statistics.js` holds a catalogue of statistics across §9's
// eleven MASTER BLOCK KEY categories, and counting the entries in it
// says nothing about whether a world can answer them. This builds a
// world, ticks it, and asks — which is how the finding that prompted
// `server/worldgen.js` was made in the first place: 35 of 67 answered,
// 24 were computable and came back null because nothing ever called
// the generator that would have produced the data, and 8 were declared
// gaps with no substrate anywhere.
//
// Every number in `dev-docs/WHAT_THE_WORLD_IS_MISSING.md` comes from
// here. Run it rather than trusting that document to have aged well:
//
//     node vacon-c/scripts/measure-world.mjs
//     node vacon-c/scripts/measure-world.mjs --ticks 400 --empty
//
// Flags:
//     --ticks N          how long to run the world (default 200)
//     --empty            skip world generation, to reproduce the original
//                        measurement: people in a field, nothing built
//     --seed S           world seed (default 'measure')
//     --json             machine-readable output
//     --extended-family  turn on worldgen.js's opt-in real aunts/
//                        uncles + cousins for ordinary NPCs
//                        (`config.extendedFamily`) — omitted, a world
//                        generates exactly as it always has. This is
//                        the flag the measured before/after numbers in
//                        CLAUDE.md's own standing rule on this came
//                        from: run once without it, once with.
//     --all-demographic-packs
//                        turn on every one of worldgen.js's seven
//                        independently opt-in demographic packs at
//                        once (ancestry, race, marital status,
//                        disability, veteran status, nativity,
//                        religion), each supplied a trivial one-bucket
//                        real-vocabulary sample pack so every draw
//                        resolves to a real value rather than falling
//                        through to a missing-tract null. Reports what
//                        fraction of NPCs get a FULL joint demographic
//                        profile (all seven fields set) versus a
//                        partial one — and whether a partial profile
//                        comes from age-gating (maritalStatus/
//                        veteranStatus are adults-only by design, same
//                        as `education`) rather than a bug. Omitted, a
//                        world generates exactly as it always has —
//                        this flag changes nothing about the default
//                        path.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../server/engine.js');
const statistics = require('../server/statistics.js');
const worldgen = require('../server/worldgen.js');
const territory = require('../server/territory.js');
const areaStats = require('../server/areaStats.js');
const economy = require('../server/economy.js');

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

const TICKS = Number(flag('ticks', 200));
const EMPTY = flag('empty', false) === true;
const SEED = flag('seed', 'measure');
const JSON_OUT = flag('json', false) === true;
const EXTENDED_FAMILY = flag('extended-family', false) === true;
const ALL_DEMOGRAPHIC_PACKS = flag('all-demographic-packs', false) === true;

const w = engine.WorldState;

// ---------------------------------------------------------------------
// --all-demographic-packs — one trivial, fully-real sample pack per
// field, so every draw resolves rather than falling through to a
// missing-tract null. One bucket at share 1 is enough to answer "does
// every field get set," which is what this flag measures — it is not
// trying to reproduce a real population's actual composition.
// ---------------------------------------------------------------------
function demographicPackOptions() {
  if (!ALL_DEMOGRAPHIC_PACKS) return {};
  const tract = (field, value) => ({
    region: 'Measured', source: 'sample', tracts: [{ tractId: 'T1', [field]: value }],
  });
  return {
    ancestryPack: tract('shares', { german: 1 }),
    racePack: tract('shares', { white: 1 }),
    maritalStatusPack: tract('shares', { 'never-married': 1 }),
    nativityPack: tract('shares', { 'us-born': 1 }),
    disabilityPack: tract('disabilityShare', 0.5),
    veteranPack: tract('veteranShare', 0.5),
    religionPack: { region: 'Measured', source: 'sample', counties: [{ countyFips: '00000', shares: { protestant: 1 } }] },
  };
}

// The seven fields each pack above sets directly on the NPC — the
// ones `worldgen.js` itself calls "independently opt-in via its own
// config.*Pack flag," not `politicalTypology` (always drawn, no flag)
// and not `islamicSect`/`jewishObservance` (conditioned on `religion`'s
// resolved VALUE, not a pack flag of their own).
const DEMOGRAPHIC_FIELDS = ['ethnicity', 'race', 'maritalStatus', 'disability', 'veteranStatus', 'nativity', 'religion'];

// Fields real ACS tables themselves only cover from a given age, so
// `worldgen.js` sets them only for adults regardless of whether a pack
// is present — a real, designed gate, not a bug this measurement
// should flag.
const ADULT_ONLY_FIELDS = ['maritalStatus', 'veteranStatus'];

function demographicCompletenessOf(people) {
  const adults = people.filter((n) => (w.tick - n.createdTick) / 365 >= 18);
  const children = people.filter((n) => (w.tick - n.createdTick) / 365 < 18);
  const fullProfile = (n, fields) => fields.every((f) => n[f] !== null && n[f] !== undefined);

  return {
    allNpcs: people.length,
    adults: adults.length,
    children: children.length,
    fullJointProfile: {
      // Children can never reach this bar by design (maritalStatus/
      // veteranStatus are adults-only), so this is reported over
      // ADULTS, the population that actually could reach it.
      count: adults.filter((n) => fullProfile(n, DEMOGRAPHIC_FIELDS)).length,
      of: adults.length,
    },
    ageUngatedFieldsOnly: {
      // What every NPC regardless of age gets, when every pack is
      // supplied — the honest "full profile" figure for the whole
      // population, since the adult-only fields are excluded by
      // design rather than by a gap.
      count: people.filter((n) => fullProfile(n, DEMOGRAPHIC_FIELDS.filter((f) => !ADULT_ONLY_FIELDS.includes(f)))).length,
      of: people.length,
    },
    adultOnlyFieldsSetForEveryAdult: {
      count: adults.filter((n) => fullProfile(n, ADULT_ONLY_FIELDS)).length,
      of: adults.length,
    },
    adultOnlyFieldsNullForEveryChild: {
      count: children.filter((n) => ADULT_ONLY_FIELDS.every((f) => n[f] === null)).length,
      of: children.length,
    },
  };
}

// The world before `worldgen.js` existed: people, placed, and nothing
// else. This is not a strawman — it is the only world the engine could
// build, and `test/` is full of fixtures shaped exactly like it.
function buildEmptyWorld() {
  w.tick = 36500;
  const city = territory.generateCity(w, { name: 'Measured' });
  const blocks = [];
  for (let i = 0; i < 5; i += 1) blocks.push(territory.generateCommunity(w, { cityId: city.id }));
  for (let i = 0; i < 150; i += 1) {
    const npc = engine.generateNPC();
    npc.createdTick = w.tick - Math.round(((i * 37) % 70) * 365);
    areaStats.placeInCommunity(w, { entityId: npc.id, communityId: blocks[i % 5].id });
    economy.generateIndividualFinances(w, npc.id, { savings: (i * 17) % 500, tick: w.tick });
  }
  return { people: 150, communities: 5, note: 'no properties, infrastructure, jobs or demographics' };
}

const summary = EMPTY
  ? buildEmptyWorld()
  : worldgen.generateWorld({ seed: SEED, extendedFamily: EXTENDED_FAMILY, ...demographicPackOptions() });
for (let t = 0; t < TICKS; t += 1) engine.advanceTick();

const demographicCompleteness = ALL_DEMOGRAPHIC_PACKS ? demographicCompletenessOf(w.npcs) : null;

const structural = new Set(statistics.unavailable().map((e) => e.key));
const profiles = statistics.profileAll(w);

const answered = [];
const silent = [];
for (const definition of statistics.CATALOGUE) {
  if (structural.has(definition.key)) continue;
  const known = profiles.filter((p) => p.statistics[definition.key].known).length;
  (known > 0 ? answered : silent).push(`${definition.category}/${definition.key}`);
}

// Per-category coverage, which is the shape of the finding rather than
// one number: a category that answers nothing at all is a different
// problem from one that answers most of itself.
const byCategory = {};
for (const definition of statistics.CATALOGUE) {
  const row = byCategory[definition.category] || { total: 0, answered: 0, structural: 0 };
  row.total += 1;
  if (structural.has(definition.key)) row.structural += 1;
  else if (profiles.some((p) => p.statistics[definition.key].known)) row.answered += 1;
  byCategory[definition.category] = row;
}

const result = {
  world: EMPTY ? 'empty (pre-worldgen)' : `generated (seed "${SEED}")`,
  ticks: TICKS,
  population: { living: w.npcs.length, dead: (w.deceased || []).length },
  born: w.npcs.filter((n) => (n.generation ?? 1) > 1).length,
  crimeIncidents: (w.crimeIncidents || []).length,
  statistics: {
    total: statistics.KEYS.length,
    answered: answered.length,
    silent: silent.length,
    declaredGaps: structural.size,
  },
  byCategory,
  silentKeys: silent,
  declaredGapKeys: [...structural],
  demographicCompleteness,
  summary,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`world:      ${result.world}`);
  console.log(`ticks:      ${TICKS}`);
  console.log(`population: ${result.population.living} living, ${result.population.dead} dead, `
    + `${result.born} born here`);
  console.log(`crime:      ${result.crimeIncidents} incidents`);
  console.log('');
  console.log(`statistics: ${result.statistics.answered} answered, `
    + `${result.statistics.silent} silent, `
    + `${result.statistics.declaredGaps} declared gaps, of ${result.statistics.total}`);
  console.log('');
  console.log('category'.padEnd(16) + 'answered'.padStart(9) + 'silent'.padStart(8)
    + 'declared'.padStart(10) + 'total'.padStart(7));
  for (const category of statistics.CATEGORIES) {
    const row = byCategory[category];
    const quiet = row.total - row.answered - row.structural;
    console.log(category.padEnd(16)
      + String(row.answered).padStart(9)
      + String(quiet).padStart(8)
      + String(row.structural).padStart(10)
      + String(row.total).padStart(7));
  }
  if (silent.length > 0) {
    console.log('\ncomputable but nothing populated it:');
    for (const key of silent) console.log(`  ${key}`);
  }
  console.log('\ndeclared gaps (no substrate anywhere):');
  for (const key of structural) console.log(`  ${key}`);

  if (demographicCompleteness) {
    const d = demographicCompleteness;
    console.log('\ndemographic pack joint completeness (--all-demographic-packs):');
    console.log(`  full joint profile (all 7 fields), adults only: ${d.fullJointProfile.count}/${d.fullJointProfile.of}`);
    console.log(`  age-ungated fields only, everyone:               ${d.ageUngatedFieldsOnly.count}/${d.ageUngatedFieldsOnly.of}`);
    console.log(`  maritalStatus+veteranStatus set, every adult:    ${d.adultOnlyFieldsSetForEveryAdult.count}/${d.adultOnlyFieldsSetForEveryAdult.of}`);
    console.log(`  maritalStatus+veteranStatus null, every child:   ${d.adultOnlyFieldsNullForEveryChild.count}/${d.adultOnlyFieldsNullForEveryChild.of}`);
  }
}
