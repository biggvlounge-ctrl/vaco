// VACO MEDIA — recorded assets, and who may play them.
//
// The other half of this service. Sessions are transport between
// people; assets are bytes somebody stored. They live together because
// the expensive, hard-to-get-right part is identical: **who gets a
// playable address, and for how long.** Two services would mean two
// token systems, and a second one of anything authorization-shaped is
// how the gap appears.
//
// **The asset is a reference, never the bytes.** This service holds
// metadata and issues short-lived playback URLs; the object itself sits
// in storage behind `lib/storage/`. That is not a limitation to fix
// later — it is the same separation as `lib/transport/`: the expensive
// commodity layer is swappable, the layer that decides things is ours.
//
// **Playback grants exist because a CDN URL is a bearer token.** An
// address that plays without further checks is one paste away from
// being public, which is precisely how subscription video leaks. So a
// grant is per-viewer, per-asset, short-lived and revocable, and the
// storage adapter signs a URL that expires with it. Vvltvre Flix's
// concurrent-stream limit is already real and already the hard part of
// subscription video; this is what makes it enforceable rather than
// advisory.

const crypto = require('crypto');

class AssetError extends Error {}

// What kind of thing, because the three consumers differ in ways that
// matter downstream: audio needs no renditions, short-form needs no
// DRM, a licensed film needs both.
const ASSET_KINDS = ['audio', 'video', 'short'];

// Where an asset is in its life. `uploaded` is not `ready`: a file that
// exists is not a file anything can play, and conflating them is how a
// catalogue fills with titles that 404.
const ASSET_STATUSES = ['registered', 'uploaded', 'processing', 'ready', 'failed', 'removed'];

const DEFAULT_PLAYBACK_TTL_MS = 4 * 60 * 60 * 1000;   // long enough for a film
const MAX_PLAYBACK_TTL_MS = 24 * 60 * 60 * 1000;

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AssetError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

// Registered by the owning app, addressed by that app's own id — the
// same rule sessions follow, so Vvltvre Flix never has to store our id
// to find its own title.
function registerAsset(store, options = {}) {
  const a = 'registerAsset';
  const {
    app, externalId, kind, ownerId,
    durationSec = null, contentRating = null, now = Date.now(),
  } = options;

  if (!ASSET_KINDS.includes(kind)) {
    throw new AssetError(`${a}: kind must be one of ${ASSET_KINDS.join(', ')}`);
  }
  if (durationSec !== null && (!Number.isFinite(durationSec) || durationSec <= 0)) {
    throw new AssetError(`${a}: durationSec must be a positive number or null`);
  }

  const appName = requireString(app, 'app', a);
  const external = requireString(String(externalId ?? ''), 'externalId', a);

  const existing = store.assets.find(
    (x) => x.app === appName && x.externalId === external && x.status !== 'removed',
  );
  if (existing) return existing;

  const asset = {
    id: store.nextAssetId++,
    app: appName,
    externalId: external,
    kind,
    // Whose it is, for revenue and takedown. Not an access rule: the
    // owning app decides who may watch, exactly as it decides who may
    // join a room.
    ownerId: requireString(String(ownerId ?? ''), 'ownerId', a),
    status: 'registered',
    durationSec,
    contentRating,
    storageKey: null,
    bytes: null,
    checksum: null,
    registeredAt: now,
    readyAt: null,
  };
  store.assets.push(asset);
  return asset;
}

function getAsset(store, assetId) {
  return store.assets.find((x) => x.id === assetId) || null;
}

function findAsset(store, app, externalId) {
  return store.assets.find(
    (x) => x.app === app && x.externalId === String(externalId) && x.status !== 'removed',
  ) || null;
}

// The storage layer reports what it stored. Called after the bytes
// land, never before -- `uploaded` is a fact about storage, and this
// service does not guess at it.
function attachStorage(store, options = {}) {
  const a = 'attachStorage';
  const { assetId, storageKey, bytes, checksum = null, now = Date.now() } = options;
  const asset = getAsset(store, assetId);
  if (!asset) throw new AssetError(`${a}: no asset with id ${assetId}`);
  if (asset.status === 'removed') throw new AssetError(`${a}: asset ${assetId} was removed`);
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new AssetError(`${a}: bytes must be a positive integer`);
  }

  asset.storageKey = requireString(storageKey, 'storageKey', a);
  asset.bytes = bytes;
  asset.checksum = checksum;
  asset.status = 'uploaded';
  asset.uploadedAt = now;
  return asset;
}

// Ready is a separate, deliberate step. A file that exists is not a
// file anything can play -- for video there is transcoding in between,
// and a catalogue that lists a title before it is playable is a
// catalogue of 404s.
function markReady(store, options = {}) {
  const a = 'markReady';
  const { assetId, now = Date.now() } = options;
  const asset = getAsset(store, assetId);
  if (!asset) throw new AssetError(`${a}: no asset with id ${assetId}`);
  if (!asset.storageKey) {
    throw new AssetError(`${a}: asset ${assetId} has no stored object -- attachStorage first`);
  }
  asset.status = 'ready';
  asset.readyAt = now;
  return asset;
}

function markFailed(store, options = {}) {
  const a = 'markFailed';
  const asset = getAsset(store, options.assetId);
  if (!asset) throw new AssetError(`${a}: no asset with id ${options.assetId}`);
  asset.status = 'failed';
  asset.failureReason = options.reason || 'unspecified';
  return asset;
}

// Takedown. Marks rather than deletes, because "what was published and
// when" outlives the file -- and because a licensed title pulled for a
// rights reason is a fact somebody will need to prove.
function removeAsset(store, options = {}) {
  const a = 'removeAsset';
  const { assetId, removedBy, reason = null, now = Date.now() } = options;
  const asset = getAsset(store, assetId);
  if (!asset) throw new AssetError(`${a}: no asset with id ${assetId}`);

  asset.status = 'removed';
  asset.removedBy = requireString(removedBy, 'removedBy', a);
  asset.removedReason = reason;
  asset.removedAt = now;

  // Every outstanding playback grant dies with it. Otherwise a title
  // pulled for a rights reason keeps playing for everyone who loaded
  // the page before the takedown, which is the case where it matters.
  for (const grant of activePlaybackGrants(store, assetId, now)) {
    grant.revokedAt = now;
    grant.revokedBy = 'asset-removed';
  }
  return asset;
}

// -- Playback grants -----------------------------------------------------

function issuePlaybackGrant(store, options = {}) {
  const a = 'issuePlaybackGrant';
  const {
    assetId, viewerId, ttlMs = DEFAULT_PLAYBACK_TTL_MS, issuedBy, now = Date.now(),
  } = options;

  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > MAX_PLAYBACK_TTL_MS) {
    throw new AssetError(`${a}: ttlMs must be between 1000 and ${MAX_PLAYBACK_TTL_MS}`);
  }
  const asset = getAsset(store, assetId);
  if (!asset) throw new AssetError(`${a}: no asset with id ${assetId}`);

  // **Only a ready asset is playable.** Handing out a grant for
  // something still processing produces a URL that resolves to nothing,
  // and the viewer blames the player.
  if (asset.status !== 'ready') {
    throw new AssetError(`${a}: asset ${assetId} is "${asset.status}", not ready to play`);
  }

  const credential = `vpb_${crypto.randomBytes(32).toString('hex')}`;
  const grant = {
    id: store.nextGrantId++,
    assetId,
    viewerId: requireString(String(viewerId ?? ''), 'viewerId', a),
    credentialDigest: crypto.createHash('sha256').update(credential).digest('hex'),
    issuedBy: requireString(issuedBy, 'issuedBy', a),
    issuedAt: now,
    expiresAt: now + ttlMs,
    revokedAt: null,
  };
  store.grants.push(grant);
  return { grant, credential };
}

function activePlaybackGrants(store, assetId, now = Date.now()) {
  return store.grants.filter(
    (g) => g.assetId === assetId && !g.revokedAt && g.expiresAt > now,
  );
}

// What Vvltvre Flix's concurrent-stream limit actually needs: how many
// live playback grants this viewer holds across everything. The limit
// itself stays Flix's -- it is a product rule and belongs to the
// product -- but the count has to come from wherever the grants are.
function activeGrantsForViewer(store, viewerId, now = Date.now()) {
  return store.grants.filter(
    (g) => g.viewerId === String(viewerId) && g.assetId !== undefined
      && !g.revokedAt && g.expiresAt > now,
  );
}

function revokePlaybackGrant(store, options = {}) {
  const a = 'revokePlaybackGrant';
  const grant = store.grants.find((g) => g.id === options.grantId);
  if (!grant) throw new AssetError(`${a}: no grant with id ${options.grantId}`);
  if (grant.revokedAt) return grant;
  grant.revokedAt = options.now ?? Date.now();
  grant.revokedBy = requireString(options.revokedBy, 'revokedBy', a);
  return grant;
}

// Same verdict shape as verifyGrant, and the same reasons: expiry read
// on every call, revocation immediate, and the asset re-checked so a
// takedown lands even on a credential issued a moment earlier.
function verifyPlaybackGrant(store, options = {}) {
  const { credential, assetId, now = Date.now() } = options;

  if (typeof credential !== 'string' || credential.length === 0) {
    return { ok: false, reason: 'no playback credential presented' };
  }
  const digest = crypto.createHash('sha256').update(credential).digest('hex');
  const grant = store.grants.find((g) => g.credentialDigest === digest && g.assetId !== undefined);
  if (!grant) return { ok: false, reason: 'playback credential not recognised' };
  if (grant.revokedAt) return { ok: false, reason: 'this playback credential was revoked' };
  if (grant.expiresAt <= now) return { ok: false, reason: 'this playback credential has expired' };
  if (assetId !== undefined && grant.assetId !== assetId) {
    return { ok: false, reason: 'this playback credential is for a different asset' };
  }

  const asset = getAsset(store, grant.assetId);
  if (!asset || asset.status !== 'ready') {
    return { ok: false, reason: `that asset is "${asset ? asset.status : 'missing'}", not playable` };
  }

  return { ok: true, assetId: grant.assetId, viewerId: grant.viewerId, storageKey: asset.storageKey };
}

function describeCatalogue(store, now = Date.now()) {
  const byStatus = {};
  for (const s of ASSET_STATUSES) {
    byStatus[s] = store.assets.filter((x) => x.status === s).length;
  }
  return {
    assets: store.assets.length,
    byStatus,
    playable: byStatus.ready,
    activePlaybackGrants: store.grants.filter(
      (g) => g.assetId !== undefined && !g.revokedAt && g.expiresAt > now,
    ).length,
    totalBytes: store.assets.reduce((n, x) => n + (x.bytes || 0), 0),
  };
}

module.exports = {
  AssetError,
  ASSET_KINDS,
  ASSET_STATUSES,
  DEFAULT_PLAYBACK_TTL_MS,
  MAX_PLAYBACK_TTL_MS,
  registerAsset,
  getAsset,
  findAsset,
  attachStorage,
  markReady,
  markFailed,
  removeAsset,
  issuePlaybackGrant,
  activePlaybackGrants,
  activeGrantsForViewer,
  revokePlaybackGrant,
  verifyPlaybackGrant,
  describeCatalogue,
};
