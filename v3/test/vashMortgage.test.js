// V3 -- VASH Mortgage: real amortization math, a real underwriting
// decision, and real VCoin payment settlement through the existing
// ledger. Grounded in the real $120,000/5-10-year program cap given
// by direct instruction, and in the real small-dollar-mortgage
// comparables (St. Louis Gateway Neighborhood Mortgage, CHN Housing
// Capital's Believe Mortgage) cited in the module's own header.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { transfer } = require('../lib/vcoin');
const {
  MORTGAGE_MAX_PRINCIPAL, MORTGAGE_TERM_YEARS_OPTIONS, PLATFORM_LENDER_ACCOUNT,
  monthlyPayment, buildAmortizationSchedule,
  applyForMortgage, getMortgage, approveMortgage, denyMortgage, makeMortgagePayment,
} = require('../lib/vashMortgage');

test('monthlyPayment matches the standard fixed-rate amortization formula', () => {
  // A known-good real value: $100,000 at 5% over 10 years is $1,060.66/mo.
  assert.equal(monthlyPayment(100000, 5, 10), 1060.66);
});

test('buildAmortizationSchedule reaches exactly zero, never a rounding residue', () => {
  const schedule = buildAmortizationSchedule(75000, 4, 5);
  assert.equal(schedule.length, 60);
  assert.equal(schedule[schedule.length - 1].remainingBalance, 0);
  // Every month's principal + interest reconstructs the real payment.
  for (const month of schedule) {
    assert.equal(Math.round((month.principalPortion + month.interestPortion) * 100) / 100, month.payment);
  }
});

test('applyForMortgage refuses a principal over the real program cap', () => {
  const store = createV3Store();
  assert.throws(
    () => applyForMortgage(store, {
      borrowerId: 'ada', propertyAddress: '1 Main St', principal: MORTGAGE_MAX_PRINCIPAL + 1, annualRatePercent: 5, termYears: 10,
    }),
    /exceeds the program cap/,
  );
});

test('applyForMortgage refuses a term outside the real 5/10-year options', () => {
  const store = createV3Store();
  assert.throws(
    () => applyForMortgage(store, {
      borrowerId: 'ada', propertyAddress: '1 Main St', principal: 90000, annualRatePercent: 5, termYears: 30,
    }),
    new RegExp(`must be one of ${MORTGAGE_TERM_YEARS_OPTIONS.join(', ')}`),
  );
});

test('approveMortgage computes a real schedule; denyMortgage requires a real reason', () => {
  const store = createV3Store();
  const application = applyForMortgage(store, {
    borrowerId: 'ada', propertyAddress: '1 Main St', principal: 90000, annualRatePercent: 4.5, termYears: 10,
  });

  assert.throws(() => denyMortgage(store, { applicationId: application.id, reviewedBy: 'underwriter-1' }), /requires a reason/);

  const approved = approveMortgage(store, { applicationId: application.id, reviewedBy: 'underwriter-1' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.schedule.length, 120);
  assert.equal(approved.remainingBalance, 90000);
  assert.equal(approved.monthlyPayment, approved.schedule[0].payment);

  // A decided application cannot be decided again.
  assert.throws(() => approveMortgage(store, { applicationId: application.id, reviewedBy: 'underwriter-1' }), /not "pending"/);
});

test('makeMortgagePayment moves real VCoin through the real ledger and pays the loan down', async () => {
  const store = createV3Store();
  // `house` only has the real STARTING_VCOIN_BALANCE (1000) on first touch.
  await transfer(store, { fromUserId: 'house', toUserId: 'ada', amount: 1000 }); // give ada real spending VCoin
  const application = applyForMortgage(store, {
    borrowerId: 'ada', propertyAddress: '1 Main St', principal: 90000, annualRatePercent: 4.5, termYears: 10,
  });
  const approved = approveMortgage(store, { applicationId: application.id, reviewedBy: 'underwriter-1' });

  const before = store.vcoinBalances.ada;
  const { application: updated, transaction } = await makeMortgagePayment(store, {
    applicationId: application.id, borrowerId: 'ada', amount: approved.monthlyPayment,
  }, { transferFn: (opts) => transfer(store, opts) });

  assert.equal(transaction.toUserId, PLATFORM_LENDER_ACCOUNT);
  assert.equal(store.vcoinBalances.ada, before - transaction.amount);
  assert.equal(updated.paymentsMade.length, 1);
  assert.ok(updated.remainingBalance < 90000);
  assert.equal(getMortgage(store, application.id).remainingBalance, updated.remainingBalance);
});

test('makeMortgagePayment refuses an amount beyond the real remaining balance, and marks paid-off at zero', async () => {
  const store = createV3Store();
  await transfer(store, { fromUserId: 'house', toUserId: 'bea', amount: 1000 }); // `house` only has 1000 to give on first touch
  const application = applyForMortgage(store, {
    borrowerId: 'bea', propertyAddress: '2 Oak St', principal: 1000, annualRatePercent: 0, termYears: 5,
  });
  approveMortgage(store, { applicationId: application.id, reviewedBy: 'underwriter-2' });

  const transferFn = (opts) => transfer(store, opts);
  await assert.rejects(
    makeMortgagePayment(store, { applicationId: application.id, borrowerId: 'bea', amount: 999999 }, { transferFn }),
    /exceeds the real remaining balance/,
  );

  const { application: paidOff } = await makeMortgagePayment(store, { applicationId: application.id, borrowerId: 'bea', amount: 1000 }, { transferFn });
  assert.equal(paidOff.status, 'paid-off');
  assert.equal(paidOff.remainingBalance, 0);
});
