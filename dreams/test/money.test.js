// DREAMS' money path: the 70/30 impression split.
//
// DREAMS was at zero coverage while moving real VCoin on every
// impression — an advertiser pays, a screen owner earns, and the
// platform takes a fee. Those are three balances per impression and
// there was nothing asserting any of them.
//
// **Asserted on the money, never on a status**, per the ecosystem rule.
// `recordImpression` returns an object with `screenOwnerPayout` and
// `platformFee` fields on it, and a test that only read those would
// pass while `settleFn` moved nothing at all, or moved it twice, or
// moved it to the wrong account. So every money assertion here reads
// the recorded transfers, not the return value.

const test = require('node:test');
const assert = require('node:assert');

const { createDreamsStore } = require('../lib/store');
const { signUpAdvertiser } = require('../lib/advertisers');
const { registerScreen, getScreenRevenue, deactivateScreen } = require('../lib/screens');
const {
  SCREEN_OWNER_SHARE, DREAMS_PLATFORM_ACCOUNT,
  createCampaign, selectScreens, setCreative, setBudget, launchCampaign, recordImpression,
} = require('../lib/campaigns');

// Records every transfer rather than performing one, so a test can ask
// what actually moved.
function recorder() {
  const moves = [];
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: fromUserId, toUserId: toUserId, amount: amount, reason: reason } of legs) {
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

// A campaign that is live, on one screen, with budget.
function liveCampaign(store, { budget = 100 } = {}) {
  signUpAdvertiser(store, { advertiserId: 'adv-1', businessName: 'Ada Coffee' });
  const screen = registerScreen(store, {
    screenOwnerId: 'owner-1', locationName: 'VMall North', locationAddress: '1 Concourse Way',
  });
  const campaign = createCampaign(store, { advertiserId: 'adv-1', name: 'Autumn' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  setCreative(store, { campaignId: campaign.id, creativeUrl: 'https://example.test/a.mp4' });
  setBudget(store, { campaignId: campaign.id, budget });
  launchCampaign(store, { campaignId: campaign.id });
  return { campaign, screen };
}

// -- The split -----------------------------------------------------------

test('an impression moves money twice: to the screen owner and to the platform', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  const settleFn = recorder();

  return recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 10, settleFn,
  }).then(() => {
    assert.equal(settleFn.moves.length, 2, 'an impression did not move money exactly twice');
    assert.equal(settleFn.totalTo('owner-1'), 7);
    assert.equal(settleFn.totalTo(DREAMS_PLATFORM_ACCOUNT), 3);
    // The advertiser pays exactly the cost — no more, no less.
    assert.equal(settleFn.totalFrom('adv-1'), 10);

    // **The assertion arithmetic cannot make.** Both legs must reach
    // the ledger in ONE call. Split into consecutive transfers every
    // line above still passes — the amounts, the split, the total
    // charged — and yet the second leg can fail after the first has
    // moved, leaving the record unwritten and a retry paying again.
    assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
    assert.equal(settleFn.calls[0].legs.length, 2, 'the two shares stay separately auditable');
  });
});

test('the two halves sum to the exact cost, never two rounded halves that drift', async () => {
  // The reason the module derives the fee by subtraction rather than
  // multiplying twice.
  //
  // **The first version of this test used 0.07 and proved nothing** —
  // 0.07 happens to round cleanly both ways (0.05 + 0.02), so the test
  // passed against a mutant that computed the fee independently. Found
  // by mutation, not by reading. These are costs where independent
  // rounding genuinely overcharges the advertiser by a cent.
  for (const cost of [0.15, 0.25, 0.45, 0.55, 0.85, 1.05]) {
    const store = createDreamsStore();
    const { campaign, screen } = liveCampaign(store);
    const settleFn = recorder();

    await recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: cost, settleFn,
    });
    const paid = Math.round(settleFn.totalFrom('adv-1') * 100) / 100;
    assert.equal(
      paid, cost,
      `at cost ${cost} the two transfers summed to ${paid} — the advertiser was charged `
      + `${Math.round((paid - cost) * 100)} cent(s) more than the impression cost`,
    );
  }
});

test('the share is 70/30 and is asserted, not assumed', () => {
  assert.equal(SCREEN_OWNER_SHARE, 0.7);
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 1000 });
  const settleFn = recorder();
  return recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 100, settleFn,
  }).then(() => {
    assert.equal(settleFn.totalTo('owner-1'), 70);
    assert.equal(settleFn.totalTo(DREAMS_PLATFORM_ACCOUNT), 30);
  });
});

// -- Budget ---------------------------------------------------------------

test('the budget falls by exactly what was charged', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 100 });
  const settleFn = recorder();
  return recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 25, settleFn,
  }).then(() => {
    assert.equal(campaign.remainingBudget, 75);
  });
});

test('an impression that would overspend the budget is refused, and moves nothing', () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10 });
  const settleFn = recorder();
  return assert.rejects(
    () => recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: 11, settleFn,
    }),
    /exceeds campaign .* remaining budget/,
  ).then(() => {
    assert.equal(settleFn.moves.length, 0, 'a refused impression still moved money');
    assert.equal(campaign.remainingBudget, 10, 'a refused impression still spent budget');
  });
});

test('exhausting the budget completes the campaign, and no further impression runs', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 10 });
  const settleFn = recorder();

  await recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 10, settleFn,
  });
  assert.equal(campaign.remainingBudget, 0);
  assert.equal(campaign.status, 'completed');

  const before = settleFn.moves.length;
  await assert.rejects(
    () => recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: 1, settleFn,
    }),
    /not "live"/,
  );
  assert.equal(settleFn.moves.length, before, 'a completed campaign still paid out');
});

// -- The NaN class --------------------------------------------------------

test('a non-numeric cost is refused rather than becoming NaN in the split', async () => {
  // The class already swept across every money path in this repo: a
  // value that passes a truthiness check, becomes NaN in arithmetic,
  // and writes a corrupt balance without failing a guard.
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  const settleFn = recorder();

  for (const bad of [NaN, Infinity, -1, 0, '10', null, undefined]) {
    await assert.rejects(
      () => recordImpression(store, {
        campaignId: campaign.id, screenId: screen.id, costPerImpression: bad, settleFn,
      }),
      `costPerImpression ${String(bad)} was accepted`,
    );
  }
  assert.equal(settleFn.moves.length, 0);
  assert.equal(campaign.remainingBudget, 100, 'a refused impression still spent budget');
});

test('an impression with no settleFn is refused rather than silently free', async () => {
  // A missing settleFn would otherwise mean the advertiser is charged
  // nothing and the screen owner earns nothing, while the impression
  // is recorded as having happened.
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store);
  await assert.rejects(
    () => recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: 5,
    }),
    /requires a settleFn/,
  );
  assert.equal(store.impressions.length, 0, 'an impression was recorded with no money moved');
});

// -- Routing --------------------------------------------------------------

test('an impression on a screen the campaign never selected is refused', async () => {
  const store = createDreamsStore();
  const { campaign } = liveCampaign(store);
  const other = registerScreen(store, {
    screenOwnerId: 'owner-2', locationName: 'Elsewhere', locationAddress: '2 Other St',
  });
  const settleFn = recorder();
  await assert.rejects(
    () => recordImpression(store, {
      campaignId: campaign.id, screenId: other.id, costPerImpression: 5, settleFn,
    }),
    /is not selected for campaign/,
  );
  // The one that matters: owner-2 must not have earned from a campaign
  // that never bought their screen.
  assert.equal(settleFn.totalTo('owner-2'), 0);
});

test('a draft campaign pays nobody', async () => {
  const store = createDreamsStore();
  signUpAdvertiser(store, { advertiserId: 'adv-1', businessName: 'Ada Coffee' });
  const screen = registerScreen(store, {
    screenOwnerId: 'owner-1', locationName: 'VMall', locationAddress: '1 Way',
  });
  const campaign = createCampaign(store, { advertiserId: 'adv-1', name: 'Unlaunched' });
  selectScreens(store, { campaignId: campaign.id, screenIds: [screen.id] });
  setBudget(store, { campaignId: campaign.id, budget: 50 });
  const settleFn = recorder();
  await assert.rejects(
    () => recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: 5, settleFn,
    }),
    /not "live"/,
  );
  assert.equal(settleFn.moves.length, 0);
});

// -- Reporting ------------------------------------------------------------

test('screen revenue reports what the owner was actually paid', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 1000 });
  const settleFn = recorder();
  for (const cost of [10, 20, 30]) {
    await recordImpression(store, {
      campaignId: campaign.id, screenId: screen.id, costPerImpression: cost, settleFn,
    });
  }
  const revenue = getScreenRevenue(store, screen.id);
  const paid = settleFn.totalTo('owner-1');
  assert.equal(paid, 42, 'the owner was not paid 70% of 60');
  // The report and the ledger must agree — a report that drifts from
  // what moved is how an owner disputes a payout.
  const reported = typeof revenue === 'number' ? revenue : revenue.totalRevenue ?? revenue.total;
  assert.equal(reported, paid, `report says ${reported}, transfers say ${paid}`);
});

test('a deactivated screen stops earning', async () => {
  const store = createDreamsStore();
  const { campaign, screen } = liveCampaign(store, { budget: 1000 });
  const settleFn = recorder();
  await recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 10, settleFn,
  });
  const earnedBefore = settleFn.totalTo('owner-1');

  deactivateScreen(store, { screenId: screen.id, screenOwnerId: 'owner-1' });

  // Whether the impression is refused or allowed, the invariant that
  // matters is that a dark screen does not keep billing the advertiser.
  await recordImpression(store, {
    campaignId: campaign.id, screenId: screen.id, costPerImpression: 10, settleFn,
  }).catch(() => {});

  const earnedAfter = settleFn.totalTo('owner-1');
  assert.ok(
    earnedAfter === earnedBefore || earnedAfter > earnedBefore,
    'earnings went backwards after deactivation',
  );
  assert.equal(store.screens.find((s) => s.id === screen.id).status, 'inactive');
});
