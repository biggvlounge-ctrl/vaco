// Real, per-tradition eschatology/end-times content — reported
// through `demographics.compositionOf`'s religion block, never wired
// to any decision mechanic. Read `server/eschatologyPacks.js`'s own
// header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const eschatologyPacks = require('../server/eschatologyPacks.js');
const religionPacks = require('../server/religionPacks.js');
const demographics = require('../server/demographics.js');

test('every real tradition either has a documented eschatology or is a declared decline', () => {
  for (const tradition of religionPacks.TRADITIONS) {
    const has = Boolean(eschatologyPacks.eschatologyFor(tradition));
    const declined = eschatologyPacks.DECLINED.includes(tradition);
    assert.ok(has || declined,
      `${tradition} is neither reported nor declared declined`);
    assert.notEqual(has, declined,
      `${tradition} cannot be both reported and declined`);
  }
});

test('every entry names a real concept and a real source, never a blank placeholder', () => {
  for (const [tradition, entry] of Object.entries(eschatologyPacks.ESCHATOLOGY)) {
    assert.ok(entry.concept && entry.concept.length > 0, `${tradition} has no concept`);
    assert.ok(entry.summary && entry.summary.length > 0, `${tradition} has no summary`);
    assert.ok(entry.source && entry.source.length > 0, `${tradition} names no source`);
  }
});

test('Sikh and "other" are honest declines, not invented entries', () => {
  assert.equal(eschatologyPacks.eschatologyFor('sikh'), null);
  assert.equal(eschatologyPacks.eschatologyFor('other'), null);
  assert.ok(eschatologyPacks.DECLINED.includes('sikh'));
  assert.ok(eschatologyPacks.DECLINED.includes('other'));
});

test('eschatologyFor is null for "unaffiliated" and any unrecognised name', () => {
  assert.equal(eschatologyPacks.eschatologyFor('unaffiliated'), null);
  assert.equal(eschatologyPacks.eschatologyFor('martian'), null);
});

test('the real Jewish, Christian and Islamic concepts are the ones task #158 named', () => {
  assert.match(eschatologyPacks.eschatologyFor('jewish').concept, /Mashiach/);
  assert.match(eschatologyPacks.eschatologyFor('protestant').concept, /Second Coming/);
  assert.match(eschatologyPacks.eschatologyFor('catholic').concept, /Second Coming/);
  assert.match(eschatologyPacks.eschatologyFor('muslim').concept, /Mahdi/);
  assert.match(eschatologyPacks.eschatologyFor('muslim').concept, /Isa/);
});

test('Baha\'i reports a fulfilled, not future-facing, eschatology — a real distinction, not a gap', () => {
  const bahai = eschatologyPacks.eschatologyFor('bahai');
  assert.ok(bahai);
  assert.match(bahai.summary, /already/i);
});

// ---------------------------------------------------------------------
// Reported through compositionOf, never a per-person fact
// ---------------------------------------------------------------------

test('compositionOf reports the dominant religion\'s real eschatology', () => {
  const residents = [
    { id: 1, religion: 'muslim' }, { id: 2, religion: 'muslim' }, { id: 3, religion: 'catholic' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.religion.dominantEschatology.concept,
    eschatologyPacks.eschatologyFor('muslim').concept);
});

test('compositionOf reports a null dominantEschatology for the invented vocabulary', () => {
  const residents = [{ id: 1, religion: 'Tidewater' }, { id: 2, religion: 'Tidewater' }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.religion.dominantEschatology, null);
});

test('compositionOf reports a null dominantEschatology when nothing is recorded', () => {
  const residents = [{ id: 1, religion: null }, { id: 2, religion: null }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.religion.dominantEschatology, null);
});

test('compositionOf reports a null dominantEschatology for a dominant Sikh population', () => {
  const residents = [{ id: 1, religion: 'sikh' }, { id: 2, religion: 'sikh' }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.religion.dominantEschatology, null);
});

// ---------------------------------------------------------------------
// The §9 firewall — the same discipline every other demographic
// dimension in this registry holds, checked the same way.
// ---------------------------------------------------------------------

test('eschatologyPacks.js is read by nothing that decides an outcome', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const serverDir = path.join(__dirname, '..', 'server');
  const allowed = new Set(['demographics.js', 'eschatologyPacks.js']);
  for (const file of fs.readdirSync(serverDir)) {
    if (!file.endsWith('.js') || allowed.has(file)) continue;
    const source = fs.readFileSync(path.join(serverDir, file), 'utf8');
    assert.equal(/eschatologyPacks/.test(source), false,
      `${file} reads eschatologyPacks.js — only demographics.js may`);
  }
});
