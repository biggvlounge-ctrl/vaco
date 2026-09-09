// VACO MEDIA — the local storage adapter.
//
// **Stores nothing and serves nothing, and says so in every response.**
//
// It exists so the catalogue — registration, lifecycle, playback grants,
// expiry, revocation, takedown — runs end to end before anyone
// provisions a bucket. That is the whole security model and most of the
// work, and it should not wait on infrastructure nobody has bought.
//
// Held to the same rule as the loopback transport, from
// `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`:
//
//   > Do not add a `<video>` tag pointing at a placeholder file to make
//   > a demo look complete.
//
// So the URL uses an unroutable `unstored://` scheme and every response
// carries `stored: false`. A caller that renders it without reading it
// gets a broken address rather than a stock clip, which is the correct
// failure.

function create() {
  function playbackUrl(verdict, options2 = {}) {
    return {
      storage: 'local',
      url: `unstored://${verdict.storageKey || verdict.assetId}`,
      expiresAt: options2.expiresAt || null,
      viewerId: verdict.viewerId,
      stored: false,
      cdn: false,
      note: 'The catalogue approved this playback. No object store is configured, so there '
        + 'are no bytes to serve. Set VACO_MEDIA_STORAGE=s3 and point VACO_MEDIA_S3_* at a '
        + 'MinIO/SeaweedFS instance to serve real media.',
    };
  }

  function describe() {
    return {
      adapter: 'local',
      configured: true,
      stored: false,
      note: 'catalogue only — registration, lifecycle and playback grants are real; no bytes are stored',
    };
  }

  return { name: 'local', playbackUrl, describe };
}

module.exports = { create };
