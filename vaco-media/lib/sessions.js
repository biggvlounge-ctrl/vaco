// VACO MEDIA — live media sessions and the grants into them.
//
// **What this owns, and it is deliberately one thing:** establishing
// and tearing down a media session between named participants, issuing
// short-lived per-participant join credentials, and reporting what the
// transport says actually happened.
//
// **What it does not own**, each for a reason
// `dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md` already states:
//
//   - **Authorization policy.** Shield says who someone is; the
//     consuming app decides whether they may join. This service
//     enforces the grant it was handed and invents no policy. CVNVO
//     decides who is in a speed date; it tells us, we do not ask.
//   - **Domain rules.** Speed-date duration is CVNVO's. Ring timeout is
//     V4's. Neither migrates here.
//   - **Being a second identity system.** The failure this ecosystem
//     keeps avoiding.
//
// **Addressed by the consumer's own id.** A session carries
// `(app, externalId)` — `('cvnvo', 'speed-date-42')` — so nothing is
// duplicated and a consumer never has to store our id to find its own
// room. That pair is unique, and re-creating an open session returns
// the existing one rather than a second room the participants would be
// split across.

const crypto = require('crypto');

class MediaError extends Error {}

// What kind of session, because the transport needs to know and
// because the four consumers genuinely differ. Closed vocabulary for
// the same reason the audit log's is: free text drifts into a dozen
// spellings and stops being queryable.
const SESSION_KINDS = [
  'call',        // two-party, V4 agent calls and CVNVO speed dates
  'room',        // many-party conversational, VXLLAGE Live
  'broadcast',   // one-to-many, Vavlt Stvdios channels
  'wall',        // many simultaneous inbound feeds, the eight-screen session
];

const SESSION_STATUSES = ['open', 'live', 'ended'];

// A participant may publish, subscribe, or both. This is a *transport*
// capability, not a permission — the consuming app already decided the
// person belongs here; this says what they do once inside. A viewer on
// a broadcast subscribes and does not publish, and that distinction is
// what stops a Vavlt Stvdios audience member from appearing on the wall.
const ROLES = ['publisher', 'subscriber', 'both'];

// Short by design. A join credential is a bearer token for a live
// media session: long expiry means a leaked one is useful for a long
// time, and a participant who needs longer can be re-granted.
const DEFAULT_GRANT_TTL_MS = 10 * 60 * 1000;
const MAX_GRANT_TTL_MS = 60 * 60 * 1000;

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MediaError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function createSession(store, options = {}) {
  const a = 'createSession';
  const {
    app, externalId, kind, createdBy,
    maxParticipants = null, recordable = false, now = Date.now(),
  } = options;

  if (!SESSION_KINDS.includes(kind)) {
    throw new MediaError(`${a}: kind must be one of ${SESSION_KINDS.join(', ')}`);
  }
  if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 1)) {
    throw new MediaError(`${a}: maxParticipants must be a positive integer or null`);
  }

  const appName = requireString(app, 'app', a);
  const external = requireString(String(externalId ?? ''), 'externalId', a);

  // Re-creating an open session returns the existing one. Without this,
  // two consumers racing on the same room -- or one retrying -- puts
  // participants in two different rooms that each look correct.
  const existing = store.sessions.find(
    (s) => s.app === appName && s.externalId === external && s.status !== 'ended',
  );
  if (existing) return existing;

  const session = {
    id: store.nextSessionId++,
    app: appName,
    externalId: external,
    kind,
    status: 'open',
    createdBy: requireString(createdBy, 'createdBy', a),
    maxParticipants,
    // Consent-gated, and false unless the consumer says otherwise.
    // Vavlt Stvdios needs recording; a CVNVO speed date must not be
    // recordable by default, and the default is where that is decided.
    recordable: recordable === true,
    recordingStartedAt: null,
    createdAt: now,
    endedAt: null,
  };
  store.sessions.push(session);
  return session;
}

function getSession(store, sessionId) {
  return store.sessions.find((s) => s.id === sessionId) || null;
}

function findSession(store, app, externalId) {
  return store.sessions.find(
    (s) => s.app === app && s.externalId === String(externalId) && s.status !== 'ended',
  ) || null;
}

// -- Grants: the security boundary --------------------------------------

// The credential is minted here and returned once. It is stored as a
// digest, like every other credential in this ecosystem, because these
// stores are written to disk and backed up off-host.
//
// **This must never be issued by a client.** A browser that can mint
// its own join token can join any room it can name, which is the whole
// attack. The consuming app asks on the participant's behalf, over a
// service credential, and hands the result down.
function issueGrant(store, options = {}) {
  const a = 'issueGrant';
  const {
    sessionId, participantId, role = 'both',
    ttlMs = DEFAULT_GRANT_TTL_MS, issuedBy, now = Date.now(),
  } = options;

  if (!ROLES.includes(role)) {
    throw new MediaError(`${a}: role must be one of ${ROLES.join(', ')}`);
  }
  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > MAX_GRANT_TTL_MS) {
    throw new MediaError(`${a}: ttlMs must be between 1000 and ${MAX_GRANT_TTL_MS}`);
  }

  const session = getSession(store, sessionId);
  if (!session) throw new MediaError(`${a}: no session with id ${sessionId}`);
  if (session.status === 'ended') {
    throw new MediaError(`${a}: session ${sessionId} has ended`);
  }

  const participant = requireString(String(participantId ?? ''), 'participantId', a);

  // Capacity is checked against *live* grants rather than against
  // reported joins: a seat held by someone connecting is taken. Doing
  // it the other way lets a room overfill in the window between grant
  // and join, which is exactly when a popular room fills.
  const active = activeGrants(store, sessionId, now);
  const alreadyHeld = active.find((g) => g.participantId === participant);
  if (!alreadyHeld && session.maxParticipants !== null
      && active.length >= session.maxParticipants) {
    throw new MediaError(
      `${a}: session ${sessionId} is full (${session.maxParticipants} participants)`,
    );
  }

  const credential = `vmg_${crypto.randomBytes(32).toString('hex')}`;
  const grant = {
    id: store.nextGrantId++,
    sessionId,
    participantId: participant,
    role,
    credentialDigest: crypto.createHash('sha256').update(credential).digest('hex'),
    issuedBy: requireString(issuedBy, 'issuedBy', a),
    issuedAt: now,
    expiresAt: now + ttlMs,
    revokedAt: null,
  };
  store.grants.push(grant);
  return { grant, credential };
}

function activeGrants(store, sessionId, now = Date.now()) {
  return store.grants.filter(
    (g) => g.sessionId === sessionId && !g.revokedAt && g.expiresAt > now,
  );
}

// Revocation is immediate and is a mark, not a delete: "who was in this
// call" is a question that outlives the call, and it is the question a
// dispute about a recorded session actually asks.
function revokeGrant(store, options = {}) {
  const a = 'revokeGrant';
  const { grantId, revokedBy, now = Date.now() } = options;
  const grant = store.grants.find((g) => g.id === grantId);
  if (!grant) throw new MediaError(`${a}: no grant with id ${grantId}`);
  if (grant.revokedAt) return grant;
  grant.revokedAt = now;
  grant.revokedBy = requireString(revokedBy, 'revokedBy', a);
  return grant;
}

// The question the transport asks on every join attempt.
//
// Returns a verdict rather than throwing, because the caller turns it
// into a 401/403 and the reason is what makes a refused join
// diagnosable. Expiry is compared against `now` on every call: a grant
// does not become valid again because the process restarted.
function verifyGrant(store, options = {}) {
  const { credential, sessionId, now = Date.now() } = options;

  if (typeof credential !== 'string' || credential.length === 0) {
    return { ok: false, reason: 'no join credential presented' };
  }
  const digest = crypto.createHash('sha256').update(credential).digest('hex');
  const grant = store.grants.find((g) => g.credentialDigest === digest);
  if (!grant) return { ok: false, reason: 'join credential not recognised' };
  if (grant.revokedAt) return { ok: false, reason: 'this join credential was revoked' };
  if (grant.expiresAt <= now) return { ok: false, reason: 'this join credential has expired' };

  // A grant is scoped to exactly one session. Without this check a
  // credential for a room you are allowed into is a credential for
  // every room -- the difference between a ticket and a skeleton key.
  if (sessionId !== undefined && grant.sessionId !== sessionId) {
    return { ok: false, reason: 'this join credential is for a different session' };
  }

  const session = getSession(store, grant.sessionId);
  if (!session || session.status === 'ended') {
    return { ok: false, reason: 'that session has ended' };
  }

  return {
    ok: true,
    sessionId: grant.sessionId,
    participantId: grant.participantId,
    role: grant.role,
  };
}

// -- Lifecycle ----------------------------------------------------------

const EVENT_KINDS = [
  'joined', 'left', 'quality', 'recording-started', 'recording-stopped', 'error',
];

// Reported by the transport, never inferred. A consumer learns a call
// actually connected rather than assuming it did, which is the whole
// reason V4's agent call flow could not be finished before this
// existed: `ring -> connected` was a state change nobody could confirm.
function recordEvent(store, options = {}) {
  const a = 'recordEvent';
  const { sessionId, kind, participantId = null, detail = {}, now = Date.now() } = options;

  if (!EVENT_KINDS.includes(kind)) {
    throw new MediaError(`${a}: kind must be one of ${EVENT_KINDS.join(', ')}`);
  }
  const session = getSession(store, sessionId);
  if (!session) throw new MediaError(`${a}: no session with id ${sessionId}`);

  // The first real join is what makes a session live. Derived from a
  // reported fact rather than set by whoever created the room.
  if (kind === 'joined' && session.status === 'open') {
    session.status = 'live';
    session.wentLiveAt = now;
  }

  const event = {
    id: store.nextEventId++,
    sessionId,
    kind,
    participantId: participantId === null ? null : String(participantId),
    detail,
    at: now,
  };
  store.events.push(event);
  return event;
}

function eventsFor(store, sessionId) {
  return store.events.filter((e) => e.sessionId === sessionId).sort((x, y) => x.at - y.at);
}

// Recording is opt-in at session creation and refused otherwise. A
// session that was not created recordable cannot become recordable
// later -- consent is given before the thing happens, not retroactively.
function startRecording(store, options = {}) {
  const a = 'startRecording';
  const { sessionId, startedBy, now = Date.now() } = options;
  const session = getSession(store, sessionId);
  if (!session) throw new MediaError(`${a}: no session with id ${sessionId}`);
  if (!session.recordable) {
    throw new MediaError(
      `${a}: session ${sessionId} was not created recordable -- consent is given up front, `
      + 'not granted after the fact',
    );
  }
  if (session.status === 'ended') throw new MediaError(`${a}: session ${sessionId} has ended`);
  if (session.recordingStartedAt) return session;

  session.recordingStartedAt = now;
  recordEvent(store, {
    sessionId, kind: 'recording-started', detail: { startedBy: String(startedBy ?? '') }, now,
  });
  return session;
}

function endSession(store, options = {}) {
  const a = 'endSession';
  const { sessionId, endedBy, now = Date.now() } = options;
  const session = getSession(store, sessionId);
  if (!session) throw new MediaError(`${a}: no session with id ${sessionId}`);
  if (session.status === 'ended') return session;

  session.status = 'ended';
  session.endedAt = now;
  session.endedBy = requireString(endedBy, 'endedBy', a);

  // Every outstanding grant dies with the room. Otherwise a credential
  // issued a minute before the end stays valid for its full TTL against
  // a session that no longer exists -- and the transport, which trusts
  // our verdict, would honour it.
  for (const grant of activeGrants(store, sessionId, now)) {
    grant.revokedAt = now;
    grant.revokedBy = 'session-ended';
  }
  if (session.recordingStartedAt) {
    recordEvent(store, { sessionId, kind: 'recording-stopped', now });
  }
  return session;
}

function describeSession(store, sessionId, now = Date.now()) {
  const session = getSession(store, sessionId);
  if (!session) return null;
  const active = activeGrants(store, sessionId, now);
  const events = eventsFor(store, sessionId);
  const joined = new Set();
  for (const e of events) {
    if (e.kind === 'joined' && e.participantId) joined.add(e.participantId);
    if (e.kind === 'left' && e.participantId) joined.delete(e.participantId);
  }
  return {
    ...session,
    activeGrants: active.length,
    // Two different numbers on purpose: seats handed out, and people
    // the transport says are actually connected. They diverge exactly
    // when something is wrong, which is when you want to see both.
    connectedParticipants: [...joined].sort(),
    eventCount: events.length,
  };
}

module.exports = {
  MediaError,
  SESSION_KINDS,
  SESSION_STATUSES,
  ROLES,
  EVENT_KINDS,
  DEFAULT_GRANT_TTL_MS,
  MAX_GRANT_TTL_MS,
  createSession,
  getSession,
  findSession,
  issueGrant,
  activeGrants,
  revokeGrant,
  verifyGrant,
  recordEvent,
  eventsFor,
  startRecording,
  endSession,
  describeSession,
};
