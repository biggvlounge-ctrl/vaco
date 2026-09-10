// server/idSequences.js
//
// **The thing that makes a restore correct rather than merely
// populated.**
//
// Sixteen id counters live as module-level `let`s across nine files —
// `nextMemoryId` in worldStore.js, `nextCityId` in territory.js,
// `nextMissionId` in missions.js, and so on. Every one of them starts
// at 1 and counts up for the life of the process.
//
// That was harmless for as long as a process only ever built a world
// from nothing. It stops being harmless the moment a world is loaded
// from Postgres: restore 500 memories numbered 1..500, then call
// `addMemory()`, and the new memory is id 1. Two rows in one array
// share a primary key. Nothing throws. `findRelationship`,
// `getKnowledge`, `requireMission` and every other lookup that finds
// "the" row by id now returns whichever one is first, and the world
// is quietly wrong from that point on.
//
// **Derived, not stored.** Each sequence is recomputed as
// max(existing id) + 1 from the restored data itself, rather than
// being saved alongside it. A saved counter is a second source of
// truth that can disagree with the rows; a derived one cannot. It also
// means this is self-correcting: a world assembled by any route —
// restore, a test fixture, a hand-built fixture — gets sequences that
// match the rows actually present.
//
// Each module owns its own counters and exposes a single `reseedIds`.
// This file only knows who to call, so adding a counter means adding
// it to its own module's reseed, not to a list here that would drift.

'use strict';

const culture = require('./culture.js');
const economy = require('./economy.js');
const flows = require('./flows.js');
const missions = require('./missions.js');
const players = require('./players.js');
const property = require('./property.js');
const territory = require('./territory.js');
const tick = require('./tick.js');
const worldStore = require('./worldStore.js');

// max(id) + 1 over a set of rows, or 1 for an empty set. Ids that are
// absent or non-numeric are ignored rather than poisoning the max with
// NaN — a row with no id is a different bug and this is not the place
// that reports it.
function nextAfter(rows, field = 'id') {
  let max = 0;
  for (const row of rows || []) {
    const value = Number(row?.[field]);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

const MODULES = [culture, economy, flows, missions, players, property, territory, tick, worldStore];

// Reseed every module's counters from the world it is handed. Returns
// what each one was set to, so a restore can report it and a test can
// assert on it rather than reaching into module privates.
function reseedAll(worldState) {
  const seeded = {};
  for (const mod of MODULES) {
    if (typeof mod.reseedIds !== 'function') {
      throw new Error(
        `idSequences: a module in the list has no reseedIds(). Every module that owns an id `
        + `counter must expose one, or a restore silently reuses its ids.`,
      );
    }
    Object.assign(seeded, mod.reseedIds(worldState));
  }
  return seeded;
}

module.exports = { nextAfter, reseedAll };
