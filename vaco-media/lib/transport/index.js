// VACO MEDIA — the transport seam.
//
// **Why an adapter rather than a direct integration.** Real media
// transport cannot be written from scratch here and should not be: an
// SFU is congestion control, simulcast, NAT traversal and TURN relay
// fallback, and it is not the kind of hard that rewards a first
// attempt. So the media *plane* is somebody else's software.
//
// The media **control** plane -- who may join, for how long, what they
// may publish, what happened -- is ours, lives in `lib/sessions.js`,
// and is the part that would otherwise be scattered across four
// consumer apps in four incompatible shapes.
//
// This file is the line between them, and it exists so the answer to
// "which SFU" is configuration rather than architecture. Same reason
// `v3/lib/cryptoAgility.js` exists: an algorithm choice that turns out
// wrong should cost a config change, not a rewrite.
//
// **The default is LiveKit, self-hosted**, on one specific ground
// rather than general preference: it is the only real option where the
// same code runs against an instance you own and a managed one. Nobody
// holds the sessions hostage. `deploy/` self-hosts everything else in
// this ecosystem; this follows that.
//
// **What an adapter must never do:** decide who may join. It receives a
// verdict from `verifyGrant` and mints transport credentials for a
// participant already approved. An adapter that consults anything else
// has become a second authorization system, which is the failure this
// ecosystem keeps not making.

const ADAPTERS = ['livekit', 'loopback'];

function createTransport(options = {}) {
  const name = options.adapter || process.env.VACO_MEDIA_TRANSPORT || 'loopback';
  if (!ADAPTERS.includes(name)) {
    throw new Error(
      `VACO_MEDIA_TRANSPORT must be one of ${ADAPTERS.join(', ')} (got "${name}")`,
    );
  }
  // eslint-disable-next-line global-require
  const factory = require(`./${name}`);
  return factory.create(options);
}

module.exports = { ADAPTERS, createTransport };
