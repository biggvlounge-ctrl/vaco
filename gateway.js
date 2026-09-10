#!/usr/bin/env node
// VACO — the single-port gateway.
//
// **Why this exists.** This ecosystem is 34 backends on 34 ports plus
// two Vite frontends. `deploy/nginx-docker.conf` and
// `deploy/nginx-vaco.conf.example` solve that for a VPS or a Compose
// stack — path-based routing behind one domain — and they are the
// right answer where nginx is available.
//
// Plenty of hosts do not give you nginx. Replit, Render, Fly and most
// PaaS boxes expose exactly one port and expect one process to own it.
// On those, the deploy story was previously "run 36 servers and expose
// one of them", which is not a deploy story.
//
// So: the same routing table, in Node, in front of the same servers.
//
// **It reads the manifest rather than repeating it.** `start-ecosystem.sh`'s
// APPS array is what `install-ecosystem.sh`, `generate-docker-compose.js`,
// `generate-nginx-conf.js`, `generate-ecosystem-config.js`,
// `smoke-frontend.mjs` and `generate-service-tokens.mjs` all read. A
// seventh hand-kept copy of the app list is exactly the drift this repo
// has now fixed three times (`.env.example`, `ecosystem.config.js`,
// `start-ecosystem.sh`'s own caller list). This is not a fourth.
//
// **Routing matches the nginx configs exactly**, because a request that
// works locally and 404s in production is worse than no gateway:
//
//   /<app>/...   → strip the prefix, proxy to that app's port
//   /            → vaco-shell, unprefixed (it is the front door)
//
// `vaco-shell` deliberately has no `/vaco-shell/` prefix, for the same
// reason `generate-nginx-conf.js` gives it the bare `/` root: the app
// store is what a visitor to the domain sees.
//
// Usage:
//   PORT=8080 node gateway.js          # after ./start-ecosystem.sh
//   node gateway.js --print-routes     # the table, for checking
//
// It proxies; it does not start anything. Whatever supervises the apps
// — `start-ecosystem.sh`, pm2, Compose — still does.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

// The one app that answers the bare `/` rather than a prefix.
const ROOT_APP = 'vaco-shell';

function manifestApps() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = src.match(/APPS=\(([\s\S]*?)\n\)/);
  if (!block) {
    throw new Error('gateway: start-ecosystem.sh has no APPS=( ... ) manifest to route from. '
      + 'Guessing a route table would send real traffic to invented ports; refusing.');
  }
  const apps = block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => {
      const [name, appPath, command, port] = l.slice(1, -1).split(':');
      return { name, appPath, command, port: Number(port) };
    });
  if (apps.length === 0) {
    throw new Error('gateway: the APPS manifest parsed to nothing. A gateway routing to no apps '
      + 'would 404 everything while looking healthy; refusing.');
  }
  return apps;
}

const apps = manifestApps();
const byName = new Map(apps.map((a) => [a.name, a]));

if (!byName.has(ROOT_APP)) {
  throw new Error(`gateway: ${ROOT_APP} is not in the manifest, so nothing would answer "/". `
    + 'Either it was renamed or ROOT_APP is stale.');
}

// What actually prevents one app swallowing another's traffic is the
// **trailing slash** on every prefix, not the sort below: `vex` and
// `vex-trading` are the closest pair in the manifest, and
// `/vex-trading/api/x` does not start with `/vex/` — the slash is the
// boundary. Since a name cannot contain `/`, no prefix here can be a
// prefix of another, and match order genuinely does not matter.
//
// The sort stays as cheap insurance against a future prefix shape that
// is not `/<name>/`. It is deliberately recorded as *not* load-bearing:
// reversing it changes no routing decision, and a test asserting it does
// would pass either way. `scripts/test/gateway.test.mjs` checks the
// property that is real — that no prefix contains another — instead.
const routes = apps
  .filter((a) => a.name !== ROOT_APP)
  .map((a) => ({ prefix: `/${a.name}/`, app: a }))
  .sort((x, y) => y.prefix.length - x.prefix.length);

// Same reason as `listen` below: a required module must not read the
// host process's argv and exit on it.
if (require.main === module && process.argv.includes('--print-routes')) {
  process.stdout.write(`${routes.length} prefixed route(s) + "/" → ${ROOT_APP}:${byName.get(ROOT_APP).port}\n\n`);
  for (const r of routes) {
    process.stdout.write(`  ${r.prefix.padEnd(22)} → 127.0.0.1:${String(r.app.port).padEnd(5)} (${r.app.command})\n`);
  }
  process.stdout.write(`  ${'/'.padEnd(22)} → 127.0.0.1:${byName.get(ROOT_APP).port}\n`);
  process.exit(0);
}

function targetFor(url) {
  for (const route of routes) {
    // `/void` (no trailing slash) is a real request a person types.
    // nginx's `location /void/` would miss it; redirecting is what a
    // browser expects and what avoids routing it to the shell.
    if (url === route.prefix.slice(0, -1)) return { redirectTo: route.prefix };
    if (url.startsWith(route.prefix)) {
      return { app: route.app, rewritten: url.slice(route.prefix.length - 1) || '/' };
    }
  }
  return { app: byName.get(ROOT_APP), rewritten: url };
}

const server = http.createServer((req, res) => {
  const target = targetFor(req.url);

  if (target.redirectTo) {
    res.writeHead(302, { Location: target.redirectTo });
    res.end();
    return;
  }

  const proxied = http.request({
    host: '127.0.0.1',
    port: target.app.port,
    method: req.method,
    path: target.rewritten,
    headers: {
      ...req.headers,
      // The same four nginx sets. Without them an app behind this sees
      // every request as coming from localhost over http, which breaks
      // any real-IP logging or scheme-aware redirect it does.
      'x-real-ip': req.socket.remoteAddress,
      'x-forwarded-for': req.headers['x-forwarded-for']
        ? `${req.headers['x-forwarded-for']}, ${req.socket.remoteAddress}`
        : req.socket.remoteAddress,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
    },
  }, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });

  proxied.on('error', (err) => {
    // Name the app that is down. "502" alone against 34 services is a
    // message that costs somebody twenty minutes.
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: `gateway: ${target.app.name} on port ${target.app.port} is not answering (${err.code || err.message})`,
      hint: 'Is the ecosystem running? ./start-ecosystem.sh, or pm2 start deploy/ecosystem.config.js',
    }));
  });

  req.pipe(proxied);
});

// WebSocket upgrades, for cvnvo's real-time messaging. nginx's config
// carries the Upgrade headers on cvnvo's location for exactly this;
// without the equivalent here, a ws:// connection through the gateway
// hangs rather than failing, which is harder to diagnose than a 502.
server.on('upgrade', (req, socket, head) => {
  const target = targetFor(req.url);
  if (target.redirectTo) { socket.destroy(); return; }

  const upstream = http.request({
    host: '127.0.0.1',
    port: target.app.port,
    method: req.method,
    path: target.rewritten,
    headers: req.headers,
  });
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${
      Object.entries(upRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (upHead && upHead.length) upSocket.unshift(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on('error', () => socket.destroy());
  if (head && head.length) upstream.write(head);
  upstream.end();
});

// Listen only when run as a program. Requiring this file — which the
// tests do, to check the route table without booting anything — must
// not bind a port. It did, and the symptom was a passing test suite
// that failed the run with EADDRINUSE against the gateway already
// serving the live ecosystem.
if (require.main === module) {
  server.listen(PORT, () => {
    process.stdout.write(`VACO gateway on :${PORT} — ${routes.length} prefixed routes, `
      + `"/" → ${ROOT_APP}:${byName.get(ROOT_APP).port}\n`);
  });
}

module.exports = { targetFor, routes, ROOT_APP };
