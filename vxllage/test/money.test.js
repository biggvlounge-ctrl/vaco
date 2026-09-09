// VXLLAGE — cosmetics, village boosts, and who gets paid.
//
// **Why this file exists.** Two separate shops move real VCoin here and
// they pay two different parties on purpose:
//
//   - `avatarCosmetics.js` pays the PLATFORM. A personal cosmetic is
//     cross-village — bought once, worn everywhere — so no single
//     village owner has a claim on it.
//   - `villageShop.js` pays the VILLAGE OWNER. A village cosmetic and a
//     boost are that community's property.
//
// Getting that backwards is the quiet failure this file exists to
// prevent: the money still moves, every status is correct, and the
// wrong person is paid on every single sale.
//
// Also targeted: buying the same cosmetic twice, equipping something
// you do not own, and boost levels that do not match what was paid.

const test = require('node:test');
const assert = require('node:assert');

const { createVxllageStore } = require('../lib/store');
const avatar = require('../lib/avatarCosmetics');
const shop = require('../lib/villageShop');
const villages = require('../lib/villages');

function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);
  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
    }
    if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  fn.drift = () => Object.values(balances).reduce((a, b) => a + b, 0) - opening;
  return fn;
}

function withVillage(store, ownerId = 'ines') {
  return villages.createVillage(store, {
    ownerId, name: 'St. Louis Runners', description: 'Weekend long runs',
  });
}

// -- Personal cosmetics: the platform is paid ---------------------------

test('a personal cosmetic pays the PLATFORM, not any village owner', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  withVillage(store, 'ines');

  const item = avatar.getAvatarCosmeticCatalog()[0];
  await avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: item.id, transferFn,
  });

  // A personal cosmetic is worn in every village, so no single village
  // owner has a claim on it. Paying one would be arbitrary and wrong.
  assert.strictEqual(transferFn.of('sam'), 500 - item.priceVCoin);
  assert.strictEqual(transferFn.of('vxllage-platform'), item.priceVCoin);
  assert.strictEqual(transferFn.of('ines'), 0, 'a village owner must not be paid for a personal cosmetic');
});

test('the same personal cosmetic cannot be bought twice', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const item = avatar.getAvatarCosmeticCatalog()[0];

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: item.id, transferFn });
  const afterFirst = transferFn.of('sam');

  await assert.rejects(() => avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: item.id, transferFn,
  }), /already owns/);

  // Selling someone something they own is the clearest possible
  // double-charge, and the one a user notices immediately.
  assert.strictEqual(transferFn.of('sam'), afterFirst);
  assert.strictEqual(store.avatarCosmeticOwnership.length, 1);
});

test('a cosmetic that is not in the catalogue cannot be bought at any price', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  await assert.rejects(() => avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: 'not-a-real-item', transferFn,
  }), /no real catalog item/);
  assert.strictEqual(transferFn.of('sam'), 500);
});

test('equipping requires real ownership, never a bare item id', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const [first, second] = avatar.getAvatarCosmeticCatalog();

  // Nothing bought yet — equipping must not work off the catalogue.
  assert.throws(() => avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: first.id }),
    /does not own/);

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: first.id, transferFn });
  const equipped = avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: first.id });
  assert.strictEqual(equipped.equippedItemId, first.id);

  // Still cannot equip the one they did not buy.
  assert.throws(() => avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: second.id }),
    /does not own/);
});

test('equipping is a single slot — a second equip replaces rather than stacks', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const [first, second] = avatar.getAvatarCosmeticCatalog();

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: first.id, transferFn });
  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: second.id, transferFn });

  avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: first.id });
  avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: second.id });

  const profile = avatar.getAvatarProfile(store, 'sam');
  assert.strictEqual(profile.equippedItemId, second.id);
  assert.strictEqual(store.avatarEquippedCosmetic.filter((e) => e.userId === 'sam').length, 1,
    'one slot means one record, not one per equip');
  // Both are still owned — replacing what is worn is not losing what is
  // bought.
  assert.strictEqual(profile.ownedCosmetics.length, 2);
});

test('cosmetics are cross-village — ownership is not scoped to where it was bought', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  withVillage(store, 'ines');
  withVillage(store, 'kai');

  const item = avatar.getAvatarCosmeticCatalog()[0];
  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: item.id, transferFn });

  // The whole point of the personal shop: bought once, worn everywhere.
  // Nothing in the ownership record names a village.
  const ownership = store.avatarCosmeticOwnership[0];
  assert.ok(!('villageId' in ownership),
    'a personal cosmetic must not be scoped to a village');
  assert.strictEqual(avatar.getOwnedAvatarCosmetics(store, 'sam').length, 1);
});

// -- Village shop: the owner is paid -------------------------------------

test('a village cosmetic pays the VILLAGE OWNER, not the platform', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');

  const item = shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'ines', name: 'Runner badge', priceVCoin: 40,
  });
  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'sam', transferFn });

  // The mirror of the personal-cosmetic test. These two shops pay
  // different parties on purpose, and swapping them would be invisible
  // in every status while paying the wrong person on every sale.
  assert.strictEqual(transferFn.of('ines'), 40);
  assert.strictEqual(transferFn.of('vxllage-platform'), 0,
    'the platform must not take a village cosmetic sale');
  assert.strictEqual(transferFn.of('sam'), 460);
});

test('a village cosmetic cannot be bought twice either', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');
  const item = shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'ines', name: 'Runner badge', priceVCoin: 40,
  });

  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'sam', transferFn });
  await assert.rejects(() => shop.purchaseCosmetic(store, {
    itemId: item.id, buyerId: 'sam', transferFn,
  }), /already owns/);
  assert.strictEqual(transferFn.of('sam'), 460);
});

// -- Boosts --------------------------------------------------------------

test('boosting pays the village owner and raises the level at the real threshold', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 5000 });
  const village = withVillage(store, 'ines');

  const [tier1, tier2] = shop.BOOST_LEVEL_THRESHOLDS;

  // One VCoin short of level 1 — the threshold must be a real boundary,
  // not a rough one.
  await shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: tier1.minVCoin - 1, transferFn,
  });
  assert.strictEqual(shop.getBoostStatus(store, village.id).boostLevel, 0,
    'one short of the threshold is not the next level');

  await shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: 1, transferFn,
  });
  const status = shop.getBoostStatus(store, village.id);
  assert.strictEqual(status.boostLevel, tier1.level, 'exactly the threshold reaches the level');
  assert.strictEqual(status.totalBoostVCoin, tier1.minVCoin);
  assert.strictEqual(status.nextLevelAt, tier2.minVCoin);
  assert.strictEqual(status.vCoinToNextLevel, tier2.minVCoin - tier1.minVCoin);

  // Every coin went to the owner.
  assert.strictEqual(transferFn.of('ines'), tier1.minVCoin);
});

test('boosts accumulate across contributors — a village is funded by its members together', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 5000, ada: 5000, kai: 5000 });
  const village = withVillage(store, 'ines');
  const [tier1] = shop.BOOST_LEVEL_THRESHOLDS;

  const each = Math.ceil(tier1.minVCoin / 3);
  for (const boosterId of ['sam', 'ada', 'kai']) {
    // eslint-disable-next-line no-await-in-loop
    await shop.boostVillage(store, {
      villageId: village.id, boosterId, amountVCoin: each, transferFn,
    });
  }

  const status = shop.getBoostStatus(store, village.id);
  assert.strictEqual(status.totalBoostVCoin, each * 3);
  assert.ok(status.boostLevel >= tier1.level,
    'three members together must reach what one member could alone');
  assert.strictEqual(store.villageBoostContributions.length, 3,
    'every contribution is recorded individually, not merged');
  assert.strictEqual(transferFn.of('ines'), each * 3);
  assert.ok(Math.abs(transferFn.drift()) < 0.01);
});

test('a boost of zero or less is refused rather than recorded as a free boost', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');

  await assert.rejects(() => shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: 0, transferFn,
  }), /positive amountVCoin/);
  await assert.rejects(() => shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: -50, transferFn,
  }), /positive amountVCoin/);
  assert.strictEqual(store.villageBoostContributions.length, 0);
});

test('boosting a village that does not exist pays nobody', async () => {
  const store = createVxllageStore();
  const transferFn = ledger({ sam: 500 });
  await assert.rejects(() => shop.boostVillage(store, {
    villageId: 9999, boosterId: 'sam', amountVCoin: 100, transferFn,
  }), /no village/);
  assert.strictEqual(transferFn.of('sam'), 500);
});

test('only a village’s own owner can list a cosmetic there', async () => {
  const store = createVxllageStore();
  const village = withVillage(store, 'ines');

  // Anyone able to list in someone else's village could price an item,
  // sell it, and the money would still route to the real owner — so the
  // damage is not theft, it is a stranger putting merchandise in your
  // shop. Refused, and worth asserting.
  assert.throws(() => shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'stranger', name: 'Spam badge', priceVCoin: 1,
  }), /only village .* own owner/);
  assert.strictEqual(store.villageCosmeticItems.length, 0);
});
