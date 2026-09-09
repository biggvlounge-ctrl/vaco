// VOID — Service Marketplace Verticals registry.
// Source of truth: VOID_SERVICE_VERTICALS_COMPARABLES.md. Five
// verticals (Transportation, Pets, Laundry, Cleaning/Handyman, Beauty)
// are deep-researched with real per-vertical numbers; the remaining
// verticals use the doc's own explicitly-authorized fallback: a
// consistent ~20% platform take rate (validated in the doc as
// matching Rover's real rate and beating Thumbtack's worker-hostile
// pay-per-lead model), applied to each vertical's real pricing unit,
// with named real comparables. Every number below traces to a real
// figure or an explicit fallback stated in the source doc -- none are
// invented from nothing.
//
// `pricingUnit` values: `hourly`, `per-job` (flat per-appointment/
// per-session/per-project), `per-trip`, `flat-quote` (project/volume-
// based quote), `per-pound` (Laundry's real, distinct unit). The
// actual price math is identical regardless of label -- `quantity *
// unitPrice` -- matching the doc's own "same underlying structure,
// not 24 unrelated pricing schemes" framing.

const PRICING_UNITS = ['hourly', 'per-job', 'per-trip', 'flat-quote', 'per-pound'];

const VERTICALS = {
  transportation: { name: 'Transportation', pricingUnit: 'per-trip', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  petCare: { name: 'Pet Care', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  laundry: { name: 'Laundry', pricingUnit: 'per-pound', takeRate: 0.25, freePickupDelivery: true, licensingGated: false },
  cleaningHandyman: { name: 'Cleaning / Handyman', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  beauty: { name: 'Beauty', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  freelance: { name: 'Freelance', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  tutoring: { name: 'Tutoring', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  freightMoving: { name: 'Freight / Moving', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: true, licensingGated: false },
  staffing: { name: 'Staffing', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  security: { name: 'Security', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  landscaping: { name: 'Landscaping / Lawn Care', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  personalTraining: { name: 'Personal Training / Fitness', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  photography: { name: 'Photography', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  eventPlanning: { name: 'Event Planning', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  cannabisDelivery: { name: 'Cannabis Delivery', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: true, licensingGated: true },
  medicalTransportation: { name: 'Medical Transportation', pricingUnit: 'per-trip', takeRate: 0.20, freePickupDelivery: true, licensingGated: true },
  seniorCare: { name: 'Senior Care / Elder Care', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  childcare: { name: 'Childcare / Babysitting', pricingUnit: 'hourly', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  autoRepairDetailing: { name: 'Auto Repair / Detailing', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: true, licensingGated: false },
  notaryLegal: { name: 'Notary / Legal Documents', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  itTechSupport: { name: 'IT / Tech Support', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
  wasteRemoval: { name: 'Waste Removal / Junk Hauling', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: true, licensingGated: false },
  courier: { name: 'Courier / Same-day Delivery', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: true, licensingGated: false },
  // Named repeatedly in VOID_MASTER_FREEZE.md's Logistics section
  // ("Food & Goods: Restaurant delivery, grocery delivery") but never
  // given its own Service Marketplace registry entry -- three later
  // follow-up docs (Meituan's transparent-kitchen feature, Food-Capable
  // Stations' priority rule, this vertical itself) all assumed it
  // existed. Registered here to close that real gap, on the same
  // ~20%-take-rate fallback as every other non-deep-researched vertical.
  foodDelivery: { name: 'Food / Grocery Delivery', pricingUnit: 'per-job', takeRate: 0.20, freePickupDelivery: true, licensingGated: false },
  // Genuinely distinct from the generic `photography` vertical --
  // real proximity auto-assignment (HomeJab's model) and centralized
  // post-production are different mechanics, not the same thing under
  // a new name. See lib/realEstateMedia.js.
  realEstateMedia: { name: 'Real Estate Media', pricingUnit: 'flat-quote', takeRate: 0.20, freePickupDelivery: false, licensingGated: false },
};

function getVertical(verticalId) {
  return VERTICALS[verticalId] || null;
}

function listVerticals() {
  return Object.entries(VERTICALS).map(([id, v]) => ({ id, ...v }));
}

module.exports = { PRICING_UNITS, VERTICALS, getVertical, listVerticals };
