// VSAFE -- Screen Time / Digital Wellbeing: the second real,
// comparable-grounded addition beyond CVNVO's original system.
// Source of truth: UNIVERSAL_SAFETY_LAYER_VSAFE.md's `ScreenTimeCheckIn
// { userId, appId, sessionDurationMinutes, dailyTotalMinutes,
// isMinorAccount, promptShown, promptDismissalCount }`, plus its own
// direct, named recommendation: "real transparency... plus genuinely
// stronger, less-dismissible protections for known-minor accounts
// specifically... not a diluted [feature] designed to avoid tension
// with VCoin's earning mechanic."
//
// **Real, deliberate deviation from the doc's literal shape, flagged
// directly**: `dailyTotalMinutes` is treated as a real *derived* value
// -- summed live from this user's own real session records for the
// real calendar day -- rather than a field trusted to stay in sync on
// its own, matching this session's own established "never a counter
// that could desync from reality" principle (VXLLAGE's
// `villageEvents.js`, CVNVO's `DateEvent.visibleAttendeeCount`). The
// one real field that genuinely can't be derived from anything else is
// `promptDismissalCount` -- an actual count of real dismissal *events*
// for the day, not something recomputable from session data, so it
// stays a real, deliberately-mutated counter, unlike the total.
//
// **Real, named enforcement asymmetry, per the doc's own instruction**:
// crossing the daily limit always surfaces a real, visible prompt
// (transparency for every account). Only for a real, known
// `isMinorAccount` does repeated dismissal escalate the prompt's own
// `severity` to `'reinforced'` -- TikTok's real "genuinely stronger,
// harder-to-dismiss" mechanic for teen accounts, not a single
// dismissible tap regardless of who's asking. A non-minor account's
// dismissals are still counted (real transparency data), but never
// escalate severity -- flagged as the deliberate distinction the doc
// itself asks for, not an oversight.
//
// No exact minute thresholds are given anywhere in the source doc --
// both limits below are real, flagged interpretive defaults, not
// invented precision: `DEFAULT_DAILY_LIMIT_MINUTES` (120, the real,
// commonly-cited "2 hours/day" recreational-screen-time guidance
// behind both Apple Screen Time's and Google Digital Wellbeing's own
// default dashboards) and a stricter `MINOR_DAILY_LIMIT_MINUTES` (60),
// reflecting the doc's own "stronger... for known-minor accounts"
// framing, not a specific cited number.

const DEFAULT_DAILY_LIMIT_MINUTES = 120;
const MINOR_DAILY_LIMIT_MINUTES = 60;
const MAX_DISMISSALS_BEFORE_REINFORCED = 3;
const PROMPT_SEVERITIES = ['standard', 'reinforced'];

function todayKey(now) {
  return new Date(now).toISOString().slice(0, 10); // real calendar-day granularity, same convention as CVNVO's longDistance.js
}

function recordSession(store, options = {}) {
  const {
    userId, appId, sessionDurationMinutes, isMinorAccount = false, now = Date.now(),
  } = options;

  if (!userId) throw new Error('recordSession requires a userId');
  if (!appId) throw new Error('recordSession requires an appId');
  if (!Number.isFinite(sessionDurationMinutes) || sessionDurationMinutes <= 0) {
    throw new Error('recordSession requires a positive sessionDurationMinutes');
  }
  if (typeof isMinorAccount !== 'boolean') throw new Error('recordSession requires a boolean isMinorAccount');

  store.screenTimeSessions.push({
    id: store.nextScreenTimeSessionId++, userId, appId, sessionDurationMinutes, isMinorAccount, createdAt: now,
  });

  const dailyTotalMinutes = getDailyTotalMinutes(store, userId, now);
  const limit = isMinorAccount ? MINOR_DAILY_LIMIT_MINUTES : DEFAULT_DAILY_LIMIT_MINUTES;
  const checkIn = getOrCreateTodayCheckIn(store, userId, isMinorAccount, now);
  if (dailyTotalMinutes >= limit) checkIn.promptShown = true;

  return {
    userId, appId, sessionDurationMinutes, dailyTotalMinutes, isMinorAccount,
    limitMinutes: limit, promptShown: checkIn.promptShown, promptSeverity: checkIn.promptSeverity,
  };
}

// Real, derived total -- summed live from this user's own real
// sessions for the real calendar day, never trusted as a stored value.
function getDailyTotalMinutes(store, userId, now = Date.now()) {
  const key = todayKey(now);
  return store.screenTimeSessions
    .filter((s) => s.userId === userId && todayKey(s.createdAt) === key)
    .reduce((sum, s) => sum + s.sessionDurationMinutes, 0);
}

function getOrCreateTodayCheckIn(store, userId, isMinorAccount, now) {
  const key = todayKey(now);
  let checkIn = store.screenTimeCheckIns.find((c) => c.userId === userId && c.date === key);
  if (!checkIn) {
    checkIn = {
      userId, date: key, isMinorAccount, promptShown: false, promptDismissalCount: 0, promptSeverity: 'standard',
    };
    store.screenTimeCheckIns.push(checkIn);
  }
  return checkIn;
}

function getScreenTimeCheckIn(store, options = {}) {
  const { userId, now = Date.now() } = options;
  const key = todayKey(now);
  return store.screenTimeCheckIns.find((c) => c.userId === userId && c.date === key) || null;
}

// Real dismissal event -- always counted (real transparency data for
// every account), but only escalates severity for a real, known minor
// account past the real dismissal-pattern threshold, per the doc's own
// named asymmetry.
function dismissPrompt(store, options = {}) {
  const { userId, now = Date.now() } = options;
  const checkIn = getScreenTimeCheckIn(store, { userId, now });
  if (!checkIn) throw new Error(`dismissPrompt: no screen-time check-in recorded today for ${userId}`);
  if (!checkIn.promptShown) throw new Error(`dismissPrompt: no prompt is currently shown for ${userId} today`);

  checkIn.promptDismissalCount += 1;
  if (checkIn.isMinorAccount && checkIn.promptDismissalCount >= MAX_DISMISSALS_BEFORE_REINFORCED) {
    checkIn.promptSeverity = 'reinforced';
  }
  return checkIn;
}

module.exports = {
  DEFAULT_DAILY_LIMIT_MINUTES, MINOR_DAILY_LIMIT_MINUTES, MAX_DISMISSALS_BEFORE_REINFORCED, PROMPT_SEVERITIES,
  recordSession, getDailyTotalMinutes, getScreenTimeCheckIn, dismissPrompt,
};
