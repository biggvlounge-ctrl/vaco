// VOID -- the primitives every service app needs.
//
// **Why this file exists.** Pet care and laundry were built as
// standalone domain modules, and writing the second one made the
// duplication obvious: both needed a cancellation rule, both needed a
// notion of who is trusted enough to do the work, and pet care's
// recurring-booking logic is not specific to dogs -- landscaping,
// cleaning, and tutoring all want the same thing.
//
// Building 21 more verticals by copying those two would produce 21
// slightly different cancellation policies and 21 slightly different
// ideas of what "verified" means. That is how a marketplace ends up
// unable to answer "is this person safe to send to a house."
//
// So the remaining verticals are not 21 bespoke apps. They are a small
// number of archetypes over these shared primitives, plus their own
// domain vocabulary. See `VOID_SERVICE_APPS_AND_THE_WORKDAY.md`.

const { VERTICALS } = require('./verticals');

// -- vetting -----------------------------------------------------------
//
// **The gap this closes, stated plainly.** Before this module,
// `canWorkVertical` required a *verified* skill only for the two
// licensing-gated verticals. Everything else accepted a claim. That
// meant a stranger could register, claim `childcare`, and be eligible
// to watch a child, with the system reporting `allowed: true`.
//
// That is not a defensible default. Care.com and UrbanSitter both gate
// on background checks, and the reason is not competitive parity.
//
// Vetting is deliberately separate from the licensing gate. Licensing
// is "the law requires a permit for this trade." Vetting is "this work
// puts someone alone with a vulnerable person, or inside an empty
// home." A vertical can need either, both, or neither.

const VETTING_LEVELS = [
  'none',
  'identity-verified',    // a real person, established through VACA
  'background-checked',   // criminal record check on file
  'credential-verified',  // a licence or certification actually sighted
];

// Ordered, so a higher level satisfies a lower requirement. Someone
// with a background check does not need to also be separately
// identity-verified.
const VETTING_RANK = Object.fromEntries(VETTING_LEVELS.map((l, i) => [l, i]));

//: Flagged interpretive: no source document assigns these. Each is the
//: level the real comparables in that category actually require, and
//: each is a judgement that should be reviewed rather than inherited:
//:
//:   childcare / seniorCare  -- background check. Care.com, UrbanSitter,
//:     and Honor all require one. Unsupervised access to a child or a
//:     vulnerable adult is the clearest case there is.
//:   tutoring                -- background check. Usually minors, often
//:     one-to-one.
//:   cleaningHandyman, landscaping, petCare, laundry, autoRepairDetailing
//:     -- identity verification. These involve access to a home, a key,
//:     or property, but not unsupervised care of a person.
//:   security                -- credential. Guard work is licensed in
//:     most jurisdictions.
//:   notaryLegal             -- credential. A notary commission is the
//:     product.
//:   medicalTransportation, cannabisDelivery -- credential, on top of
//:     the existing licensing gate. Belt and braces, deliberately.
//:
//: Everything not listed defaults to 'none', which is the honest
//: default for a courier run or a freelance design job.
const VERTICAL_VETTING_REQUIREMENTS = {
  childcare: 'background-checked',
  seniorCare: 'background-checked',
  tutoring: 'background-checked',
  petCare: 'identity-verified',
  cleaningHandyman: 'identity-verified',
  landscaping: 'identity-verified',
  laundry: 'identity-verified',
  autoRepairDetailing: 'identity-verified',
  security: 'credential-verified',
  notaryLegal: 'credential-verified',
  medicalTransportation: 'credential-verified',
  cannabisDelivery: 'credential-verified',
};

const DEFAULT_VETTING_REQUIREMENT = 'none';

class ServiceCommonError extends Error {}

function requiredVettingFor(verticalId) {
  if (!VERTICALS[verticalId]) {
    throw new ServiceCommonError(`requiredVettingFor: unknown verticalId "${verticalId}"`);
  }
  return VERTICAL_VETTING_REQUIREMENTS[verticalId] || DEFAULT_VETTING_REQUIREMENT;
}

// Records a vetting result against a provider. Expiry is required for
// anything above identity: a background check from four years ago is
// not a current background check, and treating it as one is the
// failure mode every care marketplace has been criticised for.
function recordVetting(store, options = {}) {
  const {
    providerId, level, verifiedBy, referenceId,
    expiresAt = null, now = Date.now(),
  } = options;

  const profile = store.providerProfiles.find((p) => p.providerId === providerId);
  if (!profile) throw new ServiceCommonError(`recordVetting: no provider "${providerId}"`);
  if (!VETTING_LEVELS.includes(level)) {
    throw new ServiceCommonError(`recordVetting: level must be one of ${VETTING_LEVELS.join(', ')}`);
  }
  if (level === 'none') {
    throw new ServiceCommonError('recordVetting: "none" is the absence of vetting, not a result to record');
  }
  // A result nobody can be traced back to is not evidence.
  if (!verifiedBy) throw new ServiceCommonError('recordVetting requires verifiedBy');
  if (!referenceId) throw new ServiceCommonError('recordVetting requires a referenceId');
  if (VETTING_RANK[level] > VETTING_RANK['identity-verified'] && expiresAt === null) {
    throw new ServiceCommonError(
      `recordVetting: ${level} requires an expiresAt -- a check with no expiry is treated as current forever`,
    );
  }
  if (expiresAt !== null && expiresAt <= now) {
    throw new ServiceCommonError('recordVetting: expiresAt must be in the future');
  }

  profile.vetting = profile.vetting || [];
  const record = { level, verifiedBy, referenceId, recordedAt: now, expiresAt, revokedAt: null };
  profile.vetting.push(record);
  return record;
}

function revokeVetting(store, options = {}) {
  const { providerId, referenceId, reason = 'unspecified', now = Date.now() } = options;
  const profile = store.providerProfiles.find((p) => p.providerId === providerId);
  if (!profile) throw new ServiceCommonError(`revokeVetting: no provider "${providerId}"`);

  const record = (profile.vetting || []).find((v) => v.referenceId === referenceId);
  if (!record) throw new ServiceCommonError(`revokeVetting: no vetting record "${referenceId}"`);
  record.revokedAt = now;
  record.revokedReason = reason;
  return record;
}

// The highest vetting level a provider currently holds. Expired and
// revoked records do not count, which is the whole point of storing
// expiry rather than a boolean.
function currentVettingLevel(store, providerId, now = Date.now()) {
  const profile = store.providerProfiles.find((p) => p.providerId === providerId);
  if (!profile || !profile.vetting) return 'none';

  let best = 'none';
  for (const record of profile.vetting) {
    if (record.revokedAt !== null) continue;
    if (record.expiresAt !== null && record.expiresAt <= now) continue;
    if (VETTING_RANK[record.level] > VETTING_RANK[best]) best = record.level;
  }
  return best;
}

function meetsVettingRequirement(store, providerId, verticalId, now = Date.now()) {
  const required = requiredVettingFor(verticalId);
  if (required === 'none') return { meets: true, required, held: currentVettingLevel(store, providerId, now) };

  const held = currentVettingLevel(store, providerId, now);
  return {
    meets: VETTING_RANK[held] >= VETTING_RANK[required],
    required,
    held,
  };
}

// -- cancellation ------------------------------------------------------
//
// One policy shape rather than a per-vertical invention. The window
// and the fee differ by vertical; the *rule* does not.
//
// Both sides matter and are handled separately: a customer cancelling
// late has taken a slot the provider can no longer fill, and a provider
// cancelling late has left a customer without a service they planned
// around. Charging one and ignoring the other is how a marketplace
// loses whichever side it ignores.

//: Flagged interpretive: 24 hours free-cancellation is the common
//: convention across Rover, Care.com, and most home services. The fee
//: is expressed as a fraction of the job so it scales with what was
//: actually at stake.
const DEFAULT_FREE_CANCELLATION_HOURS = 24;
const DEFAULT_LATE_CANCELLATION_FEE_RATE = 0.5;

const MS_PER_HOUR = 60 * 60 * 1000;

function assessCancellation(options = {}) {
  const {
    scheduledFor, cancelledAt, jobTotal,
    cancelledBy = 'customer',
    freeCancellationHours = DEFAULT_FREE_CANCELLATION_HOURS,
    lateFeeRate = DEFAULT_LATE_CANCELLATION_FEE_RATE,
  } = options;

  if (!Number.isFinite(scheduledFor) || !Number.isFinite(cancelledAt)) {
    throw new ServiceCommonError('assessCancellation requires numeric scheduledFor and cancelledAt');
  }
  if (!Number.isFinite(jobTotal) || jobTotal < 0) {
    throw new ServiceCommonError('assessCancellation requires a non-negative jobTotal');
  }
  if (!['customer', 'provider'].includes(cancelledBy)) {
    throw new ServiceCommonError("assessCancellation: cancelledBy must be 'customer' or 'provider'");
  }

  const hoursNotice = (scheduledFor - cancelledAt) / MS_PER_HOUR;
  const isLate = hoursNotice < freeCancellationHours;

  if (!isLate) {
    return { isLate: false, hoursNotice, customerFee: 0, providerCompensation: 0, providerPenalty: 0 };
  }

  // A late customer cancellation charges the customer and pays the
  // provider for the slot they can no longer fill. A late provider
  // cancellation charges the customer nothing and is recorded against
  // the provider -- reliability is a signal, not a fine.
  if (cancelledBy === 'customer') {
    const fee = Math.round(jobTotal * lateFeeRate * 100) / 100;
    return { isLate: true, hoursNotice, customerFee: fee, providerCompensation: fee, providerPenalty: 0 };
  }
  return { isLate: true, hoursNotice, customerFee: 0, providerCompensation: 0, providerPenalty: 1 };
}

// -- recurrence --------------------------------------------------------
//
// Generalised out of `petCare.createRecurringBookings`. A standing
// Tuesday walk, a fortnightly lawn cut, and a weekly clean are the same
// mechanic, and every one of them is the retention loop for its
// vertical -- a customer who has to rebook every week eventually
// rebooks somewhere else.
//
// Generates concrete occurrence timestamps rather than storing a rule,
// so each is individually cancellable and visible to the day planner.

//: Cap on how far a series may be scheduled ahead. Not a business
//: rule -- a guard against a typo generating ten thousand bookings.
const MAX_OCCURRENCES = 104; // two years of weekly

function generateOccurrences(options = {}) {
  const { firstAt, intervalDays, occurrences } = options;

  if (!Number.isFinite(firstAt)) {
    throw new ServiceCommonError('generateOccurrences requires a numeric firstAt');
  }
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new ServiceCommonError('generateOccurrences requires a positive integer intervalDays');
  }
  if (!Number.isInteger(occurrences) || occurrences < 2) {
    throw new ServiceCommonError('generateOccurrences requires occurrences of at least 2');
  }
  if (occurrences > MAX_OCCURRENCES) {
    throw new ServiceCommonError(`generateOccurrences: occurrences may not exceed ${MAX_OCCURRENCES}`);
  }

  const out = [];
  for (let i = 0; i < occurrences; i += 1) {
    out.push(firstAt + i * intervalDays * 24 * MS_PER_HOUR);
  }
  return out;
}

// -- service sites -----------------------------------------------------
//
// Anything performed at a place the provider must get into needs more
// than coordinates. Access instructions, gate codes, and "the dog is
// friendly but barks" are the difference between a job completed and a
// provider standing outside.

function describeServiceSite(options = {}) {
  const {
    lat, lng, addressLine = null, accessNotes = null,
    entryCode = null, parkingNotes = null, contactOnArrival = false,
  } = options;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ServiceCommonError('describeServiceSite requires numeric lat and lng');
  }
  return { lat, lng, addressLine, accessNotes, entryCode, parkingNotes, contactOnArrival };
}

module.exports = {
  VETTING_LEVELS,
  VETTING_RANK,
  VERTICAL_VETTING_REQUIREMENTS,
  DEFAULT_VETTING_REQUIREMENT,
  DEFAULT_FREE_CANCELLATION_HOURS,
  DEFAULT_LATE_CANCELLATION_FEE_RATE,
  MAX_OCCURRENCES,
  ServiceCommonError,
  requiredVettingFor,
  recordVetting,
  revokeVetting,
  currentVettingLevel,
  meetsVettingRequirement,
  assessCancellation,
  generateOccurrences,
  describeServiceSite,
};
