// VACO MEDIA — the storage seam.
//
// The same line `lib/transport/` draws, for the same reason. Storing
// and delivering terabytes is bandwidth and hardware; deciding who gets
// a playable address is logic. The first is a commodity and should be
// swappable; the second is ours and lives in `lib/assets.js`.
//
// **The default is `s3`, meaning any S3-compatible object store** —
// MinIO or SeaweedFS on your own hardware, or a hosted one. That is the
// self-hostable choice, the same posture as LiveKit for transport: the
// protocol is a de-facto standard with several open implementations, so
// "which vendor" stays a config line rather than an architecture.
//
// **What an adapter must never do:** decide who may play. It receives a
// verdict from `verifyPlaybackGrant` and signs a URL for a viewer
// already approved, expiring no later than the grant does.

const ADAPTERS = ['s3', 'local'];

function createStorage(options = {}) {
  const name = options.adapter || process.env.VACO_MEDIA_STORAGE || 'local';
  if (!ADAPTERS.includes(name)) {
    throw new Error(`VACO_MEDIA_STORAGE must be one of ${ADAPTERS.join(', ')} (got "${name}")`);
  }
  // eslint-disable-next-line global-require
  return require(`./${name}`).create(options);
}

module.exports = { ADAPTERS, createStorage };
