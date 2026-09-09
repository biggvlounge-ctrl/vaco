// VOID -- provider profiles: who can do what, and when.
//
// **The gap this fills.** VOID had 25 verticals and no notion of a
// person. `requestJob` took a `providerId` string and trusted it. A
// dog walker, a licensed electrician, and a moving crew were the same
// thing to the system: an id. That is fine for a dispatch demo and
// wrong for a marketplace, because the entire question a marketplace
// answers is "who is qualified to do this, and are they free."
//
// **The design decision that shapes everything else here:** a provider
// is not attached to one vertical. Rover makes you a dog walker. Uber
// makes you a driver. VOID's actual structural advantage is that the
// same person can hold several skills and assemble a day across them
// -- a dog walk at 9, two laundry pickups at 11, a courier run at 2.
// That is what `lib/serviceDay.js` builds on top of this module, and
// it is only possible because skills live on the provider rather than
// the provider living inside a vertical.
//
// **Businesses are first-class, not a special case.** A laundromat, a
// grooming salon, and a two-van moving company are providers with a
// `providerType` of 'business' and a crew size above one. The
// alternative -- a separate business-onboarding path -- would mean
// every vertical, every matching rule, and every payout path had two
// versions of itself forever. One shape with a type field is the
// cheaper truth.

const { VERTICALS } = require('./verticals');
const { meetsVettingRequirement } = require('./serviceCommon');

const PROVIDER_TYPES = ['individual', 'business'];

// A skill is the right to work a vertical, held by a provider. Named
// separately from the vertical id because the two answer different
// questions: a vertical is a category of work that exists, a skill is
// a claim by a person to be able to do it.
const SKILL_STATUSES = ['claimed', 'verified', 'suspended'];

//: Flagged interpretive: no source document sets a crew-size cap.
//: The value exists to catch a typo (a "business" claiming 10,000
//: workers) rather than to express a real business rule, and it is
//: overridable.
const DEFAULT_MAX_CREW_SIZE = 500;

//: How far a provider will travel to a job, by default. Real
//: comparables cluster here -- Rover and TaskRabbit both default to a
//: local radius rather than citywide, because travel time is unpaid
//: and a wide radius quietly makes the work unprofitable. Overridable
//: per provider.
const DEFAULT_SERVICE_RADIUS_KM = 25;

class ProviderError extends Error {}

function assertValidVertical(verticalId, action) {
  if (!VERTICALS[verticalId]) {
    throw new ProviderError(`${action}: unknown verticalId "${verticalId}"`);
  }
}

function registerProvider(store, options = {}) {
  const {
    providerId, displayName, providerType = 'individual',
    homeBaseLat, homeBaseLng, serviceRadiusKm = DEFAULT_SERVICE_RADIUS_KM,
    crewSize = 1, businessName = null, now = Date.now(),
  } = options;

  if (!providerId) throw new ProviderError('registerProvider requires a providerId');
  if (!displayName) throw new ProviderError('registerProvider requires a displayName');
  if (!PROVIDER_TYPES.includes(providerType)) {
    throw new ProviderError(`registerProvider: providerType must be one of ${PROVIDER_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(homeBaseLat) || !Number.isFinite(homeBaseLng)) {
    throw new ProviderError('registerProvider requires numeric homeBaseLat and homeBaseLng');
  }
  if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0) {
    throw new ProviderError('registerProvider requires a positive serviceRadiusKm');
  }
  if (!Number.isInteger(crewSize) || crewSize < 1 || crewSize > DEFAULT_MAX_CREW_SIZE) {
    throw new ProviderError(`registerProvider requires an integer crewSize between 1 and ${DEFAULT_MAX_CREW_SIZE}`);
  }
  // A business without a name is an individual with extra steps, and
  // the name is what a customer actually sees.
  if (providerType === 'business' && !businessName) {
    throw new ProviderError('registerProvider: a business provider requires a businessName');
  }
  if (store.providerProfiles.some((p) => p.providerId === providerId)) {
    throw new ProviderError(`registerProvider: provider "${providerId}" is already registered`);
  }

  const profile = {
    providerId,
    displayName,
    providerType,
    businessName,
    crewSize,
    homeBaseLat,
    homeBaseLng,
    serviceRadiusKm,
    skills: [],
    availability: [],
    createdAt: now,
  };
  store.providerProfiles.push(profile);
  return profile;
}

function getProvider(store, providerId) {
  return store.providerProfiles.find((p) => p.providerId === providerId) || null;
}

function requireProvider(store, providerId, action) {
  const profile = getProvider(store, providerId);
  if (!profile) throw new ProviderError(`${action}: no provider registered as "${providerId}"`);
  return profile;
}

// Claiming a skill is not the same as being allowed to work it.
//
// A claimed skill is a statement of intent; verification is a separate
// act. This matters most for the licensing-gated verticals, where the
// whole point is that saying you can do it is not evidence -- but the
// same shape is used everywhere, so the matching rule has no special
// case to forget.
function addSkill(store, options = {}) {
  const { providerId, verticalId, now = Date.now() } = options;
  const profile = requireProvider(store, providerId, 'addSkill');
  assertValidVertical(verticalId, 'addSkill');

  const existing = profile.skills.find((s) => s.verticalId === verticalId);
  if (existing) return existing;

  const skill = { verticalId, status: 'claimed', verifiedAt: null, addedAt: now };
  profile.skills.push(skill);
  return skill;
}

function verifySkill(store, options = {}) {
  const { providerId, verticalId, now = Date.now() } = options;
  const profile = requireProvider(store, providerId, 'verifySkill');
  const skill = profile.skills.find((s) => s.verticalId === verticalId);
  if (!skill) throw new ProviderError(`verifySkill: "${providerId}" has not claimed "${verticalId}"`);

  skill.status = 'verified';
  skill.verifiedAt = now;
  return skill;
}

function suspendSkill(store, options = {}) {
  const { providerId, verticalId, reason = 'unspecified' } = options;
  const profile = requireProvider(store, providerId, 'suspendSkill');
  const skill = profile.skills.find((s) => s.verticalId === verticalId);
  if (!skill) throw new ProviderError(`suspendSkill: "${providerId}" has not claimed "${verticalId}"`);

  skill.status = 'suspended';
  skill.suspendedReason = reason;
  return skill;
}

// The single question the matcher asks. Deliberately one function, so
// there is exactly one place where "may this provider work this job"
// is decided.
//
// A licensing-gated vertical requires a *verified* skill. Everything
// else accepts a claimed one -- the same posture the rest of the repo
// takes: fail hard where the law is involved, stay usable elsewhere.
function canWorkVertical(store, providerId, verticalId, now = Date.now()) {
  const profile = getProvider(store, providerId);
  if (!profile) return { allowed: false, reason: `no provider registered as "${providerId}"` };

  const vertical = VERTICALS[verticalId];
  if (!vertical) return { allowed: false, reason: `unknown verticalId "${verticalId}"` };

  const skill = profile.skills.find((s) => s.verticalId === verticalId);
  if (!skill) return { allowed: false, reason: `"${providerId}" has no ${verticalId} skill` };
  if (skill.status === 'suspended') {
    return { allowed: false, reason: `"${providerId}" is suspended from ${verticalId}` };
  }
  if (vertical.licensingGated && skill.status !== 'verified') {
    return {
      allowed: false,
      reason: `${verticalId} is licensing-gated and requires a verified skill, not a claimed one`,
    };
  }

  // Vetting is a separate question from licensing and is checked here
  // rather than in each vertical, so a new service app cannot forget
  // it. Licensing asks "does the law require a permit"; vetting asks
  // "does this work put someone alone with a vulnerable person, or
  // inside an empty home." See lib/serviceCommon.js.
  const vetting = meetsVettingRequirement(store, providerId, verticalId, now);
  if (!vetting.meets) {
    return {
      allowed: false,
      reason: `${verticalId} requires ${vetting.required} vetting; "${providerId}" holds ${vetting.held}`,
    };
  }
  return { allowed: true, reason: null };
}

// -- availability -----------------------------------------------------
//
// Stored as explicit windows rather than a weekly recurring rule.
// Recurring schedules are what a provider *wants*; a window is what is
// actually bookable, and the day builder needs the latter. A UI can
// generate windows from a recurring rule without this module needing
// to know about recurrence.

function addAvailability(store, options = {}) {
  const { providerId, startsAt, endsAt } = options;
  const profile = requireProvider(store, providerId, 'addAvailability');

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new ProviderError('addAvailability requires numeric startsAt and endsAt timestamps');
  }
  if (endsAt <= startsAt) throw new ProviderError('addAvailability requires endsAt after startsAt');

  // Overlapping windows would let the day builder double-book the same
  // hour against itself, which is a bug that only shows up as a
  // provider being sent to two places at once.
  const overlap = profile.availability.find((w) => startsAt < w.endsAt && endsAt > w.startsAt);
  if (overlap) {
    throw new ProviderError(
      `addAvailability: window overlaps an existing one (${overlap.startsAt}-${overlap.endsAt})`,
    );
  }

  const window = { startsAt, endsAt };
  profile.availability.push(window);
  profile.availability.sort((a, b) => a.startsAt - b.startsAt);
  return window;
}

function listProvidersForVertical(store, verticalId) {
  assertValidVertical(verticalId, 'listProvidersForVertical');
  return store.providerProfiles.filter(
    (p) => canWorkVertical(store, p.providerId, verticalId).allowed,
  );
}

// What a provider can actually earn from, which is the answer to
// "what should this person's app home screen show."
function describeProviderCapabilities(store, providerId) {
  const profile = requireProvider(store, providerId, 'describeProviderCapabilities');
  return {
    providerId,
    displayName: profile.displayName,
    providerType: profile.providerType,
    businessName: profile.businessName,
    crewSize: profile.crewSize,
    serviceRadiusKm: profile.serviceRadiusKm,
    workable: profile.skills
      .filter((s) => canWorkVertical(store, providerId, s.verticalId).allowed)
      .map((s) => ({
        verticalId: s.verticalId,
        name: VERTICALS[s.verticalId].name,
        pricingUnit: VERTICALS[s.verticalId].pricingUnit,
        status: s.status,
      })),
    blocked: profile.skills
      .filter((s) => !canWorkVertical(store, providerId, s.verticalId).allowed)
      .map((s) => ({
        verticalId: s.verticalId,
        name: VERTICALS[s.verticalId].name,
        reason: canWorkVertical(store, providerId, s.verticalId).reason,
      })),
    availabilityWindows: profile.availability.length,
  };
}

module.exports = {
  PROVIDER_TYPES,
  SKILL_STATUSES,
  DEFAULT_MAX_CREW_SIZE,
  DEFAULT_SERVICE_RADIUS_KM,
  ProviderError,
  registerProvider,
  getProvider,
  requireProvider,
  addSkill,
  verifySkill,
  suspendSkill,
  canWorkVertical,
  addAvailability,
  listProvidersForVertical,
  describeProviderCapabilities,
};
