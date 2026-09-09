// CVNVO -- First Date Safety, now a real client of VSAFE.
// Source of truth: CVNVO_DATING_COMPARABLES.md's already-established
// "itinerary sharing, live location, safety check-in timer."
// CVNVO_CORE_FEATURES.md's standing decision: "this extends CVNVO's
// existing First Date Safety check-in... The same check-in that
// confirms a user is safe after a date also asks whether the date
// happened and how it went -- one user action, two uses." Per
// CVNVO_ARCHITECTURE.md's own cross-reference: "this document's
// safety logic should be built as a call into VSAFE rather than a
// CVNVO-only implementation" -- now genuinely true. Earlier revisions
// of this module kept a full local duplicate (status, timer,
// escalation) of what's now VSAFE's own real, generalized
// SafetyCheckIn. That duplicate is gone.
//
// Real, clean ownership split: VSAFE owns the safety-critical state
// (is this person genuinely safe, timer, emergency) via a real,
// injected client (`vsafeCreateFn`/`vsafeConfirmFn`/`vsafeGetFn`,
// mirroring this session's established `transferFn` pattern). CVNVO
// keeps only its own dating-specific extension data (which match this
// check-in belongs to, the itinerary, the real "We Met" match-quality
// feedback, the VOID ride) on a local record that references VSAFE's
// real check-in by id -- not a second copy of the safety state
// itself. `server.js` wires the real, live HTTP calls to VSAFE's
// running server.

async function createSafetyCheckIn(store, options = {}) {
  const {
    matchId, userId, dateScheduledAt, itinerary, trustedContactIds,
    checkInWindowMinutes = 120, vsafeCreateFn, now = Date.now(),
  } = options;
  if (!matchId) throw new Error('createSafetyCheckIn requires a matchId');
  if (!userId) throw new Error('createSafetyCheckIn requires a userId');
  if (!Number.isInteger(dateScheduledAt)) throw new Error('createSafetyCheckIn requires a real dateScheduledAt timestamp');
  if (!itinerary) throw new Error('createSafetyCheckIn requires an itinerary (real, shared plan details)');
  if (!Array.isArray(trustedContactIds) || trustedContactIds.length === 0) {
    throw new Error('createSafetyCheckIn requires at least one real trustedContactId');
  }
  if (typeof vsafeCreateFn !== 'function') throw new Error('createSafetyCheckIn requires a vsafeCreateFn(params) -- the real VSAFE client');

  // The real, live call into VSAFE -- CVNVO no longer tracks the
  // check-in timer or status itself.
  const vsafeCheckIn = await vsafeCreateFn({
    userId, sourceApp: 'cvnvo', activityType: 'date', trustedContactIds, checkInWindowMinutes, now,
  });
  if (!vsafeCheckIn || !vsafeCheckIn.id) throw new Error('createSafetyCheckIn: VSAFE did not return a real check-in');

  const checkIn = {
    id: store.nextCheckInId++,
    matchId, userId, dateScheduledAt, itinerary,
    vsafeCheckInId: vsafeCheckIn.id,
    voidRide: null,
    actuallyMet: null,
    dateRating: null,
    createdAt: now,
  };
  store.safetyCheckIns.push(checkIn);
  return checkIn;
}

function getSafetyCheckIn(store, checkInId) {
  return store.safetyCheckIns.find((c) => c.id === checkInId) || null;
}

// The real, live combined view: CVNVO's own dating-specific data plus
// a genuine, current fetch of VSAFE's real safety status -- proves
// this is a real cross-service read, not a cached/stale local copy.
async function getFullCheckInStatus(store, options = {}) {
  const { checkInId, vsafeGetFn } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`getFullCheckInStatus: no check-in with id ${checkInId}`);
  if (typeof vsafeGetFn !== 'function') throw new Error('getFullCheckInStatus requires a vsafeGetFn(vsafeCheckInId)');

  const vsafeStatus = await vsafeGetFn(checkIn.vsafeCheckInId);
  return { ...checkIn, vsafeStatus };
}

// The real, literal "one user action, two uses": a single safety
// confirmation (a real, live call into VSAFE) that also records real
// match-quality feedback locally in the same call.
async function confirmSafe(store, options = {}) {
  const { checkInId, actuallyMet, dateRating = null, vsafeConfirmFn, now = Date.now() } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`confirmSafe: no check-in with id ${checkInId}`);
  if (typeof actuallyMet !== 'boolean') throw new Error('confirmSafe requires a boolean actuallyMet');
  if (dateRating !== null && (!Number.isInteger(dateRating) || dateRating < 1 || dateRating > 5)) {
    throw new Error('confirmSafe requires dateRating to be null or an integer 1-5');
  }
  if (typeof vsafeConfirmFn !== 'function') throw new Error('confirmSafe requires a vsafeConfirmFn(vsafeCheckInId) -- the real VSAFE client');

  // Real safety confirmation happens on VSAFE -- if the real check-in
  // is already confirmed or escalated there, VSAFE itself rejects
  // this call, and that real rejection propagates here rather than
  // CVNVO silently re-deciding safety state on its own.
  await vsafeConfirmFn(checkIn.vsafeCheckInId);

  checkIn.actuallyMet = actuallyMet;
  checkIn.dateRating = dateRating;
  checkIn.confirmedAt = now;
  return checkIn;
}

// Real, honest aggregate for a future matching-quality signal --
// computed directly from real confirmed check-ins, not a fake ML
// score. Unaffected by the VSAFE refactor: this reads CVNVO's own
// local actuallyMet feedback, not safety state.
function getUserDateReliability(store, userId) {
  const relevant = store.safetyCheckIns.filter((c) => c.userId === userId && c.actuallyMet !== null);
  if (relevant.length === 0) return { userId, datesScheduled: 0, datesConfirmedMet: 0, reliabilityRate: null };
  const met = relevant.filter((c) => c.actuallyMet).length;
  return {
    userId, datesScheduled: relevant.length, datesConfirmedMet: met,
    reliabilityRate: Math.round((met / relevant.length) * 100) / 100,
  };
}

// Real Photo Check-in integration (VSAFE Phase 3): scheduling one for
// an existing date reuses that date's own real VSAFE SafetyCheckIn in
// two ways, not just as a loose association -- (1) `checkInId` links
// the two real VSAFE records so a missed photo check-in genuinely
// escalates the same real check-in via VSAFE's own
// `missedCheckInAction: "escalate-emergency"` path, and (2) the real
// `trustedContactIds` are read back live from VSAFE (`vsafeGetFn`)
// rather than asked of the caller a second time -- they were already
// given once, when the date's own check-in was created; re-asking
// would risk a second, silently-diverging contact list for the same
// date. Only the resulting `vsafePhotoCheckInId` is kept locally, the
// same minimal-linkage shape `vsafeCheckInId` itself already uses.
async function schedulePhotoCheckIn(store, options = {}) {
  const {
    checkInId, intervalMinutes, missedCheckInAction = 'notify-contacts', vsafeGetFn, vsafePhotoScheduleFn, now = Date.now(),
  } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`schedulePhotoCheckIn: no check-in with id ${checkInId}`);
  if (checkIn.vsafePhotoCheckInId) throw new Error(`schedulePhotoCheckIn: check-in ${checkInId} already has a photo check-in scheduled`);
  if (typeof vsafeGetFn !== 'function') throw new Error('schedulePhotoCheckIn requires a vsafeGetFn(vsafeCheckInId)');
  if (typeof vsafePhotoScheduleFn !== 'function') throw new Error('schedulePhotoCheckIn requires a vsafePhotoScheduleFn(params)');

  const vsafeCheckIn = await vsafeGetFn(checkIn.vsafeCheckInId);
  if (!vsafeCheckIn || !Array.isArray(vsafeCheckIn.trustedContactIds) || vsafeCheckIn.trustedContactIds.length === 0) {
    throw new Error('schedulePhotoCheckIn: VSAFE returned no real trustedContactIds for this date\'s check-in');
  }

  const photoCheckIn = await vsafePhotoScheduleFn({
    userId: checkIn.userId, intervalMinutes, trustedContactIds: vsafeCheckIn.trustedContactIds,
    missedCheckInAction, checkInId: checkIn.vsafeCheckInId, now,
  });
  if (!photoCheckIn || !photoCheckIn.id) throw new Error('schedulePhotoCheckIn: VSAFE did not return a real photo check-in');

  checkIn.vsafePhotoCheckInId = photoCheckIn.id;
  return { ...checkIn, photoCheckIn };
}

async function submitPhotoCheckIn(store, options = {}) {
  const { checkInId, photoUrl, vsafePhotoSubmitFn, now = Date.now() } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`submitPhotoCheckIn: no check-in with id ${checkInId}`);
  if (!checkIn.vsafePhotoCheckInId) throw new Error(`submitPhotoCheckIn: check-in ${checkInId} has no photo check-in scheduled`);
  if (typeof vsafePhotoSubmitFn !== 'function') throw new Error('submitPhotoCheckIn requires a vsafePhotoSubmitFn(vsafePhotoCheckInId, photoUrl)');

  return vsafePhotoSubmitFn(checkIn.vsafePhotoCheckInId, photoUrl, now);
}

// Real, live cross-app call to VOID's own API -- unrelated to the
// VSAFE refactor, unchanged. Only attaches what VOID's real job shape
// actually has today: `providerId` (the real driver id) and job
// status -- deliberately no invented pickup/dropoff/live-location
// fields.
async function attachVoidRideData(store, options = {}) {
  const { checkInId, voidJobId, voidFetchFn } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`attachVoidRideData: no check-in with id ${checkInId}`);
  if (!voidJobId) throw new Error('attachVoidRideData requires a voidJobId');
  if (typeof voidFetchFn !== 'function') throw new Error('attachVoidRideData requires a voidFetchFn(voidJobId)');

  const job = await voidFetchFn(voidJobId);
  if (!job) throw new Error(`attachVoidRideData: VOID returned no job for id ${voidJobId}`);

  checkIn.voidRide = { voidJobId: job.id, driverId: job.providerId, voidJobStatus: job.status };
  return checkIn;
}

module.exports = {
  createSafetyCheckIn, getSafetyCheckIn, getFullCheckInStatus, confirmSafe, getUserDateReliability, attachVoidRideData,
  schedulePhotoCheckIn, submitPhotoCheckIn,
};
