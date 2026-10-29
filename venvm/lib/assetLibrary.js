// VENVM -- Asset Library: the real join `VENVM_MARKETING_DTC_CAPABILITIES.md`
// itself flags as the single most tractable missing piece across all
// three VENVM documents placed in this repo -- "VENVM has no asset
// storage, no media library, and no join to any consuming app --
// nothing maps a VENVM production to a DREAMS creative, a VACAY
// listing, or a VENVS storefront." This module is that join.
//
// A catalog entry does not hold media itself (VENVM still "cannot
// generate pixels" -- see `productionPipeline.js`'s own header); it
// records that a real asset (a finished script, a production job's
// output once one exists, or any externally supplied `url`) belongs
// to a brand, optionally a campaign, and is consumed by a named app
// and reference id. `assetType` is left open (script/video/image/...),
// the same "real examples, not an exhaustive list" posture as
// `referralType`.
//
// Real reuse tracking: `recordAssetReuse` is exactly the
// `personalizedAdVariants`/`creatorScaleWithoutCreatorCost` mechanic
// the same document describes ("the same base ad regenerated per
// audience segment ... realistic at scale since generation cost is
// internal") -- a plain, real append-only log of every place one
// catalogued asset has been reused, not a generative capability.

const { getBrand } = require('./brandManagement');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function catalogAsset(store, options = {}) {
  const {
    brandId, campaignId = null, assetType, url = null,
    sourceScriptRequestId = null, sourceProductionJobId = null,
    consumingApp = null, consumingRefId = null, now = Date.now(),
  } = options;
  if (!getBrand(store, brandId)) throw new Error(`catalogAsset: no brand with id ${brandId}`);
  requireString(assetType, 'assetType', 'catalogAsset');

  const asset = {
    id: store.nextAssetId++,
    brandId,
    campaignId,
    assetType: assetType.trim(),
    url,
    sourceScriptRequestId,
    sourceProductionJobId,
    consumingApp,
    consumingRefId,
    reusedIn: [],
    createdAt: now,
  };
  store.marketingAssets.push(asset);
  return asset;
}

function getAsset(store, assetId) {
  return store.marketingAssets.find((a) => a.id === assetId) || null;
}

function listAssetsForBrand(store, brandId) {
  return store.marketingAssets.filter((a) => a.brandId === brandId);
}

function listAssetsForCampaign(store, campaignId) {
  return store.marketingAssets.filter((a) => a.campaignId === campaignId);
}

// The real reuse record: one catalogued asset, consumed again by a
// (possibly different) app and reference -- the exact "regenerate the
// same base ad per audience segment" join this module exists to close.
function recordAssetReuse(store, options = {}) {
  const { assetId, consumingApp, consumingRefId, now = Date.now() } = options;
  const asset = getAsset(store, assetId);
  if (!asset) throw new Error(`recordAssetReuse: no asset with id ${assetId}`);
  requireString(consumingApp, 'consumingApp', 'recordAssetReuse');

  const reuse = { consumingApp: consumingApp.trim(), consumingRefId, reusedAt: now };
  asset.reusedIn.push(reuse);
  return asset;
}

module.exports = {
  catalogAsset, getAsset, listAssetsForBrand, listAssetsForCampaign, recordAssetReuse,
};
