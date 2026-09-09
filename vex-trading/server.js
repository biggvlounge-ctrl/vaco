// Vex Trading -- the real parent shell over VEX and Vex Business.
// Per direct instruction: "one app with sub apps" -- VEX (the Cvltvre
// Card brokerage, extracted from VOKEN) and Vex Business (the real
// futures-research/trading platform, renamed from CALL) are two
// genuinely separate, independently-run codebases (Node/Express vs.
// Python/FastAPI+Next.js) presented together as one real front door,
// the same "shell wraps real independent apps" shape vaco-shell
// already established for the whole ecosystem -- just scoped to these
// two. Nothing here merges their code or their data.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8817/api/health
//   curl http://localhost:8817/api/apps

const express = require('express');
const cors = require('cors');
require('dotenv/config');
const path = require('path');

const { listSubApps, getSubApp } = require('./lib/registry');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8817;

// A real, live reachability check against each sub-app's own
// /api/health -- never a hardcoded "online", same honest posture as
// every dashboard panel elsewhere in this ecosystem. A sub-app being
// down doesn't 500 this endpoint; it just reports `reachable: false`.
async function checkReachable(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vex-trading', subAppCount: listSubApps().length });
});

app.get('/api/apps', async (_req, res) => {
  const apps = await Promise.all(
    listSubApps().map(async (a) => ({ ...a, reachable: await checkReachable(a.apiUrl) })),
  );
  res.json({ apps });
});

app.get('/api/apps/:id', async (req, res) => {
  const found = getSubApp(req.params.id);
  if (!found) return res.status(404).json({ error: `no sub-app with id ${req.params.id}` });
  res.json({ ...found, reachable: await checkReachable(found.apiUrl) });
});

app.listen(PORT, () => {
  console.log(`Vex Trading listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});

module.exports = app;
