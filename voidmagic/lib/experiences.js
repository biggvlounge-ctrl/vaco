// VOID MAGIC -- Experiences (Section 39, MVP steps 1-2: "Creator
// creates experience" / "Customer discovers experience"; Section 10's
// double-booking guard, Phase 2's fifth real slice).
// Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS5 (creator-side
// creation fields: type, format, capacity, duration, pricing,
// location) and SS39's explicit MVP scope.
//
// A real, deliberate scoping choice, flagged since the brief's SS38
// only names entities without field-level shapes: this MVP models an
// Experience as one specific, already-dated/timed bookable slot (the
// same real shape VACAY's `Experience`/`Booking` pair uses) rather
// than a recurring-availability template needing SS10's "serious
// scheduling engine" -- that's real, substantial, explicitly-deferred
// engineering (SS10 itself says "this should eventually become an
// intelligent scheduling system"), not MVP work. Pricing here is
// deliberately limited to free/fixed -- SS5 also lists tiered/
// auction/invitation-only/subscription pricing, all explicitly
// deferred as real, separate engineering lifts, not built here.
//
// SS10's own first, named requirement is real and minimal enough to
// build now: "The system prevents double booking." A real, correct
// overlap check against the host's own other active experiences --
// two intervals [aStart, aEnd) and [bStart, bEnd) overlap iff
// aStart < bEnd && bStart < aEnd, the standard real interval-overlap
// test, not an approximation. Applies regardless of format (a host
// can't run a physical meet-greet and a digital conversation at the
// same moment either), and only against `open`/`full` experiences --
// a cancelled or already-completed one doesn't block a new slot.
// SS10's remaining, real detail (travel time, setup/security setup
// time, buffers, event transitions) is genuinely substantial,
// explicitly-deferred engineering, not built here -- this is the one
// real invariant SS10 names outright, not the full "intelligent
// scheduling system."
//
// Phase 2's eighth slice adds an optional `geofence: { lat, lng,
// radiusMeters } | null` field, per SS32's own "geofencing should be
// optional." No lat/lng existed anywhere on Experience before this --
// a real, minimal, additive extension, not a field the brief itself
// names outright (SS38 gives no field shapes at all). See
// `lib/geofencing.js` for the real distance check this field feeds.

const EXPERIENCE_TYPES = ['meet-greet', 'interaction', 'conversation', 'custom'];
const EXPERIENCE_FORMATS = ['physical', 'digital', 'hybrid'];
const ACTIVE_EXPERIENCE_STATUSES = ['open', 'full'];

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findDoubleBooking(store, hostId, scheduledAt, durationMinutes) {
  const start = scheduledAt;
  const end = scheduledAt + durationMinutes * 60000;
  return store.experiences.find((e) => e.hostId === hostId
    && ACTIVE_EXPERIENCE_STATUSES.includes(e.status)
    && intervalsOverlap(start, end, e.scheduledAt, e.scheduledAt + e.durationMinutes * 60000)) || null;
}

function createExperience(store, options = {}) {
  const {
    hostId, title, type, format, capacity, durationMinutes, price, scheduledAt, location,
    geofence = null, now = Date.now(),
  } = options;

  if (!hostId) throw new Error('createExperience requires a hostId');
  if (!title) throw new Error('createExperience requires a title');
  if (!EXPERIENCE_TYPES.includes(type)) {
    throw new Error(`createExperience: invalid type "${type}" (expected one of ${EXPERIENCE_TYPES.join(', ')})`);
  }
  if (!EXPERIENCE_FORMATS.includes(format)) {
    throw new Error(`createExperience: invalid format "${format}" (expected one of ${EXPERIENCE_FORMATS.join(', ')})`);
  }
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('createExperience requires a positive integer capacity');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    throw new Error('createExperience requires a positive integer durationMinutes');
  }
  if (!Number.isFinite(price) || price < 0) throw new Error('createExperience requires a non-negative price (0 = free)');
  if (!Number.isInteger(scheduledAt) || scheduledAt <= now) {
    throw new Error('createExperience requires a real, future scheduledAt timestamp');
  }
  if (!location) throw new Error('createExperience requires a location (a venue description or a digital designation)');
  if (geofence !== null) {
    const { lat, lng, radiusMeters } = geofence;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      throw new Error('createExperience: geofence, if provided, requires numeric lat/lng and a positive radiusMeters (geofencing is optional -- SS32)');
    }
  }

  const conflict = findDoubleBooking(store, hostId, scheduledAt, durationMinutes);
  if (conflict) {
    throw new Error(`createExperience: double booking -- host ${hostId} already has experience ${conflict.id} ("${conflict.title}") scheduled in an overlapping window`);
  }

  const experience = {
    id: store.nextExperienceId++,
    hostId, title, type, format, capacity, remainingCapacity: capacity, durationMinutes, price, scheduledAt, location,
    geofence,
    status: 'open',
    createdAt: now,
  };
  store.experiences.push(experience);
  return experience;
}

function getExperience(store, experienceId) {
  return store.experiences.find((e) => e.id === experienceId) || null;
}

// The real "customer discovers" step -- a real, simple, honest query
// over real open/upcoming experiences. No search ranking or AI
// recommendation logic here -- both are explicitly later work per the
// brief's own phase list (SS15's "experience recommendations" is
// V4-AI territory, SS41/Phase 3).
function discoverExperiences(store, options = {}) {
  const { type = null, format = null, now = Date.now() } = options;
  return store.experiences
    .filter((e) => e.status === 'open' && e.scheduledAt > now)
    .filter((e) => !type || e.type === type)
    .filter((e) => !format || e.format === format)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

module.exports = { EXPERIENCE_TYPES, EXPERIENCE_FORMATS, createExperience, getExperience, discoverExperiences };
