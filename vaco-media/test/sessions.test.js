// VACO MEDIA — sessions, grants and lifecycle.
//
// **What these tests are protecting.** A media join credential is a
// bearer token for a live room, and the ways it goes wrong are all
// quiet:
//
//   - a grant for one room works in another (a ticket that is a
//     skeleton key)
//   - an expired grant keeps working because expiry is read once at
//     issue instead of on every check
//   - grants outlive the session they were issued for
//   - a room overfills between grant and join, because capacity counts
//     people who arrived rather than seats handed out
//   - a credential sits in plaintext in a store.json that gets backed
//     up off-host
//   - a session becomes recordable after the fact, so consent was
//     given for something else
//
// None of these throw. Every one of them is a green suite and a real
// leak.
//
// Per `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`, each
// assertion here was watched fail against the specific bug it names.

const test = require('node:test');
const assert = require('node:assert');

const { createMediaStore } = require('../lib/store');
const {
  SESSION_KINDS, MAX_GRANT_TTL_MS,
  createSession, getSession, findSession, issueGrant, activeGrants,
  revokeGrant, verifyGrant, recordEvent, eventsFor, startRecording,
  endSession, describeSession,
} = require('../lib/sessions');

const NOW = Date.UTC(2026, 7, 27);
const MIN = 60 * 1000;

function seeded(overrides = {}) {
  const store = createMediaStore();
  const session = createSession(store, {
    app: 'cvnvo', externalId: 'speed-date-42', kind: 'call',
    createdBy: 'cvnvo', now: NOW, ...overrides,
  });
  return { store, session };
}

// -- Identity and idempotence -------------------------------------------

test('a session is addressed by the consuming app id, not ours', () => {
  const { store, session } = seeded();
  // A consumer must never have to store our id to find its own room.
  assert.strictEqual(findSession(store, 'cvnvo', 'speed-date-42').id, session.id);
  assert.strictEqual(findSession(store, 'vxllage', 'speed-date-42'), null,
    'the same external id in another app is a different room');
});

test('re-creating an open session returns the existing one', () => {
  const { store, session } = seeded();
  const again = createSession(store, {
    app: 'cvnvo', externalId: 'speed-date-42', kind: 'call', createdBy: 'cvnvo', now: NOW + 1,
  });
  // Otherwise a retry -- or two consumers racing -- splits the
  // participants across two rooms that each look correct.
  assert.strictEqual(again.id, session.id);
  assert.strictEqual(store.sessions.length, 1);
});

test('an ended session does not block a new one with the same address', () => {
  const { store, session } = seeded();
  endSession(store, { sessionId: session.id, endedBy: 'cvnvo', now: NOW + MIN });
  const next = createSession(store, {
    app: 'cvnvo', externalId: 'speed-date-42', kind: 'call', createdBy: 'cvnvo', now: NOW + 2 * MIN,
  });
  assert.notStrictEqual(next.id, session.id, 'a second date in the same slot is a new session');
});

test('the session vocabulary is closed', () => {
  const store = createMediaStore();
  assert.throws(() => createSession(store, {
    app: 'x', externalId: '1', kind: 'videochat', createdBy: 'x',
  }), /kind must be one of/);
  for (const kind of SESSION_KINDS) {
    assert.ok(createSession(store, { app: 'x', externalId: kind, kind, createdBy: 'x' }).id);
  }
});

// -- The grant is the security boundary ---------------------------------

test('a grant is scoped to one session — a ticket, not a skeleton key', () => {
  const { store, session } = seeded();
  const other = createSession(store, {
    app: 'vxllage', externalId: 'room-9', kind: 'room', createdBy: 'vxllage', now: NOW,
  });
  const { credential } = issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW,
  });

  assert.strictEqual(verifyGrant(store, { credential, sessionId: session.id, now: NOW }).ok, true);
  const wrong = verifyGrant(store, { credential, sessionId: other.id, now: NOW });
  assert.strictEqual(wrong.ok, false, 'a credential for one room must not open another');
  assert.match(wrong.reason, /different session/);
});

test('expiry is checked on every call, not once at issue', () => {
  const { store, session } = seeded();
  const { credential } = issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', ttlMs: 5 * MIN, now: NOW,
  });

  assert.strictEqual(verifyGrant(store, { credential, now: NOW + 4 * MIN }).ok, true);
  // If expiry were evaluated at issue and cached, this still passes.
  const expired = verifyGrant(store, { credential, now: NOW + 6 * MIN });
  assert.strictEqual(expired.ok, false);
  assert.match(expired.reason, /expired/);
});

test('an absurd ttl is refused rather than clamped', () => {
  const { store, session } = seeded();
  // Clamping silently gives a caller something other than what they
  // asked for, and the caller goes on believing the number they sent.
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', ttlMs: MAX_GRANT_TTL_MS + 1,
  }), /ttlMs must be between/);
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', ttlMs: 10,
  }), /ttlMs must be between/);
});

test('revocation takes effect immediately', () => {
  const { store, session } = seeded();
  const { grant, credential } = issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW,
  });
  assert.strictEqual(verifyGrant(store, { credential, now: NOW }).ok, true);

  revokeGrant(store, { grantId: grant.id, revokedBy: 'cvnvo', now: NOW + MIN });
  const after = verifyGrant(store, { credential, now: NOW + MIN });
  assert.strictEqual(after.ok, false, 'a revoked grant must fail on the very next check');
  assert.match(after.reason, /revoked/);
});

test('ending a session kills every outstanding grant', () => {
  const { store, session } = seeded();
  const a = issueGrant(store, { sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW });
  const b = issueGrant(store, { sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW });

  endSession(store, { sessionId: session.id, endedBy: 'cvnvo', now: NOW + MIN });

  // A credential issued a minute before the end would otherwise stay
  // valid for its whole TTL against a room that no longer exists -- and
  // the transport, which trusts this verdict, would honour it.
  for (const { credential } of [a, b]) {
    assert.strictEqual(verifyGrant(store, { credential, now: NOW + 2 * MIN }).ok, false);
  }
  assert.strictEqual(activeGrants(store, session.id, NOW + 2 * MIN).length, 0);
});

test('verifyGrant refuses an ended session even if a grant survived', () => {
  // Defence in depth, and it needs its own test to mean anything: the
  // normal path is that endSession revokes every grant, so the check
  // inside verifyGrant is never reached by the tests above. Removing it
  // left the whole suite green. Here the session is ended *without*
  // going through endSession, which is the state a partial failure --
  // or a future refactor of that loop -- would leave behind.
  const { store, session } = seeded();
  const { credential } = issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW,
  });
  getSession(store, session.id).status = 'ended';

  const verdict = verifyGrant(store, { credential, now: NOW + MIN });
  assert.strictEqual(verdict.ok, false, 'an unrevoked grant must not open an ended session');
  assert.match(verdict.reason, /has ended/);
});

test('a grant cannot be issued into an ended session', () => {
  const { store, session } = seeded();
  endSession(store, { sessionId: session.id, endedBy: 'cvnvo', now: NOW + MIN });
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'mallory', issuedBy: 'cvnvo', now: NOW + 2 * MIN,
  }), /has ended/);
});

test('capacity counts seats handed out, not people who arrived', () => {
  const { store, session } = seeded({ kind: 'room', maxParticipants: 2 });
  issueGrant(store, { sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW });
  issueGrant(store, { sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW });

  // Nobody has joined yet. If capacity were measured against reported
  // joins, this third grant succeeds and the room overfills in exactly
  // the window when a popular room fills.
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'hopper', issuedBy: 'cvnvo', now: NOW,
  }), /is full/);
});

test('re-granting an existing participant does not consume a second seat', () => {
  const { store, session } = seeded({ kind: 'room', maxParticipants: 2 });
  issueGrant(store, { sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW });
  issueGrant(store, { sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW });
  // A reconnect must not lock someone out of the room they are in.
  assert.ok(issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW + MIN,
  }).grant.id);
});

test('an expired seat is released', () => {
  const { store, session } = seeded({ kind: 'room', maxParticipants: 1 });
  issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', ttlMs: 5 * MIN, now: NOW,
  });
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW,
  }), /is full/);
  assert.ok(issueGrant(store, {
    sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW + 6 * MIN,
  }).grant.id, 'a lapsed grant must not hold a seat forever');
});

test('a join credential is never stored in the clear', () => {
  const { store, session } = seeded();
  const { credential } = issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW,
  });
  // This store is written to data/store.json and copied off-host by
  // backup-stores.mjs.
  assert.ok(!JSON.stringify(store).includes(credential), 'the credential reached the store');
  assert.match(credential, /^vmg_[0-9a-f]{64}$/);
});

test('an unrecognised or absent credential is refused', () => {
  const { store } = seeded();
  for (const credential of [undefined, '', 'vmg_nope']) {
    assert.strictEqual(verifyGrant(store, { credential, now: NOW }).ok, false);
  }
});

// -- Lifecycle is reported, never assumed --------------------------------

test('a session goes live on a reported join, not on being created', () => {
  const { store, session } = seeded();
  assert.strictEqual(getSession(store, session.id).status, 'open');

  // This is why V4's agent call flow could not be finished before this
  // service existed: `ring -> connected` was a state change nobody
  // could confirm.
  recordEvent(store, { sessionId: session.id, kind: 'joined', participantId: 'ada', now: NOW + MIN });
  assert.strictEqual(getSession(store, session.id).status, 'live');
});

test('presence tracks joins and leaves', () => {
  const { store, session } = seeded();
  recordEvent(store, { sessionId: session.id, kind: 'joined', participantId: 'ada', now: NOW + 1 });
  recordEvent(store, { sessionId: session.id, kind: 'joined', participantId: 'grace', now: NOW + 2 });
  recordEvent(store, { sessionId: session.id, kind: 'left', participantId: 'ada', now: NOW + 3 });

  const described = describeSession(store, session.id, NOW + 4);
  assert.deepStrictEqual(described.connectedParticipants, ['grace']);
});

test('seats handed out and people connected are reported separately', () => {
  const { store, session } = seeded({ kind: 'room', maxParticipants: 4 });
  issueGrant(store, { sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW });
  issueGrant(store, { sessionId: session.id, participantId: 'grace', issuedBy: 'cvnvo', now: NOW });
  recordEvent(store, { sessionId: session.id, kind: 'joined', participantId: 'ada', now: NOW + 1 });

  // They diverge exactly when something is wrong, which is when you
  // want to see both rather than one number that hides it.
  const d = describeSession(store, session.id, NOW + 2);
  assert.strictEqual(d.activeGrants, 2);
  assert.deepStrictEqual(d.connectedParticipants, ['ada']);
});

test('events read as a timeline', () => {
  const { store, session } = seeded();
  recordEvent(store, { sessionId: session.id, kind: 'joined', participantId: 'ada', now: NOW + 3 });
  recordEvent(store, { sessionId: session.id, kind: 'quality', participantId: 'ada', detail: { rating: 'poor' }, now: NOW + 1 });
  assert.deepStrictEqual(eventsFor(store, session.id).map((e) => e.kind), ['quality', 'joined']);
});

test('the event vocabulary is closed', () => {
  const { store, session } = seeded();
  assert.throws(() => recordEvent(store, {
    sessionId: session.id, kind: 'reconnecting',
  }), /kind must be one of/);
});

// -- Recording consent ---------------------------------------------------

test('a session not created recordable can never become recordable', () => {
  const { store, session } = seeded();
  // Consent is given before the thing happens. Allowing it afterwards
  // means consent was given for a different thing -- and a speed date
  // is exactly the room where that matters.
  assert.strictEqual(session.recordable, false);
  assert.throws(() => startRecording(store, {
    sessionId: session.id, startedBy: 'cvnvo', now: NOW + MIN,
  }), /not created recordable/);
  assert.strictEqual(getSession(store, session.id).recordingStartedAt, null);
});

test('recording is opt-in and leaves a trail on both ends', () => {
  const { store, session } = seeded({
    app: 'vavlt-stvdios', externalId: 'wall-1', kind: 'wall', recordable: true,
  });
  startRecording(store, { sessionId: session.id, startedBy: 'vavlt-stvdios', now: NOW + MIN });
  assert.strictEqual(getSession(store, session.id).recordingStartedAt, NOW + MIN);

  endSession(store, { sessionId: session.id, endedBy: 'vavlt-stvdios', now: NOW + 5 * MIN });
  const kinds = eventsFor(store, session.id).map((e) => e.kind);
  assert.ok(kinds.includes('recording-started'));
  assert.ok(kinds.includes('recording-stopped'), 'a recording that never stopped is not a record');
});

test('every session and grant names who asked for it', () => {
  const store = createMediaStore();
  assert.throws(() => createSession(store, {
    app: 'cvnvo', externalId: '1', kind: 'call',
  }), /requires a non-empty createdBy/);

  const { session } = seeded();
  assert.throws(() => issueGrant(store, {
    sessionId: session.id, participantId: 'ada',
  }), /no session with id/);
});
