// VACO MCP — the protocol, driven over a real pipe.
//
// **Every test here spawns the process and writes JSON-RPC frames to
// its stdin.** Calling the handlers directly would be easier and would
// prove almost nothing: this server's entire job is to speak a wire
// protocol to a client nobody in this repo controls, and the failures
// that matter are framing ones — a message split across two chunks, a
// notification answered when it must not be, a log line on stdout
// corrupting the stream.
//
// It is also the check that pays for choosing no SDK. That choice means
// protocol revisions have to be tracked by hand, and this file is what
// says when something no longer matches.

import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER = path.join(APP_DIR, 'server.mjs');

// **Every spawned child is tracked and killed, pass or fail.**
// The first version only killed the child in `c.close()` at the end of
// each test — so the moment an assertion threw, that child kept stdio
// open and `node --test` never exited. A failing suite hung instead of
// reporting, which is worse than the failure it was hiding.
const CHILDREN = new Set();
test.after(() => {
  for (const c of CHILDREN) if (!c.killed) c.kill('SIGKILL');
});

/** A client that speaks the protocol over a real pipe. */
function client(env = {}) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: APP_DIR,
    env: { ...process.env, VACO_SERVICE_TOKEN: 'test-token', VACO_MCP_TIMEOUT_MS: '2500', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  CHILDREN.add(child);
  let out = '';
  let err = '';
  const waiters = new Map();
  const seen = [];

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (c) => {
    out += c;
    let nl;
    while ((nl = out.indexOf('\n')) !== -1) {
      const line = out.slice(0, nl).trim();
      out = out.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);          // throws loudly if stdout is polluted
      seen.push(msg);
      const w = waiters.get(msg.id);
      if (w) { waiters.delete(msg.id); w(msg); }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => { err += c; });

  return {
    child,
    seen,
    stderr: () => err,
    /** Send raw text — used to prove chunk-splitting is handled. */
    raw: (text) => child.stdin.write(text),
    send(msg) { child.stdin.write(`${JSON.stringify(msg)}\n`); },
    request(id, method, params) {
      const p = new Promise((res, rej) => {
        waiters.set(id, res);
        setTimeout(() => rej(new Error(`no response to ${method} (id ${id}) within 5s. stderr: ${err}`)), 5000);
      });
      this.send({ jsonrpc: '2.0', id, method, params });
      return p;
    },
    async close() {
      child.stdin.end();
      await new Promise((r) => { child.on('exit', r); setTimeout(r, 1500); });
      if (!child.killed) child.kill('SIGKILL');
      CHILDREN.delete(child);
    },
  };
}

// -- handshake -----------------------------------------------------------

test('initialize returns a protocol version, capabilities and a name', async () => {
  const c = client();
  const res = await c.request(1, 'initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' },
  });
  assert.equal(res.jsonrpc, '2.0');
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, '2025-06-18', 'a version we support was not echoed back');
  assert.ok(res.result.capabilities.tools, 'the server did not declare tool capability');
  assert.equal(res.result.serverInfo.name, 'vaco-mcp');
  await c.close();
});

test('an unsupported protocol version gets ours rather than a refusal', async () => {
  // Refusing outright would break a client that could have negotiated
  // down to a version we both speak.
  const c = client();
  const res = await c.request(1, 'initialize', { protocolVersion: '1999-01-01', capabilities: {} });
  assert.equal(res.result.protocolVersion, '2025-06-18');
  await c.close();
});

test('notifications get no reply at all', async () => {
  // A reply to a notification is a protocol violation, and clients
  // differ in how loudly they complain about it.
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  c.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  c.send({ jsonrpc: '2.0', method: 'notifications/somethingUnknown' });
  const after = await c.request(2, 'ping', {});
  assert.equal(after.id, 2);
  assert.equal(c.seen.length, 2, `expected 2 replies (init, ping), got ${c.seen.length}`);
  await c.close();
});

// -- tools ---------------------------------------------------------------

test('tools/list returns well-formed tools', async () => {
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const res = await c.request(2, 'tools/list', {});
  const tools = res.result.tools;
  assert.ok(tools.length >= 10, `only ${tools.length} tools`);
  for (const t of tools) {
    assert.match(t.name, /^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/, `tool name "${t.name}" is not noun.verb`);
    assert.ok(t.description && t.description.length > 20, `${t.name} has no useful description`);
    assert.equal(t.inputSchema.type, 'object', `${t.name} has no object inputSchema`);
  }
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length, 'two tools share a name');
  await c.close();
});

test('no tool that moves money is exposed', async () => {
  // **The load-bearing assertion in this file.** An MCP server is a way
  // to let an agent act; the routes that move VCoin require a human or
  // an operator credential and are recorded in vaco-audit before they
  // happen. If one ever appears in this list, that decision has been
  // reversed by accident.
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const names = (await c.request(2, 'tools/list', {})).result.tools.map((t) => t.name);
  const forbidden = names.filter((n) => /transfer|settle|payout|purchase|refund|charge|withdraw|mint|bet|wager/i.test(n));
  assert.deepEqual(forbidden, [], 'a money-moving tool is exposed to agents');
  assert.ok(!names.includes('agent.ask'), 'the model pass-through is exposed — an agent calling itself');
  await c.close();
});

test('an unknown tool is a protocol error, a bad argument is not', async () => {
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });

  const unknown = await c.request(2, 'tools/call', { name: 'nope.nothing', arguments: {} });
  assert.equal(unknown.error.code, -32602, 'an unknown tool should be an invalid-params error');

  // A missing argument is a *result* with isError, not a transport
  // error — the model is meant to read it and try again.
  const missing = await c.request(3, 'tools/call', { name: 'maps.nearby', arguments: { lat: 38.6 } });
  assert.ok(!missing.error, 'a missing argument was reported as a protocol error');
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /lng/);
  await c.close();
});

test('an unreachable service fails the tool, not the connection', async () => {
  const c = client({ V4_PROXY_URL: 'http://127.0.0.1:9' });
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const res = await c.request(2, 'tools/call', { name: 'maps.describe', arguments: {} });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /could not reach|no answer/);
  // and the server is still alive afterwards
  assert.equal((await c.request(3, 'ping', {})).id, 3);
  await c.close();
});

test('system.health refuses a service it does not know', async () => {
  // The tool takes a name, never a URL. A free-form host here would make
  // this an SSRF primitive carrying a service credential.
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const res = await c.request(2, 'tools/call', {
    name: 'system.health', arguments: { service: 'http://169.254.169.254/latest/meta-data' },
  });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /not a known service/);
  await c.close();
});

// -- it actually calls the ecosystem, with the credential ---------------

test('a tool call carries the service credential and a trace id', async () => {
  // A stand-in for V4 that records what arrived. The point is not that
  // fetch works — it is that the credential and the traceparent are on
  // the wire, since "goes through the guards" is the entire claim this
  // server makes.
  let got = null;
  const srv = http.createServer((req, res) => {
    got = { url: req.url, headers: req.headers };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ places: 3, sightings: 0 }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const c = client({ V4_PROXY_URL: `http://127.0.0.1:${port}`, VACO_SERVICE_TOKEN: 'tok-abc' });
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const res = await c.request(2, 'tools/call', { name: 'maps.describe', arguments: {} });

  assert.ok(!res.result.isError, `tool errored: ${JSON.stringify(res.result)}`);
  assert.match(res.result.content[0].text, /"places": 3/);
  assert.equal(got.url, '/api/maps');
  assert.equal(got.headers['x-service-name'], 'vaco-mcp', 'no service name on the call');
  assert.equal(got.headers['x-service-token'], 'tok-abc', 'no service token on the call');
  assert.match(
    got.headers.traceparent || '', /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    'no W3C traceparent — an agent action would not be traceable into the ecosystem',
  );

  await c.close();
  srv.close();
});

test('a refusal is reported as a refusal, not as an outage', async () => {
  const srv = http.createServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'serviceAuth: this route requires a trusted-service credential.' }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));

  const c = client({ V4_PROXY_URL: `http://127.0.0.1:${srv.address().port}` });
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  const res = await c.request(2, 'tools/call', { name: 'maps.describe', arguments: {} });

  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /HTTP 401/);
  assert.match(res.result.content[0].text, /serviceAuth/);
  assert.match(res.result.content[0].text, /authorization, not an outage/,
    'the model is not told that a 401 here is correct behaviour rather than a fault');
  await c.close();
  srv.close();
});

// -- framing -------------------------------------------------------------

test('a message split across two writes is still read as one', async () => {
  // The failure a line-per-chunk reader has, which only shows up under
  // load or over a slow pipe — i.e. never in development.
  const c = client();
  const frame = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {} },
  });
  const wait = new Promise((res) => {
    const iv = setInterval(() => { if (c.seen.length) { clearInterval(iv); res(c.seen[0]); } }, 20);
    setTimeout(() => { clearInterval(iv); res(null); }, 4000);
  });
  c.raw(frame.slice(0, 25));
  await new Promise((r) => setTimeout(r, 120));
  c.raw(`${frame.slice(25)}\n`);

  const res = await wait;
  assert.ok(res, 'a split frame was never assembled');
  assert.equal(res.result.serverInfo.name, 'vaco-mcp');
  await c.close();
});

test('two messages in one write are both handled', async () => {
  const c = client();
  c.raw(
    `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } })}\n`
    + `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`,
  );
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(c.seen.length, 2, `expected 2 replies, got ${c.seen.length}`);
  assert.ok(c.seen.find((m) => m.id === 2).result.tools.length > 0);
  await c.close();
});

test('malformed JSON gets a parse error and does not kill the process', async () => {
  const c = client();
  c.raw('{ this is not json }\n');
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(c.seen[0].error.code, -32700);
  const res = await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  assert.equal(res.id, 1, 'the server did not survive a bad frame');
  await c.close();
});

test('nothing but protocol is written to stdout', async () => {
  // One stray console.log on stdout corrupts the stream for the client.
  // The readiness line goes to stderr, and this proves it.
  const c = client();
  await c.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} });
  await c.request(2, 'tools/list', {});
  assert.ok(c.stderr().includes('vaco-mcp ready'), 'the readiness line is missing from stderr');
  for (const m of c.seen) assert.equal(m.jsonrpc, '2.0', 'a non-protocol object reached stdout');
  await c.close();
});
