// VACO Merch.
//
// The quiet failure in a zero-inventory model is selling below cost:
// there is no stock sitting in a warehouse to make the loss obvious,
// so every unit sold loses money and the store looks like it is
// working. The second quiet failure is taking the platform fee off
// retail instead of margin, which silently eats the brand's entire
// share on a low-margin item. Both are asserted against here.

import test from 'node:test';
import assert from 'node:assert';

import { createShellStore } from '../lib/store.js';
import {
  createProduct, getProduct, listByBrand, listBrands, discontinueProduct,
  placeOrder, getOrder, submitToFulfilment, advanceOrder,
  listOrdersForCustomer, brandEarnings, describeMerch,
  DEFAULT_FULFILMENT_PROVIDER, DEFAULT_MERCH_TAKE_RATE,
  VACO_MERCH_ACCOUNT, MerchError,
} from '../lib/merchStore.js';

// **`moves` and `calls` answer different questions.** `moves` is every
// leg, flattened — what an assertion about who was paid what wants.
// `calls` is how many times the ledger was asked, which is the only
// thing that distinguishes an atomic settlement from the consecutive
// transfers it replaced: the amounts are identical either way, which is
// exactly how that defect survived a green suite.
function recordingTransfers() {
  const moves = [];
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const l of legs) {
      moves.push({ from: l.fromUserId, to: l.toUserId, amount: l.amount, reason: l.reason });
    }
    return { ok: true };
  };
  fn.moves = moves;
  fn.calls = calls;
  return fn;
}

function storeWithProducts() {
  const store = createShellStore();
  createProduct(store, {
    productId: 'void-tee', appBrandId: 'void', name: 'VOID Driver Tee',
    productType: 'apparel', retailPriceVcoin: 30, fulfilmentCostVcoin: 10,
  });
  createProduct(store, {
    productId: 'void-mug', appBrandId: 'void', name: 'VOID Mug',
    productType: 'mug', retailPriceVcoin: 18, fulfilmentCostVcoin: 7,
  });
  createProduct(store, {
    productId: 'vdp-tee', appBrandId: 'vdp', name: 'VDP Districts Tee',
    productType: 'apparel', retailPriceVcoin: 28, fulfilmentCostVcoin: 11,
  });
  return store;
}

// -- products ----------------------------------------------------------

test('a product priced at or below fulfilment cost is refused', () => {
  const store = createShellStore();
  assert.throws(() => createProduct(store, {
    productId: 'loss-tee', appBrandId: 'void', name: 'Loss Tee',
    productType: 'apparel', retailPriceVcoin: 9, fulfilmentCostVcoin: 11,
  }), /does not cover fulfilment cost/);

  // Exactly break-even is refused too — a product that earns the brand
  // nothing is a mistake, not a strategy.
  assert.throws(() => createProduct(store, {
    productId: 'even-tee', appBrandId: 'void', name: 'Even Tee',
    productType: 'apparel', retailPriceVcoin: 11, fulfilmentCostVcoin: 11,
  }), MerchError);
});

test('zero inventory is fixed true and cannot be turned off by a caller', () => {
  const store = createShellStore();
  const product = createProduct(store, {
    productId: 'warehouse-tee', appBrandId: 'void', name: 'Tee',
    productType: 'apparel', retailPriceVcoin: 30, fulfilmentCostVcoin: 10,
    isZeroInventory: false,
  });
  assert.equal(product.isZeroInventory, true);
});

test('printify is the default provider and an unknown provider is refused', () => {
  const store = createShellStore();
  const product = createProduct(store, {
    productId: 'tee', appBrandId: 'void', name: 'Tee',
    productType: 'apparel', retailPriceVcoin: 30, fulfilmentCostVcoin: 10,
  });
  assert.equal(product.fulfillmentProvider, DEFAULT_FULFILMENT_PROVIDER);
  assert.equal(DEFAULT_FULFILMENT_PROVIDER, 'printify');

  assert.throws(() => createProduct(store, {
    productId: 'tee2', appBrandId: 'void', name: 'Tee',
    productType: 'apparel', retailPriceVcoin: 30, fulfilmentCostVcoin: 10,
    fulfillmentProvider: 'some-guy-with-a-heat-press',
  }), MerchError);
});

test('one storefront, many brands', () => {
  const store = storeWithProducts();
  assert.equal(listByBrand(store, 'void').length, 2);
  assert.equal(listByBrand(store, 'vdp').length, 1);
  assert.deepEqual(listBrands(store), [
    { appBrandId: 'void', products: 2 },
    { appBrandId: 'vdp', products: 1 },
  ]);
});

test('a discontinued product disappears from the storefront and cannot be ordered', async () => {
  const store = storeWithProducts();
  discontinueProduct(store, 'void-mug');
  assert.equal(listByBrand(store, 'void').length, 1);
  await assert.rejects(() => placeOrder(store, {
    customerId: 'sam', productId: 'void-mug', settleFn: recordingTransfers(),
  }), /discontinued/);
});

// -- orders ------------------------------------------------------------

test('an order splits three ways, with the platform fee taken on margin not retail', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  const order = await placeOrder(store, { customerId: 'sam', productId: 'void-tee', settleFn });

  // Retail 30, cost 10 → margin 20. Platform takes 20% of 20 = 4.
  // Taken on retail it would have been 6, leaving the brand 14 instead
  // of 16 — which is the whole point of the distinction.
  assert.equal(order.total, 30);
  assert.equal(order.fulfilmentCost, 10);
  assert.equal(order.platformFee, 20 * DEFAULT_MERCH_TAKE_RATE);
  assert.equal(order.brandPayout, 16);
  assert.equal(order.fulfilmentCost + order.brandPayout + order.platformFee, order.total,
    'the three shares must add back up to what the customer paid');

  assert.equal(settleFn.moves.length, 3);
  // **Three legs, one call.** Written as three consecutive transfers
  // there were two windows for a partial failure, and the order record
  // is only written after all of them — so a failure moved money,
  // created no order, and left the customer free to buy again. Every
  // other assertion in this test passes either way.
  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.deepEqual(settleFn.moves.map((m) => m.to), [
    'merch-fulfilment:printify', 'brand:void', VACO_MERCH_ACCOUNT,
  ]);
  assert.ok(settleFn.moves.every((m) => m.from === 'sam'));
});

test('quantity multiplies every share', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  const order = await placeOrder(store, {
    customerId: 'sam', productId: 'void-tee', quantity: 3, settleFn,
  });
  assert.equal(order.total, 90);
  assert.equal(order.fulfilmentCost, 30);
  assert.equal(order.platformFee, 12);
  assert.equal(order.brandPayout, 48);
});

test('an order without a settleFn is refused rather than recorded unpaid', async () => {
  const store = storeWithProducts();
  await assert.rejects(
    () => placeOrder(store, { customerId: 'sam', productId: 'void-tee' }),
    /requires a settleFn/,
  );
  assert.equal(store.merchOrders.length, 0);
});

test('a fractional quantity is refused', async () => {
  const store = storeWithProducts();
  await assert.rejects(() => placeOrder(store, {
    customerId: 'sam', productId: 'void-tee', quantity: 1.5, settleFn: recordingTransfers(),
  }), /positive integer quantity/);
});

test('nothing is manufactured until the order reaches production', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  const order = await placeOrder(store, { customerId: 'sam', productId: 'void-tee', settleFn });
  assert.equal(order.status, 'placed');
  assert.equal(order.manufacturedAt, null);

  submitToFulfilment(store, { orderId: order.id, providerOrderRef: 'printify-123' });
  assert.equal(getOrder(store, order.id).status, 'submitted');
  assert.equal(getOrder(store, order.id).manufacturedAt, null,
    'submitting is not manufacturing');

  advanceOrder(store, { orderId: order.id, to: 'in-production', now: 5000 });
  assert.equal(getOrder(store, order.id).manufacturedAt, 5000);
});

test('the fulfilment seam records intent and says so rather than pretending', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  const order = await placeOrder(store, { customerId: 'sam', productId: 'void-tee', settleFn });
  const submitted = submitToFulfilment(store, { orderId: order.id });
  assert.match(submitted.integrationNote, /no live fulfilment API/);
});

test('order status cannot skip or reverse', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  const order = await placeOrder(store, { customerId: 'sam', productId: 'void-tee', settleFn });

  assert.throws(() => advanceOrder(store, { orderId: order.id, to: 'shipped' }),
    /cannot go placed -> shipped/);

  submitToFulfilment(store, { orderId: order.id });
  advanceOrder(store, { orderId: order.id, to: 'in-production' });
  // Once it physically exists, cancelling is no longer free — and the
  // machine refuses it rather than leaving that to a caller to know.
  assert.throws(() => advanceOrder(store, { orderId: order.id, to: 'cancelled' }), MerchError);

  advanceOrder(store, { orderId: order.id, to: 'shipped' });
  advanceOrder(store, { orderId: order.id, to: 'delivered' });
  assert.throws(() => advanceOrder(store, { orderId: order.id, to: 'shipped' }), /terminal/);
});

// -- reading -----------------------------------------------------------

test('brand earnings exclude cancelled orders and report each share', async () => {
  const store = storeWithProducts();
  const settleFn = recordingTransfers();
  await placeOrder(store, { customerId: 'sam', productId: 'void-tee', settleFn });
  await placeOrder(store, { customerId: 'ada', productId: 'void-mug', quantity: 2, settleFn });
  const cancelled = await placeOrder(store, { customerId: 'ada', productId: 'void-tee', settleFn });
  advanceOrder(store, { orderId: cancelled.id, to: 'cancelled' });

  const earnings = brandEarnings(store, 'void');
  assert.equal(earnings.orders, 2);
  assert.equal(earnings.unitsSold, 3);
  assert.equal(earnings.grossVcoin, 30 + 36);
  // void-tee margin 20 → brand 16. void-mug margin 11 × 2 = 22 → brand 17.6.
  assert.equal(earnings.brandPayout, 33.6);
  assert.equal(earnings.platformFees, 4 + 4.4);

  assert.equal(listOrdersForCustomer(store, 'ada').length, 2);
});

test('describeMerch states what is not built rather than implying a live integration', () => {
  const store = storeWithProducts();
  const described = describeMerch(store);
  assert.equal(described.products, 3);
  assert.equal(described.brands, 2);
  assert.equal(described.zeroInventory, true);
  assert.ok(described.notBuilt.some((n) => /no live Printify/.test(n)));
  assert.ok(described.notBuilt.some((n) => /no AI illustration layer/.test(n)));
});

test('a refused merch settlement creates no order and moves nothing', async () => {
  const store = storeWithProducts();
  const settleFn = async () => {
    throw new Error('legs[2]: Insufficient VCoin balance. Nothing in this settlement was applied.');
  };
  const before = store.merchOrders.length;

  await assert.rejects(
    () => placeOrder(store, {
      customerId: 'sam', productId: 'void-tee', quantity: 1, settleFn,
    }),
    /Nothing in this settlement was applied/,
  );

  assert.equal(store.merchOrders.length, before,
    'a refused settlement recorded an order');
});
