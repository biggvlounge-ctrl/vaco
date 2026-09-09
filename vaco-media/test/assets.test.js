// VACO MEDIA — the catalogue and playback grants.
//
// **A playback URL is a bearer token.** An address that plays without
// further checks is one paste away from being public, which is exactly
// how subscription video leaks. The failures are all quiet:
//
//   - a grant for one title plays another
//   - a takedown does not reach viewers who already loaded the page
//   - a grant is issued for something still processing, so the URL
//     resolves to nothing and the viewer blames the player
//   - a signed URL outlives the grant it came from
//   - a credential sits in plaintext in a store that gets backed up
//
// Per `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`, each was
// watched fail against the bug it names.

const test = require('node:test');
const assert = require('node:assert');

const { createMediaStore } = require('../lib/store');
const {
  ASSET_KINDS, MAX_PLAYBACK_TTL_MS,
  registerAsset, getAsset, findAsset, attachStorage, markReady, markFailed,
  removeAsset, issuePlaybackGrant, activePlaybackGrants, activeGrantsForViewer,
  revokePlaybackGrant, verifyPlaybackGrant, describeCatalogue,
} = require('../lib/assets');

const NOW = Date.UTC(2026, 7, 27);
const HOUR = 3600000;

function ready(store, overrides = {}) {
  const asset = registerAsset(store, {
    app: 'vulture-flix', externalId: 'title-7', kind: 'video',
    ownerId: 'studio-a', durationSec: 5400, now: NOW, ...overrides,
  });
  attachStorage(store, { assetId: asset.id, storageKey: `flix/${asset.externalId}.mp4`, bytes: 900000000, now: NOW });
  markReady(store, { assetId: asset.id, now: NOW });
  return asset;
}

// -- Lifecycle -----------------------------------------------------------

test('registered is not uploaded, and uploaded is not ready', () => {
  const store = createMediaStore();
  const asset = registerAsset(store, {
    app: 'vulture-flix', externalId: 'title-7', kind: 'video', ownerId: 'studio-a', now: NOW,
  });
  assert.strictEqual(asset.status, 'registered');

  // A catalogue that lists a title before it is playable is a
  // catalogue of 404s, and the viewer blames the player.
  assert.throws(() => issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  }), /is "registered", not ready/);

  attachStorage(store, { assetId: asset.id, storageKey: 'k', bytes: 10, now: NOW });
  assert.strictEqual(getAsset(store, asset.id).status, 'uploaded');
  assert.throws(() => issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  }), /is "uploaded", not ready/);

  markReady(store, { assetId: asset.id, now: NOW });
  assert.ok(issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  }).credential);
});

test('an asset cannot be marked ready without a stored object', () => {
  const store = createMediaStore();
  const asset = registerAsset(store, {
    app: 'vulture-pods', externalId: 'ep-1', kind: 'audio', ownerId: 'show-a', now: NOW,
  });
  assert.throws(() => markReady(store, { assetId: asset.id }), /has no stored object/);
});

test('a failed asset is not playable', () => {
  const store = createMediaStore();
  const asset = ready(store);
  markFailed(store, { assetId: asset.id, reason: 'transcode failed' });
  assert.throws(() => issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  }), /not ready/);
});

test('an asset is addressed by the owning app id', () => {
  const store = createMediaStore();
  const asset = ready(store);
  assert.strictEqual(findAsset(store, 'vulture-flix', 'title-7').id, asset.id);
  assert.strictEqual(findAsset(store, 'chopz', 'title-7'), null);
});

test('re-registering returns the same asset', () => {
  const store = createMediaStore();
  const first = ready(store);
  const again = registerAsset(store, {
    app: 'vulture-flix', externalId: 'title-7', kind: 'video', ownerId: 'studio-a', now: NOW + 1,
  });
  assert.strictEqual(again.id, first.id, 'a retry must not create a duplicate title');
});

test('the asset vocabulary is closed', () => {
  const store = createMediaStore();
  assert.throws(() => registerAsset(store, {
    app: 'x', externalId: '1', kind: 'livestream', ownerId: 'o',
  }), /kind must be one of/);
  for (const kind of ASSET_KINDS) {
    assert.ok(registerAsset(store, { app: 'x', externalId: kind, kind, ownerId: 'o' }).id);
  }
});

// -- Playback grants -----------------------------------------------------

test('a playback grant is scoped to one asset', () => {
  const store = createMediaStore();
  const a = ready(store);
  const b = ready(store, { externalId: 'title-8' });
  const { credential } = issuePlaybackGrant(store, {
    assetId: a.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  });

  assert.strictEqual(verifyPlaybackGrant(store, { credential, assetId: a.id, now: NOW }).ok, true);
  const wrong = verifyPlaybackGrant(store, { credential, assetId: b.id, now: NOW });
  assert.strictEqual(wrong.ok, false, 'a grant for one title must not play another');
  assert.match(wrong.reason, /different asset/);
});

test('expiry is checked on every call', () => {
  const store = createMediaStore();
  const asset = ready(store);
  const { credential } = issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', ttlMs: 2 * HOUR, now: NOW,
  });
  assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW + HOUR }).ok, true);
  assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW + 3 * HOUR }).ok, false);
});

test('an absurd ttl is refused rather than clamped', () => {
  const store = createMediaStore();
  const asset = ready(store);
  assert.throws(() => issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', ttlMs: MAX_PLAYBACK_TTL_MS + 1,
  }), /ttlMs must be between/);
});

test('a takedown reaches viewers who already have a grant', () => {
  const store = createMediaStore();
  const asset = ready(store);
  const { credential } = issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', ttlMs: 4 * HOUR, now: NOW,
  });
  assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW }).ok, true);

  // The case where it matters: a licensed title pulled for a rights
  // reason must stop playing for everyone who loaded the page before
  // the takedown, not just for the next person.
  removeAsset(store, { assetId: asset.id, removedBy: 'vulture-flix', reason: 'rights lapsed', now: NOW + HOUR });
  assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW + HOUR }).ok, false);
  assert.strictEqual(activePlaybackGrants(store, asset.id, NOW + HOUR).length, 0);
});

test('a takedown marks rather than deletes', () => {
  const store = createMediaStore();
  const asset = ready(store);
  removeAsset(store, { assetId: asset.id, removedBy: 'vulture-flix', reason: 'rights lapsed', now: NOW + HOUR });
  // "What was published and when" outlives the file, and a title pulled
  // for a rights reason is a fact somebody will need to prove.
  const after = getAsset(store, asset.id);
  assert.strictEqual(after.status, 'removed');
  assert.strictEqual(after.removedReason, 'rights lapsed');
  assert.strictEqual(after.removedBy, 'vulture-flix');
});

test('revocation is immediate', () => {
  const store = createMediaStore();
  const asset = ready(store);
  const { grant, credential } = issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  });
  revokePlaybackGrant(store, { grantId: grant.id, revokedBy: 'vulture-flix', now: NOW + 1 });
  assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW + 1 }).ok, false);
});

test('concurrent streams are countable per viewer', () => {
  const store = createMediaStore();
  const a = ready(store);
  const b = ready(store, { externalId: 'title-8' });
  issuePlaybackGrant(store, { assetId: a.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW });
  issuePlaybackGrant(store, { assetId: b.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW });
  issuePlaybackGrant(store, { assetId: a.id, viewerId: 'grace', issuedBy: 'vulture-flix', now: NOW });

  // The limit itself stays Flix's -- it is a product rule. The count
  // has to come from wherever the grants live, which is here.
  assert.strictEqual(activeGrantsForViewer(store, 'ada', NOW).length, 2);
  assert.strictEqual(activeGrantsForViewer(store, 'grace', NOW).length, 1);
});

test('a playback credential is never stored in the clear', () => {
  const store = createMediaStore();
  const asset = ready(store);
  const { credential } = issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  });
  assert.ok(!JSON.stringify(store).includes(credential));
  assert.match(credential, /^vpb_[0-9a-f]{64}$/);
});

test('an unrecognised credential is refused', () => {
  const store = createMediaStore();
  ready(store);
  for (const credential of [undefined, '', 'vpb_nope']) {
    assert.strictEqual(verifyPlaybackGrant(store, { credential, now: NOW }).ok, false);
  }
});

test('a session join credential does not work as a playback credential', () => {
  // Both live in store.grants. If verify did not distinguish them, a
  // room ticket would play the back catalogue.
  const store = createMediaStore();
  const asset = ready(store);
  const sessions = require('../lib/sessions');
  const session = sessions.createSession(store, {
    app: 'cvnvo', externalId: 'd-1', kind: 'call', createdBy: 'cvnvo', now: NOW,
  });
  const { credential } = sessions.issueGrant(store, {
    sessionId: session.id, participantId: 'ada', issuedBy: 'cvnvo', now: NOW,
  });
  const verdict = verifyPlaybackGrant(store, { credential, now: NOW });
  assert.strictEqual(verdict.ok, false, 'a room ticket must not play the catalogue');
  // Asserting the *reason*, not just the refusal. Both credential types
  // live in store.grants, and there are two defences here: the lookup
  // filters on `assetId !== undefined`, and getAsset then fails anyway.
  // Only checking `ok === false` passes with either one removed, so the
  // test would not notice the discriminator disappearing.
  assert.match(verdict.reason, /not recognised/,
    'a session grant must not even be found by the playback lookup');
});

test('verifyPlaybackGrant refuses a removed asset even if a grant survived', () => {
  // Defence in depth, and it needs isolating to mean anything: the
  // normal path is that removeAsset revokes every grant, so the status
  // check inside verifyPlaybackGrant is never reached above. Removing
  // it left the whole suite green. Here the asset is marked removed
  // *without* going through removeAsset — the state a partial failure
  // would leave behind.
  const store = createMediaStore();
  const asset = ready(store);
  const { credential } = issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada', issuedBy: 'vulture-flix', now: NOW,
  });
  getAsset(store, asset.id).status = 'removed';

  const verdict = verifyPlaybackGrant(store, { credential, now: NOW + 1 });
  assert.strictEqual(verdict.ok, false, 'an unrevoked grant must not play a removed asset');
  assert.match(verdict.reason, /not playable/);
});

test('catalogue coverage separates playable from merely present', () => {
  const store = createMediaStore();
  ready(store);
  registerAsset(store, { app: 'chopz', externalId: 'clip-1', kind: 'short', ownerId: 'c', now: NOW });

  const described = describeCatalogue(store, NOW);
  assert.strictEqual(described.assets, 2);
  assert.strictEqual(described.playable, 1, 'a registered title is not a playable one');
  assert.strictEqual(described.byStatus.registered, 1);
});

test('every asset and grant names who asked', () => {
  const store = createMediaStore();
  assert.throws(() => registerAsset(store, {
    app: 'chopz', externalId: '1', kind: 'short',
  }), /requires a non-empty ownerId/);
  const asset = ready(store);
  assert.throws(() => issuePlaybackGrant(store, {
    assetId: asset.id, viewerId: 'ada',
  }), /requires a non-empty issuedBy/);
});
