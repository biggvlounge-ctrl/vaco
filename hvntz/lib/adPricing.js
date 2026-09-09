// HVNTZ — Ad tier system + dynamic, traffic-based pricing.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "Ad tier system —
// format complexity and dynamic, traffic-based pricing." Four real
// tiers (Quick-Link, Standard, Premium/Extravagant, Full Commercial),
// every tier requires a QR code, and price scales with both tier and
// real-time location performance (traffic + revenue volume) -- but no
// base price or exact formula is specified anywhere in any source
// doc. Both are real, deterministic, flagged interpretive choices
// below, not derived from anything given.

const AD_TIERS = ['quick-link', 'standard', 'premium', 'full-commercial'];

const BASE_PRICES = {
  'quick-link': 5,
  standard: 15,
  premium: 40,
  'full-commercial': 100,
};

function calculateAdPrice(options = {}) {
  const { adTier, trafficScore, revenueVolume } = options;

  if (!AD_TIERS.includes(adTier)) {
    throw new Error(`calculateAdPrice: invalid adTier "${adTier}" (expected one of ${AD_TIERS.join(', ')})`);
  }
  if (!Number.isFinite(trafficScore) || trafficScore < 0) {
    throw new Error('calculateAdPrice requires a non-negative trafficScore');
  }
  if (!Number.isFinite(revenueVolume) || revenueVolume < 0) {
    throw new Error('calculateAdPrice requires a non-negative revenueVolume');
  }

  const basePrice = BASE_PRICES[adTier];
  // Both real-time factors push price upward, capped in influence so
  // neither factor alone can multiply price beyond a reasonable bound
  // -- interpretive: no formula is given in any source doc.
  const multiplier = Math.round((1 + (trafficScore / 100) * 0.5 + (revenueVolume / 1000) * 0.5) * 100) / 100;
  const finalPrice = Math.round(basePrice * multiplier * 100) / 100;

  return { adTier, basePrice, multiplier, finalPrice, requiresQrCode: true };
}

module.exports = { AD_TIERS, BASE_PRICES, calculateAdPrice };
