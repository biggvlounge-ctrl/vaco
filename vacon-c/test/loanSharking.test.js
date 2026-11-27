// server/loanSharking.js — loan sharks and bookies as a real informal/
// criminal economy mechanic. See that file's own header for the full
// design and what it reuses rather than invents (drugTrade.js's real
// gang-tier gate, economy.js's real claim-before-pay money movement,
// heat.js/crime.js for enforcement, contest.js's own real ratings/odds
// for street bookmaking).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const loanSharking = require('../server/loanSharking.js');
const membership = require('../server/membership.js');
const economy = require('../server/economy.js');
const heat = require('../server/heat.js');

const w = engine.WorldState;

let nextId = 940001;

function adult(traitValueFor) {
  const npc = engine.generateNPC({ traitValueFor });
  npc.createdTick = w.tick - 30 * 365;
  return npc;
}

function gang(leaderId) {
  return engine.generateOrganization({ name: `Gang ${nextId += 1}`, type: 'gang', leaderId });
}

// A real gang member whose own live tier reads deterministically as
// `soldier`/`associate` -- the identical fixture shape
// `test/drugTrade.test.js#soldierIn` already established for the
// identical real question.
function streetMember(gangOrg) {
  const npc = adult((def) => {
    if (def.family !== 'faction') return 50;
    if (def.name === 'Territorial Instinct') return 95;
    if (def.name === 'Defection Risk') return 50;
    return 5;
  });
  membership.joinOrganization(w, { entityId: npc.id, organizationId: gangOrg.id });
  return npc;
}

function savingsOf(id) {
  return economy.getLatestFinances(w, id)?.savings ?? 0;
}

// ---------------------------------------------------------------------
// operatorGangFor
// ---------------------------------------------------------------------

test('operatorGangFor refuses an entity with no real gang at all', () => {
  const npc = adult(() => 50);
  assert.throws(
    () => loanSharking.operatorGangFor(w, npc.id),
    /not a real member of any real gang/,
  );
});

test('operatorGangFor refuses a real gang LEADER -- leadership is not street-level', () => {
  const leader = adult(() => 50);
  const org = gang(leader.id);
  membership.joinOrganization(w, { entityId: leader.id, organizationId: org.id });
  assert.throws(
    () => loanSharking.operatorGangFor(w, leader.id),
    /does not operate street-level/,
  );
});

test('operatorGangFor accepts a real soldier/associate-tier gang member', () => {
  const org = gang(null);
  const member = streetMember(org);
  const result = loanSharking.operatorGangFor(w, member.id);
  assert.equal(result.id, org.id);
});

// ---------------------------------------------------------------------
// issueLoan
// ---------------------------------------------------------------------

test('issueLoan refuses a loan shark lending to themselves', () => {
  const org = gang(null);
  const shark = streetMember(org);
  assert.throws(
    () => loanSharking.issueLoan(w, { lenderEntityId: shark.id, borrowerEntityId: shark.id, principal: 100 }),
    /cannot lend to themselves/,
  );
});

test('issueLoan refuses a non-positive principal', () => {
  const org = gang(null);
  const shark = streetMember(org);
  const borrower = adult(() => 50);
  assert.throws(
    () => loanSharking.issueLoan(w, { lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 0 }),
    /positive finite principal/,
  );
});

test('issueLoan refuses a lender who is not a real street-level gang operator', () => {
  const lender = adult(() => 50);
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, lender.id, { savings: 1000, tick: w.tick });
  assert.throws(
    () => loanSharking.issueLoan(w, { lenderEntityId: lender.id, borrowerEntityId: borrower.id, principal: 100 }),
    /not a real member of any real gang/,
  );
});

test('issueLoan refuses a loan shark who does not really have the principal to lend', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 10, tick: w.tick });
  const borrower = adult(() => 50);
  assert.throws(
    () => loanSharking.issueLoan(w, { lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 100 }),
    /savings/,
  );
});

test('issueLoan moves the real principal from the lender\'s own savings into the borrower\'s, and records the loan', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });

  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 200, tick: w.tick,
  });

  assert.equal(savingsOf(shark.id), 800);
  assert.equal(savingsOf(borrower.id), 200);
  assert.equal(loan.status, 'outstanding');
  assert.equal(loan.outstanding, 200);
  assert.ok(w.historicalRecords.some((r) => r.event_type === 'loan_shark_loan'));
});

// ---------------------------------------------------------------------
// amountOwed -- a pure function of the loan's own real fields
// ---------------------------------------------------------------------

test('amountOwed is exactly the principal with no elapsed time', () => {
  const loan = { outstanding: 200, issuedTick: 1000 };
  assert.equal(loanSharking.amountOwed(loan, 1000), 200);
});

test('amountOwed accrues the real daily vig, a weekly 20% divided across seven real ticks', () => {
  const loan = { outstanding: 200, issuedTick: 1000 };
  const owed = loanSharking.amountOwed(loan, 1007); // one real week elapsed
  assert.equal(owed, Math.round(200 * 1.20 * 100) / 100);
});

// ---------------------------------------------------------------------
// collectDebt
// ---------------------------------------------------------------------

test('collectDebt, in full: the real balance moves from borrower to lender and the loan closes', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });

  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 200, tick: w.tick,
  });
  // The borrower comes into enough real money to cover principal + vig.
  economy.generateIndividualFinances(w, borrower.id, { savings: 500, tick: w.tick });

  const result = loanSharking.collectDebt(w, { loanId: loan.id, tick: w.tick });

  assert.equal(result.outcome, 'repaid');
  assert.equal(loan.status, 'repaid');
  assert.equal(loan.outstanding, 0);
  assert.equal(savingsOf(borrower.id), 500 - result.paid);
  assert.equal(savingsOf(shark.id), 800 + result.paid);
});

test('collectDebt, short: the real remainder becomes real individual_finances.debt on the borrower, not a second ledger', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });

  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 200, tick: w.tick,
  });
  economy.generateIndividualFinances(w, borrower.id, { savings: 50, tick: w.tick });

  const result = loanSharking.collectDebt(w, { loanId: loan.id, tick: w.tick });

  assert.equal(result.outcome, 'defaulted');
  assert.equal(result.paid, 50);
  assert.equal(loan.status, 'defaulted');
  assert.equal(savingsOf(borrower.id), 0);
  assert.equal(economy.getLatestFinances(w, borrower.id).debt, result.remainder);
  assert.equal(savingsOf(shark.id), 800 + 50);
});

test('collectDebt refuses a loan that is not real or already closed', () => {
  assert.throws(() => loanSharking.collectDebt(w, { loanId: 999999999 }), /no real loan/);
});

test('collectDebt refuses an entityId that is not this loan\'s own real lender', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });
  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 100, tick: w.tick,
  });
  assert.throws(
    () => loanSharking.collectDebt(w, { loanId: loan.id, entityId: borrower.id, tick: w.tick }),
    /not the real lender/,
  );
});

// ---------------------------------------------------------------------
// enforceCollection
// ---------------------------------------------------------------------

test('enforceCollection refuses a loan that has not actually defaulted', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });
  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 100, tick: w.tick,
  });
  assert.throws(
    () => loanSharking.enforceCollection(w, { loanId: loan.id }),
    /not in default/,
  );
});

test('enforceCollection on a real default puts the borrower on the lender\'s gang\'s real radar and records real violent-crime enforcement', () => {
  const org = gang(null);
  const shark = streetMember(org);
  economy.generateIndividualFinances(w, shark.id, { savings: 1000, tick: w.tick });
  const borrower = adult(() => 50);
  economy.generateIndividualFinances(w, borrower.id, { savings: 0, tick: w.tick });
  const loan = loanSharking.issueLoan(w, {
    lenderEntityId: shark.id, borrowerEntityId: borrower.id, principal: 200, tick: w.tick,
  });
  // The borrower spends the borrowed cash before collection comes due,
  // leaving them genuinely unable to cover the real balance owed.
  economy.generateIndividualFinances(w, borrower.id, { savings: 10, tick: w.tick });
  loanSharking.collectDebt(w, { loanId: loan.id, tick: w.tick });
  assert.equal(loan.status, 'defaulted');

  const before = heat.heatWith(w, borrower.id, org.id);
  const result = loanSharking.enforceCollection(w, { loanId: loan.id, tick: w.tick });

  assert.equal(loan.status, 'enforced');
  assert.equal(result.incident.category, 'violent');
  assert.equal(result.incident.perpetrator_entity_id, shark.id);
  assert.equal(result.incident.victim_entity_id, borrower.id);
  const after = heat.heatWith(w, borrower.id, org.id);
  assert.ok(after > before, 'enforcement did not really raise the borrower\'s heat with the lender\'s gang');
});

// ---------------------------------------------------------------------
// streetOddsFor / placeStreetBet
// ---------------------------------------------------------------------

function strong() {
  return adult((def) => {
    if (def.family === 'physical' || def.family === 'combat') return 95;
    if (def.family === 'mental' && def.name === 'Focus') return 95;
    return 50;
  });
}

function weak() {
  return adult((def) => {
    if (def.family === 'physical' || def.family === 'combat') return 5;
    if (def.family === 'mental' && def.name === 'Focus') return 5;
    return 50;
  });
}

test('streetOddsFor pays worse than fair odds on the real favourite -- the bookmaker\'s own standard vig, never a free market', () => {
  const favourite = strong();
  const underdog = weak();
  const { probability, payoutMultiplier } = loanSharking.streetOddsFor(w, favourite.id, underdog.id, 'combat');
  assert.ok(probability > 0.5);
  const fairMultiplier = 1 / probability;
  assert.ok(payoutMultiplier < fairMultiplier, 'the bookie paid full fair odds, keeping no real vig at all');
  assert.equal(payoutMultiplier, fairMultiplier * (1 - loanSharking.BOOKMAKER_VIG));
});

test('placeStreetBet refuses a bookie who is not a real street-level gang operator', () => {
  const bookie = adult(() => 50);
  economy.generateIndividualFinances(w, bookie.id, { savings: 1000, tick: w.tick });
  const a = strong();
  const b = weak();
  const bettor = adult(() => 50);
  economy.generateIndividualFinances(w, bettor.id, { savings: 100, tick: w.tick });
  assert.throws(
    () => loanSharking.placeStreetBet(w, {
      bettorEntityId: bettor.id, bookieEntityId: bookie.id,
      contestantIds: [a.id, b.id], pickedEntityId: a.id, stake: 10,
    }),
    /not a real member of any real gang/,
  );
});

test('placeStreetBet refuses a pick that is not one of the two real participants', () => {
  const org = gang(null);
  const bookie = streetMember(org);
  economy.generateIndividualFinances(w, bookie.id, { savings: 1000, tick: w.tick });
  const a = strong();
  const b = weak();
  const outsider = adult(() => 50);
  const bettor = adult(() => 50);
  economy.generateIndividualFinances(w, bettor.id, { savings: 100, tick: w.tick });
  assert.throws(
    () => loanSharking.placeStreetBet(w, {
      bettorEntityId: bettor.id, bookieEntityId: bookie.id,
      contestantIds: [a.id, b.id], pickedEntityId: outsider.id, stake: 10,
    }),
    /must be one of the two real contestants/,
  );
});

test('placeStreetBet refuses a stake the bettor does not really have -- claim-before-pay', () => {
  const org = gang(null);
  const bookie = streetMember(org);
  economy.generateIndividualFinances(w, bookie.id, { savings: 1000, tick: w.tick });
  const a = strong();
  const b = weak();
  const bettor = adult(() => 50);
  economy.generateIndividualFinances(w, bettor.id, { savings: 5, tick: w.tick });
  assert.throws(
    () => loanSharking.placeStreetBet(w, {
      bettorEntityId: bettor.id, bookieEntityId: bookie.id,
      contestantIds: [a.id, b.id], pickedEntityId: a.id, stake: 10,
    }),
    /savings/,
  );
});

test('a winning street bet on the real favourite pays out from the bookie\'s own real personal savings, found across real seeded ticks', () => {
  let row = null;
  let tick = w.tick;
  for (let i = 0; i < 500 && !row; i += 1, tick += 1) {
    const org = gang(null);
    const bookie = streetMember(org);
    economy.generateIndividualFinances(w, bookie.id, { savings: 100000, tick });
    const a = strong();
    const b = weak();
    const bettor = adult(() => 50);
    economy.generateIndividualFinances(w, bettor.id, { savings: 100, tick });
    const before = savingsOf(bookie.id);
    const r = loanSharking.placeStreetBet(w, {
      bettorEntityId: bettor.id, bookieEntityId: bookie.id,
      contestantIds: [a.id, b.id], pickedEntityId: a.id, stake: 20, tick,
    });
    if (r.won) {
      row = r;
      const payout = Math.round(20 * r.payoutMultiplier * 100) / 100;
      assert.equal(savingsOf(bettor.id), 100 - 20 + payout);
      assert.equal(savingsOf(bookie.id), before - (payout - 20));
      assert.ok(w.streetBetEvents.includes(r));
      assert.ok(w.historicalRecords.some((rec) => rec.event_type === 'street_bet'));
      assert.equal(loanSharking.streetBetsBy(w, bettor.id).includes(r), true);
    }
  }
  assert.ok(row, 'no winning street bet on the real favourite happened across 500 real seeded ticks');
});

test('a losing street bet on the real favourite loses the real stake to the bookie, found across real seeded ticks', () => {
  let row = null;
  let tick = w.tick;
  for (let i = 0; i < 500 && !row; i += 1, tick += 1) {
    const org = gang(null);
    const bookie = streetMember(org);
    economy.generateIndividualFinances(w, bookie.id, { savings: 100000, tick });
    const a = strong();
    const b = weak();
    const bettor = adult(() => 50);
    economy.generateIndividualFinances(w, bettor.id, { savings: 100, tick });
    const before = savingsOf(bookie.id);
    const r = loanSharking.placeStreetBet(w, {
      bettorEntityId: bettor.id, bookieEntityId: bookie.id,
      contestantIds: [a.id, b.id], pickedEntityId: a.id, stake: 20, tick,
    });
    if (!r.won) {
      row = r;
      assert.equal(savingsOf(bettor.id), 80);
      assert.equal(savingsOf(bookie.id), before + 20);
    }
  }
  assert.ok(row, 'no losing street bet on the real favourite happened across 500 real seeded ticks');
});
