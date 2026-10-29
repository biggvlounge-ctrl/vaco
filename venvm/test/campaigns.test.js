// Campaign Dashboard's own data model -- real campaigns, real
// enforced status transitions, and a real, derived spend/budget
// figure.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const {
  createCampaign, getCampaign, listCampaignsForBrand, updateCampaignStatus,
  recordSpend, campaignSpendTotal, campaignRemainingBudget, generateCampaignOptimization,
} = require('../lib/campaigns');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

function mkBrand(store) {
  return createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
}

test('createCampaign refuses an unknown brand and a negative budget', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  assert.throws(() => createCampaign(store, { brandId: 999999, name: 'X' }), /no brand with id/);
  assert.throws(() => createCampaign(store, { brandId: brand.id, name: 'X', budget: -5 }), /non-negative budget/);
});

test('a fresh campaign starts real and draft', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const campaign = createCampaign(store, { brandId: brand.id, name: 'Launch Week', budget: 1000 });
  assert.strictEqual(campaign.status, 'draft');
  assert.strictEqual(getCampaign(store, campaign.id).name, 'Launch Week');
  assert.strictEqual(listCampaignsForBrand(store, brand.id).length, 1);
});

test('updateCampaignStatus only allows real, enforced transitions', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const campaign = createCampaign(store, { brandId: brand.id, name: 'X' });
  assert.throws(() => updateCampaignStatus(store, { campaignId: campaign.id, status: 'completed' }), /cannot move from "draft" to "completed"/);
  updateCampaignStatus(store, { campaignId: campaign.id, status: 'active' });
  updateCampaignStatus(store, { campaignId: campaign.id, status: 'paused' });
  updateCampaignStatus(store, { campaignId: campaign.id, status: 'active' });
  updateCampaignStatus(store, { campaignId: campaign.id, status: 'completed' });
  assert.throws(() => updateCampaignStatus(store, { campaignId: campaign.id, status: 'active' }), /cannot move from "completed"/);
});

test('recordSpend sums into a real, derived total -- never a stored, driftable field', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const campaign = createCampaign(store, { brandId: brand.id, name: 'X', budget: 100 });
  recordSpend(store, { campaignId: campaign.id, amount: 30 });
  recordSpend(store, { campaignId: campaign.id, amount: 20.5 });
  assert.strictEqual(campaignSpendTotal(store, campaign.id), 50.5);
  assert.strictEqual(campaignRemainingBudget(store, campaign.id), 49.5);
});

test('recordSpend refuses a non-positive amount', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const campaign = createCampaign(store, { brandId: brand.id, name: 'X' });
  assert.throws(() => recordSpend(store, { campaignId: campaign.id, amount: 0 }), /positive amount/);
});

test('campaignRemainingBudget is honestly null for an unbudgeted campaign', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const campaign = createCampaign(store, { brandId: brand.id, name: 'X' });
  assert.strictEqual(campaignRemainingBudget(store, campaign.id), null);
});

test('generateCampaignOptimization is an honest, labeled pending integration point', () => {
  assert.throws(() => generateCampaignOptimization(), PendingIntegrationError);
});
