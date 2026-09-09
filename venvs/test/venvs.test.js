// VENVS — the last app in the ecosystem with real money logic and no
// tests.
//
// **Why this was the gap worth closing last.** VENVS has 1,014 lines of
// lib code and had no `test/` directory at all, so `run-all-tests.mjs`
// never even discovered it — the ecosystem reported "all green" across
// 38 suites while this one sat outside the count entirely. A suite
// count is not coverage, and an app with no tests cannot fail.
//
// What is in here is not incidental either: a publishing royalty
// calculator with real rate bands, a marketplace that takes a buyer's
// money and splits it across sellers, and a book purchase that pays an
// author. Four properties matter more than the arithmetic:
//
//   1. **Money is conserved.** Checkout charges the buyer once and pays
//      the sellers out of that. What the buyer paid must equal what the
//      sellers received, to the cent, across any number of sellers.
//   2. **Band boundaries are exact.** The 70% ebook royalty applies to
//      $2.99–$9.99 inclusive. A `>` where a `>=` belongs silently moves
//      every book priced exactly at a boundary into the 35% band.
//   3. **A rate nobody specified is not a rate to invent.** Traditional
//      narrator deals have no documented percentage, so that path
//      demands one rather than defaulting.
//   4. **A failed payment leaves no record.** Transfer first, receipt
//      second, everywhere money moves.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateEbookRoyalty, calculatePrintRoyalty,
  calculateSubscriptionFundRate, calculateSubscriptionPayout,
  calculateAudiobookRoyalty,
} from '../src/lib/royalties.js';

import {
  createMarketplace, registerSeller, getSeller, listProduct, getProduct,
  browseProducts, getSellerStorefront, createCart, getCart, addToCart,
  checkout, getOrder, requestFulfillment, checkAbandonedCarts,
  generateRecoveryOffer, PLATFORM_USER_ID,
} from '../src/lib/marketplace.js';

import {
  createCatalog, publishBook, getBook, getCatalog, purchaseBook,
  getBookOrder, listUnfulfilledBookOrders, requestBookFulfillment,
  PLATFORM_USER_ID as PUBLISHING_PLATFORM,
} from '../src/lib/catalog.js';
import { createShop, listProduct as listShopProduct, buyNow } from '../src/lib/shop.js';
import { SUB_BRANDS, ownerIdFor, seedSvmikoDegvchiStorefronts } from '../src/lib/svmikoDegvchi.js';

// Records every transfer so a test can assert on WHO paid WHOM and how
// much — the thing a stub returning `true` would hide entirely.
function ledger() {
  const moves = [];
  const fn = async (from, to, amount, reason) => { moves.push({ from, to, amount, reason }); };
  fn.moves = moves;
  fn.paidTo = (who) => moves.filter((m) => m.to === who).reduce((n, m) => n + m.amount, 0);
  fn.paidBy = (who) => moves.filter((m) => m.from === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

// ===========================================================================
// Publishing royalties — real rate bands
// ===========================================================================

test('the 70% ebook band is inclusive at both edges', () => {
  // **The off-by-one that would cost every author on a round price.**
  // The band is $2.99-$9.99 INCLUSIVE; a `>` where `>=` belongs moves
  // books priced exactly at a boundary into the 35% band and halves
  // their royalty, silently.
  assert.equal(calculateEbookRoyalty(2.99).band, 'in_band_70');
  assert.equal(calculateEbookRoyalty(9.99).band, 'in_band_70');
  assert.equal(calculateEbookRoyalty(2.98).band, 'out_of_band_35');
  assert.equal(calculateEbookRoyalty(10.00).band, 'out_of_band_35');
  assert.equal(calculateEbookRoyalty(5.00).rate, 0.7);
  assert.equal(calculateEbookRoyalty(20.00).rate, 0.35);
});

test('the delivery fee is deducted only inside the 70% band', () => {
  // Modelled on the real KDP mechanic, where the fee rides with the
  // higher rate. Applying it to the 35% band too would quietly
  // undercut low- and high-priced books.
  const inBand = calculateEbookRoyalty(9.99, 0.50);
  assert.equal(inBand.royaltyAmount, Math.round((9.99 * 0.7 - 0.5) * 100) / 100);

  const outOfBand = calculateEbookRoyalty(20.00, 0.50);
  assert.equal(outOfBand.royaltyAmount, Math.round(20 * 0.35 * 100) / 100,
    'the fee was deducted from a band the doc does not apply it to');
});

test('a delivery fee larger than the royalty floors at zero, never negative', () => {
  // An author must not owe money for a sale.
  const out = calculateEbookRoyalty(3.00, 99);
  assert.equal(out.royaltyAmount, 0);
  assert.ok(out.royaltyAmount >= 0);
});

test('a print book priced below its printing cost pays nothing and says so', () => {
  const healthy = calculatePrintRoyalty(20, 4);
  assert.equal(healthy.rate, 0.6);
  assert.equal(healthy.royaltyAmount, Math.round((20 * 0.6 - 4) * 100) / 100);
  assert.equal(healthy.belowCost, false);

  const unprofitable = calculatePrintRoyalty(5, 10);
  assert.equal(unprofitable.royaltyAmount, 0, 'never a negative payout');
  assert.equal(unprofitable.belowCost, true, 'and the caller is told why, so it can warn the author');
});

test('every royalty calculator refuses inputs it cannot compute on', () => {
  assert.throws(() => calculateEbookRoyalty(0), /positive listPrice/);
  assert.throws(() => calculateEbookRoyalty(-5), /positive listPrice/);
  assert.throws(() => calculateEbookRoyalty(5, -1), /non-negative deliveryFee/);
  assert.throws(() => calculateEbookRoyalty('5'), /positive listPrice/);
  assert.throws(() => calculatePrintRoyalty(0, 1), /positive listPrice/);
  assert.throws(() => calculatePrintRoyalty(10, -1), /non-negative printingCost/);
});

test('the subscription rate is derived from the fund, not fixed', () => {
  // The doc is explicit that the per-page rate is fund / pages, not a
  // constant — so a hardcoded $0.0045 would be wrong every month.
  const out = calculateSubscriptionFundRate(45000, 10000000);
  assert.equal(out.rate, 0.0045);
  assert.equal(out.typicalRange, true, '$0.0045 is inside the stated typical range');

  // Outside the typical range is flagged, not refused — the real fund
  // fluctuates and an unusual month is data, not an error.
  const unusual = calculateSubscriptionFundRate(90000, 10000000);
  assert.equal(unusual.typicalRange, false);
  assert.ok(unusual.rate > 0, 'and it still returns a real rate');
});

test('a subscription payout multiplies pages by the rate, and zero pages pays zero', () => {
  assert.equal(calculateSubscriptionPayout(1000, 0.0045), 4.5);
  assert.equal(calculateSubscriptionPayout(0, 0.0045), 0, 'zero pages is a real reading, not an error');
  assert.throws(() => calculateSubscriptionFundRate(0, 100), /positive totalMonthlyFund/);
  assert.throws(() => calculateSubscriptionFundRate(100, 0), /positive totalPagesRead/);
  assert.throws(() => calculateSubscriptionPayout(-1, 0.004), /non-negative pagesRead/);
});

test('AI narration has a specified rate; a human narrator deal does not', () => {
  // **The refusal that matters.** The source doc gives 40% for AI
  // narration and quantifies nothing for traditional narrator deals.
  // Inventing a default there would put a made-up number into a real
  // contract calculation.
  assert.equal(calculateAudiobookRoyalty(20, { narrationType: 'ai' }).rate, 0.4);
  assert.equal(calculateAudiobookRoyalty(20, { narrationType: 'ai' }).royaltyAmount, 8);

  assert.throws(
    () => calculateAudiobookRoyalty(20, { narrationType: 'narrator' }),
    /requires an explicit narratorRoyaltyRate/,
  );
  assert.equal(
    calculateAudiobookRoyalty(20, { narrationType: 'narrator', narratorRoyaltyRate: 0.25 }).royaltyAmount,
    5,
  );
  // And a rate outside 0-1 is a mistake, not a very generous deal.
  assert.throws(
    () => calculateAudiobookRoyalty(20, { narrationType: 'narrator', narratorRoyaltyRate: 1.5 }),
    /narratorRoyaltyRate/,
  );
  assert.throws(() => calculateAudiobookRoyalty(20, {}), /narrationType "ai" or "narrator"/);
});

// ===========================================================================
// Marketplace — where the money actually splits
// ===========================================================================

function shopFixture() {
  const m = createMarketplace();
  const a = registerSeller(m, { name: 'Atelier A', ownerId: 'owner-a' });
  const b = registerSeller(m, { name: 'Atelier B', ownerId: 'owner-b' });
  const p1 = listProduct(m, { sellerId: a.id, title: 'Coat', price: 40, category: 'outerwear' });
  const p2 = listProduct(m, { sellerId: b.id, title: 'Pin', price: 12.5, category: 'accessories' });
  return { m, a, b, p1, p2 };
}

test('a seller and a product are refused unless real', () => {
  const m = createMarketplace();
  assert.throws(() => registerSeller(m, { ownerId: 'x' }), /requires a name/);
  assert.throws(() => registerSeller(m, { name: 'x' }), /requires an ownerId/);

  const seller = registerSeller(m, { name: 'A', ownerId: 'o' });
  assert.throws(() => listProduct(m, { sellerId: 9999, title: 't', price: 1 }), /no seller with id/);
  assert.throws(() => listProduct(m, { sellerId: seller.id, price: 1 }), /requires a title/);
  assert.throws(() => listProduct(m, { sellerId: seller.id, title: 't', price: 0 }), /positive price/);
  assert.throws(() => listProduct(m, { sellerId: seller.id, title: 't', price: -1 }), /positive price/);
  assert.equal(m.products.length, 0, 'and nothing partial was written');
});

test('products are browsable and a storefront shows only its own seller', () => {
  const { m, a, p1 } = shopFixture();
  assert.equal(browseProducts(m).length, 2);
  assert.equal(browseProducts(m, { category: 'outerwear' })[0].id, p1.id);

  const front = getSellerStorefront(m, a.id);
  assert.ok(front.products.every((p) => p.sellerId === a.id), 'another seller\'s stock leaked in');
  assert.equal(getProduct(m, 9999), null, 'an unknown id is null, not undefined');
  assert.equal(getSeller(m, 9999), null);
});

test('a cart accumulates quantity rather than duplicating a line', () => {
  const { m, p1 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 2);
  addToCart(m, cart.id, p1.id, 3);
  assert.equal(cart.items.length, 1, 'two lines for one product would double-count at checkout');
  assert.equal(cart.items[0].quantity, 5);
});

test('a cart refuses what it cannot price', () => {
  const { m, p1 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  assert.throws(() => addToCart(m, 9999, p1.id), /no cart with id/);
  assert.throws(() => addToCart(m, cart.id, 9999), /no product with id/);
  assert.throws(() => addToCart(m, cart.id, p1.id, 0), /positive quantity/);
  assert.throws(() => addToCart(m, cart.id, p1.id, -2), /positive quantity/);
});

test('checkout conserves money exactly across several sellers', () => {
  // **The property this whole suite exists for.** The buyer pays the
  // platform once; the platform pays each seller their own line total.
  // Those two numbers must match to the cent, or the platform is
  // silently gaining or losing money on every order.
  const { m, a, b, p1, p2 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 2);   // 80.00
  addToCart(m, cart.id, p2.id, 3);   // 37.50
  const transferFn = ledger();

  return checkout(m, { cartId: cart.id, transferFn }).then((order) => {
    assert.equal(order.total, 117.5);
    assert.equal(transferFn.paidBy('buyer'), 117.5, 'the buyer was charged the cart total, once');
    assert.equal(
      transferFn.paidTo('owner-a') + transferFn.paidTo('owner-b'), 117.5,
      'what the sellers received does not equal what the buyer paid',
    );
    assert.equal(transferFn.paidTo('owner-a'), 80);
    assert.equal(transferFn.paidTo('owner-b'), 37.5);
    assert.equal(
      transferFn.paidTo(PLATFORM_USER_ID) - transferFn.paidBy(PLATFORM_USER_ID), 0,
      'the platform kept a cut it does not charge',
    );
    assert.equal(order.payouts.length, 2, 'one payout per seller, not per line');
  });
});

test('two products from one seller are paid as a single payout', () => {
  const { m, a } = shopFixture();
  const second = listProduct(m, { sellerId: a.id, title: 'Scarf', price: 10 });
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, second.id, 1);
  const first = m.products.find((p) => p.sellerId === a.id && p.title === 'Coat');
  addToCart(m, cart.id, first.id, 1);
  const transferFn = ledger();

  return checkout(m, { cartId: cart.id, transferFn }).then((order) => {
    assert.equal(order.payouts.length, 1, 'one seller, one payout');
    assert.equal(order.payouts[0].amount, 50);
    assert.equal(transferFn.paidTo('owner-a'), 50);
  });
});

test('a cart cannot be checked out twice', () => {
  // Otherwise a buyer pays once per click and the sellers are paid
  // every time.
  const { m, p1 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 1);
  const transferFn = ledger();

  return checkout(m, { cartId: cart.id, transferFn })
    .then(() => assert.rejects(
      () => checkout(m, { cartId: cart.id, transferFn }),
      /is completed, not active/,
    ))
    .then(() => {
      assert.equal(transferFn.paidBy('buyer'), 40, 'the buyer was charged exactly once');
      assert.equal(m.orders.length, 1);
    });
});

test('an empty cart and a missing transfer function are both refused', () => {
  const { m, p1 } = shopFixture();
  const empty = createCart(m, { buyerId: 'buyer' });
  const transferFn = ledger();
  return assert.rejects(() => checkout(m, { cartId: empty.id, transferFn }), /cart is empty/)
    .then(() => assert.rejects(() => checkout(m, { cartId: 9999, transferFn }), /no cart with id/))
    .then(() => {
      const cart = createCart(m, { buyerId: 'b' });
      addToCart(m, cart.id, p1.id, 1);
      return assert.rejects(() => checkout(m, { cartId: cart.id }), /requires a transferFn/);
    })
    .then(() => assert.equal(transferFn.moves.length, 0));
});

test('an order that cannot be paid for leaves the cart usable', () => {
  // Transfer first, order second. A failed payment must not complete
  // the cart or file a receipt.
  const { m, p1 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 1);
  const broke = async () => { throw new Error('insufficient funds'); };

  return assert.rejects(
    () => checkout(m, { cartId: cart.id, transferFn: broke }),
    /insufficient funds/,
  ).then(() => {
    assert.equal(getCart(m, cart.id).status, 'active', 'the cart was consumed by a failed payment');
    assert.equal(m.orders.length, 0, 'and a receipt was filed for money that never moved');
  });
});

// ===========================================================================
// Fulfillment and abandonment
// ===========================================================================

test('fulfillment requests one shipment per seller and is not repeatable', () => {
  const { m, p1, p2 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 1);
  addToCart(m, cart.id, p2.id, 1);
  const transferFn = ledger();
  let jobId = 0;
  const voidRequestFn = async () => ({ id: ++jobId });

  return checkout(m, { cartId: cart.id, transferFn })
    .then((order) => requestFulfillment(m, {
      orderId: order.id, shippingCostPerSeller: 5, voidRequestFn,
    }))
    .then((order) => {
      assert.equal(order.voidShipmentId.length, 2, 'one shipment per seller');
      assert.equal(order.fulfillmentStatus, 'fulfillment-requested');
      return assert.rejects(
        () => requestFulfillment(m, {
          orderId: order.id, shippingCostPerSeller: 5, voidRequestFn,
        }),
        /already has VOID shipments/,
      );
    })
    .then(() => assert.equal(jobId, 2, 'a second request would have shipped everything twice'));
});

test('fulfillment refuses a missing order, a free shipment, or no VOID client', () => {
  const m = createMarketplace();
  const voidRequestFn = async () => ({ id: 1 });
  return assert.rejects(
    () => requestFulfillment(m, { orderId: 9999, shippingCostPerSeller: 5, voidRequestFn }),
    /no order with id/,
  );
});

test('a cart is abandoned only after the threshold, and only if it has items', () => {
  const { m, p1 } = shopFixture();
  const withItems = createCart(m, { buyerId: 'b1' });
  addToCart(m, withItems.id, p1.id, 1);
  const empty = createCart(m, { buyerId: 'b2' });

  const t = withItems.lastActivityAt;
  assert.deepEqual(checkAbandonedCarts(m, { now: t + 1000 }), [], 'not yet past the threshold');

  const abandoned = checkAbandonedCarts(m, { now: t + 30 * 60 * 1000 });
  assert.equal(abandoned.length, 1, 'the threshold is inclusive at exactly 30 minutes');
  assert.equal(abandoned[0].id, withItems.id);
  assert.notEqual(getCart(m, empty.id).status, 'abandoned',
    'an empty cart is nobody abandoning anything');
});

test('an abandoned cart gets a real discount, and an active one gets nothing', () => {
  const { m, p1 } = shopFixture();
  const cart = createCart(m, { buyerId: 'buyer' });
  addToCart(m, cart.id, p1.id, 2); // 80.00

  assert.throws(() => generateRecoveryOffer(m, cart.id), /is active, not abandoned/);

  checkAbandonedCarts(m, { now: cart.lastActivityAt + 30 * 60 * 1000 });
  const offer = generateRecoveryOffer(m, cart.id, { discountPercent: 10 });
  assert.equal(offer.originalTotal, 80);
  assert.equal(offer.discountAmount, 8);
  assert.equal(offer.discountedTotal, 72);
  assert.equal(offer.originalTotal - offer.discountAmount, offer.discountedTotal, 'the arithmetic closes');
  assert.throws(() => generateRecoveryOffer(m, 9999), /no cart with id/);
});

// ===========================================================================
// Publishing catalogue and shop
// ===========================================================================

test('buying a book pays the platform and then the author their royalty', () => {
  const catalog = createCatalog();
  const book = publishBook(catalog, {
    title: 'A Real Book', authorId: 'author-1', format: 'ebook',
    listPrice: 9.99, deliveryFee: 0.5,
  });
  const transferFn = ledger();

  return purchaseBook(catalog, { bookId: book.id, buyerId: 'reader', transferFn }).then((out) => {
    assert.equal(out.pricePaid, 9.99);
    assert.equal(transferFn.paidBy('reader'), 9.99);
    assert.equal(transferFn.paidTo('author-1'), out.royaltyPaid);
    assert.ok(out.royaltyPaid > 0, 'an in-band ebook must pay a royalty');
    assert.ok(
      out.royaltyPaid < out.pricePaid,
      'the author cannot receive more than the reader paid',
    );
  });
});

test('a book purchase is refused before any money moves', () => {
  const catalog = createCatalog();
  const transferFn = ledger();
  return assert.rejects(
    () => purchaseBook(catalog, { bookId: 9999, buyerId: 'r', transferFn }),
    /no book with id/,
  )
    .then(() => {
      const book = publishBook(catalog, {
        title: 'B', authorId: 'a', format: 'ebook', listPrice: 5,
      });
      return assert.rejects(
        () => purchaseBook(catalog, { bookId: book.id, transferFn }),
        /requires a buyerId/,
      );
    })
    .then(() => assert.equal(transferFn.moves.length, 0));
});

test('the catalogue filters by format and by source', () => {
  const catalog = createCatalog();
  publishBook(catalog, { title: 'E', authorId: 'a', format: 'ebook', listPrice: 5 });
  publishBook(catalog, {
    title: 'P', authorId: 'a', format: 'print', listPrice: 20, printingCost: 4,
  });
  assert.equal(getCatalog(catalog).length, 2, 'no filter means everything');
  assert.equal(getCatalog(catalog, { format: 'ebook' }).length, 1);
  assert.equal(getBook(catalog, 9999), null);
});

test('a shop purchase charges the listed price and nothing else', () => {
  const shop = createShop();
  const product = listShopProduct(shop, { title: 'Hoodie', price: 45, sellerId: 's1' });
  const transferFn = ledger();
  return buyNow(shop, { productId: product.id, buyerId: 'buyer', transferFn }).then((out) => {
    assert.equal(out.pricePaid, 45);
    assert.equal(transferFn.paidBy('buyer'), 45);
    assert.equal(transferFn.moves.length, 1);
  });
});

// ===========================================================================
// The SVMIKO/DEGVCHI fashion house
// ===========================================================================

test('every sub-brand has a distinct payout account', () => {
  // Same reasoning as VDP's copy of this catalogue: `ownerIdFor`
  // derives the account from the slug, so a duplicate routes one
  // label's takings to another.
  assert.ok(SUB_BRANDS.length > 0);
  const slugs = SUB_BRANDS.map((b) => b.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'two sub-brands share a slug');
  const owners = slugs.map(ownerIdFor);
  assert.equal(new Set(owners).size, owners.length);
});

test('seeding registers every sub-brand as a real storefront with real stock', () => {
  // The catalogue and the marketplace are separate modules and this is
  // where they meet — if any sub-brand failed the marketplace's own
  // validation, it would throw here rather than when a shopper first
  // opened the storefront.
  const m = createMarketplace();
  const seeded = seedSvmikoDegvchiStorefronts(m);

  assert.equal(seeded.length, SUB_BRANDS.length);
  assert.equal(m.sellers.length, SUB_BRANDS.length);
  assert.ok(m.products.length >= SUB_BRANDS.length, 'a seeded storefront with no stock is an empty shop');

  for (const seller of m.sellers) {
    const front = getSellerStorefront(m, seller.id);
    assert.ok(front.products.length > 0, `${seller.name} was seeded with nothing to sell`);
    for (const p of front.products) {
      assert.ok(p.price > 0, `${seller.name} lists "${p.title}" at ${p.price}`);
    }
  }
});

test('a seeded storefront can actually take an order end to end', () => {
  // The whole point of seeding: it produces a shop somebody can buy
  // from, not a row in a table.
  const m = createMarketplace();
  seedSvmikoDegvchiStorefronts(m);
  const product = m.products[0];
  const seller = getSeller(m, product.sellerId);

  const cart = createCart(m, { buyerId: 'shopper' });
  addToCart(m, cart.id, product.id, 1);
  const transferFn = ledger();

  return checkout(m, { cartId: cart.id, transferFn }).then((order) => {
    assert.equal(order.total, product.price);
    assert.equal(transferFn.paidTo(seller.ownerId), product.price,
      'the seeded storefront\'s own owner was paid');
  });
});


// ===========================================================================
// Publishing → VOID fulfillment
// ===========================================================================
// The gap VENVS's own CLAUDE.md §7 named: "Marketplace orders now route
// to VOID; physical *book* orders from Publishing don't yet, and should
// use the same real client." Closed at the same layer marketplace uses —
// an injected `voidRequestFn`, since neither app's fulfillment is wired
// into a component yet.

function voidStub() {
  let id = 0;
  const calls = [];
  const fn = async (shipperId, shippingCost) => {
    calls.push({ shipperId, shippingCost });
    return { id: ++id };
  };
  fn.calls = calls;
  return fn;
}

const printBook = (catalog, over = {}) => publishBook(catalog, {
  title: 'A Physical Book', authorId: 'author-1', format: 'print',
  listPrice: 20, printingCost: 4, ...over,
});

test('a purchase is recorded as an order, not just returned', () => {
  // It used to move real money and hand back a summary nothing kept —
  // so a physical book could be bought and paid for with no order to
  // ship, no id to reference, and nothing for VOID to attach to.
  const catalog = createCatalog();
  const book = printBook(catalog);
  return purchaseBook(catalog, { bookId: book.id, buyerId: 'reader', transferFn: ledger() })
    .then(({ order }) => {
      assert.ok(order.id, 'the order has an id somebody can quote');
      assert.equal(order.bookId, book.id);
      assert.equal(order.buyerId, 'reader');
      assert.equal(order.pricePaid, 20);
      assert.equal(getBookOrder(catalog, order.id).id, order.id);
      assert.equal(getBookOrder(catalog, 9999), null);
    });
});

test('only a physical book is ever awaiting shipment', () => {
  // **The distinction that keeps the queue honest.** An ebook marked
  // 'unfulfilled' would sit in every awaiting-shipment view forever,
  // and eventually somebody tries to ship a file.
  const catalog = createCatalog();
  const paper = printBook(catalog);
  const ebook = publishBook(catalog, {
    title: 'E', authorId: 'author-1', format: 'ebook', listPrice: 9.99,
  });
  const audio = publishBook(catalog, {
    title: 'A', authorId: 'author-1', format: 'audiobook', listPrice: 15,
    narrationType: 'ai',
  });
  const transferFn = ledger();

  return Promise.all([paper, ebook, audio].map(
    (b) => purchaseBook(catalog, { bookId: b.id, buyerId: 'reader', transferFn }),
  )).then(([p, e, a]) => {
    assert.equal(p.order.fulfillmentStatus, 'unfulfilled');
    assert.equal(e.order.fulfillmentStatus, 'not-applicable', 'an ebook has nothing to ship');
    assert.equal(a.order.fulfillmentStatus, 'not-applicable');
    assert.deepEqual(
      listUnfulfilledBookOrders(catalog).map((o) => o.id), [p.order.id],
      'the shipping queue must contain only things that ship',
    );
  });
});

test('requesting fulfillment for a physical book creates one real VOID job', () => {
  const catalog = createCatalog();
  const book = printBook(catalog);
  const voidRequestFn = voidStub();

  return purchaseBook(catalog, { bookId: book.id, buyerId: 'reader', transferFn: ledger() })
    .then(({ order }) => requestBookFulfillment(catalog, {
      orderId: order.id, shippingCost: 5, voidRequestFn,
    }))
    .then((order) => {
      assert.equal(order.fulfillmentStatus, 'fulfillment-requested');
      assert.ok(order.voidShipmentId, 'the order records the real job id');
      assert.equal(typeof order.voidShipmentId, 'string', 'stored as a string, like marketplace\'s');
      assert.equal(voidRequestFn.calls.length, 1);
      assert.equal(voidRequestFn.calls[0].shippingCost, 5);
      assert.equal(listUnfulfilledBookOrders(catalog).length, 0, 'and it leaves the queue');
    });
});

test('a self-published book ships from its author; an Ingram title ships from VENVS', () => {
  // publishBook already draws this line by computing no royalty for
  // Ingram titles — wholesale catalog access, no per-sale author
  // relationship. Fulfillment follows the same line: VENVS is the
  // merchant of record for those, so VENVS ships them.
  const catalog = createCatalog();
  const mine = printBook(catalog, { authorId: 'author-1' });
  const theirs = printBook(catalog, {
    authorId: 'ingram-listed', source: 'ingram', title: 'Backlist Title',
  });
  const voidRequestFn = voidStub();
  const transferFn = ledger();

  return purchaseBook(catalog, { bookId: mine.id, buyerId: 'r', transferFn })
    .then(({ order }) => requestBookFulfillment(catalog, {
      orderId: order.id, shippingCost: 5, voidRequestFn,
    }))
    .then(() => purchaseBook(catalog, { bookId: theirs.id, buyerId: 'r', transferFn }))
    .then(({ order }) => requestBookFulfillment(catalog, {
      orderId: order.id, shippingCost: 5, voidRequestFn,
    }))
    .then(() => {
      assert.equal(voidRequestFn.calls[0].shipperId, 'author-1');
      assert.equal(voidRequestFn.calls[1].shipperId, PUBLISHING_PLATFORM);
    });
});

test('an ebook cannot be shipped, and nothing is shipped twice', () => {
  const catalog = createCatalog();
  const ebook = publishBook(catalog, {
    title: 'E', authorId: 'a', format: 'ebook', listPrice: 5,
  });
  const paper = printBook(catalog);
  const voidRequestFn = voidStub();
  const transferFn = ledger();

  return purchaseBook(catalog, { bookId: ebook.id, buyerId: 'r', transferFn })
    .then(({ order }) => assert.rejects(
      () => requestBookFulfillment(catalog, {
        orderId: order.id, shippingCost: 5, voidRequestFn,
      }),
      /nothing to ship/,
    ))
    .then(() => purchaseBook(catalog, { bookId: paper.id, buyerId: 'r', transferFn }))
    .then(({ order }) => requestBookFulfillment(catalog, {
      orderId: order.id, shippingCost: 5, voidRequestFn,
    }).then(() => assert.rejects(
      () => requestBookFulfillment(catalog, {
        orderId: order.id, shippingCost: 5, voidRequestFn,
      }),
      /already has a VOID shipment/,
    )))
    .then(() => assert.equal(voidRequestFn.calls.length, 1, 'exactly one real job was created'));
});

test('fulfillment refuses a missing order, a free shipment, or no VOID client', () => {
  const catalog = createCatalog();
  const book = printBook(catalog);
  const voidRequestFn = voidStub();

  return assert.rejects(
    () => requestBookFulfillment(catalog, { orderId: 9999, shippingCost: 5, voidRequestFn }),
    /no order with id/,
  )
    .then(() => purchaseBook(catalog, { bookId: book.id, buyerId: 'r', transferFn: ledger() }))
    .then(({ order }) => assert.rejects(
      () => requestBookFulfillment(catalog, { orderId: order.id, shippingCost: 0, voidRequestFn }),
      /positive shippingCost/,
    ).then(() => assert.rejects(
      () => requestBookFulfillment(catalog, { orderId: order.id, shippingCost: 5 }),
      /requires a voidRequestFn/,
    )))
    .then(() => assert.equal(voidRequestFn.calls.length, 0, 'no job was created for a refused request'));
});

test('a failed payment leaves no order to ship', () => {
  // The ordering that matters: transfer first, order second. Same rule
  // marketplace.js#checkout follows.
  const catalog = createCatalog();
  const book = printBook(catalog);
  const broke = async () => { throw new Error('insufficient funds'); };

  return assert.rejects(
    () => purchaseBook(catalog, { bookId: book.id, buyerId: 'r', transferFn: broke }),
    /insufficient funds/,
  ).then(() => {
    assert.equal(catalog.orders.length, 0);
    assert.deepEqual(listUnfulfilledBookOrders(catalog), []);
  });
});
