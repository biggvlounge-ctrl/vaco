// Yap -- the decoupled safety-report app.
// Source of truth: CVNVO_ARCHITECTURE.md's `YapReport { id, subjectId,
// reporterId, flag: "green" | "red", details }` -- explicitly
// annotated "decoupled -- never affects Match.compatibilityScore" --
// and `POST /yap/reports -- explicitly does NOT write to CVNVO's
// match tables`. CVNVO_CORE_FEATURES.md is explicit about why: "a Yap
// green/red-flag review has no automatic effect on CVNVO's own
// matching algorithm; keeping these decoupled avoids a single
// anonymous report silently tanking someone's match visibility
// without due process, which would compound Yap's existing
// defamation-exposure risk."
//
// Per explicit instruction, Yap is now architecturally decoupled one
// step further: a genuinely separate, standalone app from CVNVO, not
// just a separate module inside it (the same real split just applied
// to CHOPZ/CHOPZ SHOP). This module never imports CVNVO's own
// lib/matching.js, lib/store.js, or lib/profiles.js at all -- there is
// no code path from a Yap report to a compatibility score, and no
// local copy of CVNVO's profile data. Where CVNVO's own profile data
// is genuinely needed (the verified-reporter check, the safety
// lookup's verification badge), it's fetched live through an injected
// `profileFetchFn(userId)`, mirroring this session's established
// cross-app pattern (CVNVO's own `voidFetchFn`/`vsafeCreateFn`), not
// duplicated locally.
//
// Modeled directly on the real Tea app, per explicit direction --
// gender-neutral by confirmed decision (nothing else in CVNVO's docs
// suggests a gender-restricted design, unlike Tea's actual women-
// reviewing-men scope). Two of Tea's real, load-bearing mechanics are
// built here: (1) a genuine VERIFIED-REPORTER requirement -- Tea only
// lets verified users post reviews at all, the real anti-abuse
// mechanism that keeps the system from being a pure anonymous-
// libel tool; CVNVO's own real `verifiedBadge` on `UserProfile` is
// reused here via a live fetch, rather than inventing a second
// verification concept. (2) A real SAFETY LOOKUP that works
// standalone, before any match exists -- Tea's actual core use case is
// checking someone out before you ever engage with them, not only
// reviewing people you've already matched with. `getSafetyLookup()` is
// that real, match-independent lookup, already naturally supported
// since `submitYapReport`/`getYapReports` never required a match in
// the first place -- made explicit and prominent here as its own real
// feature, not an incidental side effect.

const YAP_FLAGS = ['green', 'red'];

// **Submitting a report is no longer publishing it**, and that is the
// point of this list. `YAP_REVIEW_PLATFORM_COMPARABLES.md` calls this
// "the highest-liability product in the ecosystem, and it is not
// close", names a dispute and removal path as "not optional", and then
// listed it under "Not built". It is built now, in `lib/moderation.js`.
//
// A report arrives `pending` and is visible to nobody but a moderator.
// A person decides whether it publishes. Nothing in this app publishes
// a report on a timer, a threshold, or a heuristic -- content review is
// a human process here, the same standing rule the rest of the repo
// follows, and `test/moderation.test.js` asserts there is no code path
// that publishes without a named moderator.
//
//   pending    submitted, awaiting a human. Not public.
//   published  a moderator published it. Public.
//   rejected   a moderator refused it, with a reason. Never public.
//   disputed   the subject contested a published report. STILL PUBLIC,
//              with the dispute attached -- see `disputeYapReport` for
//              why taking it down on request would have been worse.
//   removed    taken down for good, with a reason. Never public again.
const YAP_STATUSES = ['pending', 'published', 'rejected', 'disputed', 'removed'];

// The two a safety lookup may see. Everything else is either waiting
// for a person or has been refused by one.
const PUBLIC_STATUSES = ['published', 'disputed'];

async function submitYapReport(store, options = {}) {
  const {
    subjectId, reporterId, flag, details, profileFetchFn, now = Date.now(),
  } = options;
  if (!subjectId) throw new Error('submitYapReport requires a subjectId');
  if (!reporterId) throw new Error('submitYapReport requires a reporterId');
  if (subjectId === reporterId) throw new Error('submitYapReport: cannot report yourself');
  if (!YAP_FLAGS.includes(flag)) {
    throw new Error(`submitYapReport: invalid flag "${flag}" (expected one of ${YAP_FLAGS.join(', ')})`);
  }
  if (!details) throw new Error('submitYapReport requires details');
  if (typeof profileFetchFn !== 'function') throw new Error('submitYapReport requires a profileFetchFn(userId)');

  // **One report per reporter per subject.** The comparables document
  // lists "any fraud or brigading resistance" as not built, and this is
  // the cheapest half of it: without this, one verified account files
  // ten red flags on the same person and the summary reads as ten
  // people agreeing. The count is the whole signal a safety lookup
  // shows, so inflating it is the attack.
  //
  // Refused rather than silently folded into the existing report: a
  // reporter whose second submission vanished would have no way to tell
  // that it had, and someone with genuinely new information needs to
  // know to ask for the first one to be revisited.
  //
  // A rejected or removed report still occupies the slot. Letting a
  // refusal free it up would make the guard a speed bump -- file,
  // get refused, file again.
  const already = store.yapReports.find(
    (r) => r.subjectId === subjectId && r.reporterId === reporterId,
  );
  if (already) {
    throw new Error(
      `submitYapReport: ${reporterId} has already reported ${subjectId} `
      + `(report ${already.id}, currently ${already.status}). One report per person per subject.`,
    );
  }

  // The real Tea anti-abuse mechanic: only a genuinely verified
  // reporter's report is accepted at all -- not weighted differently,
  // rejected outright, matching Tea's actual all-users-verify-to-post
  // practice. The reporter's real profile is fetched live from CVNVO,
  // not assumed from the request body.
  let reporterProfile;
  try {
    reporterProfile = await profileFetchFn(reporterId);
  } catch (err) {
    throw new Error(`submitYapReport: no real CVNVO profile for reporter ${reporterId} (${err.message})`);
  }
  if (!reporterProfile.verifiedBadge) {
    throw new Error('submitYapReport: only verified users can submit a report, per Yap\'s real Tea-model anti-abuse requirement');
  }

  const report = {
    id: store.nextYapReportId++,
    subjectId,
    reporterId,
    flag,
    details,
    createdAt: now,
    // Pending, not published. The fields a review fills in are present
    // and null rather than absent, so a report's shape does not change
    // as it moves through the queue -- a consumer reading
    // `report.reviewedBy` gets null on a pending one instead of
    // undefined on some and a value on others.
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: null,
    dispute: null,
  };
  store.yapReports.push(report);
  return report;
}

// **The public read, and it shows published reports only.** This used
// to return everything in the store for a subject, which meant a
// report was live the instant it was submitted -- no review, no
// dispute path, and nothing between an accusation about a named person
// and anyone who looked them up.
//
// A disputed report stays in this list on purpose (see
// `disputeYapReport`). A pending, rejected or removed one never
// appears here; `listModerationQueue` in `lib/moderation.js` is the
// only way to see those, and it needs an operator scope.
function getYapReports(store, subjectId) {
  if (!subjectId) throw new Error('getYapReports requires a subjectId');
  return store.yapReports.filter(
    (r) => r.subjectId === subjectId && PUBLIC_STATUSES.includes(r.status),
  );
}

// A real, honest aggregate for a real moderator review surface --
// counts only, no automated action taken on them anywhere in this
// module.
function getYapSummary(store, subjectId) {
  // **A pending count is deliberately NOT here, and the first draft of
  // this had one.** The argument for it was that a moderator backlog
  // otherwise looks identical to a clean record. The argument against
  // it is stronger: "3 reports awaiting review" is itself a
  // reputational claim about a named person that no human has
  // validated, published to anyone who looks them up. That is the
  // precise harm the queue exists to prevent, and leaking the count
  // reintroduces it without even the accountability of content
  // somebody approved.
  //
  // So the trade is accepted and stated rather than engineered around:
  // a reader cannot tell "no reports" from "reports not yet
  // reviewed". `listModerationQueue` is where the backlog is visible,
  // to the people whose job it is.
  const reports = getYapReports(store, subjectId);
  return {
    subjectId,
    totalReports: reports.length,
    greenCount: reports.filter((r) => r.flag === 'green').length,
    redCount: reports.filter((r) => r.flag === 'red').length,
    // A reader deciding what to make of a red flag should know the
    // subject contested it, so this is public. It is a fact about
    // content a moderator already published.
    disputedCount: reports.filter((r) => r.status === 'disputed').length,
  };
}

// The real, standalone Tea-style lookup: works for anyone with a real
// CVNVO profile, regardless of match status -- combines the subject's
// real verification status (fetched live) with their real Yap record
// into one "look before you leap" view.
async function getSafetyLookup(store, subjectId, options = {}) {
  const { profileFetchFn } = options;
  if (typeof profileFetchFn !== 'function') throw new Error('getSafetyLookup requires a profileFetchFn(userId)');

  let profile;
  try {
    profile = await profileFetchFn(subjectId);
  } catch (err) {
    throw new Error(`getSafetyLookup: no real CVNVO profile for ${subjectId} (${err.message})`);
  }
  return { subjectId, verifiedBadge: profile.verifiedBadge, ...getYapSummary(store, subjectId) };
}

module.exports = {
  YAP_FLAGS, YAP_STATUSES, PUBLIC_STATUSES,
  submitYapReport, getYapReports, getYapSummary, getSafetyLookup,
};
