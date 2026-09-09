// VACAY EXPERIENCES -- Airbnb Experiences (tours/workshops led by
// local hosts), split out of VACAY itself into its own standalone app
// (Phase 1 here) per explicit instruction: VACAY should be split into
// its real, distinct divisions -- Airbnb (Stays), Airbnb Experiences,
// Turo (`../vacay-auto/`), and Zillow (`../vacay-homes/`) -- sharing
// the same V3/Shield identity but genuinely separate apps, the same
// real pattern already established for CHOPZ/CHOPZ SHOP and VENVS/VDP.
// Originally built as VACAY's own Phase 2; moved here unchanged in
// logic, `git mv`'d, not rewritten.
//
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model `Experience { id, hostId, description, durationHours }` and
// API map (`POST /vacay/experiences -- separate from stays, same host
// model`). VACAY_COMPARABLES.md independently confirms Airbnb's real
// "Experiences" category (tours/workshops led by local hosts) is a
// direct, already-correct model for this tab -- no structural change
// needed, just confirms it's well-conceived.
//
// Two real, necessary completions, flagged since the source doc's
// entity has no field shape beyond the three named fields: (1) a
// `price` field -- "same host model" as stays implies the same real
// 15.5% fee structure applies, which requires a real price to exist
// at all; (2) `capacity`/`scheduledAt` -- a real Airbnb Experience is
// a scheduled, capacity-limited group activity (a cooking class for
// up to 8 people, a specific walking tour time), not an unscheduled,
// uncapped service. This is the exact same real shape VOID MAGIC's
// own `experiences.js` already established for a structurally
// identical real-world concept (a scheduled, capacity-limited
// bookable activity) in a different domain -- deliberate, consistent
// pattern reuse across apps in this ecosystem, not a coincidence.
//
// The same real double-booking guard VOID MAGIC's own `experiences.js`
// and this project's own `bookings.js` (stays) both already
// established: a host can't run two overlapping Experiences (or an
// Experience overlapping their own stay-hosting time -- out of scope,
// hosts and stays aren't cross-checked here) at once.

const EXPERIENCE_STATUSES = ['open', 'full', 'completed', 'cancelled'];
const ACTIVE_EXPERIENCE_STATUSES = ['open', 'full'];

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findDoubleBooking(store, hostId, scheduledAt, durationHours) {
  const start = scheduledAt;
  const end = scheduledAt + durationHours * 3600000;
  return store.experiences.find((e) => e.hostId === hostId
    && ACTIVE_EXPERIENCE_STATUSES.includes(e.status)
    && intervalsOverlap(start, end, e.scheduledAt, e.scheduledAt + e.durationHours * 3600000)) || null;
}

function createExperience(store, options = {}) {
  const {
    hostId, description, durationHours, price, capacity, scheduledAt, now = Date.now(),
  } = options;

  if (!hostId) throw new Error('createExperience requires a hostId');
  if (!description) throw new Error('createExperience requires a description');
  if (!Number.isFinite(durationHours) || durationHours <= 0) throw new Error('createExperience requires a positive durationHours');
  if (!Number.isFinite(price) || price <= 0) throw new Error('createExperience requires a positive price');
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('createExperience requires a positive integer capacity');
  if (!Number.isInteger(scheduledAt) || scheduledAt <= now) throw new Error('createExperience requires a real, future scheduledAt timestamp');

  const conflict = findDoubleBooking(store, hostId, scheduledAt, durationHours);
  if (conflict) {
    throw new Error(`createExperience: double booking -- host ${hostId} already has experience ${conflict.id} scheduled in an overlapping window`);
  }

  const experience = {
    id: store.nextExperienceId++,
    hostId,
    description,
    durationHours,
    price,
    capacity,
    remainingCapacity: capacity,
    scheduledAt,
    status: 'open',
    createdAt: now,
  };
  store.experiences.push(experience);
  return experience;
}

function getExperience(store, experienceId) {
  return store.experiences.find((e) => e.id === experienceId) || null;
}

function discoverExperiences(store, options = {}) {
  const { now = Date.now() } = options;
  return store.experiences
    .filter((e) => e.status === 'open' && e.scheduledAt > now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

module.exports = {
  EXPERIENCE_STATUSES, createExperience, getExperience, discoverExperiences,
};
