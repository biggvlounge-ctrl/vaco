// VOKEN — Sell Back: instant buyback for Cvltvre Card editions.
// Source of truth: this session's PrizePicks "Packs" competitive
// research (their real, shipped feature, 21 Oct 2026) — it pays 100%
// of a pulled card's fair market value instantly, credited to the
// same balance that funds their core product, with no peer-to-peer
// secondary market required. VOKEN has pack-opening (cardPacks.js)
// and a real 0-100 desirability score (valueAlgorithm.js) but nothing
// converts that score into a dollar amount, and nothing lets a buyer
// convert a pulled card back into VCoin without finding a real buyer
// first. This module is that missing piece.
//
// **Honest gap this closes, and the one thing it deliberately does
// not invent**: no real per-edition purchase price or market-listing
// price exists anywhere in this codebase (confirmed against
// cultureCards.js, trading.js, auctions.js, fractionalOwnership.js,
// limitedEditionMerch.js) — auctions and fractional listings are the
// only real price signals, and they're per-listing, not per-card.
// Rather than retroactively inventing a purchase-price field, the
// fair market value here is computed the same way
// valueAlgorithm.js's own header already establishes as this
// project's convention for a number with "no exact formula given
// anywhere": a real, deterministic, bounded dollar range keyed to the
// card's real rarityTier (cardTypes.js's RARITY_TIERS), scaled within
// that range by the card's existing combinedRealValueScore (0-100,
// valueAlgorithm.js) — a card already scored as highly desirable
// sells back for more than a middling one of the same rarity, the
// same way the live market would price it. `combinedRealValueScore`
// is a required input here, not recomputed — same posture
// valueAlgorithm.js itself takes ("this module never fetches
// anything, on purpose"); the caller runs the real scoring (e.g. the
// existing `/api/card/:id/value-score` endpoint) and hands the result
// in.
//
// **The one calibration decision this module cannot make for
// itself, flagged rather than silently assumed**: pack price
// (cardPacks.js's packTier.price) and sell-back value are set in two
// different places. If a tier's dollar range is set higher than what
// its packs actually cost, opening and instantly selling back becomes
// a real money-printing exploit — the same risk every loot-box
// product with a cash-out carries. Calibrating SELLBACK_VALUE_RANGES
// against real catalog prices is a business decision for whoever sets
// createPackTier's price, not something this module can verify on its
// own — it only guarantees the range is fixed, bounded, and the same
// for every card of a given rarity, never invented per-call.
//
// **Claim before pay, same shape as auctions.js's settle() and
// settleOnce.js's own header.** The edition's ownership moves to the
// platform (VOKEN_PLATFORM_ACCOUNT, the same account pack-open
// proceeds already flow to) BEFORE the payout settles — the claim
// happens synchronously, before the first await, so a concurrent
// second sell-back of the same edition sees it already owned by the
// platform and is refused outright rather than racing to also get
// paid. A failed payout restores the edition to the seller: a seller
// paid nothing must never also lose the card.

const { RARITY_TIERS } = require('./cardTypes');
const { getCultureCard } = require('./cultureCards');
const { VOKEN_PLATFORM_ACCOUNT } = require('./platformAccount');
const { settleOnce } = require('./settleOnce');

// Flagged, interpretive dollar ranges (VCoin units) per rarity tier —
// see header. Common/uncommon sit at or below the pack prices this
// app's own tests already use (a basic pack prices at 10, a standard
// at 40); legendary/mythic/1-of-1 echo PrizePicks' own real "Grail"
// framing (a rare, very-high-value hit, reachable from any tier)
// without copying their number.
const SELLBACK_VALUE_RANGES = {
  common: [1, 5],
  uncommon: [3, 12],
  rare: [10, 40],
  epic: [30, 150],
  legendary: [100, 750],
  mythic: [500, 5000],
  '1-of-1': [2500, 50000],
};

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// A card already scored high by valueAlgorithm.js within its own
// rarity tier sells back for more than a middling one of the same
// tier — linear interpolation across the tier's flagged range.
function computeSellBackValue(options = {}) {
  const { rarityTier, combinedRealValueScore } = options;
  if (!RARITY_TIERS.includes(rarityTier)) {
    throw new Error(`computeSellBackValue: invalid rarityTier "${rarityTier}" (expected one of ${RARITY_TIERS.join(', ')})`);
  }
  if (!Number.isFinite(combinedRealValueScore) || combinedRealValueScore < 0 || combinedRealValueScore > 100) {
    throw new Error('computeSellBackValue requires a combinedRealValueScore between 0 and 100');
  }

  const [min, max] = SELLBACK_VALUE_RANGES[rarityTier];
  const fairMarketValue = round(clamp(min + (max - min) * (combinedRealValueScore / 100), min, max));
  return { rarityTier, combinedRealValueScore, range: { min, max }, fairMarketValue };
}

async function sellBackCard(store, options = {}) {
  const { cardId, editionNumber, format, sellerId, combinedRealValueScore, settleFn } = options;

  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`sellBackCard: no card with id ${cardId}`);
  if (!sellerId) throw new Error('sellBackCard requires a sellerId');
  if (typeof settleFn !== 'function') throw new Error('sellBackCard requires a settleFn(legs, meta)');

  const edition = card.editions.find((e) => e.editionNumber === editionNumber && e.format === format);
  if (!edition) throw new Error(`sellBackCard: no ${format} edition #${editionNumber} on card ${cardId}`);
  // Real ownership check up front, against the edition's current
  // owner — never trusted from a stale claim, and the same check that
  // closes the concurrent-double-sell-back race once the claim below
  // flips it to the platform.
  if (edition.ownerId !== sellerId) {
    throw new Error(`sellBackCard: edition ${format} #${editionNumber} of card ${cardId} is not owned by ${sellerId}`);
  }

  const { fairMarketValue } = computeSellBackValue({ rarityTier: card.rarityTier, combinedRealValueScore });

  // Keyed by cardId + editionNumber + format + a per-sell-back nonce,
  // the same shape as cardPacks.js's packOpenId: the same edition
  // could in principle be sold back, re-acquired through a later
  // resale, and sold back again — a genuinely different settlement
  // each time, which a key missing the nonce would collide on.
  const sellBackId = store.nextSellBackId++;
  const reason = `voken_sellback:${cardId}:${editionNumber}:${format}:${sellBackId}`;

  return settleOnce(edition, { ownerId: VOKEN_PLATFORM_ACCOUNT, soldBackAt: Date.now() }, async () => {
    await settleFn(
      [{ fromUserId: VOKEN_PLATFORM_ACCOUNT, toUserId: sellerId, amount: fairMarketValue, reason }],
      { reason },
    );
    card.provenance.push({ year: new Date().getFullYear(), event: `sold-back-${format}-${editionNumber}`, ownerId: VOKEN_PLATFORM_ACCOUNT });
    return { cardId, editionNumber, format, sellerId, fairMarketValue, sellBackId };
  });
}

module.exports = {
  SELLBACK_VALUE_RANGES,
  computeSellBackValue,
  sellBackCard,
};
