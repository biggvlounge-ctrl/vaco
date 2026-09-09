// VAGO -- shared, growing store object.
// Same pattern established across this session (world-layer/venvs/
// hvntz/void/voken): one factory whose shape grows by adding new
// top-level array/counter fields as each phase adds a module.

function createVagoStore() {
  return {
    // Gold Coin is a genuinely separate ledger from VCoin -- its own
    // object, never touched by any VCoin-moving code path.
    goldCoinBalances: {}, // userId -> number
    amoeEntries: [],
    nextAmoeEntryId: 1,
    casinoSessions: [],
    nextCasinoSessionId: 1,
    originalsRounds: [],
    nextOriginalsRoundId: 1,
    predictionMarkets: [],
    nextMarketId: 1,
    sportsEvents: [],
    sportsBets: [],
    nextSportsBetId: 1,
    esportsMatches: [],
    fantasyProps: [],
    nextFantasyPropId: 1,
    fantasyEntries: [],
    nextFantasyEntryId: 1,
  };
}

module.exports = { createVagoStore };
