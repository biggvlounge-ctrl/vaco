// VOKEN — recommended mint-count guidance by rarity tier, by direct
// instruction: "make sure we have the numbers correct. You have a
// correct number for how many physical cards. How many digital
// cards?"
//
// There is deliberately no single global "how many physical/digital
// cards total" number anywhere in this codebase — `plannedDigitalMintCount`
// and `plannedPhysicalMintCount` are set per card at mint time
// (`validateMintParams` in `lib/cultureCards.js`), the same
// "digital-first, physical-optional" real design `cardTypes.js`'s own
// header already documents, and the same real-world precedent actual
// trading cards follow (a 2024 base common and a numbered 1-of-1
// parallel from the same set have wildly different real print runs,
// not one fixed number for the whole product). No source doc gives
// exact figures, so — matching this codebase's own established
// discipline for every other unflagged number (`DEFAULT_CARDS_PER_PACK`
// in `lib/cardPacks.js`, the rarity/category label lists in
// `cardTypes.js`) — this is a real, deterministic, flagged
// *recommended default* an operator can use or override per card,
// never a hidden invented fact.
//
// **Grounded against the real scarcity curve already in
// `lib/valueAlgorithm.js`**, not picked independently: each tier's
// totals were chosen so `computeTraditionalScore`'s own
// `scarcityScore = 100 - log10(totalMintCount + 1) * 40` produces a
// real, meaningfully increasing scarcity premium from `epic` upward —
// `common`/`uncommon`/`rare` floor at 0 scarcity bonus (the same real
// property an actual base common trading card has: scarcity is not
// where its value comes from), while `legendary`, `mythic`, and
// `1-of-1` climb to a real, substantial scarcity premium, the
// mechanical reason a `1-of-1` card is scarce by construction rather
// than by claim.
const RECOMMENDED_MINT_COUNTS_BY_RARITY = {
  common: { plannedDigitalMintCount: 5000, plannedPhysicalMintCount: 500 },
  uncommon: { plannedDigitalMintCount: 2000, plannedPhysicalMintCount: 200 },
  rare: { plannedDigitalMintCount: 500, plannedPhysicalMintCount: 50 },
  epic: { plannedDigitalMintCount: 165, plannedPhysicalMintCount: 15 },
  legendary: { plannedDigitalMintCount: 60, plannedPhysicalMintCount: 10 },
  mythic: { plannedDigitalMintCount: 13, plannedPhysicalMintCount: 3 },
  '1-of-1': { plannedDigitalMintCount: 2, plannedPhysicalMintCount: 1 },
};

// A real, deterministic recommendation only -- every mint function in
// `lib/cultureCards.js` still requires the caller to pass its own
// `plannedDigitalMintCount`/`plannedPhysicalMintCount` explicitly, by
// the same "mint transparency, visible before you even apply" rule
// this whole module's own header above already states. This function
// never mints anything and is never consulted automatically -- it is
// only ever a real number an operator can look up before deciding.
function recommendedMintCountsFor(rarityTier) {
  const recommendation = RECOMMENDED_MINT_COUNTS_BY_RARITY[rarityTier];
  if (!recommendation) {
    throw new Error(`recommendedMintCountsFor: no recommendation for rarityTier "${rarityTier}" (expected one of ${Object.keys(RECOMMENDED_MINT_COUNTS_BY_RARITY).join(', ')})`);
  }
  return { rarityTier, ...recommendation };
}

module.exports = { RECOMMENDED_MINT_COUNTS_BY_RARITY, recommendedMintCountsFor };
