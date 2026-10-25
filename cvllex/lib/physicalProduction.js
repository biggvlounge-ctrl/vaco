// CVLLEX — physical production orders: getting a real limited run of
// physical goods actually MADE. Built first as a module inside VOKEN
// (25 Oct 2026), then extracted into this standalone app the same
// day, by direct decision: VOKEN's own constellation is now a real,
// five-app star (VOKEN · VEX · VADO · CVLTVRE · CVLLEX), with this
// app standing alongside VOKEN rather than inside it. See
// README.md for why CVLLEX is its own app rather than folded back in,
// and for the real precedent (VEX) that was tried the other way.
//
// **The real gap this closes.** Nothing in this ecosystem modeled
// ordering a real physical run (a creator dropping a digital album
// and wanting 1,000 real CDs made, a short real magazine run, limited
// collectible merch) and getting it made before it is a real,
// tokenizable object. VENVS's Publishing arm models print-on-demand
// *economics* for books but never names who presses them; VOID only
// ships goods that already exist (point A to point B). This module is
// order intake and status tracking for the step in between.
//
// **The one real economic fact worth encoding, grounded rather than
// guessed.** Physically pressed music media (CD/vinyl/cassette) and
// print-on-demand goods (magazine/poster/pin/t-shirt/hat/other) are
// NOT the same shape of business, confirmed by real, current (2025-
// 2026) comparables:
//
//   - **Qrates** (real, Tokyo-based) presses vinyl and cassettes in
//     real batches as small as 100 units — a genuine minimum run, not
//     a smooth per-unit cost curve, because physical pressing/plating
//     has a real fixed setup cost a single unit can't absorb.
//   - **Printful / Printify** (apparel, pins, posters) and **Lulu /
//     Doxzoo** (magazines) are real, confirmed no-minimum
//     print-on-demand services — order 1 unit or 10,000 at the same
//     flat per-unit rate, because digital/short-run printing has no
//     comparable plating step.
//
// No source found in this session's research gives a precise, current
// dollar figure for either — so this module does NOT fabricate a
// specific cost. It enforces the one real, structural fact that IS
// confirmed (a real minimum run size on pressed music media, no
// minimum on print-on-demand goods) and leaves the actual unit cost as
// a real input the creator or operator supplies, same posture
// `basePrice` already has on VOKEN's own merch listings.
//
// **What this module is NOT.** It does not integrate with a real
// pressing plant, printer, or merch manufacturer — no such vendor
// credential or contract exists anywhere in this repository, and
// stubbing one would be exactly the fabrication this project's
// standing discipline refuses. This is order intake and status
// tracking: a real record of what was ordered, at what quantity, for
// what real-world cost the caller states, that a human operator marks
// `produced` once the real-world shipment from a real vendor actually
// arrives. Once `produced`, `lib/vault.js` is where a produced run
// becomes a real, tokenized, redeemable collectible — this module
// does not duplicate that mechanism either.

const PRODUCTION_ITEM_TYPES = ['t-shirt', 'hat', 'cd', 'vinyl', 'cassette', 'magazine', 'poster', 'pin', 'other'];

// Real, cited minimum (Qrates): physically pressed music media has a
// genuine plating/setup floor a single unit cannot absorb. Everything
// else in PRODUCTION_ITEM_TYPES is a real, confirmed no-minimum
// print-on-demand good.
const PRESSED_MEDIA_ITEM_TYPES = ['cd', 'vinyl', 'cassette'];
const PRESSED_MEDIA_MINIMUM_UNITS = 100;

const PRODUCTION_ORDER_STATUSES = ['ordered', 'in-production', 'produced', 'cancelled'];

function minimumUnitsFor(itemType) {
  return PRESSED_MEDIA_ITEM_TYPES.includes(itemType) ? PRESSED_MEDIA_MINIMUM_UNITS : 1;
}

// `estimatedUnitCost` is a real input the caller states (the same
// posture `basePrice` already has on VOKEN's own merch listings), not
// a computed or fabricated figure — see this file's own header for why
// no real current per-unit price exists to compute from. Recorded only
// so a creator or operator can see what they committed to before the
// real vendor invoice confirms it.
function createProductionOrder(store, options = {}) {
  const {
    creatorId, itemType, quantity, estimatedUnitCost = null, vendorNote = null, now = Date.now(),
  } = options;

  if (!creatorId) throw new Error('createProductionOrder requires a creatorId');
  if (!PRODUCTION_ITEM_TYPES.includes(itemType)) {
    throw new Error(`createProductionOrder: invalid itemType "${itemType}" (expected one of ${PRODUCTION_ITEM_TYPES.join(', ')})`);
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('createProductionOrder requires a positive integer quantity');
  }
  const minimum = minimumUnitsFor(itemType);
  if (quantity < minimum) {
    throw new Error(`createProductionOrder: ${itemType} is a pressed-media good with a real minimum run of ${minimum} units (Qrates' own real batch floor), got ${quantity}`);
  }
  if (estimatedUnitCost !== null && (!Number.isFinite(estimatedUnitCost) || estimatedUnitCost <= 0)) {
    throw new Error('createProductionOrder: estimatedUnitCost must be a positive number when given');
  }

  const order = {
    id: store.nextProductionOrderId++,
    creatorId,
    itemType,
    quantity,
    minimumUnits: minimum,
    estimatedUnitCost,
    vendorNote,
    status: 'ordered',
    vaultId: null,
    createdAt: now,
    updatedAt: now,
  };
  store.productionOrders.push(order);
  return order;
}

function getProductionOrder(store, orderId) {
  return store.productionOrders.find((o) => o.id === orderId) || null;
}

function listProductionOrdersForCreator(store, creatorId) {
  return store.productionOrders
    .filter((o) => o.creatorId === creatorId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function advanceProductionOrder(store, options = {}) {
  const { orderId, toStatus, now = Date.now() } = options;
  const order = getProductionOrder(store, orderId);
  if (!order) throw new Error(`advanceProductionOrder: no production order with id ${orderId}`);
  if (!PRODUCTION_ORDER_STATUSES.includes(toStatus)) {
    throw new Error(`advanceProductionOrder: toStatus must be one of ${PRODUCTION_ORDER_STATUSES.join(', ')}`);
  }
  if (order.status === 'produced' || order.status === 'cancelled') {
    throw new Error(`advanceProductionOrder: order ${orderId} is already ${order.status} and cannot change further`);
  }
  // ordered -> in-production -> produced is the only forward path;
  // cancelled is reachable from either open state. No skipping
  // in-production -- a real vendor run is either placed or it isn't,
  // and collapsing that step would make "produced" mean nothing more
  // than "ordered" ever did.
  const forwardOrder = ['ordered', 'in-production', 'produced'];
  if (toStatus !== 'cancelled') {
    const fromIdx = forwardOrder.indexOf(order.status);
    const toIdx = forwardOrder.indexOf(toStatus);
    if (toIdx !== fromIdx + 1) {
      throw new Error(`advanceProductionOrder: cannot go from ${order.status} to ${toStatus} -- only the next step (${forwardOrder[fromIdx + 1]}) or cancelled`);
    }
  }
  order.status = toStatus;
  order.updatedAt = now;
  return order;
}

module.exports = {
  PRODUCTION_ITEM_TYPES,
  PRESSED_MEDIA_ITEM_TYPES,
  PRESSED_MEDIA_MINIMUM_UNITS,
  PRODUCTION_ORDER_STATUSES,
  minimumUnitsFor,
  createProductionOrder,
  getProductionOrder,
  listProductionOrdersForCreator,
  advanceProductionOrder,
};
