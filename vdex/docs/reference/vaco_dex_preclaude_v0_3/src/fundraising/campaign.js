'use strict';

const CAMPAIGN_TYPES = new Set([
  'charitable_donation', 'personal_cause', 'community_project',
  'nonprofit_program', 'business_reward', 'product_preorder',
  'event', 'peer_to_peer', 'membership'
]);
const FUNDING_MODELS = new Set(['all_or_nothing', 'keep_what_you_raise']);
const CAMPAIGN_STATES = new Set(['draft', 'pending_review', 'active', 'paused', 'funded', 'ended', 'rejected']);

function validateCampaign(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['Campaign must be an object'] };
  if (!CAMPAIGN_TYPES.has(input.type)) errors.push('Unsupported campaign type');
  if (typeof input.title !== 'string' || input.title.trim().length < 5 || input.title.trim().length > 120) errors.push('Title must be 5–120 characters');
  if (typeof input.description !== 'string' || input.description.trim().length < 20) errors.push('Description must be at least 20 characters');
  if (!Number.isSafeInteger(input.goalCents) || input.goalCents < 0) errors.push('goalCents must be a non-negative integer');
  if (input.fundingModel && !FUNDING_MODELS.has(input.fundingModel)) errors.push('Unsupported funding model');
  if (input.currency && !/^[A-Z]{3}$/.test(input.currency)) errors.push('currency must be an ISO-style three-letter code');
  if (input.type === 'charitable_donation' && !input.beneficiaryVerification) errors.push('Charitable beneficiary verification is required before activation');
  if (input.type === 'business_reward' || input.type === 'product_preorder') {
    if (!input.fulfillmentDisclosure) errors.push('Reward/preorder fulfillment disclosure is required');
  }
  if (input.type === 'investment' || input.securitiesOffering === true) errors.push('Securities offerings are not supported by this donation/reward campaign module');
  return { valid: errors.length === 0, errors };
}

function createCampaign(input, now = new Date().toISOString()) {
  const validation = validateCampaign(input);
  if (!validation.valid) return { ok: false, errors: validation.errors };
  return {
    ok: true,
    campaign: {
      id: input.id || `fc_${require('crypto').randomUUID()}`,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      goalCents: input.goalCents,
      raisedCents: 0,
      currency: input.currency || 'USD',
      fundingModel: input.fundingModel || 'keep_what_you_raise',
      state: 'draft',
      ownerId: input.ownerId || null,
      beneficiaryVerification: input.beneficiaryVerification || null,
      fulfillmentDisclosure: input.fulfillmentDisclosure || null,
      createdAt: now,
      updatedAt: now,
      version: 1
    }
  };
}

function recordContribution(campaign, contribution) {
  if (!campaign || campaign.state !== 'active') return { ok: false, error: 'Campaign is not active' };
  if (!contribution || !Number.isSafeInteger(contribution.amountCents) || contribution.amountCents <= 0) return { ok: false, error: 'Contribution amount must be a positive integer in cents' };
  if (contribution.currency && contribution.currency !== campaign.currency) return { ok: false, error: 'Currency mismatch' };
  // This records a confirmed external payment event only; it does not process or hold funds.
  if (contribution.paymentStatus !== 'confirmed' || !contribution.paymentReference) return { ok: false, error: 'A confirmed payment reference is required' };
  return { ok: true, campaign: { ...campaign, raisedCents: campaign.raisedCents + contribution.amountCents, updatedAt: new Date().toISOString(), version: campaign.version + 1 } };
}

module.exports = { CAMPAIGN_TYPES, CAMPAIGN_STATES, validateCampaign, createCampaign, recordContribution };
