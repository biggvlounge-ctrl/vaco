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

async function submitYapReport(store, options = {}) {
  const {
    subjectId, reporterId, flag, details, profileFetchFn,
  } = options;
  if (!subjectId) throw new Error('submitYapReport requires a subjectId');
  if (!reporterId) throw new Error('submitYapReport requires a reporterId');
  if (subjectId === reporterId) throw new Error('submitYapReport: cannot report yourself');
  if (!YAP_FLAGS.includes(flag)) {
    throw new Error(`submitYapReport: invalid flag "${flag}" (expected one of ${YAP_FLAGS.join(', ')})`);
  }
  if (!details) throw new Error('submitYapReport requires details');
  if (typeof profileFetchFn !== 'function') throw new Error('submitYapReport requires a profileFetchFn(userId)');

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
    id: store.nextYapReportId++, subjectId, reporterId, flag, details, createdAt: Date.now(),
  };
  store.yapReports.push(report);
  return report;
}

function getYapReports(store, subjectId) {
  if (!subjectId) throw new Error('getYapReports requires a subjectId');
  return store.yapReports.filter((r) => r.subjectId === subjectId);
}

// A real, honest aggregate for a real moderator review surface --
// counts only, no automated action taken on them anywhere in this
// module.
function getYapSummary(store, subjectId) {
  const reports = getYapReports(store, subjectId);
  return {
    subjectId,
    totalReports: reports.length,
    greenCount: reports.filter((r) => r.flag === 'green').length,
    redCount: reports.filter((r) => r.flag === 'red').length,
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
  YAP_FLAGS, submitYapReport, getYapReports, getYapSummary, getSafetyLookup,
};
