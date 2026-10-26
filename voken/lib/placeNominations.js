// VOKEN — real community place nominations, by direct instruction:
// "we will do a lot of the places ourselves. And then we will let
// people nominate places as well." `historicRegistry.js`'s own fixed
// `HISTORIC_REGISTRY` stays exactly what it is -- a code-reviewed,
// hand-curated set of facts this repository itself vouches for. A
// community nomination is a different real thing: a third party
// proposing a NEW real place, with no vetting at all yet, so it is
// never auto-added the same way a self-initiated application score
// can self-qualify -- the same real discipline
// `cultureCardApplication.js`'s own `community-nomination` path
// already established for a person being nominated by someone else.
// An approved nomination becomes a real, store-backed historic entry
// -- extending the historic register at runtime, without a code
// deploy, while the original fixed register in `historicRegistry.js`
// stays untouched and still the only source `getHistoricEntry()`
// itself ever reads from.
//
// Scoped to real physical places only (`place`/`monument`/`home`) --
// the three subject types the user actually named ("places...
// monuments... churches... the Vatican's"). A `person`/`invention`/
// `book` nomination already has its own real path
// (`community-nomination` in `cultureCardApplication.js`, or the
// fixed register directly) and is refused here.

const { HISTORIC_SUBJECT_TYPES } = require('./historicRegistry');

const NOMINABLE_SUBJECT_TYPES = ['place', 'monument', 'home'];
const PLACE_NOMINATION_STATUSES = ['pending-review', 'approved', 'declined'];

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function submitPlaceNomination(store, options = {}) {
  const {
    nominatorId, subjectType, name, era, earliestYear, summary, recognitions = [],
  } = options;
  if (!nominatorId) throw new Error('submitPlaceNomination requires a nominatorId');
  if (!NOMINABLE_SUBJECT_TYPES.includes(subjectType)) {
    throw new Error(`submitPlaceNomination: invalid subjectType "${subjectType}" (expected one of ${NOMINABLE_SUBJECT_TYPES.join(', ')})`);
  }
  if (!name) throw new Error('submitPlaceNomination requires a name');
  if (!era) throw new Error('submitPlaceNomination requires an era');
  if (!Number.isInteger(earliestYear)) throw new Error('submitPlaceNomination requires an integer earliestYear');
  if (!summary) throw new Error('submitPlaceNomination requires a summary');
  if (!Array.isArray(recognitions)) throw new Error('submitPlaceNomination requires recognitions to be an array');

  const slug = slugify(name);
  if (!slug) throw new Error('submitPlaceNomination: name must produce a real, non-empty slug');

  const nomination = {
    nominationId: store.nextPlaceNominationId++,
    nominatorId,
    slug,
    subjectType,
    name,
    era,
    earliestYear,
    summary,
    recognitions,
    status: 'pending-review',
    reviewedBy: null,
    reviewReason: null,
    createdAt: Date.now(),
  };
  store.placeNominations.push(nomination);
  return nomination;
}

function getPlaceNomination(store, nominationId) {
  return store.placeNominations.find((n) => n.nominationId === nominationId) || null;
}

// The real, required operator decision -- see this file's own header
// for why a nomination is never auto-added. Refuses a slug collision
// against either the fixed register or an already-approved
// nomination, so "the Vatican" can't end up approved twice under two
// different nominationIds.
function reviewPlaceNomination(store, options = {}) {
  const { nominationId, approved, operatorName, reason = null } = options;
  const nomination = getPlaceNomination(store, nominationId);
  if (!nomination) throw new Error(`reviewPlaceNomination: no nomination with id ${nominationId}`);
  if (nomination.status !== 'pending-review') {
    throw new Error(`reviewPlaceNomination: nomination ${nominationId} is "${nomination.status}", not pending-review`);
  }
  if (typeof approved !== 'boolean') throw new Error('reviewPlaceNomination requires a boolean approved');
  if (!operatorName) throw new Error('reviewPlaceNomination requires an operatorName');

  if (approved) {
    const { getHistoricEntry } = require('./historicRegistry');
    if (getHistoricEntry(nomination.slug)) {
      throw new Error(`reviewPlaceNomination: "${nomination.slug}" already exists in the fixed historic register`);
    }
    const existingApproved = store.placeNominations.find((n) => n.slug === nomination.slug && n.status === 'approved');
    if (existingApproved) {
      throw new Error(`reviewPlaceNomination: "${nomination.slug}" was already approved by nomination ${existingApproved.nominationId}`);
    }
  }

  nomination.status = approved ? 'approved' : 'declined';
  nomination.reviewedBy = operatorName;
  nomination.reviewReason = reason;
  return nomination;
}

// The real, runtime-extensible lookup `mintHistoricCard()` falls back
// to when a slug isn't in the fixed register -- shaped identically to
// a `historicRegistry.js` entry, so every downstream consumer
// (`mintHistoricCard`, scoring) can treat it the same way.
function getApprovedCustomHistoricEntry(store, slug) {
  const nomination = store.placeNominations.find((n) => n.slug === slug && n.status === 'approved');
  if (!nomination) return null;
  const {
    slug: entrySlug, subjectType, name, era, earliestYear, summary, recognitions,
  } = nomination;
  return { slug: entrySlug, subjectType, name, era, earliestYear, summary, recognitions };
}

function listApprovedCustomHistoricEntries(store, subjectType = null) {
  if (subjectType !== null && !HISTORIC_SUBJECT_TYPES.includes(subjectType)) {
    throw new Error(`listApprovedCustomHistoricEntries: invalid subjectType "${subjectType}" (expected one of ${HISTORIC_SUBJECT_TYPES.join(', ')})`);
  }
  return store.placeNominations
    .filter((n) => n.status === 'approved' && (!subjectType || n.subjectType === subjectType))
    .map((n) => getApprovedCustomHistoricEntry(store, n.slug));
}

// The same real `genuineSignificanceInputsFor()` math `historicRegistry.js`
// uses, applied to a real, approved community-nominated place -- kept
// as its own function rather than reaching into `historicRegistry.js`
// (which stays a pure function of the fixed register alone, with no
// knowledge of the store) to avoid a real module coupling neither
// side needs.
function genuineSignificanceInputsForCustomEntry(store, slug, options = {}) {
  const { now = Date.now() } = options;
  const entry = getApprovedCustomHistoricEntry(store, slug);
  if (!entry) throw new Error(`genuineSignificanceInputsForCustomEntry: no approved custom historic entry "${slug}"`);

  const currentYear = new Date(now).getFullYear();
  return {
    longevityOfImpactYears: currentYear - entry.earliestYear,
    institutionalRecognitionCount: entry.recognitions.length,
    documentedHistoricalImpact: true,
  };
}

module.exports = {
  NOMINABLE_SUBJECT_TYPES,
  PLACE_NOMINATION_STATUSES,
  submitPlaceNomination,
  getPlaceNomination,
  reviewPlaceNomination,
  getApprovedCustomHistoricEntry,
  listApprovedCustomHistoricEntries,
  genuineSignificanceInputsForCustomEntry,
};
