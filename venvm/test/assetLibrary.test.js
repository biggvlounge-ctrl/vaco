// Asset Library -- the real join a VENVM production, script, or
// externally supplied asset has to a brand, campaign, and consuming
// app, plus real reuse tracking.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const {
  catalogAsset, getAsset, listAssetsForBrand, listAssetsForCampaign, recordAssetReuse,
} = require('../lib/assetLibrary');
const { createVenvmStore } = require('../lib/store');

function mkBrand(store) {
  return createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
}

test('catalogAsset refuses an unknown brand', () => {
  const store = createVenvmStore();
  assert.throws(() => catalogAsset(store, { brandId: 999999, assetType: 'video' }), /no brand with id/);
});

test('catalogAsset creates a real, retrievable asset with no reuse yet', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const asset = catalogAsset(store, { brandId: brand.id, assetType: 'video', url: 'https://example.test/v1' });
  assert.strictEqual(getAsset(store, asset.id).assetType, 'video');
  assert.deepEqual(asset.reusedIn, []);
});

test('listAssetsForBrand and listAssetsForCampaign only return their own real scope', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  catalogAsset(store, { brandId: brand.id, assetType: 'video', campaignId: 1 });
  catalogAsset(store, { brandId: brand.id, assetType: 'script', campaignId: 2 });
  assert.strictEqual(listAssetsForBrand(store, brand.id).length, 2);
  assert.strictEqual(listAssetsForCampaign(store, 1).length, 1);
  assert.strictEqual(listAssetsForCampaign(store, 2).length, 1);
});

test('recordAssetReuse appends a real reuse record -- the DTC personalizedAdVariants join', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const asset = catalogAsset(store, { brandId: brand.id, assetType: 'video' });
  recordAssetReuse(store, { assetId: asset.id, consumingApp: 'dreams', consumingRefId: 'ad-1' });
  recordAssetReuse(store, { assetId: asset.id, consumingApp: 'vacay', consumingRefId: 'listing-9' });
  assert.strictEqual(asset.reusedIn.length, 2);
  assert.strictEqual(asset.reusedIn[0].consumingApp, 'dreams');
  assert.strictEqual(asset.reusedIn[1].consumingRefId, 'listing-9');
});

test('recordAssetReuse refuses an unknown asset', () => {
  const store = createVenvmStore();
  assert.throws(() => recordAssetReuse(store, { assetId: 999999, consumingApp: 'dreams' }), /no asset with id/);
});
