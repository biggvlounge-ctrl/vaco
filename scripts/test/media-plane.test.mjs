// The media plane exists, and the control plane is pointed at it.
//
// **The gap this closes.** `vaco-media/lib/transport/livekit.js` has
// minted real, correctly-signed LiveKit join tokens since it was
// written — and its own header said what was missing, in as many
// words: *"that needs an actual SFU process, and `deploy/` does not
// run one yet."*
//
// So the token was real and had nowhere to be spent. Every test in
// this repo passed, because every one of them tested the token.
//
// This checks the other half: that a server exists in the deployment,
// that the service which mints tokens is pointed at it, and that the
// two agree about which ports carry media. Those are three separate
// files — `deploy/generate-docker-compose.js`, `docker-compose.yml`
// and `deploy/livekit.yaml` — and nothing else compares them.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const compose = read('docker-compose.yml');
const livekitConf = read('deploy/livekit.yaml');

// The `livekit:` service block, up to the next top-level service.
function serviceBlock(name) {
  const m = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|\\nvolumes:)`).exec(compose);
  assert.ok(m, `docker-compose.yml has no "${name}" service — this scan is broken or the service is gone`);
  return m[1];
}

test('the deployment runs an SFU', () => {
  const block = serviceBlock('livekit');
  assert.match(block, /image: "?livekit\/livekit-server/, 'the livekit service is not a livekit server');
  assert.match(block, /deploy\/livekit\.yaml:\/etc\/livekit\.yaml/, 'the SFU has no config mounted');
});

test('the SFU publishes every port its own config listens on', () => {
  // The failure this catches is silent and total: a config listening on
  // a port compose does not publish is a media server nobody can reach,
  // and it comes up perfectly healthy.
  const block = serviceBlock('livekit');
  const declared = {
    http: /^port:\s*(\d+)/m.exec(livekitConf),
    tcp: /tcp_port:\s*(\d+)/.exec(livekitConf),
    udp: /udp_port:\s*(\d+)/.exec(livekitConf),
  };
  for (const [what, m] of Object.entries(declared)) {
    assert.ok(m, `deploy/livekit.yaml declares no ${what} port — this scan is broken`);
    assert.match(
      block, new RegExp(`"${m[1]}:${m[1]}`),
      `livekit.yaml listens on ${m[1]} (${what}) but compose does not publish it`,
    );
  }
});

test('vaco-media is pointed at the SFU by default, not at nothing', () => {
  const block = serviceBlock('vaco-media');
  // Before the SFU existed this defaulted to empty, so selecting the
  // livekit transport in Docker meant selecting a blank URL.
  assert.match(
    block, /LIVEKIT_URL: "\$\{LIVEKIT_URL:-ws:\/\/livekit:7880\}"/,
    'vaco-media does not default to the in-network SFU',
  );
  assert.match(block, /depends_on:[\s\S]*?- livekit/, 'vaco-media does not wait for the SFU');
});

test('the stack still comes up with no media credentials', () => {
  // The whole point of the loopback default. A contributor with no
  // LiveKit keys must still get a working ecosystem, and the media
  // service must still start — it just cannot carry audio.
  const media = serviceBlock('vaco-media');
  assert.match(
    media, /VACO_MEDIA_TRANSPORT: "\$\{VACO_MEDIA_TRANSPORT:-loopback\}"/,
    'the media transport no longer defaults to loopback — an unconfigured checkout will now fail to boot',
  );
  const sfu = serviceBlock('livekit');
  assert.match(sfu, /LIVEKIT_KEYS: "\$\{LIVEKIT_API_KEY:-\}/, 'the SFU demands keys that a fresh checkout does not have');
});

test('no media secret is committed', () => {
  // `deploy/livekit.yaml` is mounted read-only into the container and
  // lives in the repository. livekit-server also accepts keys inline in
  // that file, which is exactly how one ends up committed.
  assert.ok(
    !/^\s*keys:/m.test(livekitConf),
    'deploy/livekit.yaml declares a keys: block — API secrets belong in env, not in a committed config',
  );
});

test('the generator is what produced this, not a hand edit', () => {
  // Same rule the rest of the deploy layer runs on: docker-compose.yml
  // is generated, so a hand edit is a change that the next regeneration
  // silently discards.
  const gen = read('deploy/generate-docker-compose.js');
  assert.match(gen, /services\.livekit = \{/, 'the SFU is in docker-compose.yml but not in the generator');
});
