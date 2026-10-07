'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { VACANCY_ENTITY_MAP, NOT_SHARED, tableFor, describeAlignment } from '../src/lib/vacancySchema.js';

// vacancySchema.js's own header promises this: "a scripts/test/
// vacancy-schema-alignment.test.mjs fails if any of those names is
// not a real CREATE TABLE in the schema file." That test did not
// exist anywhere on disk -- the same "a document says X is built and
// it is not" pattern this whole file exists to guard against, just
// turned on itself. This is that real test, at this app's own
// test/*.test.js convention rather than the scripts/test/ path named
// (vdp has no scripts/ directory at all).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '../../vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql');
const schema = readFileSync(SCHEMA_PATH, 'utf8');

function hasTable(tableName) {
  return new RegExp(`CREATE TABLE\\s+${tableName}\\b`).test(schema);
}

test('every table VACANCY_ENTITY_MAP points at is a real CREATE TABLE in the schema', () => {
  for (const [kind, tableName] of Object.entries(VACANCY_ENTITY_MAP)) {
    assert.ok(hasTable(tableName), `${kind} -> "${tableName}" is not a real table in ${SCHEMA_PATH}`);
  }
});

test('tableFor answers the same mapping, and null for an unmapped kind', () => {
  for (const [kind, tableName] of Object.entries(VACANCY_ENTITY_MAP)) {
    assert.equal(tableFor(kind), tableName);
  }
  assert.equal(tableFor('not-a-real-kind'), null);
});

test('NOT_SHARED entries do not collide with VACANCY_ENTITY_MAP -- a kind is declared once', () => {
  for (const kind of Object.keys(NOT_SHARED)) {
    assert.ok(!(kind in VACANCY_ENTITY_MAP), `"${kind}" is both mapped and declared not-shared`);
  }
});

test('describeAlignment reports every mapped table, deduplicated and sorted', () => {
  const described = describeAlignment();
  const expectedTables = [...new Set(Object.values(VACANCY_ENTITY_MAP))].sort();
  assert.deepEqual(described.tables, expectedTables);
  assert.equal(described.mapped, Object.keys(VACANCY_ENTITY_MAP).length);
});
