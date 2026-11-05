// Universal World Layer — supply chain resolution against
// `supplyNeeds`. Closes this project's own flagged "Not yet built"
// gap. `commerce.js`'s own header explains the real shape decision
// this builds on: `supplyNeeds`/`suppliesResources` are both
// `{ resourceType, quantity|capacity }` lists, and neither had any
// real consumer before this file.
//
// A need is resolved against every OTHER real business in the world
// that lists a matching `suppliesResources` entry, filtered to only
// those actually reachable from the needing business's own location —
// reusing `routing.js`'s own real `findRoute` (same-location is always
// reachable with no transport node required, the one case routing.js
// itself doesn't model). This is a real reachability + capacity
// check, never a fabricated percentage: a need with more combined
// reachable capacity than it requires is 'met', some-but-not-enough
// is 'partial', and none is 'unmet'.

const { getBusiness } = require('./commerce');
const { findRoute } = require('./routing');

const RESOLUTION_STATUSES = ['met', 'partial', 'unmet'];

function isReachableFrom(worldLayer, fromLocationId, toLocationId) {
  if (fromLocationId === toLocationId) return true;
  return findRoute(worldLayer, { fromLocationId, toLocationId }).reachable;
}

function resolveSupplyNeed(worldLayer, businessId, resourceType) {
  const business = getBusiness(worldLayer, businessId);
  if (!business) {
    throw new Error(`resolveSupplyNeed: no business with id ${businessId}`);
  }
  const need = business.supplyNeeds.find((n) => n.resourceType === resourceType);
  if (!need) {
    throw new Error(`resolveSupplyNeed: business ${businessId} has no supply need for "${resourceType}"`);
  }

  const suppliers = [];
  let availableCapacity = 0;
  for (const supplier of worldLayer.businesses) {
    if (supplier.id === businessId) continue;
    const offer = supplier.suppliesResources.find((s) => s.resourceType === resourceType);
    if (!offer || offer.capacity <= 0) continue;
    if (!isReachableFrom(worldLayer, supplier.locationId, business.locationId)) continue;
    suppliers.push({ businessId: supplier.id, capacity: offer.capacity });
    availableCapacity += offer.capacity;
  }
  availableCapacity = Math.round(availableCapacity * 100) / 100;

  let status;
  if (availableCapacity <= 0) status = 'unmet';
  else if (availableCapacity >= need.quantity) status = 'met';
  else status = 'partial';

  return {
    resourceType, required: need.quantity, availableCapacity, status, suppliers,
  };
}

function resolveSupplyChain(worldLayer, businessId) {
  const business = getBusiness(worldLayer, businessId);
  if (!business) {
    throw new Error(`resolveSupplyChain: no business with id ${businessId}`);
  }

  const needs = business.supplyNeeds.map(
    (n) => resolveSupplyNeed(worldLayer, businessId, n.resourceType),
  );

  let overallStatus;
  if (needs.length === 0 || needs.every((n) => n.status === 'met')) overallStatus = 'met';
  else if (needs.every((n) => n.status === 'unmet')) overallStatus = 'unmet';
  else overallStatus = 'partial';

  return { businessId, needs, overallStatus };
}

module.exports = { RESOLUTION_STATUSES, resolveSupplyNeed, resolveSupplyChain };
