// VACO MCP — Model Context Protocol over stdio.
//
// Lets an MCP client (Claude Desktop, Claude Code, anything speaking the
// protocol) reach VACO's routes as tools. **Through the guards, never
// around them.**
//
// Run:
//   VACO_SERVICE_TOKEN=... node server.mjs
//
// Wired into a client as a stdio server:
//   { "command": "node", "args": ["/path/to/vaco-mcp/server.mjs"],
//     "env": { "VACO_SERVICE_TOKEN": "..." } }
//
// **No SDK, and the argument is the same one `vaco-media`'s LiveKit
// adapter makes.** MCP over stdio is JSON-RPC 2.0 with four methods
// that matter — initialize, notifications/initialized, tools/list,
// tools/call — newline-delimited on stdin and stdout. That is a hundred
// lines. Every app in this repo runs on express, cors and dotenv, and
// adding a protocol SDK to a process whose entire job is to forward
// HTTP would be the largest dependency in the repository serving the
// smallest service.
//
// **The honest cost of that choice**, since it is a real one: an SDK
// tracks protocol revisions and this does not. If MCP changes shape,
// this needs editing, and `test/protocol.mjs` — which drives a real
// spawned process with real frames rather than calling the handlers
// directly — is what will say so. That is the trade, taken knowingly,
// and it is cheaper to reverse than to have taken the dependency.

import process from 'node:process';
import { createRequire } from 'node:module';
import { TOOLS, HEALTH_TARGETS, DEFAULT_URLS, toolByName, describeTools } from './lib/tools.mjs';

const require = createRequire(import.meta.url);
const { newTraceId, newSpanId, formatTraceparent } = require('./lib/tracing.cjs');

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

const SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-mcp';
const SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
const TIMEOUT_MS = Number(process.env.VACO_MCP_TIMEOUT_MS || 8000);

const urlFor = (key) => process.env[key] || DEFAULT_URLS[key] || '';

// -- JSON-RPC ------------------------------------------------------------
//
// Errors use the standard codes. A tool that fails is NOT a protocol
// error: it returns a normal result with `isError: true`, because the
// model is meant to see what went wrong and adjust. A JSON-RPC error
// would hide a 401 behind a transport failure, and "the guard refused
// me" is the single most useful thing this server can say.

const ERR = { PARSE: -32700, INVALID_REQUEST: -32600, NO_METHOD: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 };

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
const ok = (text) => ({ content: [{ type: 'text', text }] });
const bad = (text) => ({ content: [{ type: 'text', text }], isError: true });

// -- calling the ecosystem ----------------------------------------------

async function callTool(tool, args) {
  let base;
  if (tool.service === 'BY_NAME') {
    // Allowlisted by name. See the note on HEALTH_TARGETS: a free-form
    // host here would be an SSRF primitive holding a service credential.
    const key = HEALTH_TARGETS[String(args.service || '').toLowerCase()];
    if (!key) {
      return bad(`system.health: "${args.service}" is not a known service. `
        + `One of: ${Object.keys(HEALTH_TARGETS).join(', ')}.`);
    }
    base = urlFor(key);
  } else {
    base = urlFor(tool.service);
  }

  const path = typeof tool.path === 'function' ? tool.path(args) : tool.path;
  const traceparent = formatTraceparent({ traceId: newTraceId(), spanId: newSpanId() });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base + path, {
      method: tool.method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // The credential every call carries. Nothing here is exempt.
        ...(SERVICE_TOKEN ? { 'X-Service-Name': SERVICE_NAME, 'X-Service-Token': SERVICE_TOKEN } : {}),
        // Started here, so an agent's action is traceable from the tool
        // call through every service it touches.
        traceparent,
      },
      body: tool.body ? JSON.stringify(args) : undefined,
    });

    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      // Said plainly, because "the guard refused me" is information the
      // model can act on and a generic failure is not.
      const why = (body && body.error) || res.statusText;
      return bad(
        `${tool.name} was refused (HTTP ${res.status}): ${why}\n`
        + (res.status === 401 || res.status === 403
          ? 'This is authorization, not an outage. This server holds one service credential and has '
            + 'no privileged path; a route that refuses it is behaving correctly.'
          : ''),
      );
    }
    return ok(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  } catch (err) {
    const reason = err.name === 'AbortError' ? `no answer within ${TIMEOUT_MS}ms` : err.message;
    return bad(`${tool.name} could not reach ${base}: ${reason}. The service may not be running.`);
  } finally {
    clearTimeout(timer);
  }
}

// -- required-argument check --------------------------------------------
//
// Done here rather than trusting the client. `inputSchema` is a contract
// the model is asked to honour, not one the transport enforces.
function missingArgs(tool, args) {
  const required = (tool.inputSchema && tool.inputSchema.required) || [];
  return required.filter((k) => args[k] === undefined || args[k] === null);
}

// -- the protocol --------------------------------------------------------

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      // Echo the client's version when we speak it; otherwise answer with
      // ours and let the client decide. Refusing outright would break a
      // client that could have negotiated down.
      const asked = params && params.protocolVersion;
      return reply(id, {
        protocolVersion: SUPPORTED.has(asked) ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'vaco-mcp', version: '1.0.0' },
        instructions:
          'Tools onto the VACO ecosystem. Every call goes through the same authorization as any '
          + 'other caller: this server holds one service credential and has no privileged path. '
          + 'Money-moving routes are deliberately not exposed — those require a human or an '
          + 'operator credential and are recorded in vaco-audit before they happen.',
      });
    }

    case 'notifications/initialized':
      return undefined;                       // no reply to a notification

    case 'ping':
      return reply(id, {});

    case 'tools/list':
      return reply(id, { tools: describeTools() });

    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = toolByName(name);
      if (!tool) return fail(id, ERR.INVALID_PARAMS, `no tool named "${name}"`);

      const missing = missingArgs(tool, args);
      if (missing.length) {
        return reply(id, bad(`${name} requires: ${missing.join(', ')}`));
      }
      return reply(id, await callTool(tool, args));
    }

    default:
      if (isNotification) return undefined;   // unknown notifications are ignored, per spec
      return fail(id, ERR.NO_METHOD, `unknown method "${method}"`);
  }
}

// -- stdio framing -------------------------------------------------------
//
// Newline-delimited JSON. Buffered rather than read line-by-line from a
// stream helper, because a single JSON object can arrive split across
// two chunks and treating each chunk as a message loses it.

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;

    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: ERR.PARSE, message: 'invalid JSON' } }); continue; }
    if (msg.jsonrpc !== '2.0') { fail(msg.id ?? null, ERR.INVALID_REQUEST, 'jsonrpc must be "2.0"'); continue; }

    try {
      await handle(msg);
    } catch (err) {
      // A thrown handler must not take the process down: the client
      // would see the pipe close and have no idea why.
      if (msg.id !== undefined && msg.id !== null) fail(msg.id, ERR.INTERNAL, err.message);
      else process.stderr.write(`vaco-mcp: ${err.stack}\n`);
    }
  }
});

process.stdin.on('end', () => process.exit(0));

// stderr, never stdout: stdout is the protocol channel and one stray
// log line on it corrupts the stream.
process.stderr.write(
  `vaco-mcp ready — ${TOOLS.length} tools, credential ${SERVICE_TOKEN ? 'present' : 'ABSENT (calls will be refused)'}\n`,
);
