// Brand Management -- real brand profiles every other dashboard
// module hangs its own records off of.

const test = require('node:test');
const assert = require('node:assert');

const {
  createBrand, getBrand, listBrands, updateBrandGuidelines, generateBrandVoiceGuidelines,
} = require('../lib/brandManagement');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

test('createBrand requires a non-empty name and ownerApp', () => {
  const store = createVenvmStore();
  assert.throws(() => createBrand(store, { ownerApp: 'dreams' }), /requires a non-empty name/);
  assert.throws(() => createBrand(store, { name: 'Vvltvre' }), /requires a non-empty ownerApp/);
});

test('createBrand creates a real, retrievable brand', () => {
  const store = createVenvmStore();
  const brand = createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams', voice: 'bold', colors: ['#000'] });
  assert.strictEqual(getBrand(store, brand.id).name, 'Vvltvre');
  assert.strictEqual(brand.voice, 'bold');
});

test('listBrands filters by real ownerApp when given', () => {
  const store = createVenvmStore();
  createBrand(store, { name: 'A', ownerApp: 'dreams' });
  createBrand(store, { name: 'B', ownerApp: 'vacay' });
  assert.strictEqual(listBrands(store, { ownerApp: 'dreams' }).length, 1);
  assert.strictEqual(listBrands(store).length, 2);
});

test('updateBrandGuidelines only changes real fields actually supplied', () => {
  const store = createVenvmStore();
  const brand = createBrand(store, { name: 'A', ownerApp: 'dreams', voice: 'calm', colors: ['#fff'] });
  updateBrandGuidelines(store, { brandId: brand.id, voice: 'bold' });
  assert.strictEqual(brand.voice, 'bold');
  assert.deepEqual(brand.colors, ['#fff'], 'colors was not supplied, so it must not have been reset');
});

test('updateBrandGuidelines refuses an unknown brand', () => {
  const store = createVenvmStore();
  assert.throws(() => updateBrandGuidelines(store, { brandId: 999999, voice: 'x' }), /no brand with id/);
});

test('generateBrandVoiceGuidelines is an honest, labeled pending integration point, not a fabricated result', () => {
  assert.throws(() => generateBrandVoiceGuidelines(), PendingIntegrationError);
});
