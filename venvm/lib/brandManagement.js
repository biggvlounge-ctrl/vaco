// VENVM -- Brand Management: a real, durable brand profile every other
// dashboard module below (campaigns, asset library, content calendar,
// product launches) hangs its own records off of via `brandId`. Not
// generative -- a brand's name, voice description, and color palette
// are facts a real brand owner supplies, the same way a culture card's
// own real attributes are supplied rather than invented in VOKEN.
//
// `ownerApp` is left open the same way `combatSportType`/
// `referralType` are left open elsewhere in this ecosystem -- real
// examples (dreams, vacay, venvs, vvltvre), not an exhaustive list.
//
// `generateBrandVoiceGuidelines` is the one real generative sliver
// here (an AI-drafted voice/tone guide) -- see `pendingIntegration.js`.

const { pendingGenerationCall } = require('./pendingIntegration');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function createBrand(store, options = {}) {
  const { name, ownerApp, voice = null, colors = [], logoUrl = null, now = Date.now() } = options;
  requireString(name, 'name', 'createBrand');
  requireString(ownerApp, 'ownerApp', 'createBrand');

  const brand = {
    id: store.nextBrandId++,
    name: name.trim(),
    ownerApp: ownerApp.trim(),
    voice,
    colors: Array.isArray(colors) ? colors : [],
    logoUrl,
    createdAt: now,
    updatedAt: now,
  };
  store.brands.push(brand);
  return brand;
}

function getBrand(store, brandId) {
  return store.brands.find((b) => b.id === brandId) || null;
}

function listBrands(store, options = {}) {
  const { ownerApp } = options;
  return store.brands.filter((b) => !ownerApp || b.ownerApp === ownerApp);
}

// A real, partial update -- only the fields a caller actually supplies
// change; omitted fields keep their current real value, never reset to
// a default.
function updateBrandGuidelines(store, options = {}) {
  const { brandId, voice, colors, logoUrl, now = Date.now() } = options;
  const brand = getBrand(store, brandId);
  if (!brand) throw new Error(`updateBrandGuidelines: no brand with id ${brandId}`);
  if (voice !== undefined) brand.voice = voice;
  if (colors !== undefined) brand.colors = Array.isArray(colors) ? colors : [];
  if (logoUrl !== undefined) brand.logoUrl = logoUrl;
  brand.updatedAt = now;
  return brand;
}

function generateBrandVoiceGuidelines() {
  return pendingGenerationCall('AI brand voice guideline generation');
}

module.exports = {
  createBrand, getBrand, listBrands, updateBrandGuidelines, generateBrandVoiceGuidelines,
};
