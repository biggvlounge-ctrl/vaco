// VOID — Regulated Delivery Boxes.
// Source of truth: QUICK_INNOVATION_THREAD.md §1: secure, compliant
// delivery boxes for regulated products (prescription, medical
// supply, cannabis-where-legal), extending `voidLocker.js`/
// `stations.js`'s existing infrastructure with real additional
// controls -- identity verification, chain-of-custody tracking.
//
// **Real, honest scope note**: `verticals.js` already gates
// `cannabisDelivery`/`medicalTransportation` as `licensingGated: true`
// -- `requestJob` (marketplace.js) already refuses to create a job on
// either vertical until real licensing exists. This module is
// deliberately the same posture: it builds the real physical
// chain-of-custody data model now (the "hardware layer ready for when
// compliance work clears," per the source doc), but does not itself
// bypass or relax that existing licensing gate -- a regulated box can
// be registered and linked to a real standard station, but nothing
// here creates a real regulated marketplace job.
//
// Identity verification routes through VACA, the same real, live
// cross-app pattern `marketplace.js`'s own provider verification
// already established (an injected fetch function, never a hard
// dependency baked in here) -- `verifyRecipientIdentity` below takes
// an injected `vacaFetchFn`, matching that established shape exactly.

const PRODUCT_CATEGORIES = ['prescription', 'medical-supply', 'cannabis'];
const CUSTODY_ACTIONS = ['loaded', 'in-transit', 'delivered', 'identity-verified', 'refused'];

function registerRegulatedBox(store, options = {}) {
  const { standardStationId, productCategory } = options;
  if (!standardStationId) throw new Error('registerRegulatedBox requires a standardStationId');
  if (!PRODUCT_CATEGORIES.includes(productCategory)) {
    throw new Error(`registerRegulatedBox: invalid productCategory "${productCategory}" (expected one of ${PRODUCT_CATEGORIES.join(', ')})`);
  }

  const box = {
    id: store.nextRegulatedDeliveryBoxId++,
    standardStationId,
    productCategory,
    identityVerificationRequired: true, // always true, per the source doc's own explicit "true, always"
    chainOfCustodyLog: [],
    createdAt: Date.now(),
  };
  store.regulatedDeliveryBoxes.push(box);
  return box;
}

function getRegulatedBox(store, boxId) {
  return store.regulatedDeliveryBoxes.find((b) => b.id === boxId) || null;
}

// Every real handling step is logged -- never silently skipped, since
// the whole point of a chain-of-custody log is that it has no gaps.
function logCustodyEvent(store, options = {}) {
  const { boxId, handlerId, action } = options;
  const box = getRegulatedBox(store, boxId);
  if (!box) throw new Error(`logCustodyEvent: no regulated box with id ${boxId}`);
  if (!handlerId) throw new Error('logCustodyEvent requires a handlerId');
  if (!CUSTODY_ACTIONS.includes(action)) {
    throw new Error(`logCustodyEvent: invalid action "${action}" (expected one of ${CUSTODY_ACTIONS.join(', ')})`);
  }

  const entry = { handlerId, timestamp: Date.now(), action };
  box.chainOfCustodyLog.push(entry);
  return entry;
}

// Real, live VACA identity check at the point of delivery -- same
// injected-fetch-function pattern as marketplace.js's own real VACA
// provider check; fails soft (returns false, never throws) on a real
// network/lookup failure, the same posture CVNVO's own `fetchYapSignal`
// already established, since a real delivery-refusal decision (not a
// silent match/no-match toggle) is what this feeds.
async function verifyRecipientIdentity(store, options = {}) {
  const { boxId, recipientId, vacaFetchFn } = options;
  const box = getRegulatedBox(store, boxId);
  if (!box) throw new Error(`verifyRecipientIdentity: no regulated box with id ${boxId}`);
  if (!recipientId) throw new Error('verifyRecipientIdentity requires a recipientId');
  if (typeof vacaFetchFn !== 'function') {
    throw new Error('verifyRecipientIdentity requires a vacaFetchFn(recipientId)');
  }

  let verified = false;
  try {
    verified = await vacaFetchFn(recipientId);
  } catch (_err) {
    verified = false;
  }

  logCustodyEvent(store, { boxId, handlerId: recipientId, action: verified ? 'identity-verified' : 'refused' });
  return verified;
}

module.exports = {
  PRODUCT_CATEGORIES,
  CUSTODY_ACTIONS,
  registerRegulatedBox,
  getRegulatedBox,
  logCustodyEvent,
  verifyRecipientIdentity,
};
