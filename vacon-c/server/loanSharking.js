// server/loanSharking.js
//
// Loan sharks and bookies — task #66 of "the next 5/10," closing a gap
// `occupations.js` has declared explicitly since it was written: "An
// illegal street-level bookie or loan shark outside a licensed casino
// has no real BLS code (illegal activity is not surveyed) and is
// deliberately NOT given one here -- that is a real, separate
// informal/criminal-economy mechanic, not an occupation, named rather
// than silently invented." This is that mechanic.
//
// ---------------------------------------------------------------------
// Who can run either role — the real anchor drugTrade.js already
// established for "street-level", reused rather than guessed twice
// ---------------------------------------------------------------------
// `drugTrade.gangOf`/`membership.gangTierFor` already answer "is this
// a real street-level operator of a real gang" for dealing drugs; loan
// sharking and unlicensed bookmaking are the identical real-world
// pairing (both historically run by the same organized-crime layer a
// street dealer sits in — DOJ/NGIC material drugTrade.js already cites
// groups "loansharking" and "illegal gambling" alongside narcotics as
// the same gang revenue streams), so this file reuses that exact check
// rather than inventing a second "who is criminal enough" gate.
// soldier/associate is the real floor drugTrade.js already drew for
// the identical reason, reused here unchanged.
//
// ---------------------------------------------------------------------
// Loan sharking — a real, widely-documented term, flagged the same way
// every other interpretive rate in this engine already is
// ---------------------------------------------------------------------
// "Six-for-five"/the vig is the real, widely-documented term for
// loan-shark interest in criminology and organized-crime literature —
// roughly 20% simple interest per week is the figure this term
// commonly refers to. No single peer-reviewed source gives one
// universal rate the way `crime.BASE_DEPRIVATION_RISK` is flagged
// interpretive; this is the identical posture, named as the shape of
// the model rather than presented as a precise, sourced constant.
// CLAUDE.md's own "a tick is a day" is why the weekly figure is
// divided by 7 for a per-tick accrual, rather than inventing a second
// time unit.
//
// ---------------------------------------------------------------------
// Collection and enforcement — reusing heat.js and crime.js directly,
// never a second violence mechanic
// ---------------------------------------------------------------------
// A borrower who can pay, pays, through the identical claim-before-pay
// `economy.generateIndividualFinances` pattern `casino.js`/
// `investments.js` already use. `individual_finances.debt` — real,
// already in the schema, already read by `economy.getNetWorth` — is
// exactly what an unpaid balance IS, so a partial payment leaves the
// honest remainder there rather than inventing a second ledger.
// A borrower who cannot fully pay is not strong-armed by a new
// mechanism: `heat.raiseHeat` puts them on the lender's own real
// gang's radar, and `crime.recordCrime` records the real enforcement
// violence under the `violent` category `crime.js`'s own CATEGORIES
// already enumerates ("aggression between two entities with standing
// conflict that escalates" — exactly what this is) — never a second,
// disagreeing violence resolver layered over `keys.resolveAggression`'s
// own calibrated one (the seventeenth standing rule's own warning,
// applied here before the mistake rather than after).
//
// ---------------------------------------------------------------------
// Street bookmaking — contest.js's own real ratings and odds, not a
// second invented game
// ---------------------------------------------------------------------
// A bookie takes bets on real contests, not an abstract casino game —
// `contest.rateEntity`/`contest.winProbability` already compute the
// real favourite/underdog probability `resolveContest` itself resolves
// a bout from, checked directly before reuse. `BOOKMAKER_VIG` is the
// real, commonly-cited "standard vig": American sports-betting odds of
// -110 on both sides of a two-way line imply a combined probability of
// 104.76%, and that 4.76% overround is the industry's own standard
// term for a bookmaker's built-in margin — reused here rather than
// inventing a second, disagreeing house edge the way `casino.js`
// already reuses roulette's own exact 2/38. No territory gate: unlike
// `extortion.js` (which specifically targets where the state's reach is
// weak), unlicensed street betting is a real phenomenon in heavily
// policed cities too — a transaction below the state's notice, not one
// that needs its absence — so gating this on `authority.writOf` would
// model a fact that is not true. No new crime category either: an
// unlicensed wager between two consenting parties has no real victim
// the way violent/property/theft/fraud do, and `crime.js`'s own
// CATEGORIES comment calls its vocabulary deliberate and fixed — this
// logs to its own `worldState.streetBetEvents`, the identical posture
// `casino.casinoWagerEvents` already holds for a licensed wager.

'use strict';

const economy = require('./economy.js');
const membership = require('./membership.js');
const drugTrade = require('./drugTrade.js');
const contest = require('./contest.js');
const heat = require('./heat.js');
const crime = require('./crime.js');
const worldStore = require('./worldStore.js');

const WEEKLY_VIG_RATE = 0.20;
const DAILY_VIG_RATE = WEEKLY_VIG_RATE / 7;

const BOOKMAKER_VIG = 0.0476;

let nextLoanId = 1;

// The real "is this person criminal enough to run either role" gate,
// shared by both halves of this file. Throws the identical shape
// `drugTrade.dealDrugs` already throws for the same real question.
function operatorGangFor(worldState, entityId) {
  const org = drugTrade.gangOf(worldState, entityId);
  if (!org) throw new Error(`loanSharking: entity ${entityId} is not a real member of any real gang.`);
  const tier = membership.gangTierFor(worldState, org.id, entityId, worldState.tick ?? 0);
  if (tier !== 'soldier' && tier !== 'associate') {
    throw new Error(`loanSharking: entity ${entityId}'s real gang tier (${tier}) does not operate street-level.`);
  }
  return org;
}

function savingsOf(worldState, entityId) {
  const finances = economy.getLatestFinances(worldState, entityId);
  return { finances, savings: Number(finances?.savings ?? 0) };
}

function moveSavings(worldState, entityId, newSavings, tick) {
  const { finances } = savingsOf(worldState, entityId);
  economy.generateIndividualFinances(worldState, entityId, {
    income: finances?.income ?? 0,
    savings: newSavings,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });
}

// ---------------------------------------------------------------------
// Loan sharking
// ---------------------------------------------------------------------

function issueLoan(worldState, options = {}) {
  const { lenderEntityId, borrowerEntityId, principal, tick = worldState.tick ?? 0 } = options;
  if (lenderEntityId === borrowerEntityId) {
    throw new Error('issueLoan: a loan shark cannot lend to themselves.');
  }
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('issueLoan requires a positive finite principal.');
  }
  operatorGangFor(worldState, lenderEntityId);

  const { savings: lenderSavings } = savingsOf(worldState, lenderEntityId);
  if (lenderSavings < principal) {
    throw new Error(`issueLoan: lender ${lenderEntityId} has ${lenderSavings} savings, not ${principal}.`);
  }

  moveSavings(worldState, lenderEntityId, lenderSavings - principal, tick);
  const { savings: borrowerSavings } = savingsOf(worldState, borrowerEntityId);
  moveSavings(worldState, borrowerEntityId, borrowerSavings + principal, tick);

  const loan = {
    id: nextLoanId++,
    lenderEntityId,
    borrowerEntityId,
    principal,
    outstanding: principal,
    issuedTick: tick,
    status: 'outstanding',
  };
  worldState.loanSharkLoans = worldState.loanSharkLoans || [];
  worldState.loanSharkLoans.push(loan);

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'loan_shark_loan',
    description: `entity ${lenderEntityId} loans entity ${borrowerEntityId} ${principal} at a real six-for-five vig`,
    when_tick: tick,
    participants: [lenderEntityId, borrowerEntityId],
  });

  return loan;
}

// Principal plus simple daily vig accrued since issuance — a pure
// function of the loan's own real fields and the tick asked about,
// never a stored, driftable running balance.
function amountOwed(loan, tick) {
  const elapsed = Math.max(0, tick - loan.issuedTick);
  return Math.round(loan.outstanding * (1 + DAILY_VIG_RATE * elapsed) * 100) / 100;
}

function loanFor(worldState, loanId) {
  const loan = (worldState.loanSharkLoans || []).find((l) => l.id === loanId);
  if (!loan) throw new Error(`loanSharking: no real loan ${loanId}.`);
  return loan;
}

// A real collection attempt. A borrower who can cover the full real
// balance pays it in full and the loan closes; one who cannot pays
// what they really have, and the honest remainder becomes real
// `individual_finances.debt` on them — the schema's own column for
// exactly this fact, never a second ledger.
//
// `entityId`, when given, must be this loan's own real lender — the
// same "a player acts as themselves" discipline `actions.js`'s own
// mission-resolution check already holds, applied here so one
// person's real loan cannot be collected by somebody else's say-so.
function collectDebt(worldState, options = {}) {
  const { loanId, entityId, tick = worldState.tick ?? 0 } = options;
  const loan = loanFor(worldState, loanId);
  if (entityId !== undefined && entityId !== loan.lenderEntityId) {
    throw new Error(`loanSharking: entity ${entityId} is not the real lender on loan ${loanId}.`);
  }
  if (loan.status !== 'outstanding') {
    throw new Error(`loanSharking: loan ${loanId} is not outstanding (status: ${loan.status}).`);
  }

  const owed = amountOwed(loan, tick);
  const { finances, savings: borrowerSavings } = savingsOf(worldState, loan.borrowerEntityId);
  const { savings: lenderSavings } = savingsOf(worldState, loan.lenderEntityId);

  if (borrowerSavings >= owed) {
    moveSavings(worldState, loan.borrowerEntityId, borrowerSavings - owed, tick);
    moveSavings(worldState, loan.lenderEntityId, lenderSavings + owed, tick);
    loan.status = 'repaid';
    loan.outstanding = 0;
    return { loan, outcome: 'repaid', paid: owed };
  }

  const paid = borrowerSavings;
  const remainder = Math.round((owed - paid) * 100) / 100;
  moveSavings(worldState, loan.borrowerEntityId, 0, tick);
  moveSavings(worldState, loan.lenderEntityId, lenderSavings + paid, tick);
  economy.generateIndividualFinances(worldState, loan.borrowerEntityId, {
    income: finances?.income ?? 0,
    savings: 0,
    debt: (Number(finances?.debt) || 0) + remainder,
    assets: finances?.assets ?? 0,
    tick,
  });
  loan.outstanding = remainder;
  loan.status = 'defaulted';
  return { loan, outcome: 'defaulted', paid, remainder };
}

// Real enforcement violence, only ever against a loan already real
// and already defaulted — see this file's own header for why this
// reuses `heat.js`/`crime.js` rather than inventing a third violence
// mechanism. `entityId`, when given, holds the identical real-lender
// check `collectDebt` already enforces.
function enforceCollection(worldState, options = {}) {
  const { loanId, entityId, tick = worldState.tick ?? 0 } = options;
  const loan = loanFor(worldState, loanId);
  if (entityId !== undefined && entityId !== loan.lenderEntityId) {
    throw new Error(`loanSharking: entity ${entityId} is not the real lender on loan ${loanId}.`);
  }
  if (loan.status !== 'defaulted') {
    throw new Error(`loanSharking: loan ${loanId} is not in default (status: ${loan.status}).`);
  }
  const gang = operatorGangFor(worldState, loan.lenderEntityId);

  heat.raiseHeat(worldState, { entityId: loan.borrowerEntityId, factionOrganizationId: gang.id });
  const incident = crime.recordCrime(worldState, {
    category: 'violent',
    perpetratorId: loan.lenderEntityId,
    victimId: loan.borrowerEntityId,
    tick,
    detail: `entity ${loan.lenderEntityId} enforces a defaulted loan-shark debt of ${loan.outstanding} against entity ${loan.borrowerEntityId}`,
  });
  loan.status = 'enforced';
  return { loan, incident };
}

function loansOwedBy(worldState, borrowerEntityId) {
  return (worldState.loanSharkLoans || []).filter((l) => l.borrowerEntityId === borrowerEntityId);
}

function loansHeldBy(worldState, lenderEntityId) {
  return (worldState.loanSharkLoans || []).filter((l) => l.lenderEntityId === lenderEntityId);
}

// ---------------------------------------------------------------------
// Street bookmaking
// ---------------------------------------------------------------------

// The real payout a picked side pays, after the bookie's own real
// standard vig — fair decimal odds (1 / probability) shaded down by
// BOOKMAKER_VIG, the same "skill divides the edge, never inverts it"
// shape `casino.winChanceFor` already holds for a licensed table.
function streetOddsFor(worldState, pickedEntityId, otherEntityId, discipline) {
  const picked = contest.rateEntity(worldState, pickedEntityId, discipline);
  const other = contest.rateEntity(worldState, otherEntityId, discipline);
  const probability = contest.winProbability(picked.rating, other.rating);
  const payoutMultiplier = (1 / probability) * (1 - BOOKMAKER_VIG);
  return { probability, payoutMultiplier };
}

// `contestantIds` names the two real contestants being bet ON, never
// the bettor — a street bet's actor is a third party watching from
// outside the contest, the opposite shape from `actions.js#enter-
// contest`'s own `participantIds` (always including the actor
// themselves), so this is deliberately a different name for a
// different real concept, not a second spelling of that one.
function placeStreetBet(worldState, options = {}) {
  const {
    bettorEntityId, bookieEntityId, contestantIds, pickedEntityId,
    stake, discipline = 'combat', contestId = null, tick = worldState.tick ?? 0,
  } = options;

  if (!Number.isFinite(stake) || stake <= 0) throw new Error('placeStreetBet requires a positive finite stake');
  if (!Array.isArray(contestantIds) || contestantIds.length !== 2) {
    throw new Error('placeStreetBet requires exactly two real contestantIds.');
  }
  if (!contestantIds.includes(pickedEntityId)) {
    throw new Error('placeStreetBet: pickedEntityId must be one of the two real contestants.');
  }
  operatorGangFor(worldState, bookieEntityId);

  const { savings: bettorSavings } = savingsOf(worldState, bettorEntityId);
  if (bettorSavings < stake) {
    throw new Error(`placeStreetBet: entity ${bettorEntityId} has ${bettorSavings} savings, not ${stake}.`);
  }

  const [otherEntityId] = contestantIds.filter((id) => id !== pickedEntityId);
  const { payoutMultiplier } = streetOddsFor(worldState, pickedEntityId, otherEntityId, discipline);

  const result = contest.resolveContest(worldState, { participantIds: contestantIds, discipline, contestId, tick });
  const won = result.winnerId === pickedEntityId;

  const { savings: bookieSavings } = savingsOf(worldState, bookieEntityId);
  const payout = Math.round(stake * payoutMultiplier * 100) / 100;
  moveSavings(worldState, bettorEntityId, won ? bettorSavings - stake + payout : bettorSavings - stake, tick);
  moveSavings(worldState, bookieEntityId, won ? bookieSavings - (payout - stake) : bookieSavings + stake, tick);

  const row = {
    bettorEntityId, bookieEntityId, pickedEntityId, otherEntityId,
    discipline, stake, payoutMultiplier, won, contestResult: result, tick,
  };
  worldState.streetBetEvents = worldState.streetBetEvents || [];
  worldState.streetBetEvents.push(row);

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'street_bet',
    description: `a real street bet of ${stake} on entity ${pickedEntityId} ${won ? 'pays out' : 'is lost to the bookie'}`,
    when_tick: tick,
    participants: [bettorEntityId, bookieEntityId],
  });

  return row;
}

function streetBetsBy(worldState, bettorEntityId) {
  return (worldState.streetBetEvents || []).filter((r) => r.bettorEntityId === bettorEntityId);
}

module.exports = {
  WEEKLY_VIG_RATE,
  DAILY_VIG_RATE,
  BOOKMAKER_VIG,
  operatorGangFor,
  issueLoan,
  amountOwed,
  collectDebt,
  enforceCollection,
  loansOwedBy,
  loansHeldBy,
  streetOddsFor,
  placeStreetBet,
  streetBetsBy,
};
