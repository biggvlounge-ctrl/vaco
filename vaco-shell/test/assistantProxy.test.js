// vaco-shell — the personal assistant routes are now a thin proxy to
// the standalone `vaco-assistant` app (extracted 15 Oct 2026). The
// thing worth proving over a real HTTP request is that the proxy
// really forwards status codes and bodies rather than silently
// swallowing or reshaping them — spawns BOTH real servers, same real
// -HTTP pattern as v4-proxy/test/server.test.js and this session's
// other copies of it.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_DIR = path.join(__dirname, '..');
const ASSISTANT_DIR = path.join(SHELL_DIR, '..', 'vaco-assistant');
const DEPS = fs.existsSync(path.join(SHELL_DIR, 'node_modules', 'express'))
  && fs.existsSync(path.join(ASSISTANT_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vaco-shell or vaco-assistant node_modules is absent — these spawn real servers and need `npm install` first';

const SHELL_PORT = 18789;
const ASSISTANT_PORT = 18829;
const SHELL_BASE = `http://127.0.0.1:${SHELL_PORT}`;
const ASSISTANT_BASE = `http://127.0.0.1:${ASSISTANT_PORT}`;

let shellChild;
let assistantChild;
let bootLog = '';

async function waitForHealth(base, label, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return res;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(`${label} did not answer /api/health within ${timeoutMs}ms.\n--- output so far ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;

  assistantChild = spawn(process.execPath, ['server.js'], {
    cwd: ASSISTANT_DIR,
    env: { ...process.env, PORT: String(ASSISTANT_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assistantChild.stdout.on('data', (d) => { bootLog += `[assistant] ${d}`; });
  assistantChild.stderr.on('data', (d) => { bootLog += `[assistant] ${d}`; });
  await waitForHealth(ASSISTANT_BASE, 'vaco-assistant');

  shellChild = spawn(process.execPath, ['server.js'], {
    cwd: SHELL_DIR,
    env: { ...process.env, PORT: String(SHELL_PORT), ASSISTANT_API_URL: ASSISTANT_BASE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  shellChild.stdout.on('data', (d) => { bootLog += `[shell] ${d}`; });
  shellChild.stderr.on('data', (d) => { bootLog += `[shell] ${d}`; });
  await waitForHealth(SHELL_BASE, 'vaco-shell');
});

test.after(() => {
  if (shellChild && !shellChild.killed) shellChild.kill('SIGTERM');
  if (assistantChild && !assistantChild.killed) assistantChild.kill('SIGTERM');
});

test('GET /api/assistant/tones proxies through to the real vaco-assistant response', { skip: SKIP }, async () => {
  const res = await fetch(`${SHELL_BASE}/api/assistant/tones`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tones, ['friendly', 'direct', 'professional', 'motivational']);
});

test('GET /api/assistant/profile/:userId forwards vaco-assistant\'s real 401, not a local pass-through', { skip: SKIP }, async () => {
  const res = await fetch(`${SHELL_BASE}/api/assistant/profile/demo-user`);
  assert.equal(res.status, 401, 'an anonymous caller reached a profile through the shell proxy');
});

test('POST /api/assistant/chat forwards vaco-assistant\'s real 401 for an anonymous caller', { skip: SKIP }, async () => {
  const res = await fetch(`${SHELL_BASE}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'demo-user', content: 'hi' }),
  });
  assert.equal(res.status, 401, 'an anonymous caller could chat as someone through the shell proxy');
});
