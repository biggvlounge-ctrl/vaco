// DREAMS -- every campaign must give something away before it can go
// live. Per direct instruction: "everything has to be used to give
// away something, a coupon, a percentage off, even if it's a large
// corporation."

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDreamsStore } = require('../lib/store');
const { signUpAdvertiser } = require('../lib/advertisers');
const { registerScreen } = require('../lib/screens');
const {
  INCENTIVE_TYPES, createCampaign, selectScreens, setCreative, setBudget, setIncentive, launchCampaign,
} = require('../lib/campaigns');

function draftCampaign(store) {
  signUpAdvertiser(store, { advertiserId: 'adv1', businessName: 'Big Corp' });
  const screen = registerScreen(store, { screenOwnerId: 'own1', locationName: 'V', locationAddress: 'L' });
  const campaign = createCampaign(store, { advertiserId: 'adv1', name: 'C' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  setCreative(store, { campaignId: campaign.id, creativeText: 'Buy this' });
  setBudget(store, { campaignId: campaign.id, budget: 50 });
  return campaign;
}

test('launchCampaign refuses a campaign with no incentive set -- even a large corporation', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  assert.throws(
    () => launchCampaign(store, { campaignId: campaign.id }),
    /has no incentive/,
  );
});

test('setIncentive accepts a real percent-off', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  setIncentive(store, { campaignId: campaign.id, type: 'percent-off', value: 20 });
  const launched = launchCampaign(store, { campaignId: campaign.id });
  assert.deepEqual(launched.incentive, { type: 'percent-off', value: 20, code: null });
});

test('setIncentive refuses a percent-off outside 0-100', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  assert.throws(
    () => setIncentive(store, { campaignId: campaign.id, type: 'percent-off', value: 150 }),
    /between 0 and 100/,
  );
});

test('setIncentive accepts a real amount-off', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  setIncentive(store, { campaignId: campaign.id, type: 'amount-off', value: 5 });
  const launched = launchCampaign(store, { campaignId: campaign.id });
  assert.equal(launched.incentive.type, 'amount-off');
});

test('setIncentive refuses a non-positive amount-off', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  assert.throws(
    () => setIncentive(store, { campaignId: campaign.id, type: 'amount-off', value: 0 }),
    /positive value/,
  );
});

test('setIncentive requires a code for a coupon incentive', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  assert.throws(
    () => setIncentive(store, { campaignId: campaign.id, type: 'coupon' }),
    /requires a code/,
  );
  setIncentive(store, { campaignId: campaign.id, type: 'coupon', code: 'HUNT10' });
  const launched = launchCampaign(store, { campaignId: campaign.id });
  assert.equal(launched.incentive.code, 'HUNT10');
});

test('setIncentive refuses an unrecognized type', () => {
  const store = createDreamsStore();
  const campaign = draftCampaign(store);
  assert.throws(
    () => setIncentive(store, { campaignId: campaign.id, type: 'bogus' }),
    new RegExp(INCENTIVE_TYPES.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
});

test('a campaign may select every active screen that exists -- no cap on growth', () => {
  const store = createDreamsStore();
  signUpAdvertiser(store, { advertiserId: 'adv1', businessName: 'Growing Co' });
  const screenIds = [];
  for (let i = 0; i < 25; i += 1) {
    screenIds.push(registerScreen(store, { screenOwnerId: 'own1', locationName: `V${i}`, locationAddress: 'L' }).id);
  }
  const campaign = createCampaign(store, { advertiserId: 'adv1', name: 'Scale' });
  selectScreens(store, { campaignId: campaign.id, screenIds });
  assert.equal(campaign.screenIds.length, 25);
});
