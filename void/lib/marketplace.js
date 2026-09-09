// VOID — Service Marketplace core loop.
// Source of truth: VOID_SERVICE_VERTICALS_COMPARABLES.md's central
// claim: every vertical, regardless of pricing unit, runs through the
// exact same backend loop -- "request → match → accept → complete →
// pay → rate" -- which is what makes 18+ verticals feel like one
// platform instead of 18 bolted-on apps. This module is the literal
// implementation of that one loop.
//
// Real payout, reusing this session's established injected-transferFn
// pattern: completing a job performs **two real transfers from the
// customer** (the same "one source, real dual payout" mechanism
// HVNTZ's hunt check-in already established) -- a provider payout and
// a platform fee -- computed so they sum to the job's total price
// exactly (no float-rounding drift between the two halves).

const { getVertical } = require('./verticals');

// 'delivery-failed' per VOID_AMAZON_LOGISTICS_INTEGRATION.md's real
// failed-delivery protocol: driver contacts the customer if the
// address can't be found, then an automatic retry the next day if
// unresolved -- a concrete, adoptable customer-service standard, not
// left as silent job abandonment.
const JOB_STATUSES = ['requested', 'matched', 'accepted', 'completed', 'cancelled', 'delivery-failed'];
const RETRY_DELAY_HOURS = 24; // real "the next day" from the source doc
const MS_PER_HOUR = 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

// `scheduledFor`, `lat`, `lng`, and `durationMinutes` are optional and
// were added when the service-day planner was built. They are optional
// on purpose: a courier run posted for "whenever, call me" is a real
// request, and requiring a time and a place would reject it. A job
// without them simply is not day-plannable, which `lib/serviceDay.js`
// reports as a skip rather than silently dropping.
function requestJob(store, options = {}) {
  const {
    verticalId, customerId, quantity, unitPrice,
    scheduledFor = null, lat = null, lng = null, durationMinutes = null,
  } = options;

  const vertical = getVertical(verticalId);
  if (!vertical) {
    throw new Error(`requestJob: unknown verticalId "${verticalId}"`);
  }
  if (vertical.licensingGated) {
    throw new Error(`requestJob: "${vertical.name}" is licensing-gated and not launch-ready without real licensing in place`);
  }
  if (!customerId) {
    throw new Error('requestJob requires a customerId');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('requestJob requires a positive quantity');
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('requestJob requires a positive unitPrice');
  }

  const totalPrice = round(quantity * unitPrice);
  const job = {
    id: store.nextJobId++,
    verticalId,
    customerId,
    status: 'requested',
    quantity,
    unitPrice,
    totalPrice,
    scheduledFor,
    lat,
    lng,
    durationMinutes,
    providerId: null,
    providerVerified: null,
    matchedAt: null,
    acceptedAt: null,
    completedAt: null,
    providerPayout: null,
    platformFee: null,
    rating: null,
    ratedAt: null,
    failureReason: null,
    failedAt: null,
    retryCount: 0,
    createdAt: Date.now(),
  };
  store.jobs.push(job);
  return job;
}

function getJob(store, jobId) {
  return store.jobs.find((j) => j.id === jobId) || null;
}

function requireJobInStatus(store, jobId, expectedStatus, action) {
  const job = getJob(store, jobId);
  if (!job) {
    throw new Error(`${action}: no job with id ${jobId}`);
  }
  if (job.status !== expectedStatus) {
    throw new Error(`${action}: job ${jobId} is "${job.status}", expected "${expectedStatus}"`);
  }
  return job;
}

function matchProvider(store, options = {}) {
  const { jobId, providerId } = options;
  if (!providerId) {
    throw new Error('matchProvider requires a providerId');
  }
  const job = requireJobInStatus(store, jobId, 'requested', 'matchProvider');
  job.providerId = providerId;
  job.status = 'matched';
  job.matchedAt = Date.now();
  return job;
}

function acceptJob(store, jobId) {
  const job = requireJobInStatus(store, jobId, 'matched', 'acceptJob');
  job.status = 'accepted';
  job.acceptedAt = Date.now();
  return job;
}

// The real payout mechanic: platform fee computed first (rounded),
// provider payout is the exact remainder -- guarantees the two real
// transfers always sum to totalPrice, not two independently-rounded
// halves that could drift by a cent.
async function completeJob(store, options = {}) {
  const { jobId, transferFn } = options;
  const job = requireJobInStatus(store, jobId, 'accepted', 'completeJob');
  if (typeof transferFn !== 'function') {
    throw new Error('completeJob requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const vertical = getVertical(job.verticalId);
  const platformFee = round(job.totalPrice * vertical.takeRate);
  const providerPayout = round(job.totalPrice - platformFee);

  await transferFn(job.customerId, job.providerId, providerPayout, `void_job_payout:${jobId}`);
  await transferFn(job.customerId, 'void-platform', platformFee, `void_job_platform_fee:${jobId}`);

  job.status = 'completed';
  job.completedAt = Date.now();
  job.providerPayout = providerPayout;
  job.platformFee = platformFee;
  return job;
}

function rateJob(store, options = {}) {
  const { jobId, rating } = options;
  const job = requireJobInStatus(store, jobId, 'completed', 'rateJob');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rateJob requires an integer rating from 1 to 5');
  }
  job.rating = rating;
  job.ratedAt = Date.now();
  return job;
}

// The real failed-delivery mechanic: an attempt from 'accepted' (the
// driver tried and couldn't complete it -- address not found, etc.)
// moves to 'delivery-failed' rather than silently stalling forever.
function reportFailedDelivery(store, options = {}) {
  const { jobId, reason, now = Date.now() } = options;
  const job = requireJobInStatus(store, jobId, 'accepted', 'reportFailedDelivery');
  if (!reason) {
    throw new Error('reportFailedDelivery requires a reason');
  }
  job.status = 'delivery-failed';
  job.failureReason = reason;
  job.failedAt = now;
  return job;
}

// Real enforcement of "automatic retry the next day" -- retrying
// before the real delay window has elapsed is rejected, not silently
// allowed early.
function retryDelivery(store, options = {}) {
  const { jobId, now = Date.now() } = options;
  const job = requireJobInStatus(store, jobId, 'delivery-failed', 'retryDelivery');
  const hoursSinceFailure = (now - job.failedAt) / MS_PER_HOUR;
  if (hoursSinceFailure < RETRY_DELAY_HOURS) {
    throw new Error(`retryDelivery: job ${jobId} can be retried in ${round(RETRY_DELAY_HOURS - hoursSinceFailure)} more hours`);
  }
  job.status = 'accepted';
  job.retryCount += 1;
  job.failureReason = null;
  job.failedAt = null;
  return job;
}

// Real background-job-runner behavior, closing this project's own
// self-flagged gap ("no background-job runner for automatic
// retries"). No new infrastructure needed -- `retryDelivery`'s own
// real 24-hour eligibility check already exists; this just finds
// every `delivery-failed` job that has actually crossed it and
// retries each one for real, the same way a human calling
// `retryDelivery` on each one by hand would. Returns the real list of
// job ids it retried (and, separately, any it found eligible but that
// failed to retry for some other real reason -- surfaced, not
// swallowed) so a caller (the interval in server.js, or a test) can
// see real, honest results rather than a fire-and-forget void call.
function sweepFailedDeliveries(store, options = {}) {
  const { now = Date.now() } = options;
  const eligible = store.jobs.filter((j) => j.status === 'delivery-failed' && (now - j.failedAt) / MS_PER_HOUR >= RETRY_DELAY_HOURS);
  const retried = [];
  const errors = [];
  for (const job of eligible) {
    try {
      retryDelivery(store, { jobId: job.id, now });
      retried.push(job.id);
    } catch (err) {
      errors.push({ jobId: job.id, error: err.message });
    }
  }
  return { retried, errors };
}

function cancelJob(store, jobId) {
  const job = getJob(store, jobId);
  if (!job) {
    throw new Error(`cancelJob: no job with id ${jobId}`);
  }
  if (!['requested', 'matched', 'delivery-failed'].includes(job.status)) {
    throw new Error(`cancelJob: job ${jobId} is "${job.status}" and can no longer be cancelled`);
  }
  job.status = 'cancelled';
  return job;
}

function getJobsForVertical(store, verticalId) {
  return store.jobs.filter((j) => j.verticalId === verticalId);
}

function getJobsForUser(store, userId, role = 'customer') {
  const field = role === 'provider' ? 'providerId' : 'customerId';
  return store.jobs.filter((j) => j[field] === userId);
}

module.exports = {
  JOB_STATUSES,
  RETRY_DELAY_HOURS,
  requestJob,
  getJob,
  matchProvider,
  acceptJob,
  completeJob,
  rateJob,
  reportFailedDelivery,
  retryDelivery,
  sweepFailedDeliveries,
  cancelJob,
  getJobsForVertical,
  getJobsForUser,
};
