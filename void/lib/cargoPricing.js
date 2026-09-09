// VOID — Dynamic Cargo Pricing.
// Source of truth: VOID_MASTER_FREEZE.md: "V4 automatically prices
// oversized items, multiple large bags, bulky equipment, heavy
// packages, and special handling needs based on the declared load."
// No formula is given anywhere -- this is a real, deterministic,
// flagged, bounded formula (matching hvntz's adPricing.js pattern:
// invented but bounded, not unbounded), not a fake V4 AI call.

const BASE_OVERSIZED_ITEM_FEE = 5;
const WEIGHT_SURCHARGE_PER_LB_OVER_50 = 0.10;
const MAX_CARGO_FEE = 100;

function round(n) {
  return Math.round(n * 100) / 100;
}

function computeDynamicCargoPricing(declaration) {
  if (!declaration || !declaration.tripId) {
    throw new Error('computeDynamicCargoPricing requires a trip declaration (from declareTrip)');
  }
  const oversizedItemCount = declaration.oversizedItems.length;
  const totalWeightLbs = round(declaration.packages.reduce((sum, p) => sum + p.weightLbs, 0));

  const itemFee = round(oversizedItemCount * BASE_OVERSIZED_ITEM_FEE);
  const weightFee = round(Math.max(0, totalWeightLbs - 50) * WEIGHT_SURCHARGE_PER_LB_OVER_50);
  const totalFee = round(Math.min(MAX_CARGO_FEE, itemFee + weightFee));

  return { tripId: declaration.tripId, oversizedItemCount, totalWeightLbs, itemFee, weightFee, totalFee };
}

module.exports = { BASE_OVERSIZED_ITEM_FEE, WEIGHT_SURCHARGE_PER_LB_OVER_50, MAX_CARGO_FEE, computeDynamicCargoPricing };
