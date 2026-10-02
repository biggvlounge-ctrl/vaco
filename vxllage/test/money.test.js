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
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: from, toUserId: to, amount: amount, reason: reason } of legs) {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
      }
      if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
      moves.push({ from, to, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
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
  const settleFn = ledger({ sam: 500 });
  withVillage(store, 'ines');

  const item = avatar.getAvatarCosmeticCatalog()[0];
  await avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: item.id, settleFn,
  });

  // A personal cosmetic is worn in every village, so no single village
  // owner has a claim on it. Paying one would be arbitrary and wrong.
  assert.strictEqual(settleFn.of('sam'), 500 - item.priceVCoin);
  assert.strictEqual(settleFn.of('vxllage-platform'), item.priceVCoin);
  assert.strictEqual(settleFn.of('ines'), 0, 'a village owner must not be paid for a personal cosmetic');
});

test('the same personal cosmetic cannot be bought twice', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  const item = avatar.getAvatarCosmeticCatalog()[0];

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: item.id, settleFn });
  const afterFirst = settleFn.of('sam');

  await assert.rejects(() => avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: item.id, settleFn,
  }), /already owns/);

  // Selling someone something they own is the clearest possible
  // double-charge, and the one a user notices immediately.
  assert.strictEqual(settleFn.of('sam'), afterFirst);
  assert.strictEqual(store.avatarCosmeticOwnership.length, 1);
});

test('a cosmetic that is not in the catalogue cannot be bought at any price', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  await assert.rejects(() => avatar.purchaseAvatarCosmetic(store, {
    userId: 'sam', itemId: 'not-a-real-item', settleFn,
  }), /no real catalog item/);
  assert.strictEqual(settleFn.of('sam'), 500);
});

test('equipping requires real ownership, never a bare item id', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  const [first, second] = avatar.getAvatarCosmeticCatalog();

  // Nothing bought yet — equipping must not work off the catalogue.
  assert.throws(() => avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: first.id }),
    /does not own/);

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: first.id, settleFn });
  const equipped = avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: first.id });
  assert.strictEqual(equipped.equippedItemId, first.id);

  // Still cannot equip the one they did not buy.
  assert.throws(() => avatar.equipAvatarCosmetic(store, { userId: 'sam', itemId: second.id }),
    /does not own/);
});

test('equipping is a single slot — a second equip replaces rather than stacks', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  const [first, second] = avatar.getAvatarCosmeticCatalog();

  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: first.id, settleFn });
  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: second.id, settleFn });

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
  const settleFn = ledger({ sam: 500 });
  withVillage(store, 'ines');
  withVillage(store, 'kai');

  const item = avatar.getAvatarCosmeticCatalog()[0];
  await avatar.purchaseAvatarCosmetic(store, { userId: 'sam', itemId: item.id, settleFn });

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
  const settleFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');

  const item = shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'ines', name: 'Runner badge', priceVCoin: 40,
  });
  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'sam', settleFn });

  // The mirror of the personal-cosmetic test. These two shops pay
  // different parties on purpose, and swapping them would be invisible
  // in every status while paying the wrong person on every sale.
  assert.strictEqual(settleFn.of('ines'), 40);
  assert.strictEqual(settleFn.of('vxllage-platform'), 0,
    'the platform must not take a village cosmetic sale');
  assert.strictEqual(settleFn.of('sam'), 460);
});

test('a village cosmetic cannot be bought twice either', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');
  const item = shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'ines', name: 'Runner badge', priceVCoin: 40,
  });

  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'sam', settleFn });
  await assert.rejects(() => shop.purchaseCosmetic(store, {
    itemId: item.id, buyerId: 'sam', settleFn,
  }), /already owns/);
  assert.strictEqual(settleFn.of('sam'), 460);
});

// -- Boosts --------------------------------------------------------------

test('boosting pays the village owner and raises the level at the real threshold', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 5000 });
  const village = withVillage(store, 'ines');

  const [tier1, tier2] = shop.BOOST_LEVEL_THRESHOLDS;

  // One VCoin short of level 1 — the threshold must be a real boundary,
  // not a rough one.
  await shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: tier1.minVCoin - 1, settleFn,
  });
  assert.strictEqual(shop.getBoostStatus(store, village.id).boostLevel, 0,
    'one short of the threshold is not the next level');

  await shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: 1, settleFn,
  });
  const status = shop.getBoostStatus(store, village.id);
  assert.strictEqual(status.boostLevel, tier1.level, 'exactly the threshold reaches the level');
  assert.strictEqual(status.totalBoostVCoin, tier1.minVCoin);
  assert.strictEqual(status.nextLevelAt, tier2.minVCoin);
  assert.strictEqual(status.vCoinToNextLevel, tier2.minVCoin - tier1.minVCoin);

  // Every coin went to the owner.
  assert.strictEqual(settleFn.of('ines'), tier1.minVCoin);
});

test('boosts accumulate across contributors — a village is funded by its members together', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 5000, ada: 5000, kai: 5000 });
  const village = withVillage(store, 'ines');
  const [tier1] = shop.BOOST_LEVEL_THRESHOLDS;

  const each = Math.ceil(tier1.minVCoin / 3);
  for (const boosterId of ['sam', 'ada', 'kai']) {
    // eslint-disable-next-line no-await-in-loop
    await shop.boostVillage(store, {
      villageId: village.id, boosterId, amountVCoin: each, settleFn,
    });
  }

  const status = shop.getBoostStatus(store, village.id);
  assert.strictEqual(status.totalBoostVCoin, each * 3);
  assert.ok(status.boostLevel >= tier1.level,
    'three members together must reach what one member could alone');
  assert.strictEqual(store.villageBoostContributions.length, 3,
    'every contribution is recorded individually, not merged');
  assert.strictEqual(settleFn.of('ines'), each * 3);
  assert.ok(Math.abs(settleFn.drift()) < 0.01);
});

test('a boost of zero or less is refused rather than recorded as a free boost', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  const village = withVillage(store, 'ines');

  await assert.rejects(() => shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: 0, settleFn,
  }), /positive amountVCoin/);
  await assert.rejects(() => shop.boostVillage(store, {
    villageId: village.id, boosterId: 'sam', amountVCoin: -50, settleFn,
  }), /positive amountVCoin/);
  assert.strictEqual(store.villageBoostContributions.length, 0);
});

test('boosting a village that does not exist pays nobody', async () => {
  const store = createVxllageStore();
  const settleFn = ledger({ sam: 500 });
  await assert.rejects(() => shop.boostVillage(store, {
    villageId: 9999, boosterId: 'sam', amountVCoin: 100, settleFn,
  }), /no village/);
  assert.strictEqual(settleFn.of('sam'), 500);
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

// -- The idempotency-key collision boostVillage/purchaseCosmetic used to have
//
// Both settlement reasons -- which double as V3's idempotency key, see
// v3Client.js -- used to be scoped only by the resource's stable id
// (villageId, itemId), with no per-contribution/per-buyer component.
// boostVillage is explicitly meant to be called repeatedly against the
// same village (see "boosts accumulate across contributors" above);
// purchaseCosmetic's ownership guard only blocks the SAME buyer from
// buying twice, not a second, different buyer. Against V3's real
// idempotency store, a different contributor/buyer's (different-body)
// settlement collided with the first's key and was refused outright;
// the SAME contributor repeating the same amount instead replayed
// silently with no new money moving while this module's own state
// still advanced as though it had.
//
// `ledger()` above can't catch this -- it's a plain spy with no model
// of V3's real idempotency fingerprinting. This one reproduces it: a
// repeated key with an identical body replays (no new money); a
// repeated key with a different body is refused, matching V3's own
// behavior.
function idempotentLedger() {
  const seen = new Map();
  const moves = [];
  const fn = async (legs, meta = {}) => {
    const fingerprint = JSON.stringify(legs);
    if (meta.reason) {
      const prior = seen.get(meta.reason);
      if (prior !== undefined) {
        if (prior !== fingerprint) {
          throw new Error(`Idempotency-Key "settle:${meta.reason}" was already used for a different request.`);
        }
        return { ok: true, idempotentReplay: true };
      }
      seen.set(meta.reason, fingerprint);
    }
    moves.push(...legs);
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => moves.filter((m) => m.toUserId === a).reduce((n, m) => n + m.amount, 0);
  return fn;
}

test('two different boosters on the same village are each really charged', async () => {
  const store = createVxllageStore();
  const village = withVillage(store, 'ines');
  const settleFn = idempotentLedger();

  // Pre-fix: both boosts share the identical villageId-only reason, so
  // ada's boost (a different fromUserId/amount) collides with sam's
  // and is refused outright by V3.
  await shop.boostVillage(store, { villageId: village.id, boosterId: 'sam', amountVCoin: 40, settleFn });
  await shop.boostVillage(store, { villageId: village.id, boosterId: 'ada', amountVCoin: 60, settleFn });

  assert.strictEqual(settleFn.of('ines'), 100,
    'both boosters must really fund the village, not collide on the same settlement key');
});

test('the same booster boosting the same village twice is charged twice, not replayed for free', async () => {
  const store = createVxllageStore();
  const village = withVillage(store, 'ines');
  const settleFn = idempotentLedger();

  // Pre-fix: identical boosterId and amount means identical legs, so
  // the second call replays the first's cached success with no new
  // money moving, while still recording a second contribution and
  // advancing totalBoostVCoin as though it had.
  await shop.boostVillage(store, { villageId: village.id, boosterId: 'sam', amountVCoin: 50, settleFn });
  await shop.boostVillage(store, { villageId: village.id, boosterId: 'sam', amountVCoin: 50, settleFn });

  assert.strictEqual(settleFn.of('ines'), 100,
    'a second, identical-looking boost must really charge again');
});

test('two different buyers of the same village cosmetic are each really charged', async () => {
  const store = createVxllageStore();
  const village = withVillage(store, 'ines');
  const item = shop.createCosmeticItem(store, {
    villageId: village.id, creatorId: 'ines', name: 'Runner badge', priceVCoin: 40,
  });
  const settleFn = idempotentLedger();

  // Pre-fix: both purchases share the identical itemId-only reason, so
  // ada's purchase (a different fromUserId) collides with sam's and is
  // refused outright by V3 -- a second buyer of a reusable cosmetic
  // could never actually buy it.
  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'sam', settleFn });
  await shop.purchaseCosmetic(store, { itemId: item.id, buyerId: 'ada', settleFn });

  assert.strictEqual(settleFn.of('ines'), 80,
    'both buyers must really pay for the cosmetic, not collide on the same settlement key');
});
