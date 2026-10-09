'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPropertyStore, purchaseHome, homeOwnedBy, advanceLifecycle, upgradeHome,
  rentHome, buyRentedHome, HOME_PRICE, RENT_PRICE, LIFECYCLE, PROPERTY_LEVELS,
  MATERIALS_REQUIRED, materialsDeltaFor, purchaseLand, LAND_PRICE, buildUnauthorized,
  demolishUnauthorized, listUnauthorized, commercialOwnedBy, purchaseCommercial,
  upgradeCommercial, COMMERCIAL_LEVELS, operateBusiness, canOperateBusiness,
  BASE_COMMERCIAL_REVENUE, BUSINESS_REVENUE_ACCOUNT, OPERATE_COOLDOWN_MS,
  PUBLIC_HOUSING_NAME, assignPublicHousing, isInPublicHousing, vacatePublicHousing,
  grantFoundingBusiness, FOUNDING_BUSINESS_CATEGORIES,
} from '../src/lib/property.js';
import {
  createResourcesStore, spendMaterials, undoSpend, materialsFor, STARTING_OLD_WORLD_STOCK,
} from '../src/lib/resources.js';
import { TOWN_NAME } from '../src/lib/town.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('purchaseHome claims the property before the transfer, and charges the real price', async () => {
  const store = createPropertyStore();
  const calls = [];
  const home = await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, HOME_PRICE);
  assert.equal(home.ownerId, 'alice');
  assert.equal(homeOwnedBy(store, 'alice').id, home.id);
});

test('a failed purchase rolls the claim back -- no home left on the books', async () => {
  const store = createPropertyStore();
  const calls = [];
  await assert.rejects(
    purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls, { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice'), null, 'a declined charge must not leave a home on the books');
  assert.equal(store.properties.length, 0);
});

test('a second home is refused for someone who already owns one', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /already owns a home/,
  );
});

test('advanceLifecycle moves one real stage at a time and stops at the end', () => {
  const property = { lifecycleStage: LIFECYCLE[0] };
  for (let i = 0; i < LIFECYCLE.length + 3; i += 1) advanceLifecycle(property);
  assert.equal(property.lifecycleStage, LIFECYCLE[LIFECYCLE.length - 1], 'lifecycle must not run past its last real stage');
});

test('there are 5 tower levels, and the entry-level ones carry the VXLLAGE/town brand', () => {
  assert.equal(PROPERTY_LEVELS.length, 5);
  assert.ok(PROPERTY_LEVELS[0].name.includes('VXLLAGE'));
  assert.ok(PROPERTY_LEVELS[0].name.includes(TOWN_NAME));
  assert.ok(PROPERTY_LEVELS[1].name.includes('VXLLAGE'));
  assert.ok(!PROPERTY_LEVELS[2].name.includes('VXLLAGE'), 'tier 3+ moves out of the VXLLAGE complex');
});

test('a purchased home starts at the first tower level', async () => {
  const store = createPropertyStore();
  const home = await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  assert.equal(home.level, PROPERTY_LEVELS[0].level);
  assert.equal(home.levelName, PROPERTY_LEVELS[0].name);
});

test('upgradeHome charges only the price difference between levels, not the next level\'s full price', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  const calls = [];
  const home = await upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(home.level, PROPERTY_LEVELS[1].level);
  assert.equal(home.levelName, PROPERTY_LEVELS[1].name);
  assert.equal(calls[0].amount, PROPERTY_LEVELS[1].price - PROPERTY_LEVELS[0].price);
});

test('a failed upgrade rolls the level back', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice').level, PROPERTY_LEVELS[0].level, 'a declined charge must not leave the home upgraded');
});

test('materialsDeltaFor charges only the real difference, and level 1 costs nothing to move into', () => {
  assert.deepEqual(MATERIALS_REQUIRED[1], { wood: 0, stone: 0, clay: 0, ore: 0 });
  assert.deepEqual(materialsDeltaFor(1, 2), MATERIALS_REQUIRED[2]);
  assert.deepEqual(
    materialsDeltaFor(2, 3),
    {
      wood: MATERIALS_REQUIRED[3].wood - MATERIALS_REQUIRED[2].wood,
      stone: MATERIALS_REQUIRED[3].stone - MATERIALS_REQUIRED[2].stone,
      clay: MATERIALS_REQUIRED[3].clay - MATERIALS_REQUIRED[2].clay,
      ore: MATERIALS_REQUIRED[3].ore - MATERIALS_REQUIRED[2].ore,
    },
  );
});

test('upgradeHome spends real materials before charging VCoin, when wired to a resources store', async () => {
  const store = createPropertyStore();
  const resourcesStore = createResourcesStore();
  resourcesStore.materials.alice = { wood: 100, stone: 100, clay: 100, ore: 100 };
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });

  const calls = [];
  const home = await upgradeHome(store, {
    ownerId: 'alice', transferFn: fakeTransfer(calls), resourcesStore,
    spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
  });

  assert.equal(home.level, PROPERTY_LEVELS[1].level);
  const delta = materialsDeltaFor(1, 2);
  assert.equal(materialsFor(resourcesStore, 'alice').wood, 100 - delta.wood);
  assert.equal(materialsFor(resourcesStore, 'alice').stone, 100 - delta.stone);
  // No local shortfall at these quantities, so the import stock must
  // not have moved at all.
  assert.equal(resourcesStore.oldWorldStock, STARTING_OLD_WORLD_STOCK);
});

test('upgradeHome refuses an upgrade nobody has the materials for, and charges no VCoin for it', async () => {
  const store = createPropertyStore();
  const resourcesStore = createResourcesStore();
  resourcesStore.oldWorldStock = 0;
  resourcesStore.materials.alice = { wood: 0, stone: 0, clay: 0, ore: 0 };
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });

  const calls = [];
  await assert.rejects(
    upgradeHome(store, {
      ownerId: 'alice', transferFn: fakeTransfer(calls), resourcesStore,
      spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
    }),
    /short/,
  );
  assert.equal(calls.length, 0, 'insufficient materials must refuse before VCoin is ever charged');
  assert.equal(homeOwnedBy(store, 'alice').level, PROPERTY_LEVELS[0].level, 'a refused upgrade must not leave the level bumped');
});

test('upgradeHome undoes a real materials spend when the VCoin transfer then fails', async () => {
  const store = createPropertyStore();
  const resourcesStore = createResourcesStore();
  resourcesStore.materials.alice = { wood: 100, stone: 100, clay: 100, ore: 100 };
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });

  await assert.rejects(
    upgradeHome(store, {
      ownerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }), resourcesStore,
      spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
    }),
  );

  assert.deepEqual(
    materialsFor(resourcesStore, 'alice'),
    { wood: 100, stone: 100, clay: 100, ore: 100 },
    'a declined VCoin charge must not leave materials spent for an upgrade that never happened',
  );
  assert.equal(resourcesStore.oldWorldStock, STARTING_OLD_WORLD_STOCK);
  assert.equal(homeOwnedBy(store, 'alice').level, PROPERTY_LEVELS[0].level);
});

test('upgradeHome still works with no resources wiring at all — materials stay optional', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  const home = await upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  assert.equal(home.level, PROPERTY_LEVELS[1].level);
});

test('upgradeHome refuses someone with no home, and refuses past the top level', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /does not own a home/,
  );

  await purchaseHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  for (let i = 1; i < PROPERTY_LEVELS.length; i += 1) {
    await upgradeHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  }
  await assert.rejects(
    upgradeHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) }),
    /already at the top level/,
  );
});

test('rentHome charges the cheap rent price, not the full purchase price, and always starts at a Studio', async () => {
  const store = createPropertyStore();
  const calls = [];
  const home = await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(calls[0].amount, RENT_PRICE);
  assert.ok(RENT_PRICE < HOME_PRICE, 'renting must be cheaper than buying outright');
  assert.equal(home.ownershipType, 'rented');
  assert.equal(home.level, PROPERTY_LEVELS[0].level);
});

test('rentHome is refused for someone who already has a home, owned or rented', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /already has a home/,
  );
});

test('upgradeHome refuses a rented home -- renting has no tower levels', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /renting, not owning/,
  );
});

test('buyRentedHome charges only the real remainder, crediting the rent already paid', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  const calls = [];
  const home = await buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(calls[0].amount, HOME_PRICE - RENT_PRICE);
  assert.equal(home.ownershipType, 'owned');
});

test('a failed buyRentedHome rolls back to rented', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice').ownershipType, 'rented');
});

test('buyRentedHome refuses someone with no home and someone who already owns', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /does not have a home/,
  );

  await purchaseHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) }),
    /already owns their home/,
  );
});

test('purchaseLand claims a real vacant plot, priced below the cheapest home', async () => {
  const store = createPropertyStore();
  const calls = [];
  const plot = await purchaseLand(store, { ownerId: 'dana', transferFn: fakeTransfer(calls) });
  assert.equal(calls[0].amount, LAND_PRICE);
  assert.ok(LAND_PRICE < HOME_PRICE);
  assert.equal(plot.type, 'land');
  assert.equal(plot.authorized, true);
  assert.equal(homeOwnedBy(store, 'dana').id, plot.id);
});

test('a failed purchaseLand rolls back -- no plot left on the books', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    purchaseLand(store, { ownerId: 'dana', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'dana'), null);
});

test('purchaseLand refuses someone who already owns a home or plot', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'dana', transferFn: fakeTransfer([]) });
  await assert.rejects(
    purchaseLand(store, { ownerId: 'dana', transferFn: fakeTransfer([]) }),
    /already owns a home or plot/,
  );
});

test('buildUnauthorized creates a real structure flagged not sanctioned, with no payment', () => {
  const store = createPropertyStore();
  const shack = buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'past the tree line' });
  assert.equal(shack.authorized, false);
  assert.equal(shack.ownerId, 'eve');
  assert.deepEqual(listUnauthorized(store), [shack]);
});

test('demolishUnauthorized removes a real unauthorized structure outright', () => {
  const store = createPropertyStore();
  const shack = buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'past the tree line' });
  const result = demolishUnauthorized(store, shack.id, { demolishedBy: 'patrol-1' });
  assert.equal(result.ownerId, 'eve');
  assert.equal(result.demolishedBy, 'patrol-1');
  assert.equal(listUnauthorized(store).length, 0);
  assert.equal(store.properties.length, 0);
});

test('demolishUnauthorized refuses an authorized property and an unknown one', async () => {
  const store = createPropertyStore();
  const home = await purchaseHome(store, { ownerId: 'frank', transferFn: fakeTransfer([]) });
  assert.throws(() => demolishUnauthorized(store, home.id), /is authorized/);
  assert.throws(() => demolishUnauthorized(store, 9999), /no property/);
});

test('buildUnauthorized can build a real, unsecured business, not just a home', () => {
  const store = createPropertyStore();
  const shop = buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'past the tree line', type: 'commercial' });
  assert.equal(shop.type, 'commercial');
  assert.equal(shop.authorized, false);
  assert.equal(shop.level, COMMERCIAL_LEVELS[0].level);
  assert.equal(shop.levelName, COMMERCIAL_LEVELS[0].name);
  assert.equal(commercialOwnedBy(store, 'eve').id, shop.id);
});

test('buildUnauthorized lets an NPC own a real unsecured business', () => {
  const store = createPropertyStore();
  const shop = buildUnauthorized(store, { ownerId: 'npc-42', locationLabel: 'the old quarter', type: 'commercial' });
  assert.equal(shop.ownerId, 'npc-42');
  assert.equal(commercialOwnedBy(store, 'npc-42').id, shop.id);
});

test('buildUnauthorized refuses a second business for an owner who already has one', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'eve', transferFn: fakeTransfer([]) });
  assert.throws(
    () => buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'past the tree line', type: 'commercial' }),
    /already owns a commercial property/,
  );
});

test('buildUnauthorized refuses an unrecognized type', () => {
  const store = createPropertyStore();
  assert.throws(
    () => buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'x', type: 'industrial' }),
    /not a real type/,
  );
});

test('an unsecured business can still operate and earn, exactly like a sanctioned one', async () => {
  const store = createPropertyStore();
  buildUnauthorized(store, { ownerId: 'eve', locationLabel: 'past the tree line', type: 'commercial' });
  const calls = [];
  const { revenue } = await operateBusiness(store, { ownerId: 'eve', transferFn: fakeTransfer(calls) });
  assert.ok(revenue > 0);
  assert.equal(calls[0].toUserId, 'eve');
});

test('purchaseCommercial is a real, independent slot -- owning a home does not block it', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const calls = [];
  const shop = await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer(calls) });
  assert.equal(calls[0].amount, COMMERCIAL_LEVELS[0].price);
  assert.equal(shop.type, 'commercial');
  assert.equal(commercialOwnedBy(store, 'gail').id, shop.id);
  assert.ok(homeOwnedBy(store, 'gail'), 'owning a commercial property must not hide the real home');
});

test('owning a commercial property does not block buying a home', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'hank', transferFn: fakeTransfer([]) });
  const home = await purchaseHome(store, { ownerId: 'hank', transferFn: fakeTransfer([]) });
  assert.equal(home.ownerId, 'hank');
});

test('a failed purchaseCommercial rolls back -- no shop left on the books', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(commercialOwnedBy(store, 'gail'), null);
});

test('purchaseCommercial refuses a second commercial property for the same owner', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  await assert.rejects(
    purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) }),
    /already owns a commercial property/,
  );
});

test('upgradeCommercial charges the real price delta and moves up exactly one level', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const calls = [];
  const shop = await upgradeCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer(calls) });
  assert.equal(calls[0].amount, COMMERCIAL_LEVELS[1].price - COMMERCIAL_LEVELS[0].price);
  assert.equal(shop.level, 2);
  assert.equal(shop.levelName, COMMERCIAL_LEVELS[1].name);
});

test('upgradeCommercial refuses someone with no commercial property and the top level', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    upgradeCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) }),
    /does not own a commercial property/,
  );
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  for (let i = 1; i < COMMERCIAL_LEVELS.length; i += 1) {
    await upgradeCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  }
  await assert.rejects(
    upgradeCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) }),
    /already at the top level/,
  );
});

test('operateBusiness pays real revenue from the customer account to the owner', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const calls = [];
  const { property, revenue } = await operateBusiness(store, {
    ownerId: 'gail', transferFn: fakeTransfer(calls), economyMultiplier: 1,
  });
  assert.equal(revenue, COMMERCIAL_LEVELS[0].level * BASE_COMMERCIAL_REVENUE);
  assert.equal(calls[0].fromUserId, BUSINESS_REVENUE_ACCOUNT);
  assert.equal(calls[0].toUserId, 'gail');
  assert.equal(calls[0].amount, revenue);
  assert.ok(property.lastOperatedAt);
});

test('operateBusiness scales real revenue by the real economy multiplier', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const { revenue } = await operateBusiness(store, {
    ownerId: 'gail', transferFn: fakeTransfer([]), economyMultiplier: 2,
  });
  assert.equal(revenue, COMMERCIAL_LEVELS[0].level * BASE_COMMERCIAL_REVENUE * 2);
});

test('operateBusiness withholds a real income tax when a real rate and treasury are given', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const calls = [];
  const grossRevenue = COMMERCIAL_LEVELS[0].level * BASE_COMMERCIAL_REVENUE;
  const taxAmount = Math.round(grossRevenue * 0.1);
  const result = await operateBusiness(store, {
    ownerId: 'gail', transferFn: fakeTransfer(calls), taxRate: 0.1, treasuryAccountId: 'vdp-government-treasury',
  });
  assert.equal(result.grossRevenue, grossRevenue);
  assert.equal(result.taxAmount, taxAmount);
  assert.equal(result.revenue, grossRevenue - taxAmount);
  assert.equal(result.taxCollected, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].amount, grossRevenue - taxAmount);
  assert.deepEqual(calls[1], {
    fromUserId: BUSINESS_REVENUE_ACCOUNT, toUserId: 'vdp-government-treasury', amount: taxAmount, reason: 'vdp-business-income-tax',
  });
});

test('operateBusiness omitting taxRate leaves revenue exactly as before -- every existing caller unchanged', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  const result = await operateBusiness(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  assert.equal(result.taxAmount, 0);
  assert.equal(result.taxCollected, false);
  assert.equal(result.revenue, result.grossRevenue);
});

test('operateBusiness taxes an unauthorized business exactly the same as a sanctioned one', async () => {
  const store = createPropertyStore();
  buildUnauthorized(store, { ownerId: 'nia', locationLabel: 'the back alley', type: 'commercial' });
  const calls = [];
  const result = await operateBusiness(store, {
    ownerId: 'nia', transferFn: fakeTransfer(calls), taxRate: 0.1, treasuryAccountId: 'vdp-government-treasury',
  });
  assert.ok(result.taxAmount > 0);
  assert.equal(result.taxCollected, true);
});

test('operateBusiness refuses someone with no commercial property', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    operateBusiness(store, { ownerId: 'gail', transferFn: fakeTransfer([]) }),
    /does not own a commercial property/,
  );
});

test('operateBusiness refuses a second run before the real cooldown elapses', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  await operateBusiness(store, { ownerId: 'gail', transferFn: fakeTransfer([]), now: 1000 });
  assert.equal(canOperateBusiness(commercialOwnedBy(store, 'gail'), 1000 + OPERATE_COOLDOWN_MS - 1), false);
  await assert.rejects(
    operateBusiness(store, { ownerId: 'gail', transferFn: fakeTransfer([]), now: 1000 + OPERATE_COOLDOWN_MS - 1 }),
    /still restocking/,
  );
  const { revenue } = await operateBusiness(store, {
    ownerId: 'gail', transferFn: fakeTransfer([]), now: 1000 + OPERATE_COOLDOWN_MS,
  });
  assert.ok(revenue > 0);
});

test('a failed operateBusiness transfer rolls back the real lastOperatedAt claim', async () => {
  const store = createPropertyStore();
  await purchaseCommercial(store, { ownerId: 'gail', transferFn: fakeTransfer([]) });
  await assert.rejects(
    operateBusiness(store, { ownerId: 'gail', transferFn: fakeTransfer([], { shouldFail: true }), now: 1000 }),
  );
  assert.equal(commercialOwnedBy(store, 'gail').lastOperatedAt, null);
});

// -- Public housing -------------------------------------------------------

test('assignPublicHousing gives a real, assigned, unpaid home', () => {
  const store = createPropertyStore();
  const property = assignPublicHousing(store, { ownerId: 'nia', reason: 'at-risk' });
  assert.equal(property.type, 'public-housing');
  assert.equal(property.ownershipType, 'assigned');
  assert.equal(property.levelName, PUBLIC_HOUSING_NAME);
  assert.equal(property.locationLabel, PUBLIC_HOUSING_NAME);
  assert.equal(property.reason, 'at-risk');
  assert.equal(homeOwnedBy(store, 'nia'), property);
  assert.ok(isInPublicHousing(store, 'nia'));
});

test('assignPublicHousing vacates any real existing home first -- a relocation, not a second residence', async () => {
  const store = createPropertyStore();
  const calls = [];
  await purchaseHome(store, { ownerId: 'nia', transferFn: fakeTransfer(calls) });
  const before = homeOwnedBy(store, 'nia');
  assert.equal(before.type, 'residential');

  const relocated = assignPublicHousing(store, { ownerId: 'nia' });
  assert.equal(relocated.relocatedFrom, PROPERTY_LEVELS[0].name);
  assert.equal(homeOwnedBy(store, 'nia'), relocated);
  assert.equal(store.properties.filter((p) => p.ownerId === 'nia').length, 1,
    'the old residential row must be gone, not kept alongside the new assignment');
});

test('assignPublicHousing never charges anyone -- it is assigned, not purchased', () => {
  const store = createPropertyStore();
  assignPublicHousing(store, { ownerId: 'nia' });
  // No transferFn was even passed -- if the function tried to charge
  // anyone it would throw calling undefined, which this call not
  // throwing already proves.
  assert.ok(homeOwnedBy(store, 'nia'));
});

test('a public-housing resident cannot also buy or rent on the open market -- one residence, same as everyone else', async () => {
  const store = createPropertyStore();
  assignPublicHousing(store, { ownerId: 'nia' });
  await assert.rejects(purchaseHome(store, { ownerId: 'nia', transferFn: fakeTransfer([]) }), /already owns a home/);
  await assert.rejects(rentHome(store, { ownerId: 'nia', transferFn: fakeTransfer([]) }), /already has a home/);
});

test('vacatePublicHousing clears the assignment, and refuses someone who was never in it', () => {
  const store = createPropertyStore();
  assignPublicHousing(store, { ownerId: 'nia' });
  const result = vacatePublicHousing(store, 'nia');
  assert.equal(result.ownerId, 'nia');
  assert.equal(homeOwnedBy(store, 'nia'), null);
  assert.ok(!isInPublicHousing(store, 'nia'));

  assert.throws(() => vacatePublicHousing(store, 'never-assigned'), /is not in public housing/);
});

test('isInPublicHousing is false for an ordinary owned home', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'theo', transferFn: fakeTransfer([]) });
  assert.ok(!isInPublicHousing(store, 'theo'));
});

test('grantFoundingBusiness gives a real, authorized, unpaid starter business', () => {
  const store = createPropertyStore();
  const business = grantFoundingBusiness(store, { ownerId: 'founder-1', category: 'restaurant' });
  assert.equal(business.type, 'commercial');
  assert.equal(business.authorized, true);
  assert.equal(business.category, 'restaurant');
  assert.equal(business.level, COMMERCIAL_LEVELS[0].level);
  assert.equal(commercialOwnedBy(store, 'founder-1').id, business.id);
});

test('grantFoundingBusiness requires an ownerId and a real category', () => {
  const store = createPropertyStore();
  assert.throws(() => grantFoundingBusiness(store, { category: 'restaurant' }), /ownerId/);
  assert.throws(() => grantFoundingBusiness(store, { ownerId: 'founder-1' }), /category/);
});

test('grantFoundingBusiness refuses a second business for the same real owner', () => {
  const store = createPropertyStore();
  grantFoundingBusiness(store, { ownerId: 'founder-1', category: 'farming' });
  assert.throws(
    () => grantFoundingBusiness(store, { ownerId: 'founder-1', category: 'clothing' }),
    /already owns a commercial property/,
  );
});

test('a granted founding business can operate for real revenue just like a purchased one', async () => {
  const store = createPropertyStore();
  grantFoundingBusiness(store, { ownerId: 'founder-1', category: 'restaurant' });
  assert.ok(canOperateBusiness(commercialOwnedBy(store, 'founder-1')));
  const result = await operateBusiness(store, { ownerId: 'founder-1', transferFn: fakeTransfer([]) });
  assert.ok(result.revenue > 0);
});

test('FOUNDING_BUSINESS_CATEGORIES names the instruction\'s own real examples', () => {
  assert.deepEqual(FOUNDING_BUSINESS_CATEGORIES, ['restaurant', 'construction', 'farming', 'clothing']);
});
