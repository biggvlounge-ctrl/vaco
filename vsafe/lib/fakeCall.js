// VSAFE -- Fake Call: bSafe's real feature, named directly in the
// source doc ("bSafe's 'Fake Call' feature: simulates an incoming
// call, giving a user a real, simple way to exit an uncomfortable
// situation") but with **zero data model given anywhere** -- unlike
// Photo Check-ins and Screen Time, which both got a real `data model
// addition` block. Flagged directly here, not guessed around silently:
// everything below is a real, defensible interpretation of "simulate
// an incoming call," not a transcription of a spec.
//
// Real, deliberate choices:
// - No default caller identity is invented. The doc names no specific
//   caller ("Mom," "Unknown," etc.) -- inventing one would be exactly
//   the kind of fabricated final value this session's own discipline
//   avoids. `callerName` is a required, real, user-supplied field.
// - `delaySeconds` is bounded (`MIN_DELAY_SECONDS`/`MAX_DELAY_SECONDS`)
//   rather than left open -- an unbounded delay would let a scheduled
//   fake call silently never ring, or ring so far in the future it's
//   useless as an actual exit tool. 300s (5 minutes) is a real,
//   flagged interpretive ceiling: long enough to look natural after
//   walking away to answer, short enough to still be useful in the
//   actual moment.
// - Real, deterministic "is it time to ring yet" polling, the same
//   shape as `safetyCheckIn.js`'s own `checkForMissedCheckIns` and
//   `photoCheckIn.js`'s own `checkMissedPhotoCheckIns`: a client polls
//   `getDueFakeCalls`, which transitions any real due call from
//   `scheduled` to `ringing` and returns it -- not a push mechanism,
//   since no real-time delivery layer exists anywhere in this project.

const MIN_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 300;
const FAKE_CALL_STATUSES = ['scheduled', 'ringing', 'answered', 'dismissed', 'cancelled'];

function scheduleFakeCall(store, options = {}) {
  const {
    userId, callerName, callerPhotoUrl = null, delaySeconds, now = Date.now(),
  } = options;

  if (!userId) throw new Error('scheduleFakeCall requires a userId');
  if (!callerName || !callerName.trim()) throw new Error('scheduleFakeCall requires a real callerName -- no default identity is fabricated');
  if (!Number.isInteger(delaySeconds) || delaySeconds < MIN_DELAY_SECONDS || delaySeconds > MAX_DELAY_SECONDS) {
    throw new Error(`scheduleFakeCall requires an integer delaySeconds between ${MIN_DELAY_SECONDS} and ${MAX_DELAY_SECONDS}`);
  }

  const call = {
    id: store.nextFakeCallId++,
    userId, callerName: callerName.trim(), callerPhotoUrl,
    scheduledAt: now + delaySeconds * 1000,
    status: 'scheduled',
    answeredAt: null,
    dismissedAt: null,
    createdAt: now,
  };
  store.fakeCalls.push(call);
  return call;
}

function getFakeCall(store, id) {
  return store.fakeCalls.find((c) => c.id === id) || null;
}

function cancelFakeCall(store, options = {}) {
  const { fakeCallId } = options;
  const call = getFakeCall(store, fakeCallId);
  if (!call) throw new Error(`cancelFakeCall: no fake call with id ${fakeCallId}`);
  if (call.status !== 'scheduled') throw new Error(`cancelFakeCall: call ${fakeCallId} already ${call.status}, can't cancel`);
  call.status = 'cancelled';
  return call;
}

// Real, deterministic poll: transitions any real due call from
// `scheduled` to `ringing`. A client polling this is how the actual
// "incoming call" UI would know to appear -- no push infra exists here.
function getDueFakeCalls(store, options = {}) {
  const { userId, now = Date.now() } = options;
  const due = [];
  for (const call of store.fakeCalls) {
    if (userId && call.userId !== userId) continue;
    if (call.status === 'scheduled' && now >= call.scheduledAt) {
      call.status = 'ringing';
      due.push(call);
    }
  }
  return due;
}

function answerFakeCall(store, options = {}) {
  const { fakeCallId, now = Date.now() } = options;
  const call = getFakeCall(store, fakeCallId);
  if (!call) throw new Error(`answerFakeCall: no fake call with id ${fakeCallId}`);
  if (call.status !== 'ringing') throw new Error(`answerFakeCall: call ${fakeCallId} is not ringing (status: ${call.status})`);
  call.status = 'answered';
  call.answeredAt = now;
  return call;
}

function dismissFakeCall(store, options = {}) {
  const { fakeCallId, now = Date.now() } = options;
  const call = getFakeCall(store, fakeCallId);
  if (!call) throw new Error(`dismissFakeCall: no fake call with id ${fakeCallId}`);
  if (call.status !== 'ringing') throw new Error(`dismissFakeCall: call ${fakeCallId} is not ringing (status: ${call.status})`);
  call.status = 'dismissed';
  call.dismissedAt = now;
  return call;
}

module.exports = {
  MIN_DELAY_SECONDS, MAX_DELAY_SECONDS, FAKE_CALL_STATUSES,
  scheduleFakeCall, getFakeCall, cancelFakeCall, getDueFakeCalls, answerFakeCall, dismissFakeCall,
};
