// Yap -- the moderation queue, the dispute path, and removal.
//
// **Why this exists.** `YAP_REVIEW_PLATFORM_COMPARABLES.md` is blunt
// about what Yap is: "the highest-liability product in the ecosystem,
// and it is not close." Every other compliance concern in the repo is a
// licensing or clearance problem with a known process; this one is a
// defamation exposure with no registration that makes it safe. That
// document listed four things as **not built** -- "dispute/appeal flow,
// removal process, identity verification of reviewers, and any fraud or
// brigading resistance" -- and noted that "every comparable above has
// all four, and the ones that added them late did so under pressure."
//
// Three of the four are built here and in `yap.js`. The fourth,
// identity verification of reviewers, was already real: `yap.js`
// refuses a report from anyone without CVNVO's own `verifiedBadge`,
// fetched live rather than taken from the request body.
//
// ---------------------------------------------------------------------
// A person decides. Always.
//
// There is no automatic publication anywhere in this app: no timer, no
// report-count threshold, no keyword classifier, no "publish unless
// disputed within N days". `publishReport` and `rejectReport` both
// require a `moderatorId` and record it, and
// `test/moderation.test.js` reads this file's own source to assert that
// nothing else writes `status: 'published'`.
//
// That is the same standing rule the rest of the repo follows for
// content review, and it matters most here. An automated publish is the
// platform "materially contributing to the content", which is exactly
// the posture that loses the Section 230 protection the comparables
// document describes.
//
// ---------------------------------------------------------------------
// The dispute design, and the version of it I rejected
//
// **A dispute does NOT take the report down.** The obvious design is
// the opposite: the subject objects, the report is hidden, a human
// looks at it. It reads as the cautious choice and it is not one --
// it hands every subject an unconditional mute button. File a dispute
// on each red flag and a safety lookup shows nothing, which defeats
// the product for exactly the people it exists to protect.
//
// So a disputed report stays visible with the dispute attached to it,
// and goes back into the moderator queue. That is what Yelp and
// Glassdoor do with a contested review -- the response is published
// beside it rather than replacing it -- and it gives the subject a
// real, visible answer without giving them a veto.
//
// The moderator re-review is the part that has teeth: `removeReport`
// takes it down for good, and a dispute is the ordinary route to one.
//
// ---------------------------------------------------------------------
// What this deliberately does not do
//
// **It does not notify anybody.** A subject is not told that a report
// about them was published, and a reporter is not told their report
// was rejected. Both should happen and both are cross-app work
// (vaco-notify), so they are a named gap rather than a half-built
// one -- see the app README.
//
// **It does not decide the policy.** What makes a report publishable
// is a judgement this module records and does not make. The
// comparables document is explicit that this needs Deskins before
// launch rather than after, and nothing here substitutes for that.

const { PUBLIC_STATUSES } = require('./yap');

//: Flagged interpretive. No source document sets a brigading window.
//: This is the span over which a burst of reports about one person is
//: worth a moderator's attention -- long enough that a coordinated
//: pile-on falls inside it, short enough that an ordinary trickle of
//: unrelated reports does not.
const BRIGADING_WINDOW_MS = 24 * 60 * 60 * 1000;

//: Also interpretive: how many reports inside that window make a
//: burst. Three distinct reporters in a day about one person is the
//: shape of a coordinated campaign rather than a coincidence.
//:
//: **It flags, and that is all it does.** Nothing is auto-hidden,
//: auto-rejected or rate-limited on the strength of this number. A
//: threshold that took action would be a heuristic making a publishing
//: decision about a named person, which is the one thing this app does
//: not do.
const BRIGADING_THRESHOLD = 3;

class ModerationError extends Error {}

function findReport(store, reportId) {
  const report = store.yapReports.find((r) => r.id === reportId);
  if (!report) throw new ModerationError(`no report ${reportId}`);
  return report;
}

// -- the queue ---------------------------------------------------------

// Everything a moderator needs to act, oldest first, because a review
// queue worked newest-first leaves the oldest complaint unread forever.
//
// `status` defaults to the two that need a decision: `pending` reports
// nobody has looked at, and `disputed` ones that need a second look.
// Passing an explicit status is how a moderator reviews their own past
// decisions.
function listModerationQueue(store, options = {}) {
  const { status = ['pending', 'disputed'], subjectId = null, includeResolved = false } = options;
  const wanted = Array.isArray(status) ? status : [status];
  return store.yapReports
    .filter((r) => {
      if (!wanted.includes(r.status)) return false;
      if (subjectId && r.subjectId !== subjectId) return false;
      // A dispute a moderator has already ruled on is off the queue.
      // Without this the report stays `disputed` after being upheld and
      // comes back round forever -- see `publishReport`.
      if (!includeResolved && r.dispute && r.dispute.resolved) return false;
      return true;
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

// The backlog, as a number a dashboard can show. Separate from the
// queue itself so a count does not mean loading every report.
function queueDepth(store) {
  const depth = { pending: 0, disputed: 0 };
  for (const r of store.yapReports) {
    if (r.status === 'pending') depth.pending += 1;
    // Only unresolved disputes are backlog; a ruled-on one is done.
    else if (r.status === 'disputed' && !(r.dispute && r.dispute.resolved)) depth.disputed += 1;
  }
  return depth;
}

// -- the two decisions -------------------------------------------------

function publishReport(store, options = {}) {
  const { reportId, moderatorId, reason = null, now = Date.now() } = options;
  if (!moderatorId) {
    throw new ModerationError(
      'publishReport requires a moderatorId — publishing a report about a named person '
      + 'is a decision a person takes, and this app records who took it',
    );
  }
  const report = findReport(store, reportId);

  // Publishable from `pending` (the first decision) or `disputed` (the
  // subject contested it and a moderator upheld it). Not from
  // `rejected` or `removed`: a decision already taken is revisited by
  // taking a new report, not by quietly flipping a terminal one back.
  if (report.status !== 'pending' && report.status !== 'disputed') {
    throw new ModerationError(
      `report ${reportId} is ${report.status}, which cannot be published`,
    );
  }

  // **An upheld dispute stays `disputed`, and that needs a resolution
  // marker or the report never leaves the queue.** The first version of
  // this set the status back to `disputed` and stopped, so a moderator
  // could uphold the same dispute forever: the default queue includes
  // `disputed`, and nothing about the report had changed.
  //
  // The dispute record is kept rather than cleared, because the reader
  // should still see that the subject answered -- erasing the objection
  // as the price of upholding the report would hide half the exchange.
  // So the dispute is marked resolved instead, and the queue skips a
  // resolved one.
  if (report.dispute) {
    report.status = 'disputed';
    report.dispute.resolved = { by: moderatorId, at: now, outcome: 'upheld', reason };
  } else {
    report.status = 'published';
  }
  report.reviewedBy = moderatorId;
  report.reviewedAt = now;
  report.reviewReason = reason;
  return report;
}

function rejectReport(store, options = {}) {
  const { reportId, moderatorId, reason, now = Date.now() } = options;
  if (!moderatorId) throw new ModerationError('rejectReport requires a moderatorId');
  // **A reason is required here and optional on publish**, which is
  // not an inconsistency. Refusing somebody's safety report is the
  // decision that needs to be answerable later -- to the reporter who
  // filed it, and to anyone asking why a pattern was not acted on.
  if (!reason) {
    throw new ModerationError(
      'rejectReport requires a reason — a refused safety report with no recorded reason '
      + 'cannot be explained to the person who filed it',
    );
  }
  const report = findReport(store, reportId);
  if (report.status !== 'pending') {
    throw new ModerationError(
      `report ${reportId} is ${report.status}; only a pending report can be rejected `
      + '(use removeReport to take down something already published)',
    );
  }
  report.status = 'rejected';
  report.reviewedBy = moderatorId;
  report.reviewedAt = now;
  report.reviewReason = reason;
  return report;
}

// -- the subject's side ------------------------------------------------

function disputeYapReport(store, options = {}) {
  const { reportId, subjectId, grounds, now = Date.now() } = options;
  if (!subjectId) throw new ModerationError('disputeYapReport requires the subjectId');
  if (!grounds) {
    throw new ModerationError('disputeYapReport requires grounds — what is wrong with the report');
  }
  const report = findReport(store, reportId);

  // **Only the subject of a report may dispute it.** Checked against
  // the report's own `subjectId`, not taken on trust from the caller:
  // otherwise anyone could file disputes on anyone's behalf and drive
  // the whole published corpus back into the queue.
  //
  // The route above this must still prove the caller *is* that subject.
  // This check proves the named subject is the right one; it cannot
  // prove the session belongs to them, and saying so here is better
  // than implying the module has authenticated anybody.
  if (report.subjectId !== subjectId) {
    throw new ModerationError(
      `report ${reportId} is not about ${subjectId} — only the subject of a report may dispute it`,
    );
  }
  if (!PUBLIC_STATUSES.includes(report.status)) {
    throw new ModerationError(
      `report ${reportId} is ${report.status} and is not public, so there is nothing to dispute`,
    );
  }
  if (report.dispute && !report.dispute.resolved) {
    throw new ModerationError(
      `report ${reportId} is already disputed; it is in the moderator queue`,
    );
  }
  // A dispute a moderator already ruled on may be raised again -- the
  // subject may have something new. The previous round is kept in
  // `priorDisputes` rather than overwritten, so a pattern of repeated
  // disputes on one report is visible to whoever reviews the next one.
  if (report.dispute && report.dispute.resolved) {
    report.priorDisputes = [...(report.priorDisputes || []), report.dispute];
  }

  report.dispute = { by: subjectId, grounds, at: now };
  report.status = 'disputed';
  return report;
}

// -- takedown ----------------------------------------------------------

function removeReport(store, options = {}) {
  const { reportId, moderatorId, reason, now = Date.now() } = options;
  if (!moderatorId) throw new ModerationError('removeReport requires a moderatorId');
  if (!reason) throw new ModerationError('removeReport requires a reason');
  const report = findReport(store, reportId);
  if (report.status === 'removed') {
    throw new ModerationError(`report ${reportId} is already removed`);
  }

  // **Removed, not deleted.** The row stays, with who removed it and
  // why. Two reasons, and the second is the one that matters: a
  // takedown that erased the record would also erase the evidence that
  // the platform acted on a complaint, which is the thing worth being
  // able to show. It also keeps the one-report-per-reporter guard in
  // `submitYapReport` honest -- deleting the row would let a removed
  // report be re-filed.
  report.status = 'removed';
  report.reviewedBy = moderatorId;
  report.reviewedAt = now;
  report.reviewReason = reason;
  return report;
}

// -- brigading ---------------------------------------------------------

// Subjects who have taken a burst of reports from several different
// reporters inside the window, for a moderator to look at.
//
// **Distinct reporters, not report count.** Counting reports would be
// satisfied by one person filing repeatedly, which `submitYapReport`
// already refuses -- so it would flag nothing that can happen. A
// coordinated campaign is several accounts, and that is what this
// counts.
function detectBrigading(store, options = {}) {
  const {
    now = Date.now(),
    windowMs = BRIGADING_WINDOW_MS,
    threshold = BRIGADING_THRESHOLD,
  } = options;

  const since = now - windowMs;
  const bySubject = new Map();
  for (const r of store.yapReports) {
    if (r.createdAt < since) continue;
    if (r.status === 'rejected' || r.status === 'removed') continue;
    if (!bySubject.has(r.subjectId)) bySubject.set(r.subjectId, new Set());
    bySubject.get(r.subjectId).add(r.reporterId);
  }

  return [...bySubject.entries()]
    .filter(([, reporters]) => reporters.size >= threshold)
    .map(([subjectId, reporters]) => ({
      subjectId,
      distinctReporters: reporters.size,
      windowMs,
      // Named so nobody reads this as an action taken.
      action: 'flagged for human review only',
    }))
    .sort((a, b) => b.distinctReporters - a.distinctReporters);
}

module.exports = {
  ModerationError,
  BRIGADING_WINDOW_MS,
  BRIGADING_THRESHOLD,
  listModerationQueue,
  queueDepth,
  publishReport,
  rejectReport,
  disputeYapReport,
  removeReport,
  detectBrigading,
};
