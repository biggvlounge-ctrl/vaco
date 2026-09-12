// DREAMS — an advertiser is never charged past the cap they set.
//
// **The bug this holds, measured before it was fixed.** `recordImpression`
// read `campaign.remainingBudget`, awaited the settlement, then
// decremented. Ten concurrent impressions at 10 VCoin each against a 10
// VCoin budget all passed the check, all settled, and all charged:
// **100 VCoin moved on a 10 VCoin cap, and `remainingBudget` ended at
// -90**.
//
// That is a different and worse consequence than the double-payout
// races found in VAGO. A double payout costs the house money it can
// see. This overcharges a customer past the limit they explicitly set,
// which is the kind of defect that is discovered by the person paying.
//
// The advertiser's budget is the whole promise of the product, so the
// property is stated as money moved rather than as internal state.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const campaigns = require('../lib/campaigns');
const screens = require('../lib/screens');
const advertisers = require('../lib/advertisers');
const { createDreamsStore } = require('../lib/store');

// The delay widens the race window. It is not what makes the race
// visible — `await` yields to the microtask queue even on a resolved
// promise — but it makes the failure reliable rather than occasional.
function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.spent = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

function liveCampaign(store, { budget = 10 } = {}) {
  advertisers.signUpAdvertiser(store, { advertiserId: 'adv1', businessName: 'A' });
  const screen = screens.registerScreen(store,
    { screenOwnerId: 'own1', locationName: 'V', locationAddress: 'L' });
  const campaign = campaigns.createCampaign(store, { advertiserId: 'adv1', name: 'C' });
  campaigns.selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  campaigns.setCreative(store, { campaignId: campaign.id, creativeText: 'Buy this' });
  campaigns.setBudget(store, { campaignId: campaign.id, budget });
  campaigns.launchCampaign(store, { campaignId: campaign.id });
  return { campaign, screen };
}

test('concurrent impressions cannot spend past the budget', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10 });
  const fn = ledger();

  await Promise.allSettled(Array.from({ length: 10 }, () => campaigns.recordImpression(store,
    { campaignId: campaign.id, screenId: screen.id, costPerImpression: 10, settleFn: fn })));

  assert.ok(fn.spent() <= 10,
    `an advertiser who capped spend at 10 VCoin was charged ${fn.spent()}`);
  const after = campaigns.getCampaign(store, campaign.id);
  assert.ok(after.remainingBudget >= 0,
    `remainingBudget went to ${after.remainingBudget} — a negative budget is an overspend already banked`);
});

test('the budget still spends down normally, one impression at a time', async () => {
  // The fix must not seize the budget it is protecting.
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10 });
  const fn = ledger({ delayMs: 0 });

  for (let i = 0; i < 5; i += 1) {
    await campaigns.recordImpression(store,
      { campaignId: campaign.id, screenId: screen.id, costPerImpression: 2, settleFn: fn });
  }
  assert.equal(fn.spent(), 10, 'five impressions at 2 VCoin did not spend the 10 VCoin budget');
  assert.equal(campaigns.getCampaign(store, campaign.id).remainingBudget, 0);
});

test('a failed settlement does not consume the budget', async () => {
  // The claim has to be handed back, or a ledger outage silently eats
  // the advertiser's money without delivering an impression.
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10 });
  const fn = ledger({ failFirstCall: true, delayMs: 0 });

  await assert.rejects(() => campaigns.recordImpression(store,
    { campaignId: campaign.id, screenId: screen.id, costPerImpression: 4, settleFn: fn }), /V3 unreachable/);

  assert.equal(campaigns.getCampaign(store, campaign.id).remainingBudget, 10,
    'a failed settlement spent budget on an impression nobody was charged for and nobody saw');

  // And the retry works.
  await campaigns.recordImpression(store,
    { campaignId: campaign.id, screenId: screen.id, costPerImpression: 4, settleFn: fn });
  assert.equal(fn.spent(), 4);
});
