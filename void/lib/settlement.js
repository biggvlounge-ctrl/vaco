// VOID -- the one settlement path every vertical uses.
//
// **Why this file exists.** `serviceEngine.js` settles the 23 verticals
// that run on its archetype machine, and it does it correctly: charge
// before the status changes, two separate transfers, refuse a booking
// with no price. `petCare.js` and `laundry.js` predate that engine and
// have their own completion functions, which changed a status and paid
// nobody. A pet care booking could complete and the walker was never
// paid -- silently, with a 200 response.
//
// The fix is not to copy the engine's settlement block into two more
// files. Money logic duplicated three times drifts, and the drift is
// invisible until someone is underpaid. So the block moved here and all
// three call it.
//
// Every rule below is `serviceEngine.js`'s, unchanged:
//
//   - **Settle before the status changes.** A failed transfer leaves
//     the job in its previous state rather than complete-and-unpaid.
//     Marking it done first and paying after is how a ledger error
//     becomes a customer who got a service for free.
//   - **A job with no price is refused, not settled at zero.** Zero is
//     a real amount and the wrong one.
//   - **Two legs, not one netted movement**, so the provider's
//     earnings and the platform's fee stay separately auditable.
//   - **`settleFn` is required at settlement and only at
//     settlement.** Everything else in these modules stays runnable in
//     plain Node with no network, which is the repo's standing rule 4.
//
// ---------------------------------------------------------------
// **One call, not two consecutive awaits — and why that is a bug fix
// rather than a tidy-up.**
//
// This used to be:
//
//     await transferFn(payer, provider, providerPayout, ...);
//     if (platformFee > 0) await transferFn(payer, PLATFORM, fee, ...);
//     job.settledTotal = total;
//
// The second leg can fail on its own — the first one just debited the
// same payer. When it did, the provider had been paid, the throw meant
// `job.settledTotal` was never set, and the caller never advanced the
// status. `petCare.completeBooking` then still saw
// `status === 'confirmed'`, which is exactly the state it accepts a
// retry in. **The retry paid the provider again.** Every balance
// assertion in the suite passed throughout, because the totals of a
// split settlement are identical to the totals of an atomic one.
//
// So both legs now go to V3 in a single `settleFn(legs, meta)` call —
// `POST /api/vcoin/settle`, which validates every leg against running
// balances and writes nothing unless all of them pass. Rule 5, "hard
// on money", means the failure has to be *all* or *nothing*; it was
// neither.

const { VERTICALS } = require('./verticals');

//: The account platform fees settle into. Same constant the engine
//: uses; it lives here now so there is one definition.
const VOID_PLATFORM_ACCOUNT = 'void-platform';

class SettlementError extends Error {}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Settles one job and returns what moved. The caller sets its own
// status afterward -- deliberately, so this function cannot be the
// thing that marks something complete.
//
//   job         the record being settled (mutated with the settlement fields)
//   verticalId  which vertical's take rate applies
//   total       the amount to settle; must be a positive number
//   label       goes in the transfer reason, e.g. 'petcare_booking'
async function settleJob(options = {}) {
  const {
    job, verticalId, total, label, reference,
    settleFn = null, now = Date.now(),
  } = options;

  if (!job) throw new SettlementError('settleJob requires a job');
  const vertical = VERTICALS[verticalId];
  if (!vertical) throw new SettlementError(`settleJob: unknown vertical "${verticalId}"`);

  if (!Number.isFinite(total) || total <= 0) {
    throw new SettlementError(
      `settleJob: ${label} ${reference} has no settleable total -- `
      + 'a job cannot complete without a price',
    );
  }
  if (typeof settleFn !== 'function') {
    throw new SettlementError(
      `settleJob: settling ${label} ${reference} requires a `
      + 'settleFn(legs, meta) that moves every leg atomically',
    );
  }
  if (!job.customerId && !job.ownerId) {
    throw new SettlementError(`settleJob: ${label} ${reference} has no payer`);
  }
  if (!job.providerId) {
    throw new SettlementError(`settleJob: ${label} ${reference} has no provider to pay`);
  }

  // Pet care calls the payer `ownerId`; every other vertical calls it
  // `customerId`. Accepting both here rather than renaming a field 23
  // other modules already read.
  const payerId = job.customerId || job.ownerId;

  const platformFee = round(total * vertical.takeRate);
  const providerPayout = round(total - platformFee);

  // A zero platform fee is genuinely no leg, not a leg of zero — V3
  // refuses a non-positive amount, and rightly: zero is a real amount
  // and the wrong one.
  const legs = [{
    fromUserId: payerId,
    toUserId: job.providerId,
    amount: providerPayout,
    reason: `void_${label}_payout:${verticalId}:${reference}`,
  }];
  if (platformFee > 0) {
    legs.push({
      fromUserId: payerId,
      toUserId: VOID_PLATFORM_ACCOUNT,
      amount: platformFee,
      reason: `void_${label}_platform_fee:${verticalId}:${reference}`,
    });
  }

  await settleFn(legs, { reason: `void_${label}:${verticalId}:${reference}` });

  job.settledTotal = total;
  job.providerPayout = providerPayout;
  job.platformFee = platformFee;
  job.settledAt = now;

  return { total, providerPayout, platformFee, payerId };
}

module.exports = { settleJob, VOID_PLATFORM_ACCOUNT, SettlementError, round };
