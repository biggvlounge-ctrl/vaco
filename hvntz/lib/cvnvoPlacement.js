// HVNTZ — CVNVO date-location algorithm placement.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, stream #10: "a
// business can opt in to be surfaced as a suggested date location
// within CVNVO... a higher package tier costs more but pushes the
// business into the algorithm more prominently."
//
// No package tier names or exact boost values are specified anywhere
// -- both are real, flagged, interpretive choices below.

const PACKAGE_TIERS = ['basic', 'standard', 'premium'];
const VISIBILITY_BOOST_BY_TIER = { basic: 1, standard: 2, premium: 4 };

function setCvnvoPlacement(store, options = {}) {
  const { businessId, packageTier } = options;
  if (!businessId) {
    throw new Error('setCvnvoPlacement requires a businessId');
  }
  if (!PACKAGE_TIERS.includes(packageTier)) {
    throw new Error(`setCvnvoPlacement: invalid packageTier "${packageTier}" (expected one of ${PACKAGE_TIERS.join(', ')})`);
  }

  const algorithmVisibilityBoost = VISIBILITY_BOOST_BY_TIER[packageTier];
  const existing = store.cvnvoPlacements.find((p) => p.businessId === businessId);
  if (existing) {
    existing.packageTier = packageTier;
    existing.algorithmVisibilityBoost = algorithmVisibilityBoost;
    return existing;
  }
  const placement = { businessId, packageTier, algorithmVisibilityBoost };
  store.cvnvoPlacements.push(placement);
  return placement;
}

function getCvnvoPlacement(store, businessId) {
  return store.cvnvoPlacements.find((p) => p.businessId === businessId) || null;
}

module.exports = { PACKAGE_TIERS, VISIBILITY_BOOST_BY_TIER, setCvnvoPlacement, getCvnvoPlacement };
