// HVNTZ — DREA placement rules + flagging.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "Real, important
// constraint: avoid direct competitor conflicts" and "Flagging system
// — human-in-the-loop for borderline cases, and business-initiated
// review." DREA itself (the actual AI matching agent) isn't built
// here -- this is the deterministic, real, testable enforcement layer
// underneath it: given a rule, does a specific seller/category
// violate it, and the flag workflow for borderline/owner-raised cases.

const MATCHING_BASES = ['contextual-relevance', 'exclusivity-agreement'];
const FLAG_SOURCES = ['drea-borderline-detection', 'business-owner-initiated'];
const FLAG_STATUSES = ['pending-review', 'confirmed-no-conflict', 'ad-removed'];

function setPlacementRule(store, options = {}) {
  const {
    businessId,
    venueId,
    excludedCompetitorCategories = [],
    excludedSpecificSellers = [],
    matchingBasis = 'contextual-relevance',
  } = options;

  if (!businessId) {
    throw new Error('setPlacementRule requires a businessId');
  }
  if (!venueId) {
    throw new Error('setPlacementRule requires a venueId');
  }
  if (!MATCHING_BASES.includes(matchingBasis)) {
    throw new Error(`setPlacementRule: invalid matchingBasis "${matchingBasis}" (expected one of ${MATCHING_BASES.join(', ')})`);
  }

  const existing = store.placementRules.find((r) => r.venueId === venueId);
  const rule = { businessId, venueId, excludedCompetitorCategories, excludedSpecificSellers, matchingBasis };
  if (existing) {
    Object.assign(existing, rule);
    return existing;
  }
  store.placementRules.push(rule);
  return rule;
}

function getPlacementRule(store, venueId) {
  return store.placementRules.find((r) => r.venueId === venueId) || null;
}

// The actual enforcement check: does this seller/category violate the
// venue's exclusion rule?
function checkPlacementAllowed(store, options = {}) {
  const { venueId, sellerId, sellerCategory } = options;
  const rule = getPlacementRule(store, venueId);
  if (!rule) {
    return { allowed: true, reason: null };
  }
  if (sellerId && rule.excludedSpecificSellers.includes(sellerId)) {
    return { allowed: false, reason: `sellerId ${sellerId} is a direct competitor excluded from venue ${venueId}` };
  }
  if (sellerCategory && rule.excludedCompetitorCategories.includes(sellerCategory)) {
    return { allowed: false, reason: `category "${sellerCategory}" is excluded from venue ${venueId}` };
  }
  return { allowed: true, reason: null };
}

function flagPlacement(store, options = {}) {
  const { venueId, adId, flagSource, flagReason, notifiedBusinessId } = options;
  if (!venueId || !adId) {
    throw new Error('flagPlacement requires venueId and adId');
  }
  if (!FLAG_SOURCES.includes(flagSource)) {
    throw new Error(`flagPlacement: invalid flagSource "${flagSource}" (expected one of ${FLAG_SOURCES.join(', ')})`);
  }
  if (!flagReason) {
    throw new Error('flagPlacement requires a flagReason');
  }
  const flag = {
    id: store.nextFlagId++,
    venueId,
    adId,
    flagSource,
    flagReason,
    status: 'pending-review',
    notifiedBusinessId: notifiedBusinessId || null,
    resolvedAt: null,
  };
  store.placementFlags.push(flag);
  return flag;
}

function getFlag(store, flagId) {
  return store.placementFlags.find((f) => f.id === flagId) || null;
}

function resolveFlag(store, flagId, resolutionStatus) {
  const flag = getFlag(store, flagId);
  if (!flag) {
    throw new Error(`resolveFlag: no flag with id ${flagId}`);
  }
  if (flag.status !== 'pending-review') {
    throw new Error(`resolveFlag: flag ${flagId} is already resolved (${flag.status})`);
  }
  if (!['confirmed-no-conflict', 'ad-removed'].includes(resolutionStatus)) {
    throw new Error(`resolveFlag: invalid resolutionStatus "${resolutionStatus}" (expected confirmed-no-conflict or ad-removed)`);
  }
  flag.status = resolutionStatus;
  flag.resolvedAt = Date.now();
  return flag;
}

function getFlagsForVenue(store, venueId, options = {}) {
  const { status } = options;
  return store.placementFlags.filter((f) => f.venueId === venueId && (status ? f.status === status : true));
}

module.exports = {
  MATCHING_BASES,
  FLAG_SOURCES,
  FLAG_STATUSES,
  setPlacementRule,
  getPlacementRule,
  checkPlacementAllowed,
  flagPlacement,
  getFlag,
  resolveFlag,
  getFlagsForVenue,
};
