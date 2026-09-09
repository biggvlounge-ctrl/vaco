// VENVS Publishing — catalog store + purchase orchestration.
// Source of truth: VENVS_PUBLISHING_ADDITION.md. "A real three-format
// publishing arm (ebook + physical + audio) sitting inside VENVS's
// Marketplace" -- and "Clean division: KDP/ACX-style tools serve new,
// self-published authors; Ingram is the real path to the existing,
// massive backlist catalog — both routing through the same VENVS
// publishing storefront."
//
// purchaseBook() takes an injected `transferFn` rather than importing
// v3Client.js directly -- keeps this module runnable/testable in
// plain Node (v3Client.js uses import.meta.env, which is Vite-only)
// and keeps catalog logic decoupled from exactly how a VCoin transfer
// happens. The real app wires transferFn to v3Client's
// transferVCoin().

import {
  calculateEbookRoyalty,
  calculatePrintRoyalty,
  calculateAudiobookRoyalty,
} from './royalties.js';

const FORMATS = ['ebook', 'print', 'audiobook'];
const SOURCES = ['self_published', 'ingram'];

export function createCatalog() {
  return {
    books: [], nextBookId: 1,
    // Purchases are recorded, not just returned. Until now
    // purchaseBook() moved real money and handed back a summary that
    // nothing kept -- which meant a physical book could be bought and
    // paid for and there was no order to ship, no id to reference, and
    // nothing for VOID fulfillment to attach to. That is the gap
    // CLAUDE.md §7 names: "Marketplace orders now route to VOID;
    // physical *book* orders from Publishing don't yet."
    orders: [], nextOrderId: 1,
  };
}

export function publishBook(catalog, options = {}) {
  const {
    title,
    authorId,
    format,
    listPrice,
    source = 'self_published',
    // format-specific:
    deliveryFee = 0,
    printingCost,
    narrationType,
    narratorRoyaltyRate,
  } = options;

  if (!title) {
    throw new Error('publishBook requires a title');
  }
  if (!authorId) {
    throw new Error('publishBook requires an authorId');
  }
  if (!FORMATS.includes(format)) {
    throw new Error(`publishBook: invalid format "${format}" (expected one of ${FORMATS.join(', ')})`);
  }
  if (!SOURCES.includes(source)) {
    throw new Error(`publishBook: invalid source "${source}" (expected one of ${SOURCES.join(', ')})`);
  }
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    throw new Error('publishBook requires a positive listPrice');
  }

  // Ingram-sourced titles are wholesale catalog access, not a
  // self-publish royalty split -- no per-sale author royalty is
  // computed for them here, per the doc's own "clean division."
  let royalty = null;
  if (source === 'self_published') {
    if (format === 'ebook') {
      royalty = calculateEbookRoyalty(listPrice, deliveryFee);
    } else if (format === 'print') {
      if (!Number.isFinite(printingCost) || printingCost < 0) {
        throw new Error('publishBook: print format requires a non-negative printingCost');
      }
      royalty = calculatePrintRoyalty(listPrice, printingCost);
    } else if (format === 'audiobook') {
      royalty = calculateAudiobookRoyalty(listPrice, { narrationType, narratorRoyaltyRate });
    }
  }

  const book = {
    id: catalog.nextBookId++,
    title,
    authorId,
    format,
    listPrice,
    source,
    royalty,
    createdAt: Date.now(),
  };
  catalog.books.push(book);
  return book;
}

export function getBook(catalog, bookId) {
  return catalog.books.find((b) => b.id === bookId) || null;
}

export function getCatalog(catalog, options = {}) {
  const { format, source } = options;
  return catalog.books.filter(
    (b) => (format ? b.format === format : true) && (source ? b.source === source : true)
  );
}

const PLATFORM_USER_ID = 'venvs-platform';

export async function purchaseBook(catalog, options = {}) {
  const { bookId, buyerId, transferFn } = options;
  if (typeof transferFn !== 'function') {
    throw new Error('purchaseBook requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  const book = getBook(catalog, bookId);
  if (!book) {
    throw new Error(`purchaseBook: no book with id ${bookId}`);
  }
  if (!buyerId) {
    throw new Error('purchaseBook requires a buyerId');
  }

  // Buyer always pays full list price to the platform.
  await transferFn(buyerId, PLATFORM_USER_ID, book.listPrice, `venvs_publishing_purchase:${book.id}`);

  // Self-published titles pay the author their royalty out of that
  // sale; Ingram titles don't (wholesale purchase, no author-side
  // royalty split modeled here).
  let royaltyPaid = null;
  if (book.royalty && book.royalty.royaltyAmount > 0) {
    await transferFn(
      PLATFORM_USER_ID,
      book.authorId,
      book.royalty.royaltyAmount,
      `venvs_publishing_royalty:${book.id}`
    );
    royaltyPaid = book.royalty.royaltyAmount;
  }

  // Recorded AFTER both transfers, deliberately: a failed payment must
  // leave no receipt behind, the same ordering marketplace.js#checkout
  // already uses.
  //
  // `fulfillmentStatus` distinguishes "nothing to ship" from "not
  // shipped yet". An ebook marked 'unfulfilled' would sit in every
  // awaiting-shipment view forever, and somebody would eventually try
  // to ship a file.
  const needsShipping = book.format === 'print';
  const order = {
    id: catalog.nextOrderId++,
    bookId: book.id,
    buyerId,
    format: book.format,
    pricePaid: book.listPrice,
    royaltyPaid,
    needsShipping,
    fulfillmentStatus: needsShipping ? 'unfulfilled' : 'not-applicable',
    voidShipmentId: null,
    createdAt: Date.now(),
  };
  catalog.orders.push(order);

  return { book, order, pricePaid: book.listPrice, royaltyPaid };
}

export function getBookOrder(catalog, orderId) {
  return catalog.orders.find((o) => o.id === orderId) || null;
}

// Orders that genuinely still need shipping. Scoped to print on
// purpose -- see the fulfillmentStatus note above.
export function listUnfulfilledBookOrders(catalog) {
  return catalog.orders.filter((o) => o.needsShipping && o.voidShipmentId === null);
}

// ---------------------------------------------------------------------------
// VOID fulfillment for physical books
// ---------------------------------------------------------------------------
// Deliberately the same shape as marketplace.js#requestFulfillment
// rather than a second mechanism: an injected `voidRequestFn(shipperId,
// shippingCost)` that the real app wires to voidClient.js's
// `createShipment`. Injected rather than imported for the same reason
// purchaseBook takes a transferFn -- voidClient.js reads
// `import.meta.env`, which is Vite-only, and importing it here would
// make this module unloadable in plain Node.
//
// **Who ships it.** A self-published print run ships from its author.
// An Ingram-sourced title is wholesale catalog access with no per-sale
// author relationship -- the same distinction publishBook already makes
// by computing no royalty for those -- so VENVS is the merchant of
// record and ships it itself.
export async function requestBookFulfillment(catalog, options = {}) {
  const { orderId, shippingCost, voidRequestFn } = options;

  const order = getBookOrder(catalog, orderId);
  if (!order) {
    throw new Error(`requestBookFulfillment: no order with id ${orderId}`);
  }
  if (!order.needsShipping) {
    throw new Error(
      `requestBookFulfillment: order ${orderId} is a ${order.format}, which has nothing to ship`,
    );
  }
  if (order.voidShipmentId !== null) {
    throw new Error(`requestBookFulfillment: order ${orderId} already has a VOID shipment`);
  }
  if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
    throw new Error('requestBookFulfillment requires a positive shippingCost');
  }
  if (typeof voidRequestFn !== 'function') {
    throw new Error('requestBookFulfillment requires a voidRequestFn(shipperId, shippingCost)');
  }

  const book = getBook(catalog, order.bookId);
  const shipperId = book.source === 'ingram' ? PLATFORM_USER_ID : book.authorId;

  const job = await voidRequestFn(shipperId, shippingCost);
  order.voidShipmentId = String(job.id);
  order.shipperId = shipperId;
  order.fulfillmentStatus = 'fulfillment-requested';
  return order;
}

export { FORMATS, SOURCES, PLATFORM_USER_ID };
