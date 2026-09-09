// VENVM -- the likeness consent gate.
//
// This is the hardest gate in the ecosystem and the one with the least
// margin for a quiet regression. It governs generating a real person's
// face or voice. The standing instruction is explicit: it must throw,
// never warn.
//
// The regressions worth catching are all silent ones. A gate softened
// to a console warning still returns successfully. A scope check
// dropped from `requireConsent` still passes for the common case where
// the subject happens to hold full consent. An expiry comparison
// flipped from `>` to `>=` still works on every date except the exact
// boundary. None of these announce themselves.

const test = require('node:test');
const assert = require('node:assert');

const {
  CONSENT_SCOPES, DEFAULT_CONSENT_TERM_DAYS, ConsentError,
  recordConsent, revokeConsent, findActiveConsent, requireConsent, listConsents,
} = require('../lib/likenessConsent');
const { createVenvmStore } = require('../lib/store');

const NOW = Date.UTC(2026, 0, 1);
const DAY = 24 * 60 * 60 * 1000;

function grant(store, overrides = {}) {
  return recordConsent(store, {
    subjectId: 'jordan',
    subjectName: 'Jordan Rivera',
    scopes: ['likeness-still', 'likeness-animated'],
    recordedBy: 'legal-ops',
    agreementReference: 'AGR-2026-001',
    now: NOW,
    ...overrides,
  });
}

// -- the default posture ----------------------------------------------

test('with NO consent on file, generation is blocked', () => {
  const store = createVenvmStore();
  assert.throws(
    () => requireConsent(store, { subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW }),
    (err) => {
      // It must throw, not warn. A ConsentError is the contract.
      assert.ok(err instanceof ConsentError);
      assert.match(err.message, /blocked/i);
      return true;
    },
  );
});

test('an empty store grants nothing to anyone', () => {
  const store = createVenvmStore();
  assert.strictEqual(listConsents(store).length, 0);
  assert.strictEqual(findActiveConsent(store, 'anyone', NOW), null);
});

// -- recording is evidence, so every field is required ----------------

test('consent cannot be recorded without a paper trail', () => {
  const store = createVenvmStore();
  // Each of these omissions produces a record that is not evidence of
  // anything, which is why each is rejected rather than defaulted.
  assert.throws(() => grant(store, { subjectId: undefined }), ConsentError);
  assert.throws(() => grant(store, { agreementReference: undefined }), ConsentError);
  assert.throws(() => grant(store, { recordedBy: undefined }), ConsentError);
  assert.strictEqual(listConsents(store).length, 0);
});

test('an unknown or empty scope is refused', () => {
  const store = createVenvmStore();
  assert.throws(() => grant(store, { scopes: [] }), /non-empty/);
  assert.throws(() => grant(store, { scopes: ['likeness-still', 'deepfake'] }), /unknown consent scope/);
});

test('the four real scopes are the only ones', () => {
  assert.deepStrictEqual([...CONSENT_SCOPES].sort(), [
    'likeness-animated', 'likeness-still', 'paid-media-distribution', 'voice-synthesis',
  ]);
});

// -- scope is specific, and that is the point -------------------------

test('consent to a still image is NOT consent to animate or to a voice', () => {
  const store = createVenvmStore();
  grant(store, { scopes: ['likeness-still'] });

  // The granted scope works.
  assert.ok(requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW,
  }));

  // The others are refused, individually.
  for (const scope of ['likeness-animated', 'voice-synthesis', 'paid-media-distribution']) {
    assert.throws(
      () => requireConsent(store, { subjectId: 'jordan', requestedScopes: [scope], now: NOW }),
      /does not cover/,
      `${scope} must not be implied by likeness-still`,
    );
  }
});

test('a partially covered request is refused entirely, not partially honored', () => {
  const store = createVenvmStore();
  grant(store, { scopes: ['likeness-still'] });
  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan',
    requestedScopes: ['likeness-still', 'voice-synthesis'],
    now: NOW,
  }), /does not cover/);
});

test('paid-media-distribution is never implied by creative consent', () => {
  // Commercial use is a separate grant from being depicted at all.
  const store = createVenvmStore();
  grant(store, { scopes: ['likeness-still', 'likeness-animated', 'voice-synthesis'] });
  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['paid-media-distribution'], now: NOW,
  }), /does not cover/);
});

// -- expiry -----------------------------------------------------------

test('consent expires, and expiry blocks generation', () => {
  const store = createVenvmStore();
  grant(store, { termDays: 30 });

  assert.ok(requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW + 29 * DAY,
  }));

  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW + 31 * DAY,
  }), /expired/);
});

test('the default term is finite, not perpetual', () => {
  // A default of "forever" would be the dangerous default.
  assert.strictEqual(DEFAULT_CONSENT_TERM_DAYS, 365);
  const store = createVenvmStore();
  const consent = grant(store);
  assert.ok(consent.expiresAt > NOW, 'a default grant must carry an expiry');
});

test('perpetual consent is possible but must be stated explicitly', () => {
  const store = createVenvmStore();
  grant(store, { perpetual: true });
  assert.ok(requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW + 100 * 365 * DAY,
  }));
});

// -- revocation -------------------------------------------------------

test('revocation blocks generation immediately, and says why', () => {
  const store = createVenvmStore();
  // revokeConsent keys on the consent record's own id, not the
  // subject -- a subject can hold more than one grant, and revoking
  // "the subject" would be ambiguous about which agreement ended.
  const consent = grant(store);
  revokeConsent(store, { consentId: consent.id, reason: 'subject withdrew', now: NOW + DAY });

  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW + 2 * DAY,
  }), /revoked/);
});

test('one subject revoking does not affect another subject', () => {
  const store = createVenvmStore();
  const jordan = grant(store, { subjectId: 'jordan' });
  grant(store, { subjectId: 'sam', subjectName: 'Sam Okafor', agreementReference: 'AGR-2026-002' });
  revokeConsent(store, { consentId: jordan.id, reason: 'withdrew', now: NOW + DAY });

  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan', requestedScopes: ['likeness-still'], now: NOW + 2 * DAY,
  }), ConsentError);
  assert.ok(requireConsent(store, {
    subjectId: 'sam', requestedScopes: ['likeness-still'], now: NOW + 2 * DAY,
  }));
});

// -- no accidental bypasses -------------------------------------------

test('a missing subjectId is refused rather than matching anyone', () => {
  const store = createVenvmStore();
  grant(store);
  assert.throws(() => requireConsent(store, {
    subjectId: undefined, requestedScopes: ['likeness-still'], now: NOW,
  }), /subjectId/);
});

test('an empty requested-scopes list does not pass as "nothing to check"', () => {
  // Requesting nothing must not be a way to get a pass.
  const store = createVenvmStore();
  grant(store);
  assert.throws(() => requireConsent(store, {
    subjectId: 'jordan', requestedScopes: [], now: NOW,
  }), /non-empty/);
});
