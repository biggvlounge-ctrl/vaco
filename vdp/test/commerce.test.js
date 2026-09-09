// VDP — the remaining district commerce and catalogue logic.
//
// Finishes the sweep the previous two suites started. What is covered
// here is the last of VDP's own game logic that had no tests: the Food
// District's flagship brands and ordering, the Stage's eight-camera
// setup, and the SVMIKO/DEGVCHI fashion-house catalogue that seeds the
// wearable economy.
//
// The `*Client.js` modules remain deliberately uncovered — they are
// thin `fetch` wrappers over other apps' APIs, and a test for one would
// be a test of `fetch`. `ensureStageSession` and `ensureVillageDistrict`
// are the same: they orchestrate real HTTP calls into Vavlt Stvdios and
// VXLLAGE. What IS tested here is everything around them that is pure
// and that decides money, names and identity.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOOD_CATEGORIES, FLAGSHIP_BRANDS,
  getBrand, listBrands, brandOwnerId, createFoodDistrict,
  orderMenuItem, getOrderHistory,
} from '../src/lib/foodDistrict.js';

import { STAGE_CAMERAS, STAGE_OWNER_ID, operatorIdForChannel } from '../src/lib/stage.js';

import {
  SVMIKO_DEGVCHI_HOUSE, SUB_BRAND_WEARABLES, creatorIdFor, seedSvmikoDegvchiWearables,
} from '../src/lib/svmikoDegvchiWearables.js';

import { createDegvchi, WEARABLE_CATEGORIES, browseWearables } from '../src/lib/degvchi.js';

function ledger() {
  const moves = [];
  const fn = async (from, to, amount, reason) => { moves.push({ from, to, amount, reason }); };
  fn.moves = moves;
  return fn;
}

// ===========================================================================
// Food District — the catalogue
// ===========================================================================

test('every flagship brand is complete enough to render and to sell', () => {
  assert.ok(FLAGSHIP_BRANDS.length > 0);
  for (const brand of FLAGSHIP_BRANDS) {
    for (const field of ['slug', 'name', 'category', 'tagline']) {
      assert.ok(brand[field], `${brand.slug || '(no slug)'} is missing ${field}`);
    }
    assert.ok(Array.isArray(brand.menu) && brand.menu.length > 0,
      `${brand.slug} has no menu — a restaurant you can walk into and order nothing from`);
  }
});

test('every brand slug is unique, because it is the payout account', () => {
  // `brandOwnerId` derives the account that gets paid straight from the
  // slug, so two brands sharing one would silently pool their takings.
  const slugs = FLAGSHIP_BRANDS.map((b) => b.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'two brands share a slug and so share an account');
});

test('every brand sits in a declared category', () => {
  // FOOD_CATEGORIES is what the district's filter UI is built from. A
  // brand in an undeclared category exists and is unfindable.
  const stray = FLAGSHIP_BRANDS.filter((b) => !FOOD_CATEGORIES.includes(b.category));
  assert.deepEqual(stray.map((b) => `${b.slug}:${b.category}`), [],
    'these brands are in categories the filter does not offer');
});

test('every declared category has at least one brand in it', () => {
  // The other direction: a category with nothing in it is an empty
  // filter tab. Reported rather than asserted-away, because an empty
  // category is a real (if minor) gap in the district.
  const empty = FOOD_CATEGORIES.filter((c) => !FLAGSHIP_BRANDS.some((b) => b.category === c));
  assert.deepEqual(empty, [], 'these categories are offered as filters and return nothing');
});

test('every menu item is priced as something somebody could buy', () => {
  for (const brand of FLAGSHIP_BRANDS) {
    for (const item of brand.menu) {
      assert.ok(item.item, `${brand.slug} has an unnamed menu item`);
      assert.ok(Number.isFinite(item.price) && item.price > 0,
        `${brand.slug}'s "${item.item}" is priced ${item.price}`);
    }
    const names = brand.menu.map((m) => m.item);
    assert.equal(new Set(names).size, names.length,
      `${brand.slug} lists the same item twice — orderMenuItem resolves by name and would `
      + 'always pick the first');
  }
});

test('brands are findable by slug and filterable by category', () => {
  const first = FLAGSHIP_BRANDS[0];
  assert.equal(getBrand(first.slug).name, first.name);
  assert.equal(getBrand('no-such-brand'), null, 'an unknown slug is null, not undefined');

  assert.equal(listBrands().length, FLAGSHIP_BRANDS.length, 'no filter means every brand');
  const filtered = listBrands({ category: first.category });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((b) => b.category === first.category));
});

// ===========================================================================
// Food District — ordering
// ===========================================================================

test('ordering pays the brand that made the food', () => {
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const item = brand.menu[0];
  const transferFn = ledger();

  return orderMenuItem(store, {
    brandSlug: brand.slug, itemName: item.item, buyerId: 'player-1', transferFn, now: 500,
  }).then((order) => {
    assert.equal(order.price, item.price, 'charged the menu price, not a number from the caller');
    assert.deepEqual(
      { from: transferFn.moves[0].from, to: transferFn.moves[0].to, amount: transferFn.moves[0].amount },
      { from: 'player-1', to: brandOwnerId(brand.slug), amount: item.price },
    );
    assert.equal(order.brandName, brand.name);
    assert.equal(order.orderedAt, 500);
  });
});

test('the price comes from the menu, never from the order', () => {
  // The obvious attack on any storefront: name your own price. The
  // function signature does not even accept one, and this pins that.
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const item = brand.menu[0];
  const transferFn = ledger();

  return orderMenuItem(store, {
    brandSlug: brand.slug,
    itemName: item.item,
    buyerId: 'p',
    price: 0,          // ignored
    amount: 0,         // ignored
    transferFn,
  }).then(() => {
    assert.equal(transferFn.moves[0].amount, item.price, 'a caller-supplied price was honoured');
  });
});

test('an order for something not on the menu is refused', () => {
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const transferFn = ledger();

  return assert.rejects(
    () => orderMenuItem(store, {
      brandSlug: 'no-such-brand', itemName: 'x', buyerId: 'p', transferFn,
    }),
    /no brand with slug/,
  )
    .then(() => assert.rejects(
      () => orderMenuItem(store, {
        brandSlug: brand.slug, itemName: 'Truffle Nothing', buyerId: 'p', transferFn,
      }),
      /has no menu item/,
    ))
    .then(() => assert.rejects(
      () => orderMenuItem(store, {
        brandSlug: brand.slug, itemName: brand.menu[0].item, transferFn,
      }),
      /requires a buyerId/,
    ))
    .then(() => assert.rejects(
      () => orderMenuItem(store, {
        brandSlug: brand.slug, itemName: brand.menu[0].item, buyerId: 'p',
      }),
      /requires a transferFn/,
    ))
    .then(() => {
      assert.equal(transferFn.moves.length, 0, 'nobody was charged for a refused order');
      assert.equal(store.orders.length, 0, 'and no order was recorded');
    });
});

test('an order that cannot be paid for is not recorded', () => {
  // Transfer first, record second. A failed payment must not leave a
  // receipt behind — the order history is what a player checks to see
  // what they bought.
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const broke = async () => { throw new Error('insufficient funds'); };

  return assert.rejects(
    () => orderMenuItem(store, {
      brandSlug: brand.slug, itemName: brand.menu[0].item, buyerId: 'p', transferFn: broke,
    }),
    /insufficient funds/,
  ).then(() => {
    assert.equal(store.orders.length, 0);
    assert.deepEqual(getOrderHistory(store, 'p'), []);
  });
});

test('order history is per buyer and newest first', () => {
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const transferFn = ledger();
  const order = (buyerId, now) => orderMenuItem(store, {
    brandSlug: brand.slug, itemName: brand.menu[0].item, buyerId, transferFn, now,
  });

  return order('p1', 100)
    .then(() => order('p2', 200))
    .then(() => order('p1', 300))
    .then(() => {
      const mine = getOrderHistory(store, 'p1');
      assert.equal(mine.length, 2, 'somebody else\'s order is not in my history');
      assert.deepEqual(mine.map((o) => o.orderedAt), [300, 100], 'newest first');
      assert.deepEqual(getOrderHistory(store, 'nobody'), []);
    });
});

test('every order gets its own id', () => {
  const store = createFoodDistrict();
  const brand = FLAGSHIP_BRANDS[0];
  const transferFn = ledger();
  return orderMenuItem(store, {
    brandSlug: brand.slug, itemName: brand.menu[0].item, buyerId: 'p', transferFn,
  })
    .then((a) => orderMenuItem(store, {
      brandSlug: brand.slug, itemName: brand.menu[0].item, buyerId: 'p', transferFn,
    }).then((b) => assert.notEqual(a.id, b.id)));
});

// ===========================================================================
// The Stage — eight cameras
// ===========================================================================

test('the Stage has exactly the eight screens the mechanic promises', () => {
  // Vavlt Stvdios' own "up to 8 interactive screens" is the whole point
  // of this district. Seven would quietly under-deliver it and nine
  // would exceed what the session supports.
  assert.equal(STAGE_CAMERAS.length, 8);
  assert.ok(STAGE_OWNER_ID);
});

test('every camera has a distinct name and a distinct operator', () => {
  // `operatorIdForChannel` resolves by NAME, so two cameras sharing one
  // would silently attribute a feed to the wrong operator.
  const names = STAGE_CAMERAS.map((c) => c.name);
  const operators = STAGE_CAMERAS.map((c) => c.operatorId);
  assert.equal(new Set(names).size, 8, 'two cameras share a name');
  assert.equal(new Set(operators).size, 8, 'two cameras share an operator');
  for (const cam of STAGE_CAMERAS) {
    assert.ok(cam.name && cam.operatorId, 'a camera is missing a field');
  }
});

test('a channel resolves to its operator, and an unknown one to null', () => {
  for (const cam of STAGE_CAMERAS) {
    assert.equal(operatorIdForChannel({ name: cam.name }), cam.operatorId);
  }
  // null rather than a fallback operator: attributing an unrecognised
  // feed to a real person is worse than attributing it to nobody.
  assert.equal(operatorIdForChannel({ name: 'Someone Else\'s Cam' }), null);
  assert.equal(operatorIdForChannel({}), null);
});

// ===========================================================================
// SVMIKO / DEGVCHI — the fashion house catalogue
// ===========================================================================

test('every sub-brand wearable is sellable and in a real category', () => {
  assert.ok(SUB_BRAND_WEARABLES.length > 0);
  assert.ok(SVMIKO_DEGVCHI_HOUSE);
  for (const item of SUB_BRAND_WEARABLES) {
    assert.ok(item.slug && item.name, 'an item is missing slug or name');
    assert.ok(
      WEARABLE_CATEGORIES.includes(item.category),
      `${item.slug} is category "${item.category}", which DEGVCHI would refuse at registration`,
    );
    assert.ok(item.price > 0, `${item.slug} is priced ${item.price}`);
  }
});

test('every sub-brand has its own payout account', () => {
  // Thirteen sub-brands under one house, each paid separately — a
  // duplicate slug would route one label's sales to another.
  const slugs = SUB_BRAND_WEARABLES.map((i) => i.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const accounts = slugs.map(creatorIdFor);
  assert.equal(new Set(accounts).size, accounts.length);
  assert.notEqual(creatorIdFor('a'), creatorIdFor('b'));
});

test('seeding registers every sub-brand item into a real DEGVCHI store', () => {
  // The catalogue and the economy are separate modules, and this is the
  // one place they meet. If DEGVCHI's validation rejected any of these
  // — a bad category, a zero price — it would throw here rather than at
  // whatever moment a player first opened the shop.
  const store = createDegvchi();
  const seeded = seedSvmikoDegvchiWearables(store);

  assert.equal(seeded.length, SUB_BRAND_WEARABLES.length);
  assert.equal(store.wearables.length, SUB_BRAND_WEARABLES.length);
  for (const { brand, wearable } of seeded) {
    assert.equal(wearable.creatorId, creatorIdFor(brand), `${brand} pays the wrong account`);
    assert.ok(wearable.id, 'a seeded wearable has no id');
  }
});

test('every seeded item is sponsored by its own label', () => {
  // `sponsor` is derived by splitting the name on " Virtual", so an item
  // named without that marker would carry its entire name as the
  // sponsor. Checked rather than assumed.
  const store = createDegvchi();
  seedSvmikoDegvchiWearables(store);

  const sponsored = browseWearables(store, { sponsoredOnly: true });
  assert.equal(sponsored.length, SUB_BRAND_WEARABLES.length, 'a seeded item lost its sponsor');
  for (const w of sponsored) {
    assert.ok(w.sponsor, `${w.name} has no sponsor`);
    assert.ok(
      !w.sponsor.includes('Virtual'),
      `${w.name} kept "Virtual" in its sponsor — the name did not split as expected`,
    );
    assert.ok(w.name.startsWith(w.sponsor), `${w.sponsor} is not the prefix of ${w.name}`);
  }
});

test('seeding twice does not collide ids', () => {
  const store = createDegvchi();
  seedSvmikoDegvchiWearables(store);
  seedSvmikoDegvchiWearables(store);
  const ids = store.wearables.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'a re-seed reused an id');
});
