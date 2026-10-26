// VOKEN — the real wallet value, by direct instruction: "then we'll
// just use the algorithm and the data points to come up with a
// value. So when people get the cards, they will know how much their
// wallet is worth. Their Culture Card wallet is worth, how much their
// value is."
//
// Genuine code reuse, not a second pricing formula: this sums the
// exact real `marketPrice` `cardMarketPrice.js` already computes for
// every card the real `ownerId` holds at least one edition of --
// never re-derives a value independently. Owning three real editions
// of the same card counts that card's real price three times, the
// same real property holding three shares of the same stock position
// has.

const { computeCardMarketPrice } = require('./cardMarketPrice');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// A card nobody has ever scored (`peakValueScore` still null) is
// honestly priced at $0 here rather than guessed -- it still appears
// in `holdings` (the real ownership is a fact regardless), just with
// `marketPricePerEdition: null`, so a wallet never silently drops a
// real card it owns, it only ever reports what it genuinely doesn't
// know the price of yet.
function computeWalletValue(store, options = {}) {
  const { ownerId } = options;
  if (!ownerId) throw new Error('computeWalletValue requires an ownerId');

  const holdings = [];
  let totalValue = 0;

  for (const card of store.cultureCards) {
    const editionsOwned = card.editions.filter((e) => e.ownerId === ownerId).length;
    if (editionsOwned === 0) continue;

    if (card.peakValueScore === null) {
      holdings.push({ cardId: card.id, editionsOwned, marketPricePerEdition: null, holdingValue: 0 });
      continue;
    }

    const { marketPrice } = computeCardMarketPrice(store, { cardId: card.id });
    const holdingValue = round2(marketPrice * editionsOwned);
    totalValue += holdingValue;
    holdings.push({ cardId: card.id, editionsOwned, marketPricePerEdition: marketPrice, holdingValue });
  }

  return { ownerId, totalValue: round2(totalValue), holdings };
}

module.exports = { computeWalletValue };
