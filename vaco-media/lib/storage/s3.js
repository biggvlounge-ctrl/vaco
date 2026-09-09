// VACO MEDIA — the S3-compatible storage adapter.
//
// Signs a time-limited GET with AWS Signature V4, which every
// S3-compatible store implements: MinIO and SeaweedFS on your own
// hardware, Backblaze B2, Cloudflare R2, or S3 itself. Point it at
// whichever; the signature is the same.
//
// **No SDK, deliberately** — same reasoning as the LiveKit adapter.
// SigV4 presigning is a documented HMAC chain that `node:crypto` does
// directly, and pulling a vendor SDK in would make the vendor a
// build-time dependency of the layer whose whole design is that the
// vendor is swappable.
//
// **What this is not.** Signing a URL is not a CDN. Serving video from
// one origin to a real audience is ruinous, and the fix is a cache in
// front of this bucket — a deployment concern, not a code one. Stated
// here rather than discovered later.

const crypto = require('crypto');

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

// Every path segment encoded, `/` preserved. Getting this wrong
// produces a signature that verifies locally and 403s at the store,
// which is the worst place to find out.
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

function create(options = {}) {
  const endpoint = options.endpoint || process.env.VACO_MEDIA_S3_ENDPOINT || '';
  const bucket = options.bucket || process.env.VACO_MEDIA_S3_BUCKET || '';
  const region = options.region || process.env.VACO_MEDIA_S3_REGION || 'us-east-1';
  const accessKey = options.accessKey || process.env.VACO_MEDIA_S3_ACCESS_KEY || '';
  const secretKey = options.secretKey || process.env.VACO_MEDIA_S3_SECRET_KEY || '';
  const cdnBase = options.cdnBase || process.env.VACO_MEDIA_CDN_BASE || '';

  function assertConfigured() {
    const missing = [
      !endpoint && 'VACO_MEDIA_S3_ENDPOINT', !bucket && 'VACO_MEDIA_S3_BUCKET',
      !accessKey && 'VACO_MEDIA_S3_ACCESS_KEY', !secretKey && 'VACO_MEDIA_S3_SECRET_KEY',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(
        `s3 storage is selected but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set. `
        + 'Point them at your own MinIO/SeaweedFS instance, or set VACO_MEDIA_STORAGE=local '
        + 'to run the catalogue without a store.',
      );
    }
  }

  // `verdict` comes from verifyPlaybackGrant and is the only thing that
  // decides anything here. Expiry is clamped to the grant's own, so a
  // revoked-early grant cannot outlive itself through a URL already
  // handed out -- the URL is the thing that leaks.
  function playbackUrl(verdict, options2 = {}) {
    assertConfigured();
    const now = options2.now || Date.now();
    const expiresAt = Math.min(options2.expiresAt || (now + 3600000), now + 604800000);
    const expiresIn = Math.max(1, Math.floor((expiresAt - now) / 1000));

    const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const stamp = new Date(now).toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = stamp.slice(0, 8);
    const scope = `${date}/${region}/s3/aws4_request`;

    const query = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${accessKey}/${scope}`],
      ['X-Amz-Date', stamp],
      ['X-Amz-Expires', String(expiresIn)],
      ['X-Amz-SignedHeaders', 'host'],
    ].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).sort().join('&');

    const canonicalPath = `/${bucket}/${encodeKey(verdict.storageKey)}`;
    const canonical = [
      'GET', canonicalPath, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD',
    ].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256hex(canonical)].join('\n');

    let key = hmac(`AWS4${secretKey}`, date);
    for (const part of [region, 's3', 'aws4_request']) key = hmac(key, part);
    const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');

    // A CDN in front is the same signed path on a different host, which
    // is why this is one line rather than a second code path.
    const base = cdnBase ? cdnBase.replace(/\/$/, '') : `${endpoint.replace(/\/$/, '')}/${bucket}`;
    const path = cdnBase ? `/${encodeKey(verdict.storageKey)}` : canonicalPath.replace(`/${bucket}`, `/${bucket}`);

    return {
      storage: 's3',
      url: cdnBase
        ? `${base}${path}?${query}&X-Amz-Signature=${signature}`
        : `${endpoint.replace(/\/$/, '')}${canonicalPath}?${query}&X-Amz-Signature=${signature}`,
      expiresAt,
      viewerId: verdict.viewerId,
      cdn: Boolean(cdnBase),
    };
  }

  function describe() {
    return {
      adapter: 's3',
      endpoint: endpoint || null,
      bucket: bucket || null,
      cdn: Boolean(cdnBase),
      configured: Boolean(endpoint && bucket && accessKey && secretKey),
      // Never the keys: this goes onto /api/health.
      note: cdnBase
        ? 'S3-compatible origin behind a CDN'
        : 'S3-compatible origin with NO CDN in front — fine for audio and testing, ruinous for video at scale',
    };
  }

  return { name: 's3', playbackUrl, describe };
}

module.exports = { create, encodeKey };
