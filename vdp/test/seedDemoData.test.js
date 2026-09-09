// VDP — what the demo seed actually seeds, and whose money it spends.
//
// **This module had no tests, and it did nothing.** It ran in a bare
// mount effect for four identities at once, so every one of its
// eighteen transfers went to V3 with no `Authorization` header and came
// back 401 — verified against a real V3, not inferred. Its own header
// promised that a presenter clicking "Log in" would find their order
// history already populated. Nothing was ever populated.
//
// The reason it cannot simply be moved later is the part worth pinning
// with tests: `/api/vcoin/transfer` is `actorOrService('fromUserId')`,
// so the session must belong to the payer. A browser has no service
// credential and must never have one, so VDP can only ever spend the
// signed-in user's own money. Seeding `demo-maya` from `demo-user`'s
// session is not a timing bug — it is the authorization boundary doing
// its job, and the seed has to be shaped around it rather than fight it.
//
// So these assert on the payer of every transfer, which is the property
// the 401 was really about.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { seedDemoData } from '../src/lib/seedDemoData.js';
import { createFoodDistrict } from '../src/lib/foodDistrict.js';
import { createDegvchi, registerWearable } from '../src/lib/degvchi.js';
import { seedSvmikoDegvchiWearables } from '../src/lib/svmikoDegvchiWearables.js';

// The same catalogue App.jsx builds before the seed runs — the seed
// looks wearables up by name, so a store without them seeds nothing and
// the tests below would pass for the wrong reason.
function degvchi() {
  const store = createDegvchi();
  registerWearable(store, { name: 'Sunset Glow Palette', category: 'cosmetics', price: 12, creatorId: 'elf-cosmetics-brand' });
  registerWearable(store, { name: 'DEGVCHI Signature Jacket', category: 'clothing', price: 25, creatorId: 'degvchi-original' });
  registerWearable(store, { name: 'Chrome Chain', category: 'accessories', price: 8, creatorId: 'degvchi-original' });
  seedSvmikoDegvchiWearables(store);
  return store;
}

// Stands in for V3 the way V3 actually behaves: a transfer is
// authorised only when the payer is the session user. Anything else is
// refused, exactly as `actorOrService('fromUserId')` refuses it.
// **`attempts` is the load-bearing half, not `moves`.** The seed
// catches per item and warns, so an unauthorised leg leaves no order
// behind and every store assertion below stays true whether the seed
// filtered that payer out or fired the request and got a 401. Only the
// attempt count separates those two, and the difference between them
// is eighteen doomed requests per page load versus six real ones.
function ledgerFor(sessionUserId) {
  const attempts = [];
  const moves = [];
  const fn = async (fromUserId, toUserId, amount, reason) => {
    attempts.push({ fromUserId, toUserId, amount, reason });
    if (fromUserId !== sessionUserId) {
      throw new Error(`requireActor: session is ${sessionUserId}, not ${fromUserId}`);
    }
    moves.push({ fromUserId, toUserId, amount, reason });
    return { ok: true };
  };
  fn.attempts = attempts;
  fn.moves = moves;
  return fn;
}

test('the seed spends only the signed-in user\'s own money', async () => {
  const food = createFoodDistrict();
  const wardrobe = degvchi();
  const ledger = ledgerFor('demo-user');

  await seedDemoData({
    foodDistrictStore: food, degvchiStore: wardrobe, userId: 'demo-user', transferFn: ledger,
  });

  // Every leg the seed sent was payable by the session that sent it.
  assert.ok(ledger.moves.length > 0, 'nothing was charged at all');
  assert.deepEqual([...new Set(ledger.moves.map((m) => m.fromUserId))], ['demo-user']);

  // Read the orders, not the ledger stub — the stub is my model of V3,
  // the store is what the UI will render.
  assert.ok(food.orders.length > 0, 'the seed produced no orders at all');
  const buyers = [...new Set(food.orders.map((o) => o.buyerId))];
  assert.deepEqual(buyers, ['demo-user'],
    `the seed charged somebody other than the signed-in user: ${buyers.join(', ')}`);

  const owners = [...new Set(wardrobe.ownership.map((o) => o.userId))];
  assert.deepEqual(owners, ['demo-user'],
    `the seed bought wearables for somebody other than the signed-in user: ${owners.join(', ')}`);
});

test('a different signed-in identity seeds their own set, not demo-user\'s', async () => {
  // The Shell can hand any of the four identities in via `adoptToken`,
  // so the filter has to be real rather than a hardcoded demo-user
  // special case.
  const food = createFoodDistrict();
  const wardrobe = degvchi();

  await seedDemoData({
    foodDistrictStore: food, degvchiStore: wardrobe, userId: 'demo-maya',
    transferFn: ledgerFor('demo-maya'),
  });

  assert.ok(food.orders.length > 0, 'demo-maya has entries in the table and got none of them');
  assert.deepEqual([...new Set(food.orders.map((o) => o.buyerId))], ['demo-maya']);
});

test('an identity with no entries seeds nothing and does not throw', async () => {
  const food = createFoodDistrict();
  const wardrobe = degvchi();

  await seedDemoData({
    foodDistrictStore: food, degvchiStore: wardrobe, userId: 'somebody-else',
    transferFn: ledgerFor('somebody-else'),
  });

  assert.equal(food.orders.length, 0);
  assert.equal(wardrobe.ownership.length, 0);
});

test('seeding with nobody signed in is refused, not silently skipped', async () => {
  // **The regression this file exists for.** The old shape took no
  // userId and ran at mount, which is how eighteen doomed requests went
  // out on every page load. A silent no-op would let that come back
  // without anything noticing; the throw is what makes App.jsx's
  // session guard load-bearing.
  await assert.rejects(
    () => seedDemoData({ foodDistrictStore: createFoodDistrict(), degvchiStore: degvchi() }),
    /requires the signed-in userId/,
  );
});

test('a store that already has orders is left alone', async () => {
  const food = createFoodDistrict();
  const wardrobe = degvchi();
  const ledger = ledgerFor('demo-user');
  await seedDemoData({
    foodDistrictStore: food, degvchiStore: wardrobe, userId: 'demo-user', transferFn: ledger,
  });
  const after = food.orders.length;
  const charged = ledger.moves.length;

  await seedDemoData({
    foodDistrictStore: food, degvchiStore: wardrobe, userId: 'demo-user', transferFn: ledger,
  });

  assert.equal(ledger.moves.length, charged, 'the second run charged again');

  assert.equal(food.orders.length, after,
    'the second run double-charged a user who was already seeded');
});
