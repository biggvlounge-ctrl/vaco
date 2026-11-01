// VOID — Ride Pass: prepaid ride packs and monthly ride subscriptions
// against the Transportation vertical, the real comparable being
// Uber's Ride Pass / Uber One and Lyft Pass -- "pay a certain amount
// up front (or a certain amount a month) for a certain amount of
// rides," per direct instruction.
//
// Real escrow-then-redeem shape, the exact same idiom this session's
// own VACAY bookings.js already established (charge in full up
// front into a dedicated escrow account, pay out of that escrow
// later rather than off the real customer's own wallet): purchasing a
// pass moves its full price from the customer into
// VOID_RIDE_PASS_ESCROW_ACCOUNT immediately; redeeming a ride then
// reroutes that SAME job's `completeJob` legs to come out of the
// escrow instead of the customer, so a pass-covered ride is a real
// $0 charge to the rider at the moment it happens.
//
// Deliberately NOT a second job system (standing rule 1 in this
// app's own CLAUDE.md: "one marketplace loop"). `redeemRidePassForJob`
// below calls the real, unmodified `completeJob` from marketplace.js
// and only wraps the `settleFn` it hands it -- every bit of the real
// payout math (provider split vs. platform fee, rounding-safe) is
// still computed exactly once, in exactly the one place it has
// always lived.
//
// Real financial guardrail, not just a ride-count cap: a pass tracks
// BOTH `creditsRemaining` (how many more rides) AND
// `balanceRemaining` (how much money is actually still sitting in
// escrow for this pass). A ride only redeems against the pass if
// there is enough of *both* -- a pass that happens to get used for
// several unusually expensive rides runs out of real money before it
// runs out of nominal "rides," and redemption is honestly refused
// rather than ever letting the escrow account go negative. The rider
// simply pays that one ride directly instead, the same real fallback
// Uber/Lyft's own "ran out of included rides" behavior has.
//
// Two real plan shapes, both flagged interpretive since no source doc
// in this ecosystem prices VOID rides (Transportation jobs are priced
// per-trip by whoever requests them, with no fixed base fare to
// discount against): `prepaid-pack` (one-time charge, N rides, a
// validity window, no renewal) and `subscription` (recurring charge
// every cycle, N rides per cycle, auto-renews until cancelled). Price/
// ridesIncluded figures below are a defensible, clearly-labeled
// placeholder economy -- real pricing is a product decision, not a
// code one.

const { getJob, completeJob } = require('./marketplace');

const VOID_RIDE_PASS_ESCROW_ACCOUNT = 'void-ride-pass-escrow';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RIDE_PASS_PLANS = {
  'pack-5': {
    name: '5-Ride Pack', kind: 'prepaid-pack', ridesIncluded: 5, price: 42, validityDays: 60,
  },
  'pack-10': {
    name: '10-Ride Pack', kind: 'prepaid-pack', ridesIncluded: 10, price: 79, validityDays: 90,
  },
  'monthly-15': {
    name: 'VOID Ride Monthly 15', kind: 'subscription', ridesIncluded: 15, price: 59, cycleLengthDays: 30,
  },
  'monthly-30': {
    name: 'VOID Ride Monthly 30', kind: 'subscription', ridesIncluded: 30, price: 99, cycleLengthDays: 30,
  },
};

function round(n) {
  return Math.round(n * 100) / 100;
}

function listRidePassPlans() {
  return Object.entries(RIDE_PASS_PLANS).map(([id, plan]) => ({ id, ...plan }));
}

function getRidePassPlan(planId) {
  return RIDE_PASS_PLANS[planId] ? { id: planId, ...RIDE_PASS_PLANS[planId] } : null;
}

async function purchaseRidePass(store, options = {}) {
  const { customerId, planId, settleFn, now = Date.now() } = options;
  const plan = RIDE_PASS_PLANS[planId];
  if (!plan) {
    throw new Error(`purchaseRidePass: unknown planId "${planId}" (expected one of ${Object.keys(RIDE_PASS_PLANS).join(', ')})`);
  }
  if (!customerId) throw new Error('purchaseRidePass requires a customerId');
  if (typeof settleFn !== 'function') throw new Error('purchaseRidePass requires a settleFn(legs, meta)');

  const passId = store.nextRidePassId++;
  await settleFn(
    [{
      fromUserId: customerId, toUserId: VOID_RIDE_PASS_ESCROW_ACCOUNT, amount: plan.price, reason: `void_ride_pass_purchase:${passId}`,
    }],
    { reason: `void_ride_pass_purchase:${passId}` },
  );

  const pass = {
    id: passId,
    customerId,
    planId,
    kind: plan.kind,
    creditsRemaining: plan.ridesIncluded,
    balanceRemaining: plan.price,
    ridesRedeemed: 0,
    status: 'active',
    autoRenew: plan.kind === 'subscription',
    purchasedAt: now,
    expiresAt: plan.kind === 'prepaid-pack' ? now + plan.validityDays * MS_PER_DAY : null,
    currentCycleStart: plan.kind === 'subscription' ? now : null,
    currentCycleEnd: plan.kind === 'subscription' ? now + plan.cycleLengthDays * MS_PER_DAY : null,
    cyclesRenewed: 0,
    lapsedReason: null,
    redemptions: [],
  };
  store.ridePasses.push(pass);
  return pass;
}

function getRidePass(store, passId) {
  return store.ridePasses.find((p) => p.id === passId) || null;
}

function listRidePassesForCustomer(store, customerId) {
  return store.ridePasses.filter((p) => p.customerId === customerId);
}

// The real redemption: covers ONE already-accepted job in full from
// the pass's own escrowed funds, provided the pass is still valid
// (unexpired pack / current subscription cycle) and has enough real
// balance left, not merely a nonzero credit count.
async function redeemRidePassForJob(store, options = {}) {
  const { passId, jobId, settleFn, now = Date.now() } = options;
  const pass = getRidePass(store, passId);
  if (!pass) throw new Error(`redeemRidePassForJob: no ride pass with id ${passId}`);
  if (typeof settleFn !== 'function') throw new Error('redeemRidePassForJob requires a settleFn(legs, meta)');
  if (pass.status !== 'active') {
    throw new Error(`redeemRidePassForJob: ride pass ${passId} is "${pass.status}", not active`);
  }
  if (pass.kind === 'prepaid-pack' && now > pass.expiresAt) {
    throw new Error(`redeemRidePassForJob: ride pass ${passId} expired on ${new Date(pass.expiresAt).toISOString()}`);
  }
  if (pass.kind === 'subscription' && now > pass.currentCycleEnd) {
    throw new Error(`redeemRidePassForJob: ride pass ${passId}'s current billing cycle has ended -- renew it before redeeming`);
  }

  const job = getJob(store, jobId);
  if (!job) throw new Error(`redeemRidePassForJob: no job with id ${jobId}`);
  if (job.verticalId !== 'transportation') {
    throw new Error(`redeemRidePassForJob: ride passes only cover the Transportation vertical, job ${jobId} is "${job.verticalId}"`);
  }
  if (job.customerId !== pass.customerId) {
    throw new Error(`redeemRidePassForJob: job ${jobId} does not belong to this ride pass's holder`);
  }
  if (pass.creditsRemaining <= 0) {
    throw new Error(`redeemRidePassForJob: ride pass ${passId} has no ride credits remaining -- complete this ride as a direct charge instead`);
  }
  if (job.totalPrice > pass.balanceRemaining) {
    throw new Error(`redeemRidePassForJob: ride pass ${passId}'s remaining balance ($${pass.balanceRemaining}) cannot cover this ride's $${job.totalPrice} fare -- complete it as a direct charge instead`);
  }

  // Reroute completeJob's own two real legs (provider payout, platform
  // fee) to come out of the pass's escrow rather than the rider -- the
  // exact same leg amounts, same atomicity, just a different payer.
  const completed = await completeJob(store, {
    jobId,
    settleFn: (legs, meta) => settleFn(
      legs.map((leg) => ({ ...leg, fromUserId: VOID_RIDE_PASS_ESCROW_ACCOUNT })),
      meta,
    ),
  });

  pass.creditsRemaining -= 1;
  pass.balanceRemaining = round(pass.balanceRemaining - job.totalPrice);
  pass.ridesRedeemed += 1;
  pass.redemptions.push({ jobId, amount: job.totalPrice, redeemedAt: now });

  return { pass, job: completed };
}

// A subscription's own real renewal: charges the next cycle's full
// price into escrow again (the same up-front shape as the original
// purchase) and resets both the credit count and the real balance --
// unused credits/balance from the prior cycle do NOT roll over, the
// same real "use it or lose it" behavior Uber One/Lyft Pass's own
// monthly allotments have.
async function renewRidePassCycle(store, options = {}) {
  const { passId, settleFn, now = Date.now() } = options;
  const pass = getRidePass(store, passId);
  if (!pass) throw new Error(`renewRidePassCycle: no ride pass with id ${passId}`);
  if (pass.kind !== 'subscription') {
    throw new Error(`renewRidePassCycle: ride pass ${passId} is a "${pass.kind}", not a subscription`);
  }
  if (pass.status !== 'active') {
    throw new Error(`renewRidePassCycle: ride pass ${passId} is "${pass.status}", not active`);
  }
  if (typeof settleFn !== 'function') throw new Error('renewRidePassCycle requires a settleFn(legs, meta)');

  const plan = RIDE_PASS_PLANS[pass.planId];
  await settleFn(
    [{
      fromUserId: pass.customerId, toUserId: VOID_RIDE_PASS_ESCROW_ACCOUNT, amount: plan.price, reason: `void_ride_pass_renewal:${passId}:${pass.cyclesRenewed + 1}`,
    }],
    { reason: `void_ride_pass_renewal:${passId}:${pass.cyclesRenewed + 1}` },
  );

  pass.creditsRemaining = plan.ridesIncluded;
  pass.balanceRemaining = plan.price;
  pass.currentCycleStart = now;
  pass.currentCycleEnd = now + plan.cycleLengthDays * MS_PER_DAY;
  pass.cyclesRenewed += 1;
  return pass;
}

// The holder's own real cancel: stops future billing, but (same as
// any real subscription) does not cut the current, already-paid-for
// cycle short -- the pass stays usable until `currentCycleEnd`, it
// simply will not renew past it. See `sweepRidePassRenewals`.
function cancelRidePassAutoRenew(store, passId) {
  const pass = getRidePass(store, passId);
  if (!pass) throw new Error(`cancelRidePassAutoRenew: no ride pass with id ${passId}`);
  if (pass.kind !== 'subscription') {
    throw new Error(`cancelRidePassAutoRenew: ride pass ${passId} is a "${pass.kind}", not a subscription`);
  }
  pass.autoRenew = false;
  return pass;
}

// Real background-job-runner behavior, the same established pattern
// as this app's own `sweepFailedDeliveries`: finds every subscription
// whose current cycle has genuinely ended and either renews it (real
// charge) or, if auto-renew was turned off or the charge itself fails
// (e.g. insufficient funds), ends it honestly rather than leaving a
// zombie "active" pass with no further rides. Returns the real lists
// so a caller (the interval in server.js, or a test) sees honest
// results instead of a fire-and-forget void call.
async function sweepRidePassRenewals(store, options = {}) {
  const { settleFn, now = Date.now() } = options;
  const due = store.ridePasses.filter((p) => p.kind === 'subscription' && p.status === 'active' && now > p.currentCycleEnd);

  const renewed = [];
  const expired = [];
  const lapsed = [];
  for (const pass of due) {
    if (!pass.autoRenew) {
      pass.status = 'expired';
      expired.push(pass.id);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await renewRidePassCycle(store, { passId: pass.id, settleFn, now });
      renewed.push(pass.id);
    } catch (err) {
      pass.status = 'lapsed';
      pass.lapsedReason = err.message;
      lapsed.push({ id: pass.id, reason: err.message });
    }
  }
  return { renewed, expired, lapsed };
}

module.exports = {
  VOID_RIDE_PASS_ESCROW_ACCOUNT,
  RIDE_PASS_PLANS,
  listRidePassPlans,
  getRidePassPlan,
  purchaseRidePass,
  getRidePass,
  listRidePassesForCustomer,
  redeemRidePassForJob,
  renewRidePassCycle,
  cancelRidePassAutoRenew,
  sweepRidePassRenewals,
};
