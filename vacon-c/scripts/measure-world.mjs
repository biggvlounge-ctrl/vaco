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
//     --ticks N   how long to run the world (default 200)
//     --empty     skip world generation, to reproduce the original
//                 measurement: people in a field, nothing built
//     --seed S    world seed (default 'measure')
//     --json      machine-readable output

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

const w = engine.WorldState;

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

const summary = EMPTY ? buildEmptyWorld() : worldgen.generateWorld({ seed: SEED });
for (let t = 0; t < TICKS; t += 1) engine.advanceTick();

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
}
