// Universal World Layer — Persistent Asset Library.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 6
// ("Persistent Asset Library — AI generation, confirmed with real
// reuse tracking"). Doc's field list: assetType, generatedModel,
// variants, qualityLevel, usageCount, locationHistory.
//
// qualityLevel reuses LOCATION_TIERS (hero/regional/filler) from
// Phase 1 rather than inventing a parallel scale — section 7 of the
// architecture doc ("real human cost hierarchy") maps Tier 1/2/3
// directly onto UNESCO-grade / major-city / everything-else, the same
// three-tier concept Phase 1 already applied to locations. This is a
// real, deliberate reuse, not a coincidence of naming.

const { getLocation, LOCATION_TIERS } = require('./locations');

function registerAsset(worldLayer, options = {}) {
  const { assetType, generatedModel, variants = [], qualityLevel = 'filler' } = options;

  if (!assetType) {
    throw new Error('registerAsset requires an assetType');
  }
  if (!generatedModel) {
    throw new Error('registerAsset requires a generatedModel');
  }
  if (!LOCATION_TIERS.includes(qualityLevel)) {
    throw new Error(
      `registerAsset: invalid qualityLevel "${qualityLevel}" (expected one of ${LOCATION_TIERS.join(', ')})`
    );
  }

  const asset = {
    id: worldLayer.nextAssetId++,
    assetType,
    generatedModel,
    variants,
    qualityLevel,
    usageCount: 0,
    locationHistory: [],
    createdTick: worldLayer.tick,
  };

  worldLayer.assets.push(asset);
  return asset;
}

function getAsset(worldLayer, assetId) {
  return worldLayer.assets.find((a) => a.id === assetId) || null;
}

function getAssetsByType(worldLayer, assetType) {
  return worldLayer.assets.filter((a) => a.assetType === assetType);
}

function useAsset(worldLayer, assetId, locationId) {
  const asset = getAsset(worldLayer, assetId);
  if (!asset) {
    throw new Error(`useAsset: no asset with id ${assetId}`);
  }
  if (!getLocation(worldLayer, locationId)) {
    throw new Error(`useAsset: no location with id ${locationId}`);
  }

  asset.usageCount += 1;
  asset.locationHistory.push({ locationId, tick: worldLayer.tick });
  return asset;
}

module.exports = {
  registerAsset,
  getAsset,
  getAssetsByType,
  useAsset,
};
