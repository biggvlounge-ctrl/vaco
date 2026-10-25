// CVLLEX — vaulting and redemption: the real bridge into VOKEN's
// existing Cvltvre Card minting, and real unit-by-unit redemption
// through VOID's courier vertical. Every cross-app call is a fake
// function here — no network, matching this ecosystem's standing
// injected-cross-app-call convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createCvllexStore } = require('../lib/store');
const { createProductionOrder, advanceProductionOrder } = require('../lib/physicalProduction');
const {
  getVaultedCollectible, vaultProducedOrder, redeemUnit,
} = require('../lib/vault');

function produce(store, overrides = {}) {
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 10, ...overrides });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'produced' });
  return order;
}

const fakeMint = async (order) => ({ id: 777, sourceApp: 'cvllex', externalRef: String(order.id) });

test('vaultProducedOrder refuses to vault an order that is not actually produced yet', async () => {
  const store = createCvllexStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 10 });
  await assert.rejects(
    vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint }),
    /is ordered, not produced/,
  );
});

test('vaultProducedOrder mints the real Cvltvre Card and creates a matching vault', async () => {
  const store = createCvllexStore();
  const order = produce(store);
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });
  assert.strictEqual(vault.orderId, order.id);
  assert.strictEqual(vault.creatorId, 'ada');
  assert.strictEqual(vault.totalUnits, 10);
  assert.strictEqual(vault.remainingUnits, 10);
  assert.strictEqual(vault.cultureCardId, 777);
  assert.strictEqual(vault.status, 'vaulted');
  assert.strictEqual(order.vaultId, vault.id);
});

test('vaultProducedOrder refuses to vault the same order twice', async () => {
  const store = createCvllexStore();
  const order = produce(store);
  await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });
  await assert.rejects(
    vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint }),
    /already vaulted/,
  );
});

test('vaultProducedOrder surfaces a real error if the mint call does not return a real card id', async () => {
  const store = createCvllexStore();
  const order = produce(store);
  await assert.rejects(
    vaultProducedOrder(store, { order, mintCultureCardFn: async () => null }),
    /did not return a real minted card/,
  );
});

test('redeemUnit decrements remainingUnits and records a real VOID shipment', async () => {
  const store = createCvllexStore();
  const order = produce(store);
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });

  const fakeVoid = async (redeemerId, shippingCost) => ({ id: 42, customerId: redeemerId, unitPrice: shippingCost });
  const { vault: updated, redemption } = await redeemUnit(store, {
    vaultId: vault.id, redeemerId: 'ben', shippingCost: 5.5, voidRequestFn: fakeVoid,
  });

  assert.strictEqual(updated.remainingUnits, 9);
  assert.strictEqual(updated.status, 'vaulted');
  assert.strictEqual(redemption.redeemerId, 'ben');
  assert.strictEqual(redemption.voidShipmentId, '42');
  assert.strictEqual(updated.redemptions.length, 1);
});

test('redeemUnit marks the vault depleted once the last unit is redeemed', async () => {
  const store = createCvllexStore();
  const order = produce(store, { quantity: 1 });
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });

  const fakeVoid = async (redeemerId, shippingCost) => ({ id: 1, customerId: redeemerId, unitPrice: shippingCost });
  const { vault: updated } = await redeemUnit(store, {
    vaultId: vault.id, redeemerId: 'ben', shippingCost: 5, voidRequestFn: fakeVoid,
  });

  assert.strictEqual(updated.remainingUnits, 0);
  assert.strictEqual(updated.status, 'depleted');
});

test('redeemUnit refuses once a vault has no units left', async () => {
  const store = createCvllexStore();
  const order = produce(store, { quantity: 1 });
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });
  const fakeVoid = async (redeemerId, shippingCost) => ({ id: 1, customerId: redeemerId, unitPrice: shippingCost });
  await redeemUnit(store, { vaultId: vault.id, redeemerId: 'ben', shippingCost: 5, voidRequestFn: fakeVoid });

  await assert.rejects(
    redeemUnit(store, { vaultId: vault.id, redeemerId: 'cal', shippingCost: 5, voidRequestFn: fakeVoid }),
    /has no units left to redeem/,
  );
});

test('redeemUnit claims the unit before the real shipment request goes out, not after', async () => {
  // The same claim-before-pay discipline settleOnce.js enforces for
  // money, checked directly here: if the decrement happened only
  // after voidRequestFn resolved, two concurrent redemptions of the
  // last unit could both pass the remainingUnits check and both
  // request a real courier job for a unit that was never really
  // available twice over.
  const store = createCvllexStore();
  const order = produce(store, { quantity: 1 });
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });

  let sawRemainingInsideVoidCall;
  const fakeVoid = async (redeemerId, shippingCost) => {
    sawRemainingInsideVoidCall = getVaultedCollectible(store, vault.id).remainingUnits;
    return { id: 9, customerId: redeemerId, unitPrice: shippingCost };
  };
  await redeemUnit(store, { vaultId: vault.id, redeemerId: 'ben', shippingCost: 5, voidRequestFn: fakeVoid });
  assert.strictEqual(sawRemainingInsideVoidCall, 0);
});

test('redeemUnit rejects a non-positive shippingCost', async () => {
  const store = createCvllexStore();
  const order = produce(store);
  const vault = await vaultProducedOrder(store, { order, mintCultureCardFn: fakeMint });
  await assert.rejects(
    redeemUnit(store, {
      vaultId: vault.id, redeemerId: 'ben', shippingCost: 0, voidRequestFn: async () => ({ id: 1 }),
    }),
    /requires a positive shippingCost/,
  );
});
