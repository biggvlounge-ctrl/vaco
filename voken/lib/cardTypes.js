// VOKEN — Cvltvre Card type constants.
// Source of truth: VOKEN_MASTER_SPEC_PROGRESS.md. The doc is explicit
// that the exact real category/rarity label strings weren't
// recoverable from the source transcript -- these are reasonable,
// flagged placeholders grounded in VOKEN's own "what VOKEN is" text
// and the real design tokens (which confirm distinct "mythic" and
// "1/1" foil tiers beyond a base system), NOT confirmed final labels.
// Replace both lists the moment the real ones are available.

const CATEGORIES = [
  'vehicles', 'property', 'music', 'art', 'creatorMemberships',
  'digitalWearables', 'businessLoyalty', 'eventMoments', 'landmarks', 'collectibles',
];

const RARITY_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', '1-of-1'];

// Real, per VOKEN_NEW_VALUE_ALGORITHM.md's "digital-first, physical-
// optional" confirmation -- digital is the default form, physical a
// real optional add-on, the reverse of the traditional card industry.
const TOKENIZATION_TYPES = ['physical', 'digital', 'tokenized', 'avatar'];
const FORMATS = ['physical', 'digital', 'tokenized', 'avatar'];

module.exports = { CATEGORIES, RARITY_TIERS, TOKENIZATION_TYPES, FORMATS };
