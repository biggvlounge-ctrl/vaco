// VACANCY — task #136's real per-incident force-level rating.
//
// What this closes: `recordEscalation` always received a real,
// per-incident, trait-derived `responseLevel` and threw it away —
// `severity: Math.max(severityFloor, responseLevel)` almost always
// keeps the category floor (70/65/80), because `responseLevel`'s own
// real range for a FIRED escalation sits well below those floors. See
// `server/crime.js`'s own header above `FORCE_LEVELS` for the full
// measurement this closes against (a real 400-tick world, one seed: 9
// fired escalations, 57-81).
//
// A snapshot, not a live gauge, by the task's own framing: computed
// once, at the moment `recordEscalation` records the incident, never
// recomputed later.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const crime = require('../server/crime.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const weapons = require('../server/weapons.js');
const inventory = require('../server/inventory.js');

// ---------------------------------------------------------------------------
// The band function itself
// ---------------------------------------------------------------------------

test('forceLevelFor bands a real responseLevel into exactly one of four names', () => {
  assert.equal(crime.forceLevelFor(0), 'push');
  assert.equal(crime.forceLevelFor(59), 'push');
  assert.equal(crime.forceLevelFor(60), 'punch');
  assert.equal(crime.forceLevelFor(69), 'punch');
  assert.equal(crime.forceLevelFor(70), 'knee');
  assert.equal(crime.forceLevelFor(79), 'knee');
  assert.equal(crime.forceLevelFor(80), 'choke');
  assert.equal(crime.forceLevelFor(100), 'choke');
});

test('forceLevelFor refuses a non-finite input with null, never a fabricated band', () => {
  assert.equal(crime.forceLevelFor(null), null);
  assert.equal(crime.forceLevelFor(undefined), null);
  assert.equal(crime.forceLevelFor(NaN), null);
});

test('the real measured sample this file cites all lands inside the four bands', () => {
  // 57, 58, 67, 67, 69, 69, 71, 76, 81 — the real 400-tick, one-seed
  // measurement crime.js's own header names. Not a fixture; a direct
  // transcription of that measurement, so a future re-measurement that
  // disagrees is caught by re-reading this test against it.
  const measured = [57, 58, 67, 67, 69, 69, 71, 76, 81];
  const bands = measured.map((v) => crime.forceLevelFor(v));
  assert.deepEqual(bands, ['push', 'push', 'punch', 'punch', 'punch', 'punch', 'knee', 'knee', 'choke']);
});

// ---------------------------------------------------------------------------
// recordEscalation wiring — unarmed only, snapshotted once
// ---------------------------------------------------------------------------

function freshWorld(seed) {
  worldgen.generateWorld({ seed });
  return engine.WorldState;
}

test('recordEscalation sets a real force_level for an unarmed escalation', () => {
  const w = freshWorld('force-level-wire-1');
  const a = w.npcs[0].id;
  const b = w.npcs[1].id;
  const incident = crime.recordEscalation(w, {
    perpetratorId: a, victimId: b, tick: 1, responseLevel: 75,
  });
  assert.equal(incident.force_level, 'knee');
});

test('force_level is null when no responseLevel was ever passed in', () => {
  const w = freshWorld('force-level-wire-2');
  const a = w.npcs[0].id;
  const b = w.npcs[1].id;
  const incident = crime.recordEscalation(w, {
    perpetratorId: a, victimId: b, tick: 1, responseLevel: null,
  });
  assert.equal(incident.force_level, null);
});

test('force_level is null for an armed (gun) incident -- push/punch/knee/choke are unarmed techniques', () => {
  const w = freshWorld('force-level-wire-3');
  const perpetrator = w.npcs[0];
  const victim = w.npcs[1];
  // A functioning firearm needs a real equipped weapon AND a held
  // round of its own ammunition -- see weapons.js's own header.
  weapons.registerItems(w);
  inventory.give(w, { entityId: perpetrator.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: perpetrator.id, itemName: 'pistol' });
  inventory.give(w, { entityId: perpetrator.id, itemName: 'pistol_rounds', quantity: 5 });
  assert.ok(weapons.isFunctioningFirearm(w, perpetrator.id), 'fixture did not actually arm the perpetrator');
  const incident = crime.recordEscalation(w, {
    perpetratorId: perpetrator.id, victimId: victim.id, tick: 1, responseLevel: 90,
  });
  assert.equal(incident.category, 'gun');
  assert.equal(incident.force_level, null, 'a shooting is not a push, punch, knee or choke');
});

test('recordCrime stores force_level as a plain, real field on the incident, null when not given', () => {
  const w = freshWorld('force-level-wire-4');
  const a = w.npcs[0].id;
  const b = w.npcs[1].id;
  const incident = crime.recordCrime(w, {
    category: 'theft', perpetratorId: a, victimId: b, tick: 1,
  });
  assert.equal(incident.force_level, null);
});

// ---------------------------------------------------------------------------
// schema-extensions.sql / migrate.js wiring
// ---------------------------------------------------------------------------

test('schema-extensions.sql adds force_level and migrate.js writes it', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const extensionSql = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'schema-extensions.sql'), 'utf8',
  );
  assert.match(extensionSql, /ALTER TABLE crime_incidents ADD COLUMN IF NOT EXISTS force_level TEXT/);
  const migrateSource = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'migrate.js'), 'utf8',
  );
  assert.match(migrateSource, /force_level/);
});
