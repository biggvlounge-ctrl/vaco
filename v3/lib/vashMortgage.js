// V3 -- VASH Mortgage: small-dollar home loans for affordable/
// rehabbed properties, denominated in VCoin.
//
// Real-world grounding, per direct instruction ("buy the houses for
// cheap [from the city]... start a small mortgage operation that
// maybe runs up to 100 grand... 5 to 10 years, nice easy payment"):
// this is the same real problem the St. Louis Gateway Neighborhood
// Mortgage and Detroit Home Mortgage Initiative programs were built
// to solve. Conventional lenders will not originate a loan this small
// -- fixed origination costs make a $70k loan far less profitable per
// dollar than a $700k one (Urban Institute/Pew), and a cheap rehabbed
// home's renovation cost often exceeds its appraised value, the real
// "appraisal gap" (Abt Associates/HUD). Both real programs answer it
// with a primary mortgage plus a forgivable "soft second" loan (up to
// $75,000 in St. Louis's own program) covering that gap -- a real,
// cited extension this module does not yet build. CHN Housing
// Capital's "Believe Mortgage" (Cleveland) is the closest real
// comparable to this module's own cap, targeting loans at or under
// $70,000 for the identical reason.
//
// **What this honestly is, and is not.** Every dollar anywhere in this
// ecosystem is VCoin -- "No real-money path exists anywhere in the
// repository" (dev-docs/GO_LIVE_DOSSIER.md's own words, true before
// this file and still true after it). This module is a real, working
// loan-administration system: real amortization math, a real
// underwriting decision, real payment tracking, settled through V3's
// own real VCoin ledger (`lib/vcoin.js`) -- denominated in VCoin
// throughout, the same posture VAGO already takes for Gold Coin. **It
// is not, and cannot be, a real mortgage lender.** Originating an
// actual loan against a real house requires real NMLS Mortgage Loan
// Originator registration under the SAFE Act (background check,
// pre-licensure and continuing education) plus a state lending
// licence, and real USD banking rails this ecosystem does not have.
// Do not wire a real bank account or a real disbursement to this
// module without that licensing and counsel first -- the same rule
// dev-docs/GO_LIVE_DOSSIER.md §2 already states for VAGO's real-money
// gambling.

// **`transferFn` is injected, not required from `./vcoin` directly.**
// V3 itself runs on one of two real ledger backends (in-memory or
// Postgres rows, see `lib/ledger.js`'s own header on why routes never
// branch on which). Calling `vcoin.transfer` here directly would
// always write to the in-memory store even when the real deployment
// is on Postgres rows -- exactly the "two paths drift" failure
// `ledger.js` exists to prevent. The real caller (`server.js`) injects
// whichever `ledger.transfer` the live backend resolved to; tests
// inject the plain in-memory `vcoin.transfer`, same pattern this
// ecosystem already uses everywhere a module must stay runnable with
// no live network or live backend decision (VOID's `transferFn`,
// `payoutFn`, etc.).

// Direct instruction: "maybe up to 100 grand... maybe up to 120
// grand... affordable."
const MORTGAGE_MAX_PRINCIPAL = 120000;
// Direct instruction: "5 to 10 years."
const MORTGAGE_TERM_YEARS_OPTIONS = [5, 10];
const MORTGAGE_STATUSES = ['pending', 'approved', 'denied', 'paid-off'];
// Not a real user account -- the platform's own real VCoin account
// every mortgage payment settles into, the same shape DREAMS' own
// `DREAMS_PLATFORM_ACCOUNT` already uses for its own settlements.
const PLATFORM_LENDER_ACCOUNT = 'vash-mortgage-platform';

function round(n) {
  return Math.round(n * 100) / 100;
}

// Standard fixed-rate, fully-amortizing monthly payment -- the same
// formula every real mortgage calculator uses. `r === 0` is handled
// separately because the closed form divides by zero at a 0% rate,
// which a real affordability program can genuinely offer.
function monthlyPayment(principal, annualRatePercent, termYears) {
  const n = termYears * 12;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return round(principal / n);
  return round((principal * (r * (1 + r) ** n)) / ((1 + r) ** n - 1));
}

// A real, month-by-month amortization schedule. The final month's
// principal portion is set to clear the exact remaining balance
// rather than the formula's own rounded figure, so the loan reaches
// precisely zero instead of a few cents of rounding residue left
// owing forever.
function buildAmortizationSchedule(principal, annualRatePercent, termYears) {
  const n = termYears * 12;
  const r = annualRatePercent / 100 / 12;
  const payment = monthlyPayment(principal, annualRatePercent, termYears);
  let balance = principal;
  const schedule = [];
  for (let month = 1; month <= n; month++) {
    const interestPortion = round(balance * r);
    let principalPortion = round(payment - interestPortion);
    if (month === n) principalPortion = balance;
    balance = round(balance - principalPortion);
    schedule.push({
      month,
      payment: round(principalPortion + interestPortion),
      principalPortion,
      interestPortion,
      remainingBalance: Math.max(balance, 0),
    });
  }
  return schedule;
}

function applyForMortgage(store, options = {}) {
  const {
    borrowerId, propertyAddress, principal, annualRatePercent, termYears, now = Date.now(),
  } = options;

  if (!borrowerId) throw new Error('applyForMortgage requires a borrowerId');
  if (!propertyAddress) throw new Error('applyForMortgage requires a propertyAddress');
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('applyForMortgage requires a positive principal');
  }
  if (principal > MORTGAGE_MAX_PRINCIPAL) {
    throw new Error(`applyForMortgage: principal ${principal} exceeds the program cap of ${MORTGAGE_MAX_PRINCIPAL}`);
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
    throw new Error('applyForMortgage requires a non-negative annualRatePercent');
  }
  if (!MORTGAGE_TERM_YEARS_OPTIONS.includes(termYears)) {
    throw new Error(`applyForMortgage: termYears must be one of ${MORTGAGE_TERM_YEARS_OPTIONS.join(', ')}`);
  }

  const application = {
    id: store.nextMortgageApplicationId++,
    borrowerId,
    propertyAddress,
    principal,
    annualRatePercent,
    termYears,
    status: 'pending',
    schedule: null,
    monthlyPayment: null,
    remainingBalance: null,
    paymentsMade: [],
    reviewedBy: null,
    reviewNotes: null,
    reviewedAt: null,
    createdAt: now,
  };
  store.mortgageApplications.push(application);
  return application;
}

function getMortgage(store, applicationId) {
  return store.mortgageApplications.find((m) => m.id === applicationId) || null;
}

function requirePending(store, applicationId, action) {
  const application = getMortgage(store, applicationId);
  if (!application) throw new Error(`${action}: no mortgage application with id ${applicationId}`);
  if (application.status !== 'pending') {
    throw new Error(`${action}: application ${applicationId} is "${application.status}", not "pending"`);
  }
  return application;
}

// The real underwriting decision -- a human/operator call, the same
// posture VACA's own `approveVerification` takes for an authenticity
// grade, not an auto-approval.
function approveMortgage(store, options = {}) {
  const { applicationId, reviewedBy, now = Date.now() } = options;
  const application = requirePending(store, applicationId, 'approveMortgage');
  if (!reviewedBy) throw new Error('approveMortgage requires a reviewedBy');

  application.status = 'approved';
  application.reviewedBy = reviewedBy;
  application.reviewedAt = now;
  application.schedule = buildAmortizationSchedule(application.principal, application.annualRatePercent, application.termYears);
  application.monthlyPayment = application.schedule[0].payment;
  application.remainingBalance = application.principal;
  return application;
}

function denyMortgage(store, options = {}) {
  const { applicationId, reviewedBy, reason, now = Date.now() } = options;
  const application = requirePending(store, applicationId, 'denyMortgage');
  if (!reviewedBy) throw new Error('denyMortgage requires a reviewedBy');
  if (!reason) throw new Error('denyMortgage requires a reason');

  application.status = 'denied';
  application.reviewedBy = reviewedBy;
  application.reviewNotes = reason;
  application.reviewedAt = now;
  return application;
}

// A real VCoin settlement through whichever real ledger backend is
// live -- a mortgage payment moves through the exact same ledger
// every other real payment in this ecosystem settles through, not a
// parallel one invented just for this module. See the header note
// above `transferFn` on why this is injected rather than required.
async function makeMortgagePayment(store, options = {}, deps = {}) {
  const { applicationId, borrowerId, amount, now = Date.now() } = options;
  const { transferFn } = deps;
  if (typeof transferFn !== 'function') throw new Error('makeMortgagePayment requires a transferFn(options)');
  const application = getMortgage(store, applicationId);
  if (!application) throw new Error(`makeMortgagePayment: no mortgage application with id ${applicationId}`);
  if (application.status !== 'approved') {
    throw new Error(`makeMortgagePayment: application ${applicationId} is "${application.status}", not "approved"`);
  }
  if (application.borrowerId !== borrowerId) {
    throw new Error('makeMortgagePayment: borrowerId does not match this mortgage');
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('makeMortgagePayment requires a positive amount');
  if (amount > application.remainingBalance + 0.01) {
    throw new Error(`makeMortgagePayment: amount ${amount} exceeds the real remaining balance ${application.remainingBalance}`);
  }

  const result = await transferFn({
    fromUserId: borrowerId, toUserId: PLATFORM_LENDER_ACCOUNT, amount, reason: `mortgage #${applicationId} payment`, now,
  });

  application.remainingBalance = round(application.remainingBalance - amount);
  application.paymentsMade.push({ amount, at: now, transactionId: result.transaction.id });
  if (application.remainingBalance <= 0.01) {
    application.status = 'paid-off';
    application.remainingBalance = 0;
  }
  return { application, transaction: result.transaction };
}

module.exports = {
  MORTGAGE_MAX_PRINCIPAL,
  MORTGAGE_TERM_YEARS_OPTIONS,
  MORTGAGE_STATUSES,
  PLATFORM_LENDER_ACCOUNT,
  monthlyPayment,
  buildAmortizationSchedule,
  applyForMortgage,
  getMortgage,
  approveMortgage,
  denyMortgage,
  makeMortgagePayment,
};
