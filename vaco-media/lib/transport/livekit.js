// VACO MEDIA — the LiveKit adapter.
//
// Mints a LiveKit access token for a participant this service has
// *already* approved. LiveKit's join credential is a JWT signed with a
// shared API secret, carrying a `video` grant that says which room and
// what the participant may do in it — so this is a signing function,
// not an authorization function, and the difference is the whole point
// of the seam.
//
// **No SDK dependency, deliberately.** The token is HS256 over a small
// documented claim set, which `node:crypto` does in twenty lines. Every
// app in this repo is `express + cors + dotenv` and nothing else, and
// pulling a vendor SDK in to produce a JWT would make the vendor a
// build-time dependency of a service whose entire design is that the
// vendor is swappable.
//
// **What is real here and what needs a server.** The token is real: a
// running LiveKit instance will accept it, because the claim shape is
// LiveKit's documented one. What this file cannot do is carry media —
// that needs an actual SFU process, and `deploy/` does not run one yet.
// Stated plainly rather than implied, per the media decision doc's own
// rule: do not build something that looks like it plays.

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// LiveKit's own grant vocabulary. Kept as a translation rather than
// adopted as ours: `roomJoin`/`canPublish`/`canSubscribe` are LiveKit
// nouns, and if the adapter changes they change with it. `lib/sessions`
// keeps saying `publisher`/`subscriber`/`both`.
function videoGrantFor(role, room) {
  return {
    room,
    roomJoin: true,
    canPublish: role === 'publisher' || role === 'both',
    canSubscribe: role === 'subscriber' || role === 'both',
    canPublishData: true,
  };
}

function create(options = {}) {
  const url = options.url || process.env.LIVEKIT_URL || '';
  const apiKey = options.apiKey || process.env.LIVEKIT_API_KEY || '';
  const apiSecret = options.apiSecret || process.env.LIVEKIT_API_SECRET || '';

  // Refuses at construction rather than at the first join. A media
  // service that starts healthy and fails only when somebody tries to
  // talk is the same class of problem as a settlement route that 401s
  // only when money moves.
  //
  // **That is what this comment always said, and it was not what the
  // code did.** `assertConfigured` was only ever called from inside
  // `joinCredential`, so a service selecting this adapter with no keys
  // started clean and failed on the first person who tried to speak —
  // precisely the behaviour the paragraph above rejects.
  //
  // The obvious fix — calling it from `create()` — was tried and is
  // wrong, and this file's own tests are what said so. `describe()`
  // reports `configured: false` onto /api/health, which requires
  // being able to *construct* an unconfigured adapter and ask it. A
  // constructor that throws makes the health signal unreachable and
  // the seam untestable without live credentials.
  //
  // So the guarantee lives at the boot of the service that selects the
  // adapter — `vaco-media/server.js` — where "this process must not
  // start" is a statement that can actually be made. It is exported
  // rather than kept private for exactly that caller.
  function assertConfigured() {
    const missing = [
      !url && 'LIVEKIT_URL',
      !apiKey && 'LIVEKIT_API_KEY',
      !apiSecret && 'LIVEKIT_API_SECRET',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(
        `livekit transport is selected but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set. `
        + 'Point them at your own LiveKit instance, or set VACO_MEDIA_TRANSPORT=loopback '
        + 'to run the control plane without a media plane.',
      );
    }
  }

  // `verdict` comes from sessions.verifyGrant and is the only input
  // that decides anything. This function's job is translation.
  function joinCredential(verdict, session, options2 = {}) {
    assertConfigured();
    const ttlSec = Math.floor((options2.ttlMs || 600000) / 1000);
    const now = Math.floor((options2.now || Date.now()) / 1000);

    // Room name namespaced by the consuming app, so two apps that both
    // call something "lobby" do not land in one room.
    const room = `${session.app}__${session.externalId}`;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: apiKey,
      sub: verdict.participantId,
      nbf: now,
      exp: now + ttlSec,
      // LiveKit reads identity from `sub`; `name` is display only and
      // is deliberately not set here — this service holds no profile
      // data and is not going to start.
      video: videoGrantFor(verdict.role, room),
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(signingInput).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return {
      transport: 'livekit',
      url,
      room,
      token: `${signingInput}.${signature}`,
      expiresAt: (now + ttlSec) * 1000,
    };
  }

  function describe() {
    return {
      adapter: 'livekit',
      url: url || null,
      configured: Boolean(url && apiKey && apiSecret),
      // Never the secret, and never the key: this object goes onto
      // /api/health.
      note: 'self-hosted or managed LiveKit; the same token works against either',
    };
  }

  return { name: 'livekit', joinCredential, describe, assertConfigured };
}

module.exports = { create, videoGrantFor };
