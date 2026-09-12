// VAGO -- Sportsbook (house-set odds, VCoin only).
// Source of truth: VAGO_ARCHITECTURE.md's `SportsBet { id, eventId,
// odds, userId, stakeVCoin }` and `POST /vago/sports/:eventId/bet --
// place a house-odds bet (VCoin only)`. VAGO_COMPARABLES.md is
// explicit that this is structurally the opposite mechanic from
// Kalshi's peer-to-peer contracts: a traditional bookmaker, house-set
// odds, not priced by the market -- deliberately a different real
// mechanic from `predictionMarkets.js`, not a re-skin of it.
//
// Real, standard American odds format and payout math (negative =
// favorite, positive = underdog) -- not invented, the same formula
// every real US sportsbook (DraftKings, FanDuel) uses. Odds are
// locked in at the moment a bet is placed, per how real sportsbooks
// actually work -- a bet's payout never changes even if the posted
// line moves afterward, unlike `predictionMarkets.js`'s live-price
// contracts. Settlement pays directly from the house account (the
// same real, injected `settleFn` pattern as every other module this
// session) -- real bookmakers manage risk via balanced odds/vig and
// capitalization, not a segregated per-bet pool, so no pari-mutuel
// pooling is used here (unlike predictions/esports staking, which
// genuinely need it).

const { VAGO_HOUSE_ACCOUNT } = require('./casinoSession');
const { settleOnce } = require('./settleOnce');

const SPORTS_EVENT_STATUSES = ['open', 'settled'];
const SPORTS_BET_STATUSES = ['pending', 'won', 'lost'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function isValidAmericanOdds(odds) {
  return Number.isInteger(odds) && (odds <= -100 || odds >= 100);
}

// Real American-odds payout math: a -150 favorite pays $100/$150
// staked in profit; a +130 underdog pays $130 profit per $100 staked.
function computeAmericanOddsPayout(odds, stake) {
  if (!isValidAmericanOdds(odds)) {
    throw new Error(`computeAmericanOddsPayout: invalid American odds "${odds}" (must be an integer <= -100 or >= 100)`);
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new Error('computeAmericanOddsPayout requires a positive stake');
  }
  const profit = odds < 0 ? round(stake * 100 / Math.abs(odds)) : round(stake * odds / 100);
  return { profit, totalPayout: round(stake + profit) };
}

// -- Odds as a percentage -------------------------------------------------
//
// **`-150` is opaque and `60%` is not**, and the two are the same
// statement. Every posted line already implies a probability; showing
// it is a display change, not a new mechanic, and it is most of what
// makes a Polymarket or Kalshi board readable at a glance.
//
// The standard conversions, not invented:
//   negative (favorite):  |odds| / (|odds| + 100)
//   positive (underdog):  100 / (odds + 100)
function impliedProbability(odds) {
  if (!isValidAmericanOdds(odds)) {
    throw new Error(`impliedProbability: invalid American odds "${odds}"`);
  }
  const p = odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
  return Math.round(p * 10000) / 10000;
}

// **These do not sum to 1, and saying so is the honest part.**
//
// A bookmaker's posted odds embed the vig, so the raw implied
// probabilities across an event's outcomes total *more* than 100% --
// that excess is the house margin. Showing raw numbers labelled
// "probability" would tell a user that a two-outcome game is 105%
// likely to happen, which is not a rounding artefact, it is the price
// of the book.
//
// So both are returned: `implied` as posted, and `fair` with the margin
// divided out proportionally (the standard multiplicative de-vig). A
// market seeded from a house line must use `fair`, because seeding with
// the vig baked in would open every market biased toward the favorite
// by the house's own margin.
function eventProbabilities(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    throw new Error('eventProbabilities requires at least 2 outcomes');
  }
  const implied = outcomes.map((o) => impliedProbability(o.odds));
  const overround = implied.reduce((sum, p) => sum + p, 0);
  return outcomes.map((o, i) => ({
    outcomeId: o.outcomeId,
    label: o.label,
    odds: o.odds,
    impliedProbability: implied[i],
    fairProbability: Math.round((implied[i] / overround) * 10000) / 10000,
  }));
}

// The house margin on an event, as a percentage. 0 would be a book with
// no edge, which no real bookmaker posts.
function eventOverround(outcomes) {
  const implied = outcomes.map((o) => impliedProbability(o.odds));
  const total = implied.reduce((sum, p) => sum + p, 0);
  return Math.round((total - 1) * 10000) / 10000;
}

function createSportsEvent(store, options = {}) {
  const { eventId, description, outcomes } = options;
  if (!eventId) throw new Error('createSportsEvent requires an eventId');
  if (store.sportsEvents.some((e) => e.eventId === eventId)) {
    throw new Error(`createSportsEvent: an event with id "${eventId}" already exists`);
  }
  if (!description) throw new Error('createSportsEvent requires a description');
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    throw new Error('createSportsEvent requires at least 2 outcomes');
  }
  for (const o of outcomes) {
    if (!o.outcomeId || !o.label) throw new Error('every outcome requires an outcomeId and a label');
    if (!isValidAmericanOdds(o.odds)) throw new Error(`createSportsEvent: invalid odds "${o.odds}" for outcome "${o.outcomeId}"`);
  }

  const event = { eventId, description, outcomes, status: 'open', winningOutcomeId: null, createdAt: Date.now() };
  store.sportsEvents.push(event);
  return event;
}

function getSportsEvent(store, eventId) {
  return store.sportsEvents.find((e) => e.eventId === eventId) || null;
}

async function placeSportsBet(store, options = {}) {
  const { eventId, outcomeId, userId, stakeVCoin, settleFn } = options;
  const event = getSportsEvent(store, eventId);
  if (!event) throw new Error(`placeSportsBet: no event with id ${eventId}`);
  if (event.status !== 'open') throw new Error(`placeSportsBet: event ${eventId} is not open (status: ${event.status})`);
  const outcome = event.outcomes.find((o) => o.outcomeId === outcomeId);
  if (!outcome) throw new Error(`placeSportsBet: no outcome "${outcomeId}" on event ${eventId}`);
  if (!userId) throw new Error('placeSportsBet requires a userId');
  if (!Number.isFinite(stakeVCoin) || stakeVCoin <= 0) throw new Error('placeSportsBet requires a positive stakeVCoin');
  if (typeof settleFn !== 'function') throw new Error('placeSportsBet requires a settleFn(legs, meta)');

  await settleFn(
    [{ fromUserId: userId, toUserId: VAGO_HOUSE_ACCOUNT, amount: stakeVCoin, reason: `vago_sports_bet:${eventId}` }],
    { reason: `vago_sports_bet:${eventId}` },
  );

  // Odds locked in at bet time -- the real, standard sportsbook rule.
  const { totalPayout } = computeAmericanOddsPayout(outcome.odds, stakeVCoin);
  const bet = {
    id: store.nextSportsBetId++, eventId, outcomeId, odds: outcome.odds, userId, stakeVCoin,
    potentialPayout: totalPayout, status: 'pending', createdAt: Date.now(),
  };
  store.sportsBets.push(bet);
  return bet;
}

function getSportsBet(store, betId) {
  return store.sportsBets.find((b) => b.id === betId) || null;
}

async function settleSportsEvent(store, options = {}) {
  const { eventId, winningOutcomeId, settleFn } = options;
  const event = getSportsEvent(store, eventId);
  if (!event) throw new Error(`settleSportsEvent: no event with id ${eventId}`);
  if (event.status !== 'open') throw new Error(`settleSportsEvent: event ${eventId} is not open (status: ${event.status})`);
  if (!event.outcomes.some((o) => o.outcomeId === winningOutcomeId)) {
    throw new Error(`settleSportsEvent: no outcome "${winningOutcomeId}" on event ${eventId}`);
  }
  if (typeof settleFn !== 'function') throw new Error('settleSportsEvent requires a settleFn(legs, meta)');

  const eventBets = store.sportsBets.filter((b) => b.eventId === eventId && b.status === 'pending');
  const settledBets = [];

  // **The widest window of any settlement here, and the worst to leave
  // open.** This pays in a loop with an await per winning bet, so the
  // gap between the status check above and the status write below grew
  // with the number of bets on the event. Five concurrent settlements
  // on a three-bet event paid 250.05 instead of 50.01.
  //
  // Claiming the event first closes it: the second caller sees
  // `settled` and throws before reaching the loop.
  await settleOnce(event, { status: 'settled', winningOutcomeId }, async () => {
    for (const bet of eventBets) {
      if (bet.outcomeId === winningOutcomeId) {
        await settleFn(
          [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: bet.userId, amount: bet.potentialPayout, reason: `vago_sports_payout:${eventId}` }],
          { reason: `vago_sports_payout:${eventId}` },
        );
        bet.status = 'won';
      } else {
        bet.status = 'lost';
      }
      settledBets.push(bet);
    }
  });
  return { event, settledBets };
}

module.exports = {
  SPORTS_EVENT_STATUSES,
  SPORTS_BET_STATUSES,
  isValidAmericanOdds,
  computeAmericanOddsPayout,
  impliedProbability,
  eventProbabilities,
  eventOverround,
  createSportsEvent,
  getSportsEvent,
  placeSportsBet,
  getSportsBet,
  settleSportsEvent,
};
