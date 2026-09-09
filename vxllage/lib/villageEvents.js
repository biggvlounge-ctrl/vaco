// VXLLAGE -- Village Events (real RSVP, real going-count).
// Source of truth: VXLLAGE_CLAUDE.md's prototype inventory: "RSVP
// toggle with real local state, generates a going-count increment."
// Built for real here as a genuinely derived count -- the real
// attendee list's length -- rather than a separately-tracked counter
// that could drift from the real attendee list.

const { getVillage } = require('./villages');

function createVillageEvent(store, options = {}) {
  const { villageId, title, scheduledAt } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`createVillageEvent: no village with id ${villageId}`);
  if (!title) throw new Error('createVillageEvent requires a title');
  if (!Number.isInteger(scheduledAt)) throw new Error('createVillageEvent requires a scheduledAt timestamp');

  const event = { id: store.nextVillageEventId++, villageId, title, scheduledAt, attendees: [], createdAt: Date.now() };
  store.villageEvents.push(event);
  return event;
}

function getVillageEvent(store, eventId) {
  return store.villageEvents.find((e) => e.id === eventId) || null;
}

function listVillageEvents(store, villageId) {
  return store.villageEvents.filter((e) => e.villageId === villageId);
}

function rsvpToEvent(store, options = {}) {
  const { eventId, userId } = options;
  const event = getVillageEvent(store, eventId);
  if (!event) throw new Error(`rsvpToEvent: no event with id ${eventId}`);
  if (!userId) throw new Error('rsvpToEvent requires a userId');
  if (event.attendees.includes(userId)) throw new Error(`rsvpToEvent: ${userId} already RSVP'd to event ${eventId}`);
  event.attendees.push(userId);
  return event;
}

function unrsvpFromEvent(store, options = {}) {
  const { eventId, userId } = options;
  const event = getVillageEvent(store, eventId);
  if (!event) throw new Error(`unrsvpFromEvent: no event with id ${eventId}`);
  if (!event.attendees.includes(userId)) throw new Error(`unrsvpFromEvent: ${userId} has not RSVP'd to event ${eventId}`);
  event.attendees = event.attendees.filter((id) => id !== userId);
  return event;
}

// The real going-count -- always the real attendee list's length,
// never a separately-tracked number that could desync from reality.
function getGoingCount(store, eventId) {
  const event = getVillageEvent(store, eventId);
  if (!event) throw new Error(`getGoingCount: no event with id ${eventId}`);
  return event.attendees.length;
}

module.exports = {
  createVillageEvent, getVillageEvent, listVillageEvents, rsvpToEvent, unrsvpFromEvent, getGoingCount,
};
