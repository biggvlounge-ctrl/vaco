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

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** "Does not
include auth" / "every request is anonymous" is stale. Checked
directly against `server.js`: real auth was added — `lib/shieldAuth.cjs`
and `lib/serviceAuth.cjs` gate nearly every route with `requireSession`,
`requireActor`, `requireCallParty`, or `requireCallingService` (most
wrapped in `actorOrService(...)` so a signed-in person or a named
internal service may both satisfy it). Only the LLM/maps-proxy reads
`server.js` itself marks `audit-route-guards: open` stay anonymous, on
purpose — there is no VACO principal to require on a pure-arithmetic
or pass-through query. What is still true, and the thing this note was
actually trying to say: there is no *V4-specific* auth here, no login
of its own, and no per-user quota — V4 relies entirely on Shield
sessions and the service-token allowlist other apps already use, per
`V4_CLAUDE.md`'s own gap-5 correction.

Two environment variables that follow from this and are not yet
listed in `.env.example`, both already read by this server with safe
defaults: `SHIELD_API_URL` (`lib/shieldAuth.cjs`, defaults to
`http://localhost:8812`) and `VACO_SERVICE_TOKENS` /
`VACO_SERVICE_AUTH_MODE` (`lib/serviceAuth.cjs`, which an internal
caller like VACON must be issued a token under to invoke `/api/agent`
as a service rather than as a session). `VACO_MEDIA_URL`,
`VACO_SERVICE_NAME`, and `VACO_SERVICE_TOKEN` (`lib/mediaClient.cjs`,
this server's own outbound call to `vaco-media` on call answer — see
`AI_HUMAN_TWIN_SCOPE.md`'s 13 Nov 2026 addition) round out the list.

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` making real calls against only 11
of this app's 28 routes. All three existing tabs (Maps, Twins, Calls)
kept their original shape; this pass filled in the real routes each
one left uncalled, plus two pre-existing bugs that meant part of the
*existing* coverage never actually worked. Every new call was checked
against its real `lib/*.js` function signature and the live server's
actual response shape (via `curl`, service-credential auth) before
being wired — no field name or payload shape here was guessed.

**Two pre-existing bugs, fixed as part of this pass** (both verified
directly against `lib/maps.js` / `lib/agentCall.js` before being
touched):

- **Maps tab, "Register a place"** posted only `placeId`/`name`/`lat`/
  `lng`. `registerPlace()` also requires `kind` (one of
  `lib/maps.js`'s `PLACE_KINDS`) and `sourceApp` — every submission was
  failing with a 400. Added both fields.
- **Calls tab, "Place a call"** posted `fromUserId`/`toAgentId`.
  `placeCall()` and the route's own `requireActor("userId")` guard
  both want `userId`/`agentId` — every call placement was refused with
  a 400, which meant the whole rest of the Calls tab (the table,
  Answer/Decline) had nothing real to operate on. Fixed the field
  names and added the real optional `topic` field.

**Maps tab** — `lib/maps.js` had seven routes with no frontend caller:

- `POST /api/maps/nearby` — "Find nearby places" radius search.
- `POST /api/maps/bounds` — used two ways: a real "Registered places"
  list (a world-spanning box turns the real viewport query into "every
  place", rather than inventing a list-all route) with a real
  `DELETE /api/maps/place/:id` action per row, and available as the
  underlying viewport query itself.
- `GET /api/maps/place/:id` — "Look up a place by id".
- `POST /api/maps/route` — "Plan a route", a 2–3 stop form showing
  real cumulative leg distance/time and the response's own
  "not road routing" disclaimer.
- `POST /api/maps/sighting` — "Record a sighting", the raw signal
  behind crossings and foot traffic.
- `POST /api/maps/crossings` — "Find my crossings" (what Kevin's
  system prompt promises CVNVO; the backend enforces that the
  signed-in session matches the `userId` being queried).
- `POST /api/maps/foot-traffic` — "Foot traffic near a point" (what
  DREA's system prompt promises DREAMS), shown with the response's own
  "self-reported, not independently audited" disclaimer rather than
  presenting it as verified measurement.

**Twins tab** — `lib/twinProfiles.js` / `lib/surfaces.js` had three
routes with no frontend caller, plus an existing table asking for
fields the real response never returns:

- The existing "Twins" table asked for `displayName`/`animationState`
  columns; `GET /api/twins` only ever returns
  `agentId`/`preferredFraming`/`voiceProfile`/`embodied` — every row
  was silently rendering em dashes. Replaced with the real fields, and
  added real columns (`label`/`maxFraming`/`video`) to the existing
  "Surfaces" table.
- `GET /api/twins/:agentId` — "Look up a twin profile", demonstrating
  that an unknown agent id resolves to V4's default presentation
  rather than a 404 (resolving a twin never invents an agent).
- `POST /api/twins/:agentId/presentation` — "Resolve a presentation",
  showing the real surface clamping live: TV Play permits full-body,
  FaceTime/web clamp to head-and-shoulders, and CarPlay drops to
  audio-only whenever the vehicle is moving *or* its motion state is
  left unspecified (treated as moving, not as "no").
- `POST /api/twins/animation/advance` — "Drive the animation state
  machine", a real transition simulator. An illegal transition (e.g.
  `absent` straight to `speaking`) comes back as the real 400 naming
  the legal options, not a silent clamp.

**Calls tab** — `lib/agentCall.js` had three routes with no frontend
caller:

- `GET /api/calls/:id` — "Call details": agent, surface, resolved
  framing, live animation state, topic, and the real per-call event
  timeline.
- `POST /api/calls/:id/events` — "Send a call event", streaming a real
  conversation event into a connected call and showing the resulting
  animation-state transition. Shares its event vocabulary with the
  Twins tab's simulator by fetching `GET /api/twins/animation/states`
  rather than hardcoding a second copy that could drift.
- `POST /api/calls/:id/end` — an "End" button on a connected call's
  row (the table previously only had actions for `ringing` calls).

**Deliberately left backend-only** — three routes, for reasons
specific to each, not a sweep running out of time:

- `POST /api/agent` — by design, per this file's own "Wiring the
  frontend to it" section above: the frontend doesn't call this proxy
  directly any more, VACON does (`POST /api/agents/:id/invoke`). Adding
  a direct caller here would route around that layering, not close a
  gap.
- `POST /api/calls/sweep-timeouts` — guarded by
  `requireCallingService()`, not a user session; it's a scheduler job
  that sweeps every ringing call in the store, not something a signed-
  in person's own session can reasonably authorize. This app's
  frontend has no service-credential login, same posture `void`'s own
  frontend-coverage pass took for its `requireOperator`-gated routes.
- `GET /api/health` — infrastructure, not an app feature; no other
  app in this sweep surfaces its own health check in its tabs either.
