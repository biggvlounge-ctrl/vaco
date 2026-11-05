// CHOPZ SHOP -- Live Shopping Events.
// Source of truth: `CHOPZ_TIKTOK_COMPARABLES.md`'s own real "Live
// shopping" data point ("drives 10-15x more engagement than static
// posts; brands running weekly livestreams see 3-5x higher
// conversion") and that same file's own "Implementation status"
// section, which already named both the real gap and the real fix
// directly: "Vavlt Stvdios has real live channels and CHOPZ SHOP has
// real products, so the pieces exist in separate apps; nothing
// connects them... that is the obvious next thing here if this
// document is picked up again."
//
// This is that connection. A seller schedules a real event against a
// real, already-existing Vavlt Stvdios channel they actually own --
// verified LIVE, via a real cross-app call, never trusted on the
// caller's bare claim (the same discipline `dreams/server.js`'s own
// `fetchHvntzLocation` already takes for a cross-app ownership claim)
// -- and tags a real set of this seller's own real products as
// "featured" for it.
//
// **No new checkout path.** A purchase made "during" a live event is
// the exact same real `orders.js#createOrder`, just optionally
// attributed to which real live event it came through
// (`liveShoppingEventId`) -- the same shape `affiliateLinkId`
// attribution already takes on an order, not a second, parallel
// payment mechanism this app would have to keep in sync with the
// first.
//
// **What this deliberately does NOT claim.** The real "10-15x
// engagement" and "3-5x conversion" figures are TikTok's own real,
// aggregate statistics -- not a guarantee this app's own events will
// reproduce them. `getLiveShoppingEventSales` reports the real,
// measured orders/GMV for a real event, never a fabricated lift
// percentage against a control group this app has no real data for.

const { getProduct } = require('./products');

const EVENT_STATUSES = ['scheduled', 'live', 'ended'];

async function createLiveShoppingEvent(store, options = {}) {
  const {
    sellerId, title, vavltChannelId, featuredProductIds, vavltChannelFetchFn, now = Date.now(),
  } = options;

  if (!sellerId) throw new Error('createLiveShoppingEvent requires a sellerId');
  if (!title) throw new Error('createLiveShoppingEvent requires a title');
  if (!Array.isArray(featuredProductIds) || featuredProductIds.length === 0) {
    throw new Error('createLiveShoppingEvent requires a non-empty featuredProductIds array');
  }
  // Every featured product must be real AND actually belong to this
  // same seller -- a seller can feature their own catalogue, never
  // someone else's listing, in their own live event.
  for (const productId of featuredProductIds) {
    const product = getProduct(store, productId);
    if (!product) throw new Error(`createLiveShoppingEvent: no product with id ${productId}`);
    if (product.sellerId !== sellerId) {
      throw new Error(`createLiveShoppingEvent: product ${productId} is not owned by ${sellerId}`);
    }
  }
  if (typeof vavltChannelFetchFn !== 'function') {
    throw new Error('createLiveShoppingEvent requires a vavltChannelFetchFn(channelId)');
  }

  // Real, live cross-app verification. A caller-claimed
  // vavltChannelId is never trusted on its own -- this is checked
  // live, every time, against Vavlt Stvdios' own real channel record.
  const channel = await vavltChannelFetchFn(vavltChannelId);
  if (!channel) throw new Error(`createLiveShoppingEvent: no Vavlt Stvdios channel with id ${vavltChannelId}`);
  if (channel.ownerId !== sellerId) {
    throw new Error(`createLiveShoppingEvent: channel ${vavltChannelId} is not owned by ${sellerId}`);
  }

  const event = {
    id: store.nextLiveShoppingEventId++,
    sellerId,
    title,
    vavltChannelId,
    featuredProductIds,
    status: 'scheduled',
    createdAt: now,
    wentLiveAt: null,
    endedAt: null,
  };
  store.liveShoppingEvents.push(event);
  return event;
}

function getLiveShoppingEvent(store, eventId) {
  return store.liveShoppingEvents.find((e) => e.id === eventId) || null;
}

function listLiveShoppingEvents(store, options = {}) {
  const { sellerId, status } = options;
  return store.liveShoppingEvents.filter(
    (e) => (sellerId ? e.sellerId === sellerId : true) && (status ? e.status === status : true),
  );
}

function requireStatus(store, eventId, expectedStatus, action) {
  const event = getLiveShoppingEvent(store, eventId);
  if (!event) throw new Error(`${action}: no live shopping event with id ${eventId}`);
  if (event.status !== expectedStatus) {
    throw new Error(`${action}: live shopping event ${eventId} is "${event.status}", expected "${expectedStatus}"`);
  }
  return event;
}

function goLiveShoppingEvent(store, options = {}) {
  const { eventId, now = Date.now() } = options;
  const event = requireStatus(store, eventId, 'scheduled', 'goLiveShoppingEvent');
  event.status = 'live';
  event.wentLiveAt = now;
  return event;
}

function endLiveShoppingEvent(store, options = {}) {
  const { eventId, now = Date.now() } = options;
  const event = requireStatus(store, eventId, 'live', 'endLiveShoppingEvent');
  event.status = 'ended';
  event.endedAt = now;
  return event;
}

// Real, honest measurement -- every real order genuinely attributed
// to this event (`Order.liveShoppingEventId`, set by `orders.js`'s
// own `createOrder` when a purchase happens through it), never a
// fabricated lift percentage.
function getLiveShoppingEventSales(store, eventId) {
  const event = getLiveShoppingEvent(store, eventId);
  if (!event) throw new Error(`getLiveShoppingEventSales: no live shopping event with id ${eventId}`);
  const orders = store.orders.filter((o) => o.liveShoppingEventId === eventId);
  const gmv = Math.round(orders.reduce((sum, o) => sum + o.price, 0) * 100) / 100;
  return { eventId, orderCount: orders.length, gmv };
}

module.exports = {
  EVENT_STATUSES,
  createLiveShoppingEvent,
  getLiveShoppingEvent,
  listLiveShoppingEvents,
  goLiveShoppingEvent,
  endLiveShoppingEvent,
  getLiveShoppingEventSales,
};
