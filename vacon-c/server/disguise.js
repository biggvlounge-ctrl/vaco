// server/disguise.js
//
// A real disguise — masks, wigs, a change of clothing — by direct
// instruction: "disguise / notoriety-reduction mechanic." Read
// `policing.js#evasionOf`'s own header first: it already reads
// Stealth/Deception/Black Market Ties/Heat Tolerance as "skills at not
// being caught" — innate ability, never a situational choice. A
// disguise is the situational half that was missing: the same skilled
// thief is harder to pin down wearing one than not, and an unskilled
// person in a good mask can still throw off an identification.
//
// ---------------------------------------------------------------------
// Named items, not a category check
// ---------------------------------------------------------------------
// `inventory.hasEquippedCategory(..., 'clothing')` would also match
// `salvage.js`'s own `woven_garment` — ordinary clothing, not a
// disguise — the same mistake `weapons.js`'s own header already warns
// against for `'protection'` catching a `shield`. `DISGUISE_ITEM_NAMES`
// is the named list, the same shape `weapons.FIREARM_NAMES` already
// takes.
//
// ---------------------------------------------------------------------
// Where this actually lands: evasionOf, not a second confidence model
// ---------------------------------------------------------------------
// `crime.js#recordCrime`'s victim- and bystander-witness confidence,
// and `policing.js#clearanceChance`'s own evasion factor, both already
// read `policing.evasionOf` for the one real "how hard is this person
// to pin down" number. A disguise bonus added there reaches every real
// consumer of that number for free — the victim's own knowledge-write,
// the bystander-witness write task #35 added, AND clearance chance —
// rather than three separate checks for the same situational fact.
//
// `DISGUISE_EVASION_BONUS = 0.2`, flagged interpretive the same honesty
// `policing.VICTIM_BONUS`/`WITNESS_BONUS` already carry — no document
// gives a mask its own number. Set to the same magnitude as
// `VICTIM_BONUS`, in the opposite direction: a real disguise should
// matter about as much as a direct witness matters, not swamp every
// other term in the same computation.

'use strict';

const inventory = require('./inventory.js');

// `mask`/`wig` are real, craftable salvage.js PRODUCTS — that file
// knows how to build one, this file knows what wearing one means,
// the same split `zip_gun` already has between salvage.js and
// weapons.js. No second registration here.
const DISGUISE_ITEM_NAMES = ['mask', 'wig'];

const DISGUISE_EVASION_BONUS = 0.2;

// Equipped, not merely held — a mask in a bag disguises nobody, the
// same real distinction `weapons.equippedFirearm` already draws.
function isDisguised(worldState, entityId) {
  return inventory.equippedItems(worldState, entityId)
    .some((h) => DISGUISE_ITEM_NAMES.includes(h.item_name));
}

module.exports = {
  DISGUISE_ITEM_NAMES,
  DISGUISE_EVASION_BONUS,
  isDisguised,
};
