// V4 Search Layer — the single, canonical search infrastructure every
// app with a search feature calls into, instead of each app building
// its own. Same consolidation pattern already used for V4's Maps layer.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl -X POST http://localhost:8788/api/search \
//     -H "Content-Type: application/json" \
//     -d '{"query":"hunt"}'

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import "dotenv/config";

import tracingModule from "./lib/tracing.cjs";
const { traceMiddleware } = tracingModule;
import { MemorySearchAdapter } from "./adapters/memoryAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 8788;

// Every app currently named as routing through V4 Search. Adding a new
// app means adding its id here and seeding its documents in the adapter
// — server.js and the route below don't change.
const APP_IDS = ["HVNTZ", "VACAY", "VENVS", "Vvltvre", "VOKEN", "VACON-C"];

const adapter = new MemorySearchAdapter();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apps: APP_IDS });
});

// audit-route-guards: open -- stateless query, POST only for body size; reads and writes no record
app.post("/api/search", async (req, res) => {
  const { query, apps, limit } = req.body || {};

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'query' string." });
  }
  if (apps !== undefined) {
    if (!Array.isArray(apps) || apps.some((a) => typeof a !== "string")) {
      return res.status(400).json({ error: "'apps' must be an array of app id strings." });
    }
    const unknown = apps.filter((a) => !APP_IDS.includes(a));
    if (unknown.length) {
      return res.status(400).json({ error: `Unknown app id(s): ${unknown.join(", ")}` });
    }
  }
  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    return res.status(400).json({ error: "'limit' must be a positive number." });
  }

  const started = Date.now();
  const results = await adapter.search(query, { apps, limit });
  res.json({ query, results, tookMs: Date.now() - started });
});

app.listen(PORT, () => {
  console.log(`V4 search layer listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
