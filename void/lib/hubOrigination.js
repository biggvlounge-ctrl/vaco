// VOID — Walk-Up Hub Package Origination.
// Source of truth: VOID_HUB_WALKUP_ORIGINATION.md: the third, distinct
// delivery flow (alongside receiving and remote/app-initiated) --
// a customer physically brings a package to a Hub and originates an
// outbound shipment on the spot, self-service or staff-assisted. Real
// comparable: walking into a FedEx Office/UPS Store/USPS retail
// counter.
//
// Real code reuse: creates an actual `courier` marketplace job through
// the existing `requestJob()`, the same pattern established for VOID
// Direct and the Moving/Real Estate Media verticals -- not a fourth,
// parallel origination system.

const { requestJob } = require('./marketplace');
const { decideAirVsGround } = require('./dispatchIntelligence');

const ORIGINATION_METHODS = ['self-service-kiosk', 'staff-assisted'];

function originateShipmentAtHub(store, options = {}) {
  const {
    originHubId, customerId, originationMethod, packageWeight, packageDimensions,
    destinationAddress, staffMemberId = null, quotedPrice,
  } = options;

  if (!originHubId) throw new Error('originateShipmentAtHub requires an originHubId');
  if (!customerId) throw new Error('originateShipmentAtHub requires a customerId');
  if (!ORIGINATION_METHODS.includes(originationMethod)) {
    throw new Error(`originateShipmentAtHub: invalid originationMethod "${originationMethod}" (expected one of ${ORIGINATION_METHODS.join(', ')})`);
  }
  if (originationMethod === 'staff-assisted' && !staffMemberId) {
    throw new Error('originateShipmentAtHub: "staff-assisted" requires a staffMemberId');
  }
  if (originationMethod === 'self-service-kiosk' && staffMemberId) {
    throw new Error('originateShipmentAtHub: "self-service-kiosk" cannot have a staffMemberId');
  }
  if (!Number.isFinite(packageWeight) || packageWeight <= 0) {
    throw new Error('originateShipmentAtHub requires a positive packageWeight');
  }
  if (!packageDimensions) throw new Error('originateShipmentAtHub requires packageDimensions');
  if (!destinationAddress) throw new Error('originateShipmentAtHub requires a destinationAddress');

  const job = requestJob(store, { verticalId: 'courier', customerId, quantity: 1, unitPrice: quotedPrice });

  const shipment = {
    id: store.nextHubShipmentId++,
    jobId: job.id,
    originHubId,
    customerId,
    originationMethod,
    packageWeight,
    packageDimensions,
    destinationAddress,
    fulfillmentMethod: null,
    staffMemberId,
    createdAt: Date.now(),
  };
  store.hubOriginatedShipments.push(shipment);
  return shipment;
}

function getHubOriginatedShipment(store, shipmentId) {
  return store.hubOriginatedShipments.find((s) => s.id === shipmentId) || null;
}

// Gibson's existing air-vs-ground decision, reused rather than a new
// three-way decision system. Note: the source doc names a third
// "rideshare-style" fulfillment option that isn't actually
// distinguishable with the real decision logic built so far --
// fulfillmentMethod here only ever resolves to 'drone' or 'driver'
// (air/ground), flagged honestly rather than faking a third real path.
function decideFulfillmentForShipment(store, options = {}) {
  const { shipmentId, hasGroundCapacityHeadingToDestination, estimatedGroundDeliveryHours } = options;
  const shipment = getHubOriginatedShipment(store, shipmentId);
  if (!shipment) throw new Error(`decideFulfillmentForShipment: no shipment with id ${shipmentId}`);

  const decision = decideAirVsGround({ hasGroundCapacityHeadingToDestination, estimatedGroundDeliveryHours });
  shipment.fulfillmentMethod = decision.mode === 'air' ? 'drone' : 'driver';
  return shipment;
}

module.exports = {
  ORIGINATION_METHODS,
  originateShipmentAtHub,
  getHubOriginatedShipment,
  decideFulfillmentForShipment,
};
