// HVNTZ — Ad Content Review Workflow.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md's ad tier system
// (`lib/adPricing.js`) names four ad tiers, each requiring a QR code,
// with no submission/approval workflow around them -- content just
// "runs." This closes that real, previously-flagged gap ("Ad
// submission/content review workflow" in the Phase 3 README): a real
// pending -> approved/rejected state machine, and running an approved
// submission triggers the actual `screen-ad` revenue event via
// Phase 1's `recordRevenueEvent`, closing the loop between ad pricing
// and real payout.
//
// No review process, reviewer role, or approval criteria is specified
// anywhere in any source doc -- this is a real, minimal, flagged
// workflow: submitted content is pending until explicitly
// approved/rejected, and only approved content can be run.

const { getBusiness, getLocation, recordRevenueEvent } = require('./revenueStack');

const AD_REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

function submitAdContent(store, options = {}) {
  const { businessId, locationId, tier, content, qrCodeUrl } = options;
  if (!getBusiness(store, businessId)) {
    throw new Error(`submitAdContent: no business with id ${businessId}`);
  }
  const location = getLocation(store, locationId);
  if (!location) {
    throw new Error(`submitAdContent: no location with id ${locationId}`);
  }
  if (location.locationType !== 'screen') {
    throw new Error(`submitAdContent: location ${locationId} is not a screen location`);
  }
  if (!content) {
    throw new Error('submitAdContent requires content');
  }
  if (!qrCodeUrl) {
    throw new Error('submitAdContent requires a qrCodeUrl (every ad tier requires a QR code)');
  }

  const submission = {
    id: store.nextAdSubmissionId++,
    businessId,
    locationId,
    tier,
    content,
    qrCodeUrl,
    status: 'pending',
    reviewerNote: null,
    submittedAt: Date.now(),
    reviewedAt: null,
    timesRun: 0,
  };
  store.adSubmissions.push(submission);
  return submission;
}

function getAdSubmission(store, submissionId) {
  return store.adSubmissions.find((s) => s.id === submissionId) || null;
}

function reviewAdSubmission(store, options = {}) {
  const { submissionId, approved, reviewerNote = null } = options;
  const submission = getAdSubmission(store, submissionId);
  if (!submission) {
    throw new Error(`reviewAdSubmission: no ad submission with id ${submissionId}`);
  }
  if (submission.status !== 'pending') {
    throw new Error(`reviewAdSubmission: submission ${submissionId} has already been reviewed (status: ${submission.status})`);
  }
  if (typeof approved !== 'boolean') {
    throw new Error('reviewAdSubmission requires a boolean approved');
  }

  submission.status = approved ? 'approved' : 'rejected';
  submission.reviewerNote = reviewerNote;
  submission.reviewedAt = Date.now();
  return submission;
}

function getAdSubmissions(store, options = {}) {
  const { businessId, status } = options;
  return store.adSubmissions.filter(
    (s) => (businessId ? s.businessId === businessId : true) && (status ? s.status === status : true)
  );
}

// Running an approved submission is the actual payout event -- proves
// the review workflow is connected to real revenue, not a separate
// disconnected moderation queue.
async function runAdSubmission(store, options = {}) {
  const { submissionId, amountEarned, payerId, settleFn } = options;
  const submission = getAdSubmission(store, submissionId);
  if (!submission) {
    throw new Error(`runAdSubmission: no ad submission with id ${submissionId}`);
  }
  if (submission.status !== 'approved') {
    throw new Error(`runAdSubmission: submission ${submissionId} is not approved (status: ${submission.status})`);
  }

  const revenueEvent = await recordRevenueEvent(store, {
    locationId: submission.locationId,
    eventType: 'screen-ad',
    amountEarned,
    payerId,
    settleFn,
  });
  submission.timesRun += 1;

  return { submission, revenueEvent };
}

module.exports = {
  AD_REVIEW_STATUSES,
  submitAdContent,
  getAdSubmission,
  reviewAdSubmission,
  getAdSubmissions,
  runAdSubmission,
};
