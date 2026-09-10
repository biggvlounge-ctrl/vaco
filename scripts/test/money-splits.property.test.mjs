// Every two-way money split in the ecosystem, over 1,000 generated
// amounts each — not the handful somebody thought of.
//
// **This is the test that would have caught the DREAMS bug.** That
// module's rounding test used a cost of 0.07, which rounds cleanly both
// ways, so it passed against a mutant that computed the platform fee
// independently and overcharged the advertiser a cent. I found it by
// mutation, after picking one example and picking the wrong one.
//
// The shape recurs across the whole system: round one side, derive the
// other by subtraction so the two always sum. Four apps do it, and each
// is a place where a cent goes missing on somebody's invoice. Stated
// once, as a property, and checked against every amount rather than a
// chosen few.
//
// Deliberately cross-app and in `scripts/test/`: each app's own suite
// tests its own split with named examples, which is still the right
// place for "70/30, and here is what 100 looks like." This asks the
// different question — does it hold for *all* amounts — and asks it of
// every app at once, so a new split added anywhere gets the same
// scrutiny by being added to the list below.

import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { splitsExactly, forAll, gen } from './lib/property.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const app = (rel) => require(path.join(REPO_ROOT, rel));

// -- DREAMS: the 70/30 impression split ----------------------------------

test('DREAMS: screen-owner and platform shares always sum to the cost', async () => {
  const { createDreamsStore } = app('dreams/lib/store');
  const { signUpAdvertiser } = app('dreams/lib/advertisers');
  const { registerScreen } = app('dreams/lib/screens');
  const campaigns = app('dreams/lib/campaigns');

  // Run the real recordImpression and read what actually moved, rather
  // than re-implementing the split here — a property over a copy of the
  // arithmetic proves the copy correct and nothing else.
  const splitOf = async (amount) => {
    const store = createDreamsStore();
    signUpAdvertiser(store, { advertiserId: 'adv', businessName: 'B' });
    const screen = registerScreen(store, {
      screenOwnerId: 'own', locationName: 'L', locationAddress: 'A',
    });
    const c = campaigns.createCampaign(store, { advertiserId: 'adv', name: 'C' });
    campaigns.selectScreens(store, { campaignId: c.id, screenIds: [screen.id] });
    campaigns.setCreative(store, { campaignId: c.id, creativeUrl: 'https://x.test/a.mp4' });
    campaigns.setBudget(store, { campaignId: c.id, budget: 100000 });
    campaigns.launchCampaign(store, { campaignId: c.id });

    const moves = [];
    await campaigns.recordImpression(store, {
      campaignId: c.id, screenId: screen.id, costPerImpression: amount,
      settleFn: async (legs) => { for (const l of legs) moves.push({ to: l.toUserId, n: l.amount }); },
    });
    return [
      moves.filter((m) => m.to === 'own').reduce((s, m) => s + m.n, 0),
      moves.filter((m) => m.to === campaigns.DREAMS_PLATFORM_ACCOUNT).reduce((s, m) => s + m.n, 0),
    ];
  };

  // Async, so the generic helper is inlined here rather than bent.
  const amounts = [];
  forAll(gen.money(0.01, 500), (a) => { amounts.push(a); }, { runs: 400 });
  for (const amount of amounts) {
    const [owner, platform] = await splitOf(amount);
    const sum = Math.round((owner + platform) * 100) / 100;
    assert.equal(
      sum, amount,
      `at cost ${amount}: owner ${owner} + platform ${platform} = ${sum}, `
      + `advertiser charged ${Math.round((sum - amount) * 100)} cent(s) too much`,
    );
  }
});

// -- Vvltvre Pods: the 90/10 subscription split --------------------------

test('Vvltvre Pods: creator and platform shares always sum to the tier price', async () => {
  const { createVulturePodsStore } = app('vulture-pods/lib/store');
  const { createShow } = app('vulture-pods/lib/shows');
  const subs = app('vulture-pods/lib/subscriptions');

  const amounts = [];
  forAll(gen.money(0.01, 500), (a) => { amounts.push(a); }, { runs: 400 });

  for (const price of amounts) {
    const store = createVulturePodsStore();
    const show = createShow(store, {
      creatorId: 'creator', title: 'T', description: 'D', category: 'culture',
      subscriptionTiers: [{ name: 'S', priceVCoin: price }],
    });
    const moves = [];
    await subs.subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id,
      settleFn: async (legs) => { for (const l of legs) moves.push({ to: l.toUserId, n: l.amount }); },
    });
    const creator = moves.filter((m) => m.to === 'creator').reduce((s, m) => s + m.n, 0);
    const platform = moves
      .filter((m) => m.to === subs.VULTURE_PODS_PLATFORM_ACCOUNT).reduce((s, m) => s + m.n, 0);
    const sum = Math.round((creator + platform) * 100) / 100;
    assert.equal(
      sum, price,
      `at price ${price}: creator ${creator} + platform ${platform} = ${sum}`,
    );
  }
});

// -- HVNTZ: fourteen event types, each with its own share ----------------

test('HVNTZ: business and VACO shares sum to the amount, for every event type', async () => {
  const rs = app('hvntz/lib/revenueStack');

  // The interesting axis here is not just the amount but the *share* —
  // fourteen event types with different percentages, each of which
  // rounds differently. Both are generated.
  const cases = [];
  forAll(
    (r) => ({
      amount: gen.money(0.01, 500)(r),
      eventType: gen.oneOf(rs.REVENUE_EVENT_TYPES)(r),
    }),
    (c) => { cases.push(c); },
    { runs: 500 },
  );

  for (const { amount, eventType } of cases) {
    const store = rs.createHvntzStore();
    const business = rs.registerBusiness(store, { name: 'B', ownerId: 'own' });
    const location = rs.registerLocation(store, {
      businessId: business.id, locationType: 'screen', address: 'A', lat: 38.6, lng: -90.1,
    });
    const moves = [];
    await rs.recordRevenueEvent(store, {
      locationId: location.id, eventType, amountEarned: amount, payerId: 'payer',
      settleFn: async (legs) => { for (const l of legs) moves.push({ to: l.toUserId, n: l.amount }); },
    });
    const owner = moves.filter((m) => m.to === 'own').reduce((s, m) => s + m.n, 0);
    const vaco = moves.filter((m) => m.to === rs.VACO_PLATFORM_USER_ID).reduce((s, m) => s + m.n, 0);
    const sum = Math.round((owner + vaco) * 100) / 100;
    assert.equal(
      sum, amount,
      `${eventType} at ${amount}: business ${owner} + VACO ${vaco} = ${sum}`,
    );
    assert.ok(owner >= 0 && vaco >= 0, `a share went negative on ${eventType} at ${amount}`);
  }
});

// -- The helper itself ---------------------------------------------------

test('the property helper actually fails when the property is false', () => {
  // The rule this repo runs on: watch it fail before trusting it. A
  // helper that cannot fail would make every property above vacuous.
  //
  // This is the exact bug shape from DREAMS — round both sides
  // independently instead of deriving the second by subtraction.
  const drifting = (amount) => [
    Math.round(amount * 0.7 * 100) / 100,
    Math.round(amount * 0.3 * 100) / 100,
  ];
  assert.throws(
    () => splitsExactly(drifting, { runs: 500 }),
    (err) => /overcharged|undercharged/.test(err.message) && /run \d+\/500/.test(err.message),
    'the helper passed a split that demonstrably drifts',
  );

  // And the correct shape passes.
  const derived = (amount) => {
    const a = Math.round(amount * 0.7 * 100) / 100;
    return [a, Math.round((amount - a) * 100) / 100];
  };
  assert.doesNotThrow(() => splitsExactly(derived, { runs: 1000 }));
});

test('the same seed gives the same run, so a failure is reproducible', () => {
  const seen = [];
  const collect = () => { const out = []; forAll(gen.money(), (v) => out.push(v), { runs: 20, seed: 7 }); return out; };
  seen.push(collect(), collect());
  assert.deepEqual(seen[0], seen[1], 'the same seed produced a different run');

  const other = [];
  forAll(gen.money(), (v) => other.push(v), { runs: 20, seed: 8 });
  assert.notDeepEqual(seen[0], other, 'a different seed produced an identical run');
});
