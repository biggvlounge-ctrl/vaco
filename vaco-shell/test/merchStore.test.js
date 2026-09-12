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

// **Every price in the two tests above divides evenly.** 30/10 and
// 90/30 split into thirds with nothing left over, so they cannot
// distinguish a split that adds up from one that loses a cent to
// rounding — and the money audit closed with this module described as
// "probed clean", which it had not earned from round numbers alone.
//
// Driven across 8 awkward price points: 0 mismatches. The reason it
// holds is structural rather than lucky — `brandPayout` is
// `round(grossMargin - platformFee)`, a residual, so whatever the other
// two shares round to, the brand absorbs the difference and the three
// always sum to what the customer paid.
//
// **A claim this comment first made and the code disproved.** It said
// an independent `round(grossMargin * (1 - takeRate))` would not have
// that property. Mutating the line to exactly that: all 16 tests still
// passed. At a rate of 0.2 the two formulas are arithmetically
// identical on cent-quantized margins — `0.2 × cents` can only land on
// a fraction of .0, .2, .4, .6 or .8, never the .5 that would round
// both shares up and produce an extra cent. So the residual form is
// the better one to keep, but this test cannot tell them apart, and
// saying it could would have been an assertion about coverage the
// suite does not have.
//
// What the mutation did surface is the test below it: chasing a rate
// where the two formulas *do* diverge is what found that `takeRate`
// was never validated.
test('the three shares sum to the total at prices that do not divide evenly', async () => {
  const cases = [
    { retail: 0.03, cost: 0.01, quantity: 1 },   // sub-cent margin
    { retail: 7.77, cost: 3.33, quantity: 3 },
    { retail: 99.99, cost: 49.99, quantity: 7 },
    { retail: 18, cost: 7, quantity: 11 },
    { retail: 0.05, cost: 0.02, quantity: 13 },
    { retail: 52, cost: 24, quantity: 2 },
    { retail: 1.01, cost: 0.99, quantity: 1 },   // margin of one cent
    { retail: 28, cost: 11, quantity: 1 },
  ];

  for (const [i, c] of cases.entries()) {
    const store = createShellStore();
    createProduct(store, {
      productId: `p${i}`, appBrandId: 'void', name: `P${i}`,
      productType: 'other', retailPriceVcoin: c.retail, fulfilmentCostVcoin: c.cost,
    });
    const settleFn = recordingTransfers();
    const order = await placeOrder(store, {
      customerId: 'sam', productId: `p${i}`, quantity: c.quantity, settleFn,
    });

    const shares = order.fulfilmentCost + order.brandPayout + order.platformFee;
    assert.equal(Math.round(shares * 100) / 100, order.total,
      `${c.retail}×${c.quantity} split into ${shares} against a total of ${order.total}`);

    // And the ledger must move exactly that, not the unrounded figure.
    const moved = Math.round(settleFn.moves.reduce((n, m) => n + m.amount, 0) * 100) / 100;
    assert.equal(moved, order.total,
      `the customer paid ${order.total} but ${moved} left their balance`);
    assert.ok(order.brandPayout >= 0 && order.platformFee >= 0,
      `a share went negative: brand ${order.brandPayout}, platform ${order.platformFee}`);
  }
});

// **The defect: `takeRate` was caller-settable with no validation, and
// it is the one field in a product that can charge a customer more than
// the order says.** The platform fee is derived from it and the brand
// gets the residual, so a rate above 1 makes the brand's share
// negative — and `placeOrder` drops a non-positive leg rather than
// refusing it, so the fee is taken and nothing offsets it. Measured
// before the fix, `takeRate: 3` on the 30 VCoin tee: **70 VCoin left
// the customer's balance against an order recording `total: 30`.** A
// negative rate inverts it: the brand is paid more than the entire
// margin, the platform's negative leg is dropped, and the customer
// funds the difference.
test('a take rate that would overcharge the customer is refused at creation', () => {
  const store = createShellStore();
  for (const takeRate of [1.5, 3, -0.25, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createProduct(store, {
      productId: `bad-${takeRate}`, appBrandId: 'void', name: 'Bad',
      productType: 'other', retailPriceVcoin: 30, fulfilmentCostVcoin: 10, takeRate,
    }), MerchError, `takeRate ${takeRate} was accepted`);
  }

  // 0 and 1 are both legitimate: the brand keeping the whole margin,
  // and the platform taking it. Neither makes a share negative.
  for (const takeRate of [0, 1]) {
    const p = createProduct(store, {
      productId: `edge-${takeRate}`, appBrandId: 'void', name: 'Edge',
      productType: 'other', retailPriceVcoin: 30, fulfilmentCostVcoin: 10, takeRate,
    });
    assert.equal(p.takeRate, takeRate);
  }
});

test('a product persisted with a bad take rate cannot be ordered', async () => {
  // Validation at creation does not reach a product that was written
  // to a file or to Postgres before that check existed — the store is
  // loaded from persistence, so the order path has to refuse it too.
  const store = storeWithProducts();
  getProduct(store, 'void-tee').takeRate = 3;

  const settleFn = recordingTransfers();
  await assert.rejects(() => placeOrder(store, {
    customerId: 'sam', productId: 'void-tee', settleFn,
  }), /takeRate 3/);

  assert.equal(settleFn.moves.length, 0, 'money moved on an order that should not exist');
  assert.equal(store.merchOrders.length, 0, 'an order was recorded despite the refusal');
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
