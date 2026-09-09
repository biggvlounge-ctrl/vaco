// VOID MAGIC -- Media (Section 13, Phase 2's seventh real slice).
// Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS13: MAGIC PHOTO
// (a professional photograph), MAGIC VIDEO (a short professionally
// recorded interaction), MAGIC MEMORY (a post-event package
// containing photos, video, messages, digital ticket, event
// information, approved memories) -- "This becomes another revenue
// stream."
//
// Real, honest scoping, consistent with this session's standing
// no-fake-media/no-fake-AI stance: this module is real order
// tracking and real revenue settlement for professional media add-ons
// -- it does NOT generate photos, video, or any synthesized content.
// `deliverMedia` requires an actual, real `assetUrl` supplied by the
// caller (the professional media team's real upload, exactly the
// same honest pattern VXLLAGE/CHOPZ already use for `mediaUrl` on a
// video record) -- never fabricated here.
//
// Real revenue mechanics, reusing `bookings.js`'s own established
// escrow-then-settle shape rather than inventing a second payment
// model: `orderMedia` charges the buyer into the same real escrow
// account at order time; `deliverMedia` pays the host + platform a
// real dual payout (the same `PLATFORM_TAKE_RATE`, reused rather than
// inventing a second, undocumented rate) once the real asset is
// actually delivered, not at order time -- "you get paid when you
// deliver," matching the real "Payment is processed" / "Host receives
// settlement" separation SS39 already establishes for the core loop.
//
// MAGIC MEMORY's own real gate: SS13 explicitly calls it a
// "Post-event experience package," so unlike photo/video (purchasable
// any time after booking), a MEMORY order and its package assembly
// both require the booking to have actually completed.

const { getBooking, VOID_MAGIC_ESCROW_ACCOUNT, PLATFORM_TAKE_RATE } = require('./bookings');
const { getExperience } = require('./experiences');

const MEDIA_TYPES = ['magic-photo', 'magic-video', 'magic-memory'];

function round(n) {
  return Math.round(n * 100) / 100;
}

async function orderMedia(store, options = {}) {
  const {
    bookingId, type, price, transferFn, now = Date.now(),
  } = options;

  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`orderMedia: no booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`orderMedia: booking ${bookingId} is cancelled`);
  if (!MEDIA_TYPES.includes(type)) {
    throw new Error(`orderMedia: invalid type "${type}" (expected one of ${MEDIA_TYPES.join(', ')})`);
  }
  if (type === 'magic-memory' && booking.status !== 'completed') {
    throw new Error(`orderMedia: "magic-memory" is a post-event package -- booking ${bookingId} has not completed yet (status: ${booking.status})`);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error('orderMedia requires a positive price');
  if (typeof transferFn !== 'function') throw new Error('orderMedia requires a transferFn(fromUserId, toUserId, amount, reason)');

  await transferFn(booking.customerId, VOID_MAGIC_ESCROW_ACCOUNT, price, `voidmagic_media_order:${bookingId}:${type}`);

  const order = {
    id: store.nextMediaOrderId++,
    bookingId,
    type,
    price,
    status: 'ordered',
    assetUrl: null,
    orderedAt: now,
    deliveredAt: null,
  };
  store.mediaOrders.push(order);
  return order;
}

function getMediaOrder(store, mediaOrderId) {
  return store.mediaOrders.find((o) => o.id === mediaOrderId) || null;
}

function listMediaOrders(store, bookingId) {
  if (!getBooking(store, bookingId)) throw new Error(`listMediaOrders: no booking with id ${bookingId}`);
  return store.mediaOrders.filter((o) => o.bookingId === bookingId);
}

// The real host+platform payout, deliberately at delivery, not order
// time -- the same real escrow-then-settle shape as event bookings.
async function deliverMedia(store, options = {}) {
  const {
    mediaOrderId, assetUrl, transferFn, now = Date.now(),
  } = options;

  const order = getMediaOrder(store, mediaOrderId);
  if (!order) throw new Error(`deliverMedia: no media order with id ${mediaOrderId}`);
  if (order.status !== 'ordered') throw new Error(`deliverMedia: media order ${mediaOrderId} is not awaiting delivery (status: ${order.status})`);
  if (!assetUrl) throw new Error('deliverMedia requires a real assetUrl -- this module never generates media itself');
  if (typeof transferFn !== 'function') throw new Error('deliverMedia requires a transferFn(fromUserId, toUserId, amount, reason)');

  const booking = getBooking(store, order.bookingId);
  const experience = getExperience(store, booking.experienceId);
  const platformFee = round(order.price * PLATFORM_TAKE_RATE);
  const hostPayout = round(order.price - platformFee);
  await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, experience.hostId, hostPayout, `voidmagic_media_host_settlement:${mediaOrderId}`);
  await transferFn(VOID_MAGIC_ESCROW_ACCOUNT, 'voidmagic-platform', platformFee, `voidmagic_media_platform_fee:${mediaOrderId}`);

  order.status = 'delivered';
  order.assetUrl = assetUrl;
  order.deliveredAt = now;
  return order;
}

// MAGIC MEMORY's real package assembly: the booking's own real
// receipt data (the same fields `bookings.js`'s own
// `getPostEventSummary` already surfaces) plus whichever real,
// delivered media assets exist for this booking -- an honest bundle
// of already-real data, not synthesized content.
function getMagicMemoryPackage(store, bookingId) {
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`getMagicMemoryPackage: no booking with id ${bookingId}`);
  if (booking.status !== 'completed') throw new Error(`getMagicMemoryPackage: booking ${bookingId} has not completed yet (status: ${booking.status})`);
  const experience = getExperience(store, booking.experienceId);

  const deliveredAssets = store.mediaOrders.filter(
    (o) => o.bookingId === bookingId && o.type !== 'magic-memory' && o.status === 'delivered',
  );

  return {
    bookingId: booking.id,
    experienceTitle: experience.title,
    hostId: experience.hostId,
    pricePaid: booking.pricePaid,
    completedAt: booking.completedAt,
    mediaAssets: deliveredAssets.map((o) => ({ type: o.type, assetUrl: o.assetUrl, deliveredAt: o.deliveredAt })),
  };
}

module.exports = {
  MEDIA_TYPES, orderMedia, getMediaOrder, listMediaOrders, deliverMedia, getMagicMemoryPackage,
};
