// HVNTZ — Tiered Location Participation.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "Tiered location
// participation — businesses aren't limited to their own hunt
// location": three real participation levels (own-hunt-location,
// paid-screen-presence / paid-hub-presence, hub-as-store), with
// revenue share scaling with how much a business pays.
//
// No exact fee-to-share formula is given anywhere in the source doc
// ("a larger percentage yields more screen time/priority" is
// qualitative, not quantified) -- REFERENCE_FEE_FOR_FULL_SHARE below
// is an interpretive, flagged constant: share scales linearly from 0
// to 100% as feesPaid approaches it, capped at 100%. hub-as-store
// requires reaching that same full-share threshold explicitly, since
// the doc describes it as "a high enough participation tier" unlocking
// full store-equivalent treatment -- read literally as the top of the
// same continuum, not a separate pricing model.

const { getBusiness, getLocation } = require('./revenueStack');

const PARTICIPATION_TYPES = ['own-hunt-location', 'paid-screen-presence', 'paid-hub-presence', 'hub-as-store'];
const REFERENCE_FEE_FOR_FULL_SHARE = 500;

function registerLocationParticipation(store, options = {}) {
  const { businessId, locationId, participationType, feesPaid = 0 } = options;

  if (!getBusiness(store, businessId)) {
    throw new Error(`registerLocationParticipation: no business with id ${businessId}`);
  }
  if (!getLocation(store, locationId)) {
    throw new Error(`registerLocationParticipation: no location with id ${locationId}`);
  }
  if (!PARTICIPATION_TYPES.includes(participationType)) {
    throw new Error(
      `registerLocationParticipation: invalid participationType "${participationType}" (expected one of ${PARTICIPATION_TYPES.join(', ')})`
    );
  }

  let scanRevenueShare;
  let dtcRevenueShare;

  if (participationType === 'own-hunt-location') {
    scanRevenueShare = 1;
    dtcRevenueShare = 1;
  } else if (participationType === 'hub-as-store') {
    if (!Number.isFinite(feesPaid) || feesPaid < REFERENCE_FEE_FOR_FULL_SHARE) {
      throw new Error(
        `registerLocationParticipation: hub-as-store requires feesPaid >= ${REFERENCE_FEE_FOR_FULL_SHARE} ("a high enough participation tier")`
      );
    }
    scanRevenueShare = 1;
    dtcRevenueShare = 1;
  } else {
    // paid-screen-presence | paid-hub-presence
    if (!Number.isFinite(feesPaid) || feesPaid <= 0) {
      throw new Error(`registerLocationParticipation: ${participationType} requires a positive feesPaid`);
    }
    const share = Math.round(Math.min(1, feesPaid / REFERENCE_FEE_FOR_FULL_SHARE) * 100) / 100;
    scanRevenueShare = share;
    dtcRevenueShare = share;
  }

  const participation = {
    id: store.nextParticipationId++,
    businessId,
    locationId,
    participationType,
    feesPaid,
    scanRevenueShare,
    dtcRevenueShare,
    createdAt: Date.now(),
  };
  store.participations.push(participation);
  return participation;
}

function getParticipations(store, businessId) {
  return store.participations.filter((p) => p.businessId === businessId);
}

module.exports = {
  PARTICIPATION_TYPES,
  REFERENCE_FEE_FOR_FULL_SHARE,
  registerLocationParticipation,
  getParticipations,
};
