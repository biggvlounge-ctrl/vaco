// DREAMS' scan and sale revenue -- the founder's own follow-up on VOID
// DROP's screens: "we will run our ads... plus the renter's personal
// ads, [and the renter] will receive a small percentage of scans and
// sales on the screens." Two new chargeable events alongside the
// existing impression: a scan (priced per-event, same shape as an
// impression, set via `setScanPricing`) and a sale (commissioned as a
// percentage of the sale's own real value, set via `setSaleCommission`
// -- a referral-commission shape, not a flat cost). Both split
// SCREEN_OWNER_SHARE/the remainder the same way an impression does, so
// whoever is registered as a screen's owner at the time -- the renter,
// for a VOID DROP asset deployed to their location -- is who actually
// gets paid.
//
// Same posture as money.test.js: every assertion reads the recorded
// transfers, never just the return value.

const test = require('node:test');
const assert = require('node:assert');

const { createDreamsStore } = require('../lib/store');
const { signUpAdvertiser } = require('../lib/advertisers');
const { registerScreen } = require('../lib/screens');
const {
  DREAMS_PLATFORM_ACCOUNT,
  createCampaign, selectScreens, setCreative, setBudget, setIncentive, launchCampaign,
  setScanPricing, setSaleCommission, recordScan, recordSale,
} = require('../lib/campaigns');

function recorder() {
  const moves = [];
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId, toUserId, amount, reason } of legs) {
      moves.push({ fromUserId, toUserId, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  fn.totalFrom = (who) => moves.filter((m) => m.fromUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

// A draft campaign, on one screen, with budget -- not yet launched,
// so scan pricing/sale commission (both draft-only setters, like every
// other campaign setup step) can still be applied by the caller.
function draftCampaign(store, { budget = 100 } = {}) {
  signUpAdvertiser(store, { advertiserId: 'adv-1', businessName: 'Ada Coffee' });
  const screen = registerScreen(store, {
    screenOwnerId: 'renter-1', locationName: 'Drop Pop Shop @ Cherokee', locationAddress: '1 Cherokee St',
  });
  const campaign = createCampaign(store, { advertiserId: 'adv-1', name: 'Autumn' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  setCreative(store, { campaignId: campaign.id, creativeUrl: 'https://example.test/a.mp4' });
  setBudget(store, { campaignId: campaign.id, budget });
  setIncentive(store, { campaignId: campaign.id, type: 'percent-off', value: 15 });
  return { campaign, screen };
}

// A campaign that is live, on one screen, with budget -- optionally
// with scan pricing and/or sale commission set before launch.
function liveCampaign(store, { budget = 100, costPerScan = null, saleCommissionRate = null } = {}) {
  const { campaign, screen } = draftCampaign(store, { budget });
  if (costPerScan !== null) setScanPricing(store, { campaignId: campaign.id, costPerScan });
  if (saleCommissionRate !== null) setSaleCommission(store, { campaignId: campaign.id, saleCommissionRate });
  launchCampaign(store, { campaignId: campaign.id });
  return { campaign, screen };
}

// -- Scans --------------------------------------------------------------

test('setScanPricing validates and recordScan refuses to run without it', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  assert.throws(() => setScanPricing(store, { campaignId: 999, costPerScan: 1 }), /no campaign/);

  const settleFn = recorder();
  await assert.rejects(
    () => recordScan(store, { campaignId: campaign.id, screenId: screen.id, settleFn }),
    /no costPerScan set/,
  );
});

test('a scan moves money twice, split 70/30, to the registered screen owner', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 1000, costPerScan: 50 });

  const settleFn = recorder();
  const scan = await recordScan(store, { campaignId: campaign.id, screenId: screen.id, settleFn });

  assert.equal(settleFn.moves.length, 2, 'a scan did not move money exactly twice');
  assert.equal(settleFn.totalTo('renter-1'), 35);
  assert.equal(settleFn.totalTo(DREAMS_PLATFORM_ACCOUNT), 15);
  assert.equal(settleFn.totalFrom('adv-1'), 50);
  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.equal(scan.screenOwnerPayout, 35);
  assert.equal(campaign.remainingBudget, 950, 'a scan draws down the campaign budget like an impression');
});

test('a scan that would overspend the budget is refused, and moves nothing', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10, costPerScan: 11 });

  const settleFn = recorder();
  await assert.rejects(
    () => recordScan(store, { campaignId: campaign.id, screenId: screen.id, settleFn }),
    /exceeds campaign .* remaining budget/,
  );
  assert.equal(settleFn.moves.length, 0);
  assert.equal(campaign.remainingBudget, 10);
});

// -- Sales ----------------------------------------------------------------

test('setSaleCommission validates its rate before launch, and recordSale refuses to run without it', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = draftCampaign(store);
  assert.throws(
    () => setSaleCommission(store, { campaignId: campaign.id, saleCommissionRate: 0 }),
    /between 0 \(exclusive\) and 1/,
  );
  assert.throws(
    () => setSaleCommission(store, { campaignId: campaign.id, saleCommissionRate: 1.5 }),
    /between 0 \(exclusive\) and 1/,
  );
  launchCampaign(store, { campaignId: campaign.id });

  const settleFn = recorder();
  await assert.rejects(
    () => recordSale(store, { campaignId: campaign.id, screenId: screen.id, saleAmount: 40, settleFn }),
    /no saleCommissionRate set/,
  );
});

test('a sale commissions a small percentage of its own real value, split 70/30', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 1000, saleCommissionRate: 0.05 });

  const settleFn = recorder();
  // A real $200 sale at a renter's drop pop shop, attributed to this
  // screen's ad -- a 5% commission is $10, split 70/30.
  const sale = await recordSale(store, {
    campaignId: campaign.id, screenId: screen.id, saleAmount: 200, settleFn,
  });

  assert.equal(sale.commission, 10);
  assert.equal(settleFn.totalTo('renter-1'), 7);
  assert.equal(settleFn.totalTo(DREAMS_PLATFORM_ACCOUNT), 3);
  assert.equal(settleFn.totalFrom('adv-1'), 10, 'the commission, not the full sale amount, is what moves');
  assert.equal(settleFn.calls.length, 1);
});

test('a sale is not metered against the campaign ad-spend budget', async () => {
  const store = createDreamsStore();
  // A tiny budget that a sale's commission would never fit if it drew
  // from the same pool an impression does.
  const { campaign, screen } = liveCampaign(store, { budget: 1, saleCommissionRate: 0.05 });

  const settleFn = recorder();
  await recordSale(store, { campaignId: campaign.id, screenId: screen.id, saleAmount: 500, settleFn });
  assert.equal(campaign.remainingBudget, 1, 'a sale commission must not draw down the ad-spend budget');
});

test('recordSale requires a positive saleAmount', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { saleCommissionRate: 0.05 });

  const settleFn = recorder();
  await assert.rejects(
    () => recordSale(store, { campaignId: campaign.id, screenId: screen.id, saleAmount: 0, settleFn }),
    /requires a positive saleAmount/,
  );
});

test('a sale against a screen not selected for the campaign is refused', async () => {
  const store = createDreamsStore();
  const { campaign } = liveCampaign(store, { saleCommissionRate: 0.05 });
  const otherScreen = registerScreen(store, {
    screenOwnerId: 'renter-2', locationName: 'Other Lot', locationAddress: '2 Other St',
  });

  const settleFn = recorder();
  await assert.rejects(
    () => recordSale(store, { campaignId: campaign.id, screenId: otherScreen.id, saleAmount: 100, settleFn }),
    /not selected for campaign/,
  );
});
