// YAP — the safety signal other apps read.
//
// **Why this file exists.** `dev-docs/COMPANY_TREE.md` calls YAP the
// highest-liability item in the ecosystem, and the completion audit
// names it in the tier of *gates other apps trust*. Two things make it
// that:
//
//   1. **The verified-reporter requirement is the whole anti-abuse
//      mechanism.** `yap.js`'s own header is explicit that an
//      unverified reporter is *rejected outright, not weighted* —
//      modelled on Tea's real all-users-verify-to-post practice. If
//      that check ever degrades to a warning, YAP becomes an anonymous
//      libel tool, and the header says so in those words.
//
//   2. **The decoupling from CVNVO matching is deliberate and
//      documented.** CVNVO_CORE_FEATURES.md: a green/red flag has *no*
//      automatic effect on matching, "to avoid a single anonymous
//      report silently tanking someone's match visibility without due
//      process, which would compound Yap's existing defamation-exposure
//      risk."
//
// The failures targeted:
//
//   - an unverified reporter's report being accepted, or accepted-and-
//     discounted rather than refused
//   - a refused report still landing in the store, polluting a summary
//     that a moderator or another app then reads
//   - self-reporting, which is the cheapest way to manufacture a green
//   - a profile lookup failure resolving to a default rather than an
//     error, so an unknown subject looks clean
//   - YAP acquiring a local copy of CVNVO's profile data
//
// Assertions are on the refusal and on the *signal*, never on a status.

const test = require('node:test');
const assert = require('node:assert');

const { createYapStore } = require('../lib/store');
const yap = require('../lib/yap');
const moderation = require('../lib/moderation');

// YAP never keeps profile data. It fetches live through an injected
// `profileFetchFn`, which is what keeps the decoupling real rather than
// aspirational — and makes it directly testable here.
function profiles(map) {
  const calls = [];
  const fn = async (userId) => {
    calls.push(userId);
    if (!(userId in map)) throw new Error(`no CVNVO profile for ${userId}`);
    return map[userId];
  };
  fn.calls = calls;
  return fn;
}

const VERIFIED = { verifiedBadge: true };
const UNVERIFIED = { verifiedBadge: false };

function report(store, profileFetchFn, overrides = {}) {
  return yap.submitYapReport(store, {
    subjectId: 'rio',
    reporterId: 'ada',
    flag: 'red',
    details: 'showed up two hours late and was rude to the staff',
    profileFetchFn,
    ...overrides,
  });
}

// **Submitting a report no longer publishes it**, which is what the
// moderation queue changed, so every test about what a *reader* sees
// has to carry the report through a human decision to get there.
//
// Five tests in this file failed the moment that landed, and all five
// were asserting on `getYapSummary`/`getSafetyLookup` right after a
// submit. They were not wrong tests — they were correct about the old
// behaviour, where a report about a named person went live the instant
// it arrived with nobody in the loop. Routing them through
// `publishReport` is the change, not a workaround for it.
//
// `test/moderation.test.js` covers the queue itself.
async function published(store, profileFetchFn, overrides = {}) {
  const r = await report(store, profileFetchFn, overrides);
  return moderation.publishReport(store, { reportId: r.id, moderatorId: 'mod-dana' });
}

// -- The verified-reporter requirement -----------------------------------

test('an unverified reporter is refused outright, not weighted', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: UNVERIFIED, rio: VERIFIED });

  await assert.rejects(() => report(store, profileFetchFn),
    /only verified users can submit a report/);

  // "Accepted but discounted" is the tempting design and the wrong one:
  // it still puts an unverified accusation into a subject's record.
  assert.strictEqual(store.yapReports.length, 0,
    'a refused report must not exist at all — a discounted one still counts against someone');
  assert.strictEqual(store.nextYapReportId, 1, 'nor burn a report id');
});

test('a verified reporter is accepted, and the badge is read live from CVNVO', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });

  const submitted = await report(store, profileFetchFn);

  assert.strictEqual(submitted.reporterId, 'ada');
  assert.strictEqual(submitted.flag, 'red');
  assert.deepStrictEqual(profileFetchFn.calls, ['ada'],
    'the reporter’s badge is fetched, not taken from the request body');
});

test('a reporter claiming to be verified in the request body is still refused', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: UNVERIFIED, rio: VERIFIED });

  // The body is attacker-controlled. Only the live profile counts.
  await assert.rejects(() => yap.submitYapReport(store, {
    subjectId: 'rio', reporterId: 'ada', flag: 'red', details: 'a report',
    verifiedBadge: true, verified: true, profileFetchFn,
  }), /only verified users can submit a report/);
  assert.strictEqual(store.yapReports.length, 0);
});

test('a reporter with no CVNVO profile is refused rather than treated as unverified-but-present', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ rio: VERIFIED });

  await assert.rejects(() => report(store, profileFetchFn),
    /no real CVNVO profile for reporter ada/);
  assert.strictEqual(store.yapReports.length, 0);
});

test('a report with no profileFetchFn is refused — the check cannot be skipped by omission', async () => {
  const store = createYapStore();

  // The dangerous version: a caller that forgets the injection and gets
  // a report through with no verification performed at all.
  await assert.rejects(() => yap.submitYapReport(store, {
    subjectId: 'rio', reporterId: 'ada', flag: 'red', details: 'a report',
  }), /requires a profileFetchFn/);
  assert.strictEqual(store.yapReports.length, 0);
});

// -- What a report has to be ---------------------------------------------

test('you cannot report yourself', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED });

  // The cheapest possible abuse: a verified user manufacturing their
  // own green flags.
  await assert.rejects(() => report(store, profileFetchFn, { subjectId: 'ada', reporterId: 'ada' }),
    /cannot report yourself/);
  assert.strictEqual(store.yapReports.length, 0);
});

test('only green and red are flags', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });

  assert.deepStrictEqual(yap.YAP_FLAGS, ['green', 'red']);
  for (const flag of ['yellow', 'RED', 'Green', '', null, true, 1]) {
    await assert.rejects(() => report(store, profileFetchFn, { flag }),
      /invalid flag/, `flag ${JSON.stringify(flag)} must be refused`);
  }
  assert.strictEqual(store.yapReports.length, 0);
});

test('a report with no details is refused — an unexplained flag is not reviewable', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });

  await assert.rejects(() => report(store, profileFetchFn, { details: '' }), /requires details/);
  await assert.rejects(() => report(store, profileFetchFn, { details: undefined }), /requires details/);
  assert.strictEqual(store.yapReports.length, 0);
});

test('subjectId and reporterId are both required', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });

  await assert.rejects(() => report(store, profileFetchFn, { subjectId: '' }), /requires a subjectId/);
  await assert.rejects(() => report(store, profileFetchFn, { reporterId: '' }), /requires a reporterId/);
  assert.strictEqual(store.yapReports.length, 0);
});

// -- The signal other apps read ------------------------------------------

test('a summary counts green and red separately, and totals them honestly', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, kai: VERIFIED, ira: VERIFIED, rio: VERIFIED });

  // Three DISTINCT reporters. The old version of this test filed two
  // reports from `kai` on the same subject, which the brigading guard
  // in `submitYapReport` now refuses outright — one account cannot
  // make itself look like two people agreeing.
  await published(store, profileFetchFn, { reporterId: 'ada', flag: 'red' });
  await published(store, profileFetchFn, { reporterId: 'kai', flag: 'green' });
  await published(store, profileFetchFn, { reporterId: 'ira', flag: 'green' });

  const summary = yap.getYapSummary(store, 'rio');
  assert.strictEqual(summary.totalReports, 3);
  assert.strictEqual(summary.redCount, 1);
  assert.strictEqual(summary.greenCount, 2);
  assert.strictEqual(summary.greenCount + summary.redCount, summary.totalReports,
    'every report is exactly one flag — no third bucket can appear');
});

test('a subject with no reports summarises to zeros, not to an error', () => {
  const store = createYapStore();

  // Absence is a real, meaningful answer here: "nobody has said
  // anything" is different from "we could not check", and a lookup that
  // threw would push callers toward swallowing it.
  const summary = yap.getYapSummary(store, 'nobody');
  assert.deepStrictEqual(summary, {
    subjectId: 'nobody', totalReports: 0, greenCount: 0, redCount: 0, disputedCount: 0,
  });
});

test('one subject’s reports never appear under another’s', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED, kai: VERIFIED });

  await published(store, profileFetchFn, { subjectId: 'rio', flag: 'red' });
  await published(store, profileFetchFn, { subjectId: 'kai', flag: 'green' });

  assert.strictEqual(yap.getYapSummary(store, 'rio').redCount, 1);
  assert.strictEqual(yap.getYapSummary(store, 'rio').greenCount, 0);
  assert.strictEqual(yap.getYapSummary(store, 'kai').greenCount, 1);
  assert.strictEqual(yap.getYapSummary(store, 'kai').redCount, 0);
});

test('getYapReports requires a subject rather than returning everything', () => {
  const store = createYapStore();
  // Defaulting to "all reports" would turn a lookup typo into a data
  // dump of every accusation in the system.
  assert.throws(() => yap.getYapReports(store, ''), /requires a subjectId/);
  assert.throws(() => yap.getYapReports(store, undefined), /requires a subjectId/);
});

// -- The standalone safety lookup ----------------------------------------

test('the safety lookup works with no match in existence — that is its whole point', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });
  await published(store, profileFetchFn, { flag: 'red' });

  // Tea's real core use case: checking someone out *before* you engage.
  // Nothing in this call requires a match, a conversation, or any prior
  // relationship.
  const lookup = await yap.getSafetyLookup(store, 'rio', { profileFetchFn });
  assert.strictEqual(lookup.subjectId, 'rio');
  assert.strictEqual(lookup.verifiedBadge, true);
  assert.strictEqual(lookup.redCount, 1);
  assert.strictEqual(lookup.totalReports, 1);
});

test('a lookup on an unknown subject fails loudly instead of looking clean', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED });

  // The quiet failure would be returning zeros for someone who has no
  // profile — indistinguishable from a real person nobody has reported.
  await assert.rejects(() => yap.getSafetyLookup(store, 'ghost', { profileFetchFn }),
    /no real CVNVO profile for ghost/);
});

test('a lookup reports an unverified subject as unverified, and still shows their record', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: UNVERIFIED });
  await published(store, profileFetchFn, { flag: 'red' });

  // Being unverified bars you from *reporting*, not from *being*
  // reported. Conflating the two would let unverified accounts
  // accumulate no record at all.
  const lookup = await yap.getSafetyLookup(store, 'rio', { profileFetchFn });
  assert.strictEqual(lookup.verifiedBadge, false);
  assert.strictEqual(lookup.redCount, 1);
});

test('a lookup with no profileFetchFn is refused rather than answering from local data', async () => {
  const store = createYapStore();
  await assert.rejects(() => yap.getSafetyLookup(store, 'rio', {}),
    /requires a profileFetchFn/);
});

// -- The decoupling ------------------------------------------------------

test('YAP holds no profile data of its own — only reports', () => {
  const store = createYapStore();

  // If a profile, verification, or match field ever appears in this
  // store, YAP has started keeping a local copy of CVNVO's data and the
  // "fetched live" guarantee is gone.
  assert.deepStrictEqual(Object.keys(store).sort(), ['nextYapReportId', 'yapReports']);
});

test('YAP never imports CVNVO’s matching, profiles, or store', () => {
  const source = require('node:fs').readFileSync(require.resolve('../lib/yap.js'), 'utf8');
  const code = source.replace(/^\/\/.*$/gm, '');

  // The documented guarantee is that there is *no code path* from a Yap
  // report to a compatibility score. That is a structural property, so
  // it is asserted structurally: a require of CVNVO's own modules is
  // the only way such a path could exist.
  for (const forbidden of ['matching', 'profiles', '../../lib/store', 'cvnvo/lib']) {
    assert.ok(!new RegExp(`require\\([^)]*${forbidden}`).test(code),
      `yap.js must not require CVNVO's ${forbidden} — a report must never reach a match score`);
  }
});

test('a report records who said it and when, so it can be reviewed later', async () => {
  const store = createYapStore();
  const profileFetchFn = profiles({ ada: VERIFIED, rio: VERIFIED });
  const submitted = await report(store, profileFetchFn);

  // YAP has no moderation queue yet — recorded as a known gap in
  // COMPLETION_AUDIT.md §3.6. These fields are the minimum a future
  // queue needs to exist at all, so losing them would foreclose it.
  assert.ok(submitted.id > 0);
  assert.strictEqual(submitted.reporterId, 'ada');
  assert.ok(typeof submitted.createdAt === 'number' && Number.isFinite(submitted.createdAt));
  assert.ok(submitted.details.length > 0);
});
