// Universal World Layer — Information Propagation Engine.
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 5
// ("Information Propagation Engine — confirmed as the one, universal
// mechanism"). Doc's field list: eventType, origin, distance,
// connectivity, trustNetwork, languageBarrier, timeDelay,
// spreadProbability. Used for rumors, disasters, laws, business
// openings, wars, discoveries, and player reputation — one system,
// not separate mechanisms per event type. `eventType` is therefore a
// free-form string here, not a fixed enum — the whole point is that
// the mechanism doesn't branch on it.
//
// No formula for spreadProbability/timeDelay is specified in any
// source doc. The one implemented here is a real, deterministic,
// testable placeholder — documented as an interpretive choice in
// dev-docs/phase-5-information-propagation/plan.md, same honesty as
// every other undocumented formula in this project (e.g. VACON-C's
// territory control thresholds).

const { getLocation } = require('./locations');

const DISTANCE_DECAY_CONSTANT = 50; // arbitrary; larger = slower falloff with distance

function originateEvent(worldLayer, options = {}) {
  const { eventType, originLocationId, description = null } = options;

  if (!eventType) {
    throw new Error('originateEvent requires an eventType');
  }
  if (originLocationId == null) {
    throw new Error('originateEvent requires an originLocationId');
  }
  if (!getLocation(worldLayer, originLocationId)) {
    throw new Error(`originateEvent: no location with id ${originLocationId}`);
  }

  const event = {
    id: worldLayer.nextInformationEventId++,
    eventType,
    originLocationId,
    description,
    propagations: [],
    createdTick: worldLayer.tick,
  };

  worldLayer.informationEvents.push(event);
  return event;
}

function getInformationEvent(worldLayer, eventId) {
  return worldLayer.informationEvents.find((e) => e.id === eventId) || null;
}

function calculatePropagation(options = {}) {
  const { distance, connectivity, trustNetwork, languageBarrier = false } = options;

  if (typeof distance !== 'number' || distance < 0) {
    throw new Error('calculatePropagation requires a non-negative numeric distance');
  }
  if (typeof connectivity !== 'number' || connectivity < 0 || connectivity > 100) {
    throw new Error('calculatePropagation requires connectivity between 0 and 100');
  }
  if (typeof trustNetwork !== 'number' || trustNetwork < 0 || trustNetwork > 100) {
    throw new Error('calculatePropagation requires trustNetwork between 0 and 100');
  }
  if (typeof languageBarrier !== 'boolean') {
    throw new Error('calculatePropagation requires languageBarrier to be a boolean');
  }

  const distanceDecay = 1 / (1 + distance / DISTANCE_DECAY_CONSTANT);
  const languageMultiplier = languageBarrier ? 0.5 : 1;

  let spreadProbability = connectivity * (trustNetwork / 100) * distanceDecay * languageMultiplier;
  spreadProbability = Math.max(0, Math.min(100, Math.round(spreadProbability * 100) / 100));

  const timeDelay = Math.max(1, Math.round(distance / Math.max(connectivity, 1)));

  return { spreadProbability, timeDelay };
}

function propagateEvent(worldLayer, eventId, targetLocationId, propagationOptions = {}) {
  const event = getInformationEvent(worldLayer, eventId);
  if (!event) {
    throw new Error(`propagateEvent: no information event with id ${eventId}`);
  }
  if (!getLocation(worldLayer, targetLocationId)) {
    throw new Error(`propagateEvent: no location with id ${targetLocationId}`);
  }

  const { spreadProbability, timeDelay } = calculatePropagation(propagationOptions);

  const record = {
    locationId: targetLocationId,
    spreadProbability,
    timeDelay,
    arrivesTick: worldLayer.tick + timeDelay,
  };

  event.propagations.push(record);
  return record;
}

function getPropagationsForLocation(worldLayer, locationId) {
  const results = [];
  for (const event of worldLayer.informationEvents) {
    for (const propagation of event.propagations) {
      if (propagation.locationId === locationId) {
        results.push({ eventId: event.id, eventType: event.eventType, ...propagation });
      }
    }
  }
  return results;
}

module.exports = {
  DISTANCE_DECAY_CONSTANT,
  originateEvent,
  getInformationEvent,
  calculatePropagation,
  propagateEvent,
  getPropagationsForLocation,
};
