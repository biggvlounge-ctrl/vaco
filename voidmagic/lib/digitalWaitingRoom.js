// VOID MAGIC -- Digital Waiting Room (Section 11, Phase 2's second
// real slice). Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS11:
// "For digital experiences: BOOKED -> CONFIRMATION -> REMINDERS ->
// WAITING ROOM -> IDENTITY CHECK -> EXPERIENCE -> EXIT."
//
// Real, honest scoping: BOOKED/CONFIRMATION are already real, existing
// states -- a `Booking` with `status: 'confirmed'` from `bookings.js`
// (Phase 1). REMINDERS is SS33's Notification System, a real, separate
// Phase 2 slice not built yet -- not duplicated or faked here. This
// module builds the three real, new states that only apply to digital/
// hybrid experiences: WAITING ROOM, IDENTITY CHECK, EXPERIENCE
// (admitted), and EXIT.
//
// Real code reuse, not a second verification concept: IDENTITY CHECK
// here is not a new credential system -- it calls straight into
// `bookings.js`'s own real `checkIn()`, the exact same credential
// already issued at booking time (SS6). A digital identity check and a
// physical QR scan are the same real action (present the credential,
// verify it) through two different channels, so this session's
// established "call the existing function, don't build a parallel one"
// principle (VSAFE's safety word calling `triggerEmergency()`, CHOPZ
// SHOP calling VOID's real courier vertical) applies here too:
// `verifyIdentity()` performs the real `checkIn()`, which is what
// actually flips `Booking.status` to `'checked-in'` -- this module's
// own `WaitingRoomSession.status` tracks the additional digital-only
// states layered on top, not a duplicate of Booking's own lifecycle.

const { getBooking, checkIn } = require('./bookings');
const { getExperience } = require('./experiences');
const { createNotification } = require('./notifications');

const WAITING_ROOM_STATUSES = ['waiting-room', 'identity-verified', 'admitted', 'exited'];

// SS11's own scoping: "For digital experiences" -- hybrid experiences
// have a real digital component too (SS4's three experience modes),
// so both formats are real, valid entry points; a purely physical
// experience has no digital room to enter (it uses Phase 1's own QR
// check-in flow directly).
function requireDigitalOrHybrid(experience, action) {
  if (experience.format !== 'digital' && experience.format !== 'hybrid') {
    throw new Error(`${action}: experience ${experience.id} is "${experience.format}", not a digital/hybrid experience with a waiting room`);
  }
}

function enterWaitingRoom(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`enterWaitingRoom: no booking with id ${bookingId}`);
  const experience = getExperience(store, booking.experienceId);
  requireDigitalOrHybrid(experience, 'enterWaitingRoom');
  if (booking.status !== 'confirmed') {
    throw new Error(`enterWaitingRoom: booking ${bookingId} is not in a confirmed state (status: ${booking.status})`);
  }
  if (store.waitingRoomSessions.some((s) => s.bookingId === bookingId)) {
    throw new Error(`enterWaitingRoom: booking ${bookingId} already has a waiting room session`);
  }

  const session = {
    id: store.nextWaitingRoomSessionId++,
    bookingId,
    status: 'waiting-room',
    enteredWaitingRoomAt: now,
    identityVerifiedAt: null,
    admittedAt: null,
    exitedAt: null,
  };
  store.waitingRoomSessions.push(session);
  return session;
}

function getWaitingRoomSession(store, sessionId) {
  return store.waitingRoomSessions.find((s) => s.id === sessionId) || null;
}

// The real identity check step -- reuses `checkIn()` directly, so a
// wrong credential is rejected by the exact same real code path the
// physical flow already uses, not a second, parallel check.
function verifyIdentity(store, options = {}) {
  const { sessionId, providedCredential, now = Date.now() } = options;
  const session = getWaitingRoomSession(store, sessionId);
  if (!session) throw new Error(`verifyIdentity: no waiting room session with id ${sessionId}`);
  if (session.status !== 'waiting-room') {
    throw new Error(`verifyIdentity: session ${sessionId} is not awaiting identity check (status: ${session.status})`);
  }

  checkIn(store, { bookingId: session.bookingId, providedCredential, now });

  session.status = 'identity-verified';
  session.identityVerifiedAt = now;
  return session;
}

function admitToExperience(store, options = {}) {
  const { sessionId, now = Date.now() } = options;
  const session = getWaitingRoomSession(store, sessionId);
  if (!session) throw new Error(`admitToExperience: no waiting room session with id ${sessionId}`);
  if (session.status !== 'identity-verified') {
    throw new Error(`admitToExperience: session ${sessionId} has not passed identity check (status: ${session.status})`);
  }

  session.status = 'admitted';
  session.admittedAt = now;

  const booking = getBooking(store, session.bookingId);
  const experience = getExperience(store, booking.experienceId);
  createNotification(store, {
    recipientId: booking.customerId,
    type: 'experience-starting',
    subject: `"${experience.title}" is starting`,
    message: `You've been admitted to "${experience.title}". It's starting now.`,
    relatedId: booking.id,
    now,
  });

  return session;
}

function exitExperience(store, options = {}) {
  const { sessionId, now = Date.now() } = options;
  const session = getWaitingRoomSession(store, sessionId);
  if (!session) throw new Error(`exitExperience: no waiting room session with id ${sessionId}`);
  if (session.status !== 'admitted') {
    throw new Error(`exitExperience: session ${sessionId} is not currently admitted (status: ${session.status})`);
  }

  session.status = 'exited';
  session.exitedAt = now;
  return session;
}

module.exports = {
  WAITING_ROOM_STATUSES, enterWaitingRoom, getWaitingRoomSession, verifyIdentity, admitToExperience, exitExperience,
};
