# V4 Agent Proxy

Closes V4_CLAUDE.md §7 gap 0. Holds the Anthropic API key server-side.
The frontend calls `POST /api/agent` on this server — it never talks to
`api.anthropic.com` directly and never sees the key.

## Setup

```bash
npm install
cp .env.example .env
# edit .env, set ANTHROPIC_API_KEY to a real key
npm start
```

You should see:

```
V4 agent proxy listening on http://localhost:8787
Health check: curl http://localhost:8787/api/health
```

## Verify it's actually working (do this yourself — I can't reach the
## network from here, so this is how you confirm it, not me)

1. Health check — confirms the server is up and the key was loaded
   (it exits immediately at startup if the key is missing, so a
   running process already implies a key is present):

   ```bash
   curl http://localhost:8787/api/health
   # -> {"ok":true,"model":"claude-sonnet-4-6"}
   ```

2. Real end-to-end call — confirms the key actually works against
   Anthropic and a real completion comes back:

   ```bash
   curl -X POST http://localhost:8787/api/agent \
     -H "Content-Type: application/json" \
     -d '{
       "system": "You are QVAN, a terse security executive. Reply in exactly one sentence.",
       "messages": [{"role":"user","content":"Status check."}]
     }'
   ```

   Expected shape:

   ```json
   { "text": "All systems nominal, no active threats detected." }
   ```

   (Exact wording will vary — that's expected, it's a live model call.
   What matters is you get a 200 with a non-empty `text` field, not an
   error.)

3. Failure modes to sanity-check, so you know the errors are handled
   and not silently swallowed:
   - Bad/missing key → server won't even start (fails fast in step 1).
   - Malformed request body → `400` with a specific message, e.g.
     `curl -X POST http://localhost:8787/api/agent -d '{}' -H "Content-Type: application/json"`
     should return `{"error":"Missing or invalid 'system' (agent persona) string."}`.
   - Upstream Anthropic error (bad model name, quota, etc.) → proxied
     back as the same status code with `error`, key never appears in
     the response.

## Wiring the frontend to it

**Update**: `V4Prototype.jsx`'s `callAgent()` no longer posts here
directly — it now calls `../vacon/`'s own `POST
/api/agents/:id/invoke`, which looks up the agent's real systemPrompt
in VACON's registry and calls straight into this exact `/api/agent`
route to get the completion. This server's own role is unchanged (the
only thing that ever holds the key and talks to Anthropic); VACON is
the new, real caller sitting between the frontend and this proxy. See
`../vacon/README.md`. This server still posts to `api.anthropic.com`
itself, same as always — what changed is only who calls *this* server:

- In dev, run this proxy on `localhost:8787` and either serve the
  React app from the same origin, or add a dev-server proxy rule
  (e.g. Vite's `server.proxy`) forwarding `/api` → `http://localhost:8787`.
- In production, deploy this server and the built frontend behind the
  same domain (or point the frontend at the proxy's full URL and add
  it to `cors()`'s allowed origins instead of the wide-open default
  below — the default here allows all origins, which is fine for local
  dev but should be locked down before a real deploy).

## Note on scope

This is a minimal, correct proxy — env-based key, input validation,
per-IP rate limiting, error passthrough without leaking the key. It
does not include auth (no user accounts exist yet per the CLAUDE.md
gaps), persistent logging, or per-user quotas. Add those once real
auth exists — right now every request is anonymous, same as the rest
of the prototype.
