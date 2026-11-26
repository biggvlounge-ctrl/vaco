// server/savedLocations.js
//
// Task #97 — "saved/bookmarked locations with a takeover-key
// requirements card." A saved location is nothing but the one real
// pair `assess-takeover` already requires — `{scale, locationId}` —
// kept on a list. Saving one records NOTHING about what taking it
// would require: `savedLocationRowsOf` is read verbatim, and the
// requirements card itself is `control.assess`, the real,
// already-built generator `assess-takeover` already exposes,
// recomputed LIVE every time the list is read (standing rule 3 — the
// world a bookmark points at keeps moving after it is saved, so a
// stored card would go stale the first tick a resident is born, dies,
// or is recruited). That live recomputation is `engine.js#savedLocationsOf`'s
// job, not this file's — this module is the bookmark list and nothing
// about takeovers at all, the same separation `inventory.js` holds
// from `barter.js`'s pricing.
//
// `server/schema-extensions.sql` admits `saved_locations` as a new
// table against the same bar `inventory.js`'s own header argues at
// length: `players` has no field for it, and a bookmark is not an
// entity, a relationship, or a holding — the three existing tables
// that were considered and rejected there for an identical reason.
//
// **Never a bookmark "about nothing."** `missionVariety.js`'s own
// `offer*Mission` functions anchor at a real property before
// returning anything; saving a location holds to the same discipline
// one step earlier — `saveLocation` refuses a `{scale, locationId}`
// pair that does not resolve to a real target, via `control
// .compositionFor`, the one real scale-and-location existence check
// `control.assess` itself already performs internally before it ever
// looks at a tribe.

const { nextAfter } = require('./nextAfter.js');
const control = require('./control.js');

let nextSavedLocationId = 1;

function reseedIds(worldState) {
  nextSavedLocationId = nextAfter(worldState.savedLocations, 'id');
  return { nextSavedLocationId };
}

function savedLocationRowsOf(worldState, entityId) {
  return (worldState.savedLocations || []).filter((s) => s.entity_id === entityId);
}

// Bookmarking the same `{scale, locationId}` pair twice is a no-op —
// the existing row comes back rather than a second, identical one, the
// same idempotence `media.registerWalkieTalkie` already holds for a
// repeated registration.
function saveLocation(worldState, entityId, options = {}) {
  const { scale, locationId, tick = worldState.tick ?? 0 } = options;

  if (!control.SCALE_NAMES.includes(scale)) {
    throw new Error(
      `savedLocations.saveLocation: "${scale}" is not a scale `
      + `(one of: ${control.SCALE_NAMES.join(', ')}).`,
    );
  }
  const id = Number(locationId);
  if (!Number.isFinite(id)) {
    throw new Error(`savedLocations.saveLocation: locationId must be a number, got ${locationId}`);
  }
  if (!control.compositionFor(worldState, { scale, locationId: id, tick })) {
    throw new Error(
      `savedLocations.saveLocation: no real ${scale} with id ${id} to bookmark — `
      + 'a saved location has to point at something, the same discipline missionVariety.js '
      + 'holds for a mission.',
    );
  }

  const existing = savedLocationRowsOf(worldState, entityId)
    .find((s) => s.scale === scale && s.location_id === id);
  if (existing) return existing;

  const row = {
    id: nextSavedLocationId++,
    entity_id: entityId,
    scale,
    location_id: id,
    saved_tick: tick,
  };
  worldState.savedLocations.push(row);
  return row;
}

function unsaveLocation(worldState, entityId, savedLocationId) {
  const rows = worldState.savedLocations || [];
  const index = rows.findIndex(
    (s) => s.id === Number(savedLocationId) && s.entity_id === entityId,
  );
  if (index === -1) {
    throw new Error(
      `savedLocations.unsaveLocation: no saved location ${savedLocationId} `
      + `belonging to entity ${entityId}.`,
    );
  }
  rows.splice(index, 1);
}

module.exports = {
  reseedIds,
  savedLocationRowsOf,
  saveLocation,
  unsaveLocation,
};
