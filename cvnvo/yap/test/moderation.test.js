// Yap moderation — a report about a named person does not publish itself.
//
// **What this suite is really asserting.** Before the moderation queue
// existed, `submitYapReport` pushed a report and `getYapReports`
// returned it, so a red flag about a named individual was live the
// instant it arrived — no person in the loop, no dispute path, no
// takedown. `YAP_REVIEW_PLATFORM_COMPARABLES.md` called a dispute and
// removal path "not optional" and then listed it under "Not built".
//
// The property that matters most here is a negative one: there is no
// code path that publishes a report without a named human deciding to.
// A test can only check that by reading the source, so one below does
// exactly that — a behavioural test can only prove that the paths it
// happens to call require a moderator.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { createYapStore } = require('../lib/store');
const yap = require('../lib/yap');
const mod = require('../lib/moderation');

const VERIFIED = { verifiedBadge: true };
const profileFetchFn = async (userId) => {
  if (userId === 'nobody') throw new Error(`no CVNVO profile for ${userId}`);
  return VERIFIED;
};

let clock = 1_700_000_000_000;
function file(store, overrides = {}) {
  clock += 1000;
  return yap.submitYapReport(store, {
    subjectId: 'rio',
    reporterId: 'ada',
    flag: 'red',
    details: 'took a deposit and never showed up',
    profileFetchFn,
    now: clock,
    ...overrides,
  });
}

// -- the core change ----------------------------------------------------

test('a submitted report is not visible to anyone yet', async () => {
  const store = createYapStore();
  const report = await file(store);

  assert.equal(report.status, 'pending');
  assert.deepEqual(yap.getYapReports(store, 'rio'), [],
    'a report was readable before any human reviewed it');
  assert.equal(yap.getYapSummary(store, 'rio').totalReports, 0);

  const lookup = await yap.getSafetyLookup(store, 'rio', { profileFetchFn });
  assert.equal(lookup.totalReports, 0, 'a safety lookup showed an unreviewed accusation');

  // It is in the queue, though — received, not discarded.
  assert.deepEqual(mod.listModerationQueue(store).map((r) => r.id), [report.id]);
  assert.deepEqual(mod.queueDepth(store), { pending: 1, disputed: 0 });
});

test('the public summary does not leak how many reports are awaiting review', async () => {
  // **A pending count was in the first draft of `getYapSummary` and was
  // taken out.** "3 reports awaiting review" is itself a reputational
  // claim about a named person that no human has validated, published
  // to anyone who looks them up — the precise harm the queue exists to
  // prevent. The accepted cost is that a reader cannot tell "no
  // reports" from "not yet reviewed", and that is the right side to
  // err on.
  const store = createYapStore();
  await file(store, { reporterId: 'ada' });
  await file(store, { reporterId: 'kai' });

  const summary = yap.getYapSummary(store, 'rio');
  assert.deepEqual(summary, {
    subjectId: 'rio', totalReports: 0, greenCount: 0, redCount: 0, disputedCount: 0,
  });
  const leaks = Object.keys(summary).filter((k) => /pending|await|queue|review/i.test(k));
  assert.deepEqual(leaks, [], `the public summary exposes ${leaks.join(', ')}`);
});

test('nothing publishes a report without a named moderator', async () => {
  const store = createYapStore();
  const report = await file(store);

  await assert.rejects(
    async () => mod.publishReport(store, { reportId: report.id }),
    /requires a moderatorId/,
  );
  await assert.rejects(
    async () => mod.rejectReport(store, { reportId: report.id, reason: 'thin' }),
    /requires a moderatorId/,
  );
  assert.equal(report.status, 'pending', 'a refused decision changed the report anyway');

  // **And the same property at the source level, which is the only way
  // to state it as "nothing" rather than "not these two calls".** A
  // future timer, threshold or classifier that published on its own
  // would pass every behavioural test above.
  //
  // **Attributed to the enclosing function, not counted.** The first
  // version of this asserted a line count and was simply wrong about
  // the number — there are three such lines, two of them legitimately
  // inside `publishReport` (the plain case and the upheld-dispute
  // case). A count also says nothing useful: three lines in the right
  // two functions is fine, one line in a new `autoPublishStale()` is
  // the thing to catch.
  const source = fs.readFileSync(require.resolve('../lib/moderation.js'), 'utf8');
  let enclosing = '(top level)';
  const writers = new Set();
  for (const line of source.split('\n')) {
    const declaration = line.match(/^function\s+([A-Za-z0-9_]+)\s*\(/);
    if (declaration) enclosing = declaration[1];
    if (/status\s*=\s*['"](published|disputed)['"]/.test(line)) writers.add(enclosing);
  }
  assert.deepEqual([...writers].sort(), ['disputeYapReport', 'publishReport'],
    `a public status is set outside the two functions allowed to set one: ${[...writers].join(', ')}`);

  const yapSource = fs.readFileSync(require.resolve('../lib/yap.js'), 'utf8');
  assert.equal(/status:\s*['"]published['"]/.test(yapSource), false,
    'yap.js creates or sets a published report; only a moderator decision may');
});

test('a published report becomes public, and records who published it', async () => {
  const store = createYapStore();
  const report = await file(store);
  const published = mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });

  assert.equal(published.status, 'published');
  assert.equal(published.reviewedBy, 'mod-dana');
  assert.ok(published.reviewedAt > 0, 'a decision with no timestamp cannot be audited');
  assert.equal(yap.getYapSummary(store, 'rio').redCount, 1);
  assert.deepEqual(mod.listModerationQueue(store), [], 'a decided report stayed in the queue');
});

test('a rejected report needs a reason and never becomes public', async () => {
  const store = createYapStore();
  const report = await file(store);

  await assert.rejects(
    async () => mod.rejectReport(store, { reportId: report.id, moderatorId: 'mod-dana' }),
    /requires a reason/,
    'a safety report was refused with nothing recorded to explain it to the reporter',
  );

  mod.rejectReport(store, {
    reportId: report.id, moderatorId: 'mod-dana', reason: 'no specifics, unverifiable',
  });
  assert.equal(report.status, 'rejected');
  assert.equal(report.reviewReason, 'no specifics, unverifiable');
  assert.deepEqual(yap.getYapReports(store, 'rio'), []);
  assert.deepEqual(mod.listModerationQueue(store), []);

  // And a rejection is not a route back to publication.
  assert.throws(() => mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' }),
    /is rejected, which cannot be published/);
});

// -- the subject's side -------------------------------------------------

test('only the subject of a report may dispute it', async () => {
  const store = createYapStore();
  const report = await file(store);
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });

  assert.throws(() => mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'kai', grounds: 'not me',
  }), /only the subject of a report may dispute it/,
  'anyone could dispute anyone else’s report, driving the whole corpus back into the queue');

  assert.throws(() => mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'rio',
  }), /requires grounds/);
});

test('a dispute keeps the report visible and puts it back in the queue', async () => {
  // **The rejected design, stated because it is the obvious one.**
  // Hiding a report on dispute reads as the cautious choice and is not
  // one: it hands every subject an unconditional mute button, and a
  // safety lookup on someone who disputes everything shows nothing.
  // Yelp and Glassdoor publish the response beside the review instead.
  const store = createYapStore();
  const report = await file(store);
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });

  const disputed = mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'rio', grounds: 'I was never hired by this person',
  });

  assert.equal(disputed.status, 'disputed');
  assert.equal(disputed.dispute.grounds, 'I was never hired by this person');
  assert.equal(yap.getYapReports(store, 'rio').length, 1,
    'the dispute took the report down — that is a mute button, not due process');
  assert.equal(yap.getYapSummary(store, 'rio').disputedCount, 1,
    'a reader cannot see that the subject contested it');
  assert.deepEqual(mod.listModerationQueue(store).map((r) => r.id), [report.id]);
  assert.deepEqual(mod.queueDepth(store), { pending: 0, disputed: 1 });
});

test('upholding a dispute takes it off the queue instead of looping forever', async () => {
  // **This was a real bug in the first version.** Publishing a disputed
  // report set its status back to `disputed` and stopped — and the
  // default queue includes `disputed`, so the same dispute came round
  // again after every ruling, with nothing about the report changed.
  const store = createYapStore();
  const report = await file(store);
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });
  mod.disputeYapReport(store, { reportId: report.id, subjectId: 'rio', grounds: 'wrong person' });

  mod.publishReport(store, {
    reportId: report.id, moderatorId: 'mod-lee', reason: 'reporter produced the receipt',
  });

  assert.equal(report.status, 'disputed', 'the objection was erased when the report was upheld');
  assert.equal(report.dispute.resolved.outcome, 'upheld');
  assert.equal(report.dispute.resolved.by, 'mod-lee');
  assert.equal(yap.getYapReports(store, 'rio').length, 1, 'an upheld report must stay public');
  assert.deepEqual(mod.listModerationQueue(store), [],
    'a ruled-on dispute is still on the queue and will be ruled on forever');
  assert.deepEqual(mod.queueDepth(store), { pending: 0, disputed: 0 });

  // A moderator can still find it deliberately.
  assert.equal(mod.listModerationQueue(store, { includeResolved: true }).length, 1);
});

test('a subject may dispute again, and the earlier round is kept', async () => {
  const store = createYapStore();
  const report = await file(store);
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });
  mod.disputeYapReport(store, { reportId: report.id, subjectId: 'rio', grounds: 'first objection' });
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-lee', reason: 'upheld' });

  mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'rio', grounds: 'new evidence: I have the cancellation',
  });
  assert.equal(report.dispute.grounds, 'new evidence: I have the cancellation');
  assert.equal(report.dispute.resolved, undefined, 'the new dispute arrived pre-resolved');
  assert.equal(report.priorDisputes.length, 1, 'the first objection was overwritten');
  assert.equal(report.priorDisputes[0].grounds, 'first objection');
  assert.deepEqual(mod.listModerationQueue(store).map((r) => r.id), [report.id]);

  // Two open disputes at once is refused — it is already in the queue.
  assert.throws(() => mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'rio', grounds: 'again',
  }), /already disputed/);
});

test('an unpublished report has nothing to dispute', async () => {
  const store = createYapStore();
  const report = await file(store);
  assert.throws(() => mod.disputeYapReport(store, {
    reportId: report.id, subjectId: 'rio', grounds: 'pre-emptive',
  }), /is pending and is not public/);
});

// -- takedown -----------------------------------------------------------

test('a removed report is gone from public view but not from the record', async () => {
  const store = createYapStore();
  const report = await file(store);
  mod.publishReport(store, { reportId: report.id, moderatorId: 'mod-dana' });

  assert.throws(() => mod.removeReport(store, { reportId: report.id, moderatorId: 'mod-lee' }),
    /requires a reason/);

  mod.removeReport(store, {
    reportId: report.id, moderatorId: 'mod-lee', reason: 'subject produced contemporaneous records',
  });

  assert.equal(report.status, 'removed');
  assert.deepEqual(yap.getYapReports(store, 'rio'), []);
  assert.equal(yap.getYapSummary(store, 'rio').totalReports, 0);

  // **Removed, not deleted.** The row proves the platform acted on a
  // complaint, and it keeps the one-report-per-reporter guard honest.
  assert.equal(store.yapReports.length, 1);
  assert.equal(store.yapReports[0].reviewedBy, 'mod-lee');
  assert.throws(() => mod.removeReport(store, {
    reportId: report.id, moderatorId: 'mod-lee', reason: 'again',
  }), /already removed/);
});

// -- brigading ----------------------------------------------------------

test('one account cannot report the same person twice', async () => {
  // Without this, one verified account files ten red flags and the
  // summary reads as ten people agreeing. The count is the whole
  // signal a safety lookup shows, so inflating it is the attack.
  const store = createYapStore();
  const first = await file(store, { reporterId: 'ada' });
  await assert.rejects(() => file(store, { reporterId: 'ada' }),
    /has already reported rio/);

  // Refused, not silently folded in — and the refusal names the
  // existing report so the reporter can ask for it to be revisited.
  assert.equal(store.yapReports.length, 1);

  // A rejected report still holds the slot, or the guard is a speed
  // bump: file, get refused, file again.
  mod.rejectReport(store, { reportId: first.id, moderatorId: 'mod-dana', reason: 'thin' });
  await assert.rejects(() => file(store, { reporterId: 'ada' }), /has already reported rio/);

  // Different reporter, and a different subject, are both fine.
  await file(store, { reporterId: 'kai' });
  await file(store, { reporterId: 'ada', subjectId: 'other' });
  assert.equal(store.yapReports.length, 3);
});

test('a pile-on is flagged for a human and nothing else', async () => {
  const store = createYapStore();
  const now = clock + 10_000;
  for (const reporterId of ['ada', 'kai', 'ira']) {
    await file(store, { reporterId, now: now - 1000 });
  }

  const flagged = mod.detectBrigading(store, { now });
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].subjectId, 'rio');
  assert.equal(flagged[0].distinctReporters, 3);
  assert.match(flagged[0].action, /human review only/);

  // **Flagged, not acted on.** Every report is still exactly where the
  // moderator left it — a threshold that hid or refused reports would
  // be a heuristic making a publishing decision about a named person.
  assert.deepEqual(store.yapReports.map((r) => r.status), ['pending', 'pending', 'pending']);
  assert.equal(mod.queueDepth(store).pending, 3);

  // Two reporters is under the threshold, and an old burst has aged out.
  assert.deepEqual(mod.detectBrigading(store, { now, threshold: 4 }), []);
  assert.deepEqual(mod.detectBrigading(store, { now: now + 48 * 60 * 60 * 1000 }), []);
});

test('the queue is oldest first, so the oldest complaint is not buried', async () => {
  const store = createYapStore();
  const a = await file(store, { reporterId: 'ada', now: 5000 });
  const b = await file(store, { reporterId: 'kai', now: 3000 });
  const c = await file(store, { reporterId: 'ira', now: 9000 });

  assert.deepEqual(mod.listModerationQueue(store).map((r) => r.id), [b.id, a.id, c.id]);
  assert.deepEqual(mod.listModerationQueue(store, { subjectId: 'nobody-else' }), []);
});

test('a decision on a report that does not exist is refused, not invented', () => {
  const store = createYapStore();
  assert.throws(() => mod.publishReport(store, { reportId: 999, moderatorId: 'mod-dana' }),
    /no report 999/);
});
