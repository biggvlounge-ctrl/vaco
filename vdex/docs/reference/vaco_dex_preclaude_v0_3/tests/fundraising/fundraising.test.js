'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCampaign, validateCampaign, recordContribution } = require('../../src/fundraising/campaign');
const { validateConnectorManifest, buildCampaignShare } = require('../../src/integrations/social/connector-contract');
const valid = { type: 'charitable_donation', title: 'Community food pantry', description: 'Help provide groceries and essential supplies to local families this winter.', goalCents: 250000, beneficiaryVerification: { status: 'pending' } };

test('creates a draft campaign with integer cents', () => { const r = createCampaign(valid); assert.equal(r.ok, true); assert.equal(r.campaign.raisedCents, 0); assert.equal(r.campaign.state, 'draft'); });
test('rejects unverified charitable beneficiary field omission', () => { const r = validateCampaign({ ...valid, beneficiaryVerification: undefined }); assert.equal(r.valid, false); });
test('rejects investment/securities offerings from donation module', () => { const r = validateCampaign({ ...valid, securitiesOffering: true }); assert.equal(r.valid, false); });
test('requires fulfillment disclosure for rewards and preorders', () => { const r = validateCampaign({ ...valid, type: 'business_reward' }); assert.equal(r.valid, false); });
test('rejects fractional cents and negative contributions', () => { const r = createCampaign(valid); const active = { ...r.campaign, state: 'active' }; assert.equal(recordContribution(active, { amountCents: 1.5, paymentStatus: 'confirmed', paymentReference: 'pay_1' }).ok, false); assert.equal(recordContribution(active, { amountCents: -100, paymentStatus: 'confirmed', paymentReference: 'pay_2' }).ok, false); });
test('does not count an unconfirmed or unreferenced payment', () => { const r = createCampaign(valid); const active = { ...r.campaign, state: 'active' }; assert.equal(recordContribution(active, { amountCents: 500, paymentStatus: 'pending', paymentReference: 'pay_3' }).ok, false); });
test('counts only a confirmed payment event', () => { const r = createCampaign(valid); const active = { ...r.campaign, state: 'active' }; const result = recordContribution(active, { amountCents: 500, currency: 'USD', paymentStatus: 'confirmed', paymentReference: 'pay_4' }); assert.equal(result.ok, true); assert.equal(result.campaign.raisedCents, 500); });
test('validates social connector capabilities', () => { assert.equal(validateConnectorManifest({ provider: 'tiktok', capabilities: ['share_link', 'publish_video'], authMode: 'oauth2' }).valid, true); assert.equal(validateConnectorManifest({ provider: 'bad', capabilities: ['scrape_private_messages'], authMode: 'oauth2' }).valid, false); });
test('requires HTTPS campaign links for social sharing', () => { assert.throws(() => buildCampaignShare({ campaignUrl: 'http://example.com' })); });
test('builds a share payload without publishing automatically', () => { const r = buildCampaignShare({ campaignUrl: 'https://example.org/c/123', title: 'Help out', message: 'Please share', provider: 'instagram' }); assert.equal(r.requiresUserAction, true); assert.equal(r.url, 'https://example.org/c/123'); });
