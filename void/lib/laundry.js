// VOID -- Laundry as a real service app.
//
// **The second proof of the per-vertical pattern, chosen because its
// domain looks nothing like pet care's.** Pet care is about a
// relationship: the same walker, the same dog, a standing Tuesday.
// Laundry is about a round trip with a machine in the middle -- pickup
// window, weight measured on receipt rather than at booking, care
// preferences that must survive to whoever actually runs the wash, and
// a delivery window a day or two later.
//
// If the same module shape fits both, it fits the other 21.
//
// **The thing this vertical gets right that pet care cannot.** Laundry
// is the vertical where "free pickup and delivery" is real rather than
// marketing, because the pickup and the delivery *are* the service.
// VOID's comparables document flags this as a headline feature to
// surface rather than bury, and this module makes it structural: an
// order has two legs, and both are VOID's.
//
// **The pricing honesty this module enforces.** Rinse and its
// competitors quote per pound, and nobody knows the pound count until
// the bag is on a scale. Quoting a total at booking time would be a
// guess presented as a price. So an order carries an *estimate* until
// it is weighed, and the real total is set at intake -- with the
// customer's own cap respected, because "we weighed it and it is
// triple" is exactly the surprise that loses a customer for good.

const { canWorkVertical, requireProvider } = require('./providerProfiles');
const { settleJob } = require('./settlement');

const LAUNDRY_VERTICAL_ID = 'laundry';

const SERVICE_TYPES = ['wash-and-fold', 'dry-cleaning', 'wash-only', 'press-only'];

const WATER_TEMPERATURES = ['cold', 'warm', 'hot'];
const DRY_SETTINGS = ['low', 'medium', 'high', 'hang-dry'];

const ORDER_STATUSES = [
  'scheduled', 'picked-up', 'weighed', 'in-progress', 'ready', 'delivered', 'cancelled',
];

//: Flagged interpretive: no source document sets a rate. This is a
//: structurally accurate stand-in at the shape the real market uses
//: (per pound for wash-and-fold, per item for dry cleaning), not a
//: quoted price. Overridable per provider -- a laundromat setting its
//: own rate is the entire point of letting businesses onboard.
const DEFAULT_PRICE_PER_POUND = 2.5;
const DEFAULT_MINIMUM_POUNDS = 10;

//: Standard turnaround. Rinse and comparable services run next-day or
//: two-day; 48 hours is the safe default and a provider can beat it.
const DEFAULT_TURNAROUND_HOURS = 48;

const MS_PER_HOUR = 60 * 60 * 1000;

class LaundryError extends Error {}

function round(n) {
  return Math.round(n * 100) / 100;
}

function assertWindow(startsAt, endsAt, label) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new LaundryError(`${label} requires numeric startsAt and endsAt timestamps`);
  }
  if (endsAt <= startsAt) throw new LaundryError(`${label} requires endsAt after startsAt`);
}

// Care preferences are captured once, on the order, and travel with
// it. The failure this prevents is mundane and expensive: a wool
// sweater on a hot wash. Every real complaint in this category is a
// preference that did not reach the person operating the machine.
function normaliseCarePreferences(prefs = {}) {
  const {
    waterTemperature = 'warm',
    drySetting = 'medium',
    detergent = 'standard',
    separateWhites = true,
    delicatesSeparate = false,
    noFabricSoftener = false,
    specialInstructions = null,
  } = prefs;

  if (!WATER_TEMPERATURES.includes(waterTemperature)) {
    throw new LaundryError(`carePreferences.waterTemperature must be one of ${WATER_TEMPERATURES.join(', ')}`);
  }
  if (!DRY_SETTINGS.includes(drySetting)) {
    throw new LaundryError(`carePreferences.drySetting must be one of ${DRY_SETTINGS.join(', ')}`);
  }
  return {
    waterTemperature,
    drySetting,
    detergent,
    separateWhites,
    delicatesSeparate,
    noFabricSoftener,
    specialInstructions,
  };
}

function scheduleOrder(store, options = {}) {
  const {
    customerId, providerId, serviceType,
    pickupWindowStart, pickupWindowEnd,
    lat = null, lng = null,
    estimatedPounds = null,
    maxAcceptableTotal = null,
    pricePerPound = DEFAULT_PRICE_PER_POUND,
    minimumPounds = DEFAULT_MINIMUM_POUNDS,
    turnaroundHours = DEFAULT_TURNAROUND_HOURS,
    carePreferences = {},
    now = Date.now(),
  } = options;

  if (!customerId) throw new LaundryError('scheduleOrder requires a customerId');
  requireProvider(store, providerId, 'scheduleOrder');
  if (!SERVICE_TYPES.includes(serviceType)) {
    throw new LaundryError(`scheduleOrder: serviceType must be one of ${SERVICE_TYPES.join(', ')}`);
  }
  assertWindow(pickupWindowStart, pickupWindowEnd, 'scheduleOrder');

  const permission = canWorkVertical(store, providerId, LAUNDRY_VERTICAL_ID);
  if (!permission.allowed) throw new LaundryError(`scheduleOrder: ${permission.reason}`);

  if (estimatedPounds !== null && (!Number.isFinite(estimatedPounds) || estimatedPounds <= 0)) {
    throw new LaundryError('scheduleOrder: estimatedPounds must be a positive number when given');
  }
  if (maxAcceptableTotal !== null && (!Number.isFinite(maxAcceptableTotal) || maxAcceptableTotal <= 0)) {
    throw new LaundryError('scheduleOrder: maxAcceptableTotal must be a positive number when given');
  }

  const billablePounds = Math.max(estimatedPounds || minimumPounds, minimumPounds);

  const order = {
    id: store.nextLaundryOrderId++,
    customerId,
    providerId,
    serviceType,
    status: 'scheduled',
    pickupWindowStart,
    pickupWindowEnd,
    lat,
    lng,
    pricePerPound,
    minimumPounds,
    estimatedPounds,
    // An estimate, and labelled as one. It is not a quote.
    estimatedTotal: round(billablePounds * pricePerPound),
    maxAcceptableTotal,
    actualPounds: null,
    actualTotal: null,
    carePreferences: normaliseCarePreferences(carePreferences),
    turnaroundHours,
    pickedUpAt: null,
    readyAt: null,
    deliveryWindowStart: null,
    deliveryWindowEnd: null,
    deliveredAt: null,
    overCapReason: null,
    settledTotal: null,
    providerPayout: null,
    platformFee: null,
    settledAt: null,
    createdAt: now,
  };
  store.laundryOrders.push(order);
  return order;
}

function getOrder(store, orderId) {
  return store.laundryOrders.find((o) => o.id === orderId) || null;
}

function requireOrder(store, orderId, action) {
  const order = getOrder(store, orderId);
  if (!order) throw new LaundryError(`${action}: no laundry order with id ${orderId}`);
  return order;
}

function markPickedUp(store, options = {}) {
  const { orderId, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'markPickedUp');
  if (order.status !== 'scheduled') {
    throw new LaundryError(`markPickedUp: order ${orderId} is ${order.status}, not scheduled`);
  }
  order.status = 'picked-up';
  order.pickedUpAt = now;
  return order;
}

// The moment the real price exists.
//
// If the weighed total exceeds the customer's stated cap, the order is
// held rather than silently billed. That is the whole reason
// `maxAcceptableTotal` exists: this vertical's characteristic bad
// experience is a bill arriving at double the estimate with no
// opportunity to object.
function recordWeight(store, options = {}) {
  const { orderId, actualPounds, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'recordWeight');
  if (order.status !== 'picked-up') {
    throw new LaundryError(`recordWeight: order ${orderId} is ${order.status}, must be picked-up`);
  }
  if (!Number.isFinite(actualPounds) || actualPounds <= 0) {
    throw new LaundryError('recordWeight requires a positive actualPounds');
  }

  const billable = Math.max(actualPounds, order.minimumPounds);
  const actualTotal = round(billable * order.pricePerPound);

  order.actualPounds = actualPounds;
  order.actualTotal = actualTotal;
  order.status = 'weighed';
  order.weighedAt = now;

  if (order.maxAcceptableTotal !== null && actualTotal > order.maxAcceptableTotal) {
    order.requiresCustomerApproval = true;
    order.overCapReason = `Weighed total ${actualTotal} exceeds the customer's cap of ${order.maxAcceptableTotal}`;
  } else {
    order.requiresCustomerApproval = false;
  }
  return order;
}

function approveOverCap(store, options = {}) {
  const { orderId } = options;
  const order = requireOrder(store, orderId, 'approveOverCap');
  if (!order.requiresCustomerApproval) {
    throw new LaundryError(`approveOverCap: order ${orderId} is not awaiting approval`);
  }
  order.requiresCustomerApproval = false;
  order.overCapApproved = true;
  return order;
}

function startProcessing(store, options = {}) {
  const { orderId } = options;
  const order = requireOrder(store, orderId, 'startProcessing');
  if (order.status !== 'weighed') {
    throw new LaundryError(`startProcessing: order ${orderId} is ${order.status}, must be weighed`);
  }
  // Work does not begin on an order the customer has not agreed to pay
  // for. Washing first and asking after is how a dispute becomes a
  // loss.
  if (order.requiresCustomerApproval) {
    throw new LaundryError(
      `startProcessing: order ${orderId} is over the customer's cap and awaiting approval. ${order.overCapReason}`,
    );
  }
  order.status = 'in-progress';
  return order;
}

function markReady(store, options = {}) {
  const { orderId, deliveryWindowStart = null, deliveryWindowEnd = null, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'markReady');
  if (order.status !== 'in-progress') {
    throw new LaundryError(`markReady: order ${orderId} is ${order.status}, must be in-progress`);
  }
  if (deliveryWindowStart !== null || deliveryWindowEnd !== null) {
    assertWindow(deliveryWindowStart, deliveryWindowEnd, 'markReady');
    order.deliveryWindowStart = deliveryWindowStart;
    order.deliveryWindowEnd = deliveryWindowEnd;
  }
  order.status = 'ready';
  order.readyAt = now;
  return order;
}

// Delivery is where a laundry order settles: the clothes are back with
// the customer, so the work is done. Until now this changed a status
// and paid nobody.
//
// It settles the **weighed** total, never the estimate. The estimate is
// explicitly not a quote -- nobody knows the pound count until the bag
// is on a scale -- so settling one would charge a number the customer
// was told was provisional. An order that reached delivery without
// being weighed is refused rather than settled at a guess.
//
// Settlement runs before the status changes, so a ledger failure leaves
// the order ready rather than delivered-and-unpaid.
async function markDelivered(store, options = {}) {
  const { orderId, settleFn = null, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'markDelivered');
  if (order.status !== 'ready') {
    throw new LaundryError(`markDelivered: order ${orderId} is ${order.status}, must be ready`);
  }
  if (typeof order.actualTotal !== 'number') {
    throw new LaundryError(
      `markDelivered: order ${orderId} was never weighed -- `
      + 'settling the estimate would charge a number the customer was told was provisional',
    );
  }

  await settleJob({
    job: order,
    verticalId: LAUNDRY_VERTICAL_ID,
    total: order.actualTotal,
    label: 'laundry',
    reference: orderId,
    settleFn,
    now,
  });

  order.status = 'delivered';
  order.deliveredAt = now;
  return order;
}

function cancelOrder(store, options = {}) {
  const { orderId, reason = 'unspecified' } = options;
  const order = requireOrder(store, orderId, 'cancelOrder');
  if (order.status === 'delivered') {
    throw new LaundryError(`cancelOrder: order ${orderId} is already delivered`);
  }
  order.status = 'cancelled';
  order.cancelledReason = reason;
  return order;
}

// Whether an order is running late against its own promised
// turnaround. Surfaced rather than computed silently, because the
// customer-facing promise is the turnaround, not the status.
function isOverdue(store, options = {}) {
  const { orderId, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'isOverdue');
  if (order.pickedUpAt === null) return false;
  if (order.status === 'delivered' || order.status === 'cancelled') return false;
  return now > order.pickedUpAt + order.turnaroundHours * MS_PER_HOUR;
}

function listOrdersForCustomer(store, customerId) {
  return store.laundryOrders.filter((o) => o.customerId === customerId);
}

module.exports = {
  LAUNDRY_VERTICAL_ID,
  SERVICE_TYPES,
  WATER_TEMPERATURES,
  DRY_SETTINGS,
  ORDER_STATUSES,
  DEFAULT_PRICE_PER_POUND,
  DEFAULT_MINIMUM_POUNDS,
  DEFAULT_TURNAROUND_HOURS,
  LaundryError,
  normaliseCarePreferences,
  scheduleOrder,
  getOrder,
  markPickedUp,
  recordWeight,
  approveOverCap,
  startProcessing,
  markReady,
  markDelivered,
  cancelOrder,
  isOverdue,
  listOrdersForCustomer,
};
