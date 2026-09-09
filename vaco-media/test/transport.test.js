// VACO MEDIA — the transport adapters.
//
// **The failure these guard against is the tempting one.** The media
// plane needs a server nobody has provisioned yet, and the shortest
// path to a demo that looks finished is an adapter that returns a
// plausible URL. `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md` names it:
//
//   > A player that plays a stock clip is a worse artifact than a page
//   > that says the stream is not connected, because the first one has
//   > to be un-learned by whoever inherits it.
//
// So the loopback adapter is asserted to be *unusable* — not merely
// documented as such. And the LiveKit adapter is asserted to produce a
// token a real instance would accept, because an adapter that mints a
// plausible-looking string nobody validates is the same lie one layer
// down.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const { ADAPTERS, createTransport } = require('../lib/transport');
const livekit = require('../lib/transport/livekit');

const SESSION = { app: 'cvnvo', externalId: 'speed-date-42' };
const VERDICT = { participantId: 'ada', role: 'publisher' };
const NOW = 1787845000000;

// -- The seam ------------------------------------------------------------

test('an unknown adapter is refused at construction, not at first join', () => {
  // A media service that starts healthy and fails only when somebody
  // tries to talk is the same class as a settlement route that 401s
  // only when money moves.
  assert.throws(() => createTransport({ adapter: 'zoom' }), /must be one of/);
  for (const name of ADAPTERS) {
    assert.strictEqual(createTransport({ adapter: name }).name, name);
  }
});

// -- Loopback: asserted unusable ----------------------------------------

test('loopback returns nothing a player could be pointed at', () => {
  const out = createTransport({ adapter: 'loopback' })
    .joinCredential(VERDICT, SESSION, { ttlMs: 600000, now: NOW });

  assert.strictEqual(out.token, null, 'a null token cannot be mistaken for a real one');
  assert.strictEqual(out.mediaPlane, 'none');
  assert.match(out.url, /^loopback:\/\//, 'the URL must not be a routable scheme');
  assert.ok(!/^https?:|^wss?:/.test(out.url), 'nothing here may look connectable');
  assert.match(out.note, /no media transport is configured/i,
    'the response must say so in words, for whoever reads it and not the schema');
});

test('loopback still reports the control-plane decision it was given', () => {
  // Honest about the media plane is not the same as useless: the
  // approval is real and the consumer needs it.
  const out = createTransport({ adapter: 'loopback' })
    .joinCredential({ participantId: 'grace', role: 'subscriber' }, SESSION, { now: NOW });
  assert.strictEqual(out.participantId, 'grace');
  assert.strictEqual(out.role, 'subscriber');
  assert.strictEqual(out.room, 'cvnvo__speed-date-42');
});

// -- LiveKit: asserted real ---------------------------------------------

function decode(part) {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
}

test('livekit mints a token a real instance would accept', () => {
  const secret = 'a-secret-of-entirely-sufficient-length';
  const t = livekit.create({ url: 'wss://livekit.vaco.internal', apiKey: 'APIk', apiSecret: secret });
  const out = t.joinCredential(VERDICT, SESSION, { ttlMs: 600000, now: NOW });

  const [h, p, sig] = out.token.split('.');
  assert.deepStrictEqual(decode(h), { alg: 'HS256', typ: 'JWT' });

  const payload = decode(p);
  assert.strictEqual(payload.iss, 'APIk');
  assert.strictEqual(payload.sub, 'ada', 'LiveKit reads participant identity from sub');
  assert.strictEqual(payload.exp - payload.nbf, 600, 'the token expires when the grant does');

  // Signature checked rather than assumed. An adapter that emits a
  // plausible string nobody validates is the same lie one layer down.
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert.strictEqual(sig, expected);
});

test('the role becomes the right LiveKit grant, in both directions', () => {
  // A viewer who can publish appears on the wall. This is the line
  // between an audience member and a broadcaster at Vavlt Stvdios.
  const pub = livekit.videoGrantFor('publisher', 'r');
  assert.strictEqual(pub.canPublish, true);
  assert.strictEqual(pub.canSubscribe, false);

  const sub = livekit.videoGrantFor('subscriber', 'r');
  assert.strictEqual(sub.canPublish, false, 'a subscriber must never be able to publish');
  assert.strictEqual(sub.canSubscribe, true);

  const both = livekit.videoGrantFor('both', 'r');
  assert.strictEqual(both.canPublish, true);
  assert.strictEqual(both.canSubscribe, true);
});

test('rooms are namespaced by app, so two apps cannot collide', () => {
  const t = livekit.create({ url: 'wss://x', apiKey: 'k', apiSecret: 'ssssssssssssssssssssssssssssssss' });
  const a = t.joinCredential(VERDICT, { app: 'cvnvo', externalId: 'lobby' }, { now: NOW });
  const b = t.joinCredential(VERDICT, { app: 'vxllage', externalId: 'lobby' }, { now: NOW });
  assert.notStrictEqual(a.room, b.room, 'two apps both calling something "lobby" must not share a room');
});

test('an unconfigured livekit refuses loudly and names what is missing', () => {
  const t = livekit.create({ url: '', apiKey: '', apiSecret: '' });
  assert.throws(() => t.joinCredential(VERDICT, SESSION, { now: NOW }),
    /LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET/);
  assert.strictEqual(t.describe().configured, false);
});

test('describe() never leaks the API secret', () => {
  const secret = 'do-not-put-me-on-a-health-endpoint-xx';
  const described = livekit.create({ url: 'wss://x', apiKey: 'k', apiSecret: secret }).describe();
  // This object goes onto /api/health, which is unauthenticated.
  assert.ok(!JSON.stringify(described).includes(secret));
  assert.ok(!JSON.stringify(described).includes('"k"'));
  assert.strictEqual(described.configured, true);
});
