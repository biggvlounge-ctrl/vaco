// DREAMS -- the Dreams Wallet: collecting a campaign's own incentive
// by a real, identified scan, separate from the anonymous billing
// event `recordScan` already records. See lib/wallet.js's own header
// for why the two are deliberately independent.

const test = require('node:test');
const assert = require('node:assert');

const { createDreamsStore } = require('../lib/store');
const { signUpAdvertiser } = require('../lib/advertisers');
const { registerScreen } = require('../lib/screens');
const {
  createCampaign, selectScreens, setCreative, setBudget, setIncentive, launchCampaign, getCampaign,
} = require('../lib/campaigns');
const { collectIncentive, getWalletEntry, listWalletForUser, redeemIncentive } = require('../lib/wallet');

// Same fixture shape as test/scanSale.test.js's own `liveCampaign`,
// kept local rather than imported so this file has no coupling to
// another test file's internals.
function liveCampaign(store, { budget = 100, incentive = { type: 'percent-off', value: 15 } } = {}) {
  signUpAdvertiser(store, { advertiserId: 'adv-1', businessName: 'Ada Coffee' });
  const screen = registerScreen(store, {
    screenOwnerId: 'renter-1', locationName: 'Drop Pop Shop @ Cherokee', locationAddress: '1 Cherokee St',
  });
  const campaign = createCampaign(store, { advertiserId: 'adv-1', name: 'Autumn' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  setCreative(store, { campaignId: campaign.id, creativeUrl: 'https://example.test/a.mp4' });
  setBudget(store, { campaignId: campaign.id, budget });
  setIncentive(store, { campaignId: campaign.id, ...incentive });
  launchCampaign(store, { campaignId: campaign.id });
  return { campaign, screen };
}

function collect(store, campaign, screen, userId = 'scanner-1', now = undefined) {
  return collectIncentive(store, {
    userId, campaignId: campaign.id, screenId: screen.id, campaign: getCampaign(store, campaign.id),
    ...(now !== undefined ? { now } : {}),
  });
}

// -- Collecting -----------------------------------------------------

test('a real scan collects the campaign\'s own incentive into the wallet', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { incentive: { type: 'coupon', code: 'AUTUMN15' } });
  const entry = collect(store, campaign, screen);

  assert.equal(entry.userId, 'scanner-1');
  assert.equal(entry.campaignId, campaign.id);
  assert.equal(entry.advertiserId, 'adv-1');
  assert.deepEqual(entry.incentive, { type: 'coupon', value: null, code: 'AUTUMN15' });
  assert.equal(entry.redeemedAt, null);
  assert.ok(entry.collectedAt);
});

test('one collected item per person per campaign — a second scan is refused, not a second coupon', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  collect(store, campaign, screen);
  assert.throws(() => collect(store, campaign, screen), /already collected/);
  assert.equal(listWalletForUser(store, 'scanner-1').length, 1, 'a refused second scan must not add a second entry');
});

test('two different people scanning the same campaign each get their own entry', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  collect(store, campaign, screen, 'scanner-1');
  collect(store, campaign, screen, 'scanner-2');
  assert.equal(listWalletForUser(store, 'scanner-1').length, 1);
  assert.equal(listWalletForUser(store, 'scanner-2').length, 1);
});

test('a screen not actually selected for the campaign is refused', () => {
  const store = createDreamsStore();
  const { campaign } = liveCampaign(store);
  const otherScreen = registerScreen(store, { screenOwnerId: 'renter-2', locationName: 'Elsewhere', locationAddress: '2 Elsewhere St' });
  assert.throws(
    () => collectIncentive(store, { userId: 'scanner-1', campaignId: campaign.id, screenId: otherScreen.id, campaign: getCampaign(store, campaign.id) }),
    /not selected/,
  );
});

test('a campaign that is not live refuses collection', () => {
  const store = createDreamsStore();
  signUpAdvertiser(store, { advertiserId: 'adv-1', businessName: 'Ada Coffee' });
  const screen = registerScreen(store, { screenOwnerId: 'renter-1', locationName: 'Drop Pop Shop', locationAddress: '1 Cherokee St' });
  const campaign = createCampaign(store, { advertiserId: 'adv-1', name: 'Draft' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  assert.throws(
    () => collectIncentive(store, { userId: 'scanner-1', campaignId: campaign.id, screenId: screen.id, campaign }),
    /not "live"/,
  );
});

test('collecting is free — it never calls or depends on a settlement function', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  // collectIncentive takes no settleFn at all; this test exists so a
  // future edit that tries to thread one through fails loudly here
  // rather than silently coupling the wallet to billing.
  assert.equal(typeof collectIncentive, 'function');
  assert.equal(collectIncentive.length, 1, 'collectIncentive should take exactly one options object, no settleFn parameter');
  collect(store, campaign, screen);
});

// -- Redeeming --------------------------------------------------------

test('redeeming marks the entry used', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  const entry = collect(store, campaign, screen);
  const redeemed = redeemIncentive(store, { userId: 'scanner-1', entryId: entry.id });
  assert.ok(redeemed.redeemedAt);
  assert.equal(getWalletEntry(store, entry.id).redeemedAt, redeemed.redeemedAt);
});

test('redeeming the same entry twice is refused — a coupon is torn off once', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  const entry = collect(store, campaign, screen);
  redeemIncentive(store, { userId: 'scanner-1', entryId: entry.id });
  assert.throws(() => redeemIncentive(store, { userId: 'scanner-1', entryId: entry.id }), /already redeemed/);
});

test('redeeming someone else\'s entry is refused, even with the right entryId', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  const entry = collect(store, campaign, screen, 'scanner-1');
  assert.throws(
    () => redeemIncentive(store, { userId: 'scanner-2', entryId: entry.id }),
    /only the person who collected/,
  );
  assert.equal(getWalletEntry(store, entry.id).redeemedAt, null, 'a refused redemption must not mark the entry used');
});

// -- Listing ----------------------------------------------------------

test('listWalletForUser returns only that user\'s entries, newest first', () => {
  const store = createDreamsStore();
  const { campaign: c1, screen } = liveCampaign(store, { budget: 50 });
  collect(store, c1, screen, 'scanner-1', 1000);

  signUpAdvertiser(store, { advertiserId: 'adv-2', businessName: 'Bea Bakery' });
  const campaign2 = createCampaign(store, { advertiserId: 'adv-2', name: 'Spring' });
  selectScreens(store, { campaignId: campaign2.id, screenIds: [screen.id] });
  setCreative(store, { campaignId: campaign2.id, creativeUrl: 'https://example.test/b.mp4' });
  setBudget(store, { campaignId: campaign2.id, budget: 50 });
  setIncentive(store, { campaignId: campaign2.id, type: 'amount-off', value: 5 });
  launchCampaign(store, { campaignId: campaign2.id });
  const second = collectIncentive(store, {
    userId: 'scanner-1', campaignId: campaign2.id, screenId: screen.id, campaign: getCampaign(store, campaign2.id), now: 2000,
  });

  collect(store, c1, screen, 'scanner-2', 3000);

  const mine = listWalletForUser(store, 'scanner-1');
  assert.equal(mine.length, 2);
  assert.equal(mine[0].id, second.id, 'the most recently collected item should be first');
  assert.ok(mine.every((e) => e.userId === 'scanner-1'));
});
