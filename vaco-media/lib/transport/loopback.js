// VACO MEDIA — the loopback adapter.
//
// **This carries no media, and says so in everything it returns.**
//
// It exists so the control plane — sessions, grants, capacity, expiry,
// revocation, lifecycle events — can be built, tested and run end to
// end before anyone stands up an SFU. That is most of the work and all
// of the security, and it should not wait on a server nobody has
// provisioned yet.
//
// The temptation this file is designed against is the one
// `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md` names outright:
//
//   > Do not add a `<video>` tag pointing at a placeholder file to make
//   > a demo look complete. [...] A player that plays a stock clip is a
//   > worse artifact than a page that says the stream is not connected,
//   > because the first one has to be un-learned by whoever inherits
//   > it.
//
// So every response carries `mediaPlane: 'none'` and a human-readable
// `note`, the URL is an unroutable `loopback://`, and there is no code
// path here that produces something a player could be pointed at by
// mistake. A caller that renders this without reading it gets a broken
// address, not a stock clip — which is the correct failure.

function create(options = {}) {
  const now = () => Date.now();

  function joinCredential(verdict, session, options2 = {}) {
    const ttlMs = options2.ttlMs || 600000;
    return {
      transport: 'loopback',
      // Deliberately not a URL anything can connect to.
      url: `loopback://${session.app}/${session.externalId}`,
      room: `${session.app}__${session.externalId}`,
      // Not a token. Named so nobody mistakes it for one.
      token: null,
      participantId: verdict.participantId,
      role: verdict.role,
      expiresAt: (options2.now || now()) + ttlMs,
      mediaPlane: 'none',
      note: 'The control plane approved this join. No media transport is configured, '
        + 'so nothing will connect. Set VACO_MEDIA_TRANSPORT=livekit and point '
        + 'LIVEKIT_URL at an instance to carry real audio/video.',
    };
  }

  function describe() {
    return {
      adapter: 'loopback',
      configured: true,
      mediaPlane: 'none',
      note: 'control plane only — sessions, grants and lifecycle are real; media is not carried',
    };
  }

  return { name: 'loopback', joinCredential, describe };
}

module.exports = { create };
