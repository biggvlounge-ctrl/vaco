// VENVM -- Campaign Dashboard's own data model: a real campaign under
// a brand, with a real budget and a real, append-only spend log --
// the same "derive the total fresh every time, never cache a number
// that can drift" discipline `growthPrograms.js`'s own
// `ambassadorScorecard` already holds for reward totals.
//
// Status is a real, enforced progression -- `draft` -> `active`, and
// from `active` either `paused` (resumable: back to `active`) or
// `completed` (terminal) -- deliberately looser than
// `productionPipeline.js`'s strictly linear stage machine, because a
// real campaign genuinely does pause and resume, a production job
// does not.
//
// "AI campaign optimization" / "viral campaign generation" are
// exactly the capabilities `growthPrograms.js`'s own header already
// refused to fake for the same reason: no generative/predictive model
// provider is configured in this environment. Not duplicated here;
// `generateCampaignOptimization` is this module's one real generative
// sliver, stubbed via `pendingIntegration.js`.

const { getBrand } = require('./brandManagement');
const { pendingGenerationCall } = require('./pendingIntegration');

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'];

// Real, enforced transitions -- keyed by current status, value is the
// set of statuses that may follow it. `completed` has none: a real
// finished campaign does not reopen.
const CAMPAIGN_TRANSITIONS = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function createCampaign(store, options = {}) {
  const { brandId, name, budget = null, startDate = null, endDate = null, now = Date.now() } = options;
  if (!getBrand(store, brandId)) throw new Error(`createCampaign: no brand with id ${brandId}`);
  requireString(name, 'name', 'createCampaign');
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error('createCampaign requires a non-negative budget, or null for an unbudgeted campaign');
  }

  const campaign = {
    id: store.nextCampaignId++,
    brandId,
    name: name.trim(),
    budget,
    startDate,
    endDate,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  store.campaigns.push(campaign);
  return campaign;
}

function getCampaign(store, campaignId) {
  return store.campaigns.find((c) => c.id === campaignId) || null;
}

function listCampaignsForBrand(store, brandId) {
  return store.campaigns.filter((c) => c.brandId === brandId);
}

function updateCampaignStatus(store, options = {}) {
  const { campaignId, status, now = Date.now() } = options;
  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`updateCampaignStatus: no campaign with id ${campaignId}`);
  if (!CAMPAIGN_STATUSES.includes(status)) {
    throw new Error(`updateCampaignStatus: "${status}" is not a real campaign status`);
  }
  const allowed = CAMPAIGN_TRANSITIONS[campaign.status];
  if (!allowed.includes(status)) {
    throw new Error(`updateCampaignStatus: campaign ${campaignId} cannot move from "${campaign.status}" to "${status}"`);
  }
  campaign.status = status;
  campaign.updatedAt = now;
  return campaign;
}

// A real, specific spend record against a real campaign -- never
// mutates a running total directly, the same append-and-derive
// pattern `growthPrograms.js` uses for reward totals.
function recordSpend(store, options = {}) {
  const { campaignId, amount, note = null, now = Date.now() } = options;
  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`recordSpend: no campaign with id ${campaignId}`);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('recordSpend requires a positive amount');
  }
  const entry = { id: store.nextCampaignSpendId++, campaignId, amount, note, recordedAt: now };
  store.campaignSpend.push(entry);
  return entry;
}

function campaignSpendTotal(store, campaignId) {
  return Math.round(
    store.campaignSpend
      .filter((s) => s.campaignId === campaignId)
      .reduce((sum, s) => sum + s.amount, 0) * 100,
  ) / 100;
}

// Honestly `null` for an unbudgeted campaign, never a guessed ceiling.
function campaignRemainingBudget(store, campaignId) {
  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`campaignRemainingBudget: no campaign with id ${campaignId}`);
  if (campaign.budget === null) return null;
  return Math.round((campaign.budget - campaignSpendTotal(store, campaignId)) * 100) / 100;
}

function generateCampaignOptimization() {
  return pendingGenerationCall('AI campaign optimization');
}

module.exports = {
  CAMPAIGN_STATUSES,
  createCampaign, getCampaign, listCampaignsForBrand, updateCampaignStatus,
  recordSpend, campaignSpendTotal, campaignRemainingBudget, generateCampaignOptimization,
};
