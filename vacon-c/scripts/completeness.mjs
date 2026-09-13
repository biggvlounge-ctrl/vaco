#!/usr/bin/env node
//
// scripts/completeness.mjs
//
// **The running percent: how much of a complete game exists.**
//
// Builds a world, runs it, measures it, and writes
// `dev-docs/GAME_COMPLETENESS.md`. Nothing in that document is typed by
// hand — `test/completeness.test.js` regenerates it and fails if the
// committed copy disagrees, the same guard
// `scripts/completion-report.mjs` uses at the ecosystem level.
//
// Run it:
//
//     node vacon-c/scripts/completeness.mjs           # rewrite the report
//     node vacon-c/scripts/completeness.mjs --check   # fail if stale
//     node vacon-c/scripts/completeness.mjs --json
//
// Flags:
//     --ticks N   how long to run the world (default 200)
//     --seed S    world seed (default 'complete')
//     --check     do not write; exit 1 if the committed report is stale
//     --json      machine-readable output, no write

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const completeness = require('../server/completeness.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT = path.join(HERE, '..', 'dev-docs', 'GAME_COMPLETENESS.md');

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

// **Seeded and fixed-length on purpose.** The report is committed, so
// the measurement has to be reproducible — a report that changed on
// every run would be noise in every diff and could not be checked for
// staleness at all. §88's seeded determinism is what makes this work.
const TICKS = Number(flag('ticks', 200));
const SEED = String(flag('seed', 'complete'));

export function runMeasurement({ ticks = TICKS, seed = SEED } = {}) {
  const world = engine.WorldState;
  worldgen.generateWorld({ seed });
  const snapshot = completeness.snapshotTraits(world);
  for (let t = 0; t < ticks; t += 1) engine.advanceTick();
  return { report: completeness.measure(world, snapshot), ticks, seed };
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

const AXIS_NOTES = {
  systems: 'The forty systems §7 names, at `server/urbanSystems.js`\'s own four levels '
    + '(modelled 1, partial 0.5, slot 0.15, absent 0).',
  tables: 'Every `CREATE TABLE` in the schema and its extensions. A table a built world '
    + 'fills scores 1; one the engine writes but no world has ever used scores 0.5; one '
    + 'with no store at all scores 0.',
  statistics: 'The `server/statistics.js` catalogue, scored on whether a world can produce '
    + 'the number in any area at all.',
  traits: 'Every individual trait, scored on whether anything under `server/` reads it.',
  traitDepth: 'The seven contributing columns on `entity_traits`, scored on whether a real '
    + 'run ever moves them. A column nothing writes means people cannot change.',
  habits: 'Yes/no questions about whether habits and routines carry information rather than '
    + 'being identical for everybody.',
};

function bar(percent) {
  const filled = Math.round(percent / 5);
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`;
}

function render({ report, ticks, seed }) {
  const lines = [];
  lines.push('# VACON-C — how much of a complete game exists');
  lines.push('');
  lines.push('**Generated. Do not edit.** `node vacon-c/scripts/completeness.mjs`');
  lines.push('regenerates it and `test/completeness.test.js` fails if this file and the');
  lines.push('code disagree.');
  lines.push('');
  lines.push('Every number here is measured — from the source tree, or from a world that was');
  lines.push(`actually generated and run for ${ticks} ticks (seed \`${seed}\`). Nothing in this`);
  lines.push('document is a checklist somebody ticked. That distinction is the whole reason');
  lines.push('the file exists: this project\'s own status claims have been wrong every single');
  lines.push('time they were checked — `CLAUDE.md`\'s "foundation already running" list in');
  lines.push('three places, a spec section\'s "roughly 25 of the 40", a catalogue of 67');
  lines.push('statistics that a real world answered 36 of, and seven trait families generated');
  lines.push('on every NPC and read by nothing.');
  lines.push('');
  lines.push(`## ${report.percent}% complete`);
  lines.push('');
  lines.push('```');
  lines.push(`${bar(report.percent)}  ${report.percent}%   ${report.earned} of ${report.total}`);
  lines.push('```');
  lines.push('');
  lines.push('| axis | complete | score | what it measures |');
  lines.push('|---|---|---|---|');
  for (const axis of report.axes) {
    lines.push(`| ${axis.axis} | **${axis.percent}%** | ${axis.earned}/${axis.total} | ${axis.label} |`);
  }
  lines.push('');
  lines.push('The total is weighted by item count — one statistic counts the same as one');
  lines.push('table counts as one trait. Any other weighting is a judgement about which half');
  lines.push('of a game matters more, and no document in this package makes that judgement,');
  lines.push('so inventing one would put a made-up number at the top of a report whose whole');
  lines.push('purpose is that its numbers are not made up. The per-axis figures are here so a');
  lines.push('reader can weight them differently and say so.');
  lines.push('');
  lines.push('## What it takes to reach 100%');
  lines.push('');
  lines.push('Everything below is a measured gap, grouped by axis and named exactly as the');
  lines.push('measurement names it. This is the work list.');
  lines.push('');

  for (const axis of report.axes) {
    if (axis.gaps.length === 0) {
      lines.push(`### ${axis.axis} — complete`);
      lines.push('');
      continue;
    }
    lines.push(`### ${axis.axis} — ${axis.gaps.length} open`);
    lines.push('');
    lines.push(AXIS_NOTES[axis.axis] ?? '');
    lines.push('');
    lines.push('| item | state | worth |');
    lines.push('|---|---|---|');
    for (const gap of axis.gaps) {
      const worth = Math.round((1 - gap.credit) * 100) / 100;
      const deferred = gap.deferred ? ' *(deferred by scope)*' : '';
      lines.push(`| \`${gap.name}\`${deferred} | ${gap.state}${gap.note ? ` — ${gap.note}` : ''} | +${worth} |`);
    }
    lines.push('');
  }

  lines.push('## How to read a gap');
  lines.push('');
  lines.push('**"empty in a built world" is the most actionable state in this report.** It');
  lines.push('means the mechanism is built, tested and green, and `worldgen.js` never calls');
  lines.push('it — so every world this engine has ever run had no such thing in it. That is');
  lines.push('the eleventh standing rule, and it is the same finding that produced');
  lines.push('`worldgen.js` in the first place: a generator nothing calls is indistinguishable');
  lines.push('from a generator that does not exist. Those are half-credit because the hard');
  lines.push('half is done.');
  lines.push('');
  lines.push('**"no store" means the table is a shape in the schema and nothing more.** No');
  lines.push('array, no code, no rows — full credit available.');
  lines.push('');
  lines.push('**"never moves" on a trait column means people cannot change.** The column');
  lines.push('exists, is migrated and is restored; nothing writes it.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------

const measurement = runMeasurement();

if (flag('json', false) === true) {
  console.log(JSON.stringify(measurement.report, null, 2));
} else if (flag('check', false) === true) {
  const expected = render(measurement);
  const actual = fs.existsSync(REPORT) ? fs.readFileSync(REPORT, 'utf8') : '';
  if (expected !== actual) {
    console.error('completeness: dev-docs/GAME_COMPLETENESS.md is out of date.');
    console.error('Re-run `node vacon-c/scripts/completeness.mjs` and commit the result.');
    process.exit(1);
  }
  console.log(`completeness: report is current (${measurement.report.percent}%).`);
} else {
  fs.writeFileSync(REPORT, render(measurement));
  const { report } = measurement;
  console.log(`completeness: ${report.percent}% (${report.earned}/${report.total})`);
  for (const axis of report.axes) {
    console.log(`  ${axis.axis.padEnd(12)} ${String(axis.percent).padStart(5)}%  ${axis.earned}/${axis.total}`);
  }
  console.log(`Wrote ${path.relative(path.join(HERE, '..', '..'), REPORT)}`);
}
