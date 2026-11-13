# V4 — Doc-vs-Code Reconciliation Tracking

Running record of this app's own markdown docs checked directly
against its real, current code. Earlier rounds landed in
`git log --oneline -- v4-proxy/` (see `153fce6`: Jake added to
`V4Prototype.jsx`'s `AGENTS` array). This file tracks what this round
found and fixed. Per this project's convention, every fix below is an
*appended*, dated correction in the doc itself — no original claim was
deleted, including ones already superseded by a previous correction.

## This round (13 Nov 2026)

- [fixed] `V4_CLAUDE.md` — "Roster drift" section's "VACON's registry
  holds 12 domain agents plus MIA" / "Verified: the array parses, 12
  entries" had gone stale by one: `vacon/lib/agents.js` later gained a
  13th domain agent (Jake, VENVM), and the commit that added him to
  `V4Prototype.jsx`'s own `AGENTS` array (`153fce6`) didn't touch this
  count. Appended a dated correction; verified `V4Prototype.jsx` now
  has 13 `systemPrompt:` entries.
- [fixed] `V4_CLAUDE.md` — gap table item 5 ("Auth | Available, not
  wired here — Shield is real and used by other apps") understated
  reality for the backend: `server.js` now gates nearly every route
  through `lib/shieldAuth.cjs` (`requireSession`/`requireActor`/
  `requireCallParty`/`requireCallingService`, mostly via
  `actorOrService(...)`). Only the routes `server.js` itself marks
  `audit-route-guards: open` are unauthenticated, by design. Appended
  a correction splitting the claim: backend auth is closed; the
  `V4Prototype.jsx` `Login` screen is still the original mock and that
  half of the gap is genuinely still open.
- [fixed] `README.md` — "Note on scope" claimed "does not include
  auth... every request is anonymous," the same stale claim as above,
  now in the primary README. Appended a correction plus the real,
  previously-undocumented env vars this server actually reads with
  defaults (`SHIELD_API_URL`, `VACO_SERVICE_TOKENS`,
  `VACO_SERVICE_AUTH_MODE`, `VACO_MEDIA_URL`, `VACO_SERVICE_NAME`,
  `VACO_SERVICE_TOKEN`) — none were in `.env.example` or this file
  before.
- [fixed] `QVAN_LESLIE_DESKINS_TECH_AVATAR.md` — its own closing "One
  factual correction... No agent named Jake exists in VACON's roster"
  had become self-contradictory: the same document's own earlier "All
  three agents are real" section already lists `jake` in the real
  14-agent roster it quotes. The claim cited `vacon/README.md`'s
  *first* "no Jake" note, which `vacon/README.md` itself later
  corrected a second time once Jake was registered for real. Appended
  a correction reconciling both halves of this same file.
- [fixed] `QVAN_SECURITY_RESILIENCE_SCOPE.md` — two of its "not done"
  items are now done, both citing this document as their source:
  (1) "DREAMS local fallback — also not built" — `dreams/
  lib/offlineCache.js` exists, quotes this section's own line as its
  source of truth, and is wired into real routes
  (`GET /api/screens/:id/offline-content`,
  `POST /api/screens/:id/offline-plays`, `GET /api/offline-plays`).
  (2) "crypto-agility in V3 and VACA... not done" — `v3/lib/
  cryptoAgility.js` and `vaca/lib/cryptoAgility.js` both exist, both
  quote this section's recommendation verbatim, and both implement a
  config-resolved algorithm registry exactly as recommended. Appended
  dated corrections for both.
- [fixed] `VACO_GEOFENCING_GEO_ENGINE.md` — its own "Implementation
  status" table never mentioned `v4-proxy/lib/maps.js`, a real,
  REST-reachable location service (places, nearby, bounds, crossings,
  foot traffic, routing) built in this very app to close the "shared
  VACO location service" gap this document proposed. Appended a
  correction: the "Cross-app developer API" cell moves from "Not
  built" to "built, not yet adopted" (checked directly — no sibling
  app's code calls `/api/maps/*` yet), and the "Where it lives"
  question is partly answered (V4 already has a location database).
  The real remaining gap — named/reusable zones and enter/exit/dwell
  transitions — is still correctly unbuilt and said so explicitly.
- [fixed] `AI_HUMAN_TWIN_SCOPE.md` — "Honest limits" didn't mention
  that `POST /api/calls/:id/answer` now calls real `vaco-media`
  infrastructure (`lib/mediaClient.cjs`) for a fail-soft join
  confirmation on connect. Added real missing doc coverage: this does
  not contradict "no media and no rendering" (vaco-media's own SFU
  isn't deployed, so no real audio/video bytes flow yet), but the
  control-plane join confirmation is real, undocumented anywhere in
  this app's docs before this pass, and worth recording precisely
  rather than leaving the reader to assume nothing changed.

## Checked and found still accurate (no action needed)

- README's "Frontend coverage pass (31 Oct 2026)" section's specific
  route list — verified against `public/index.html` directly: all 25
  claimed-covered routes are called from it, and the 3
  "deliberately left backend-only" routes (`POST /api/agent`,
  `POST /api/calls/sweep-timeouts`, `GET /api/health`) are not.
  `server.js` has exactly 28 route handlers, matching every "28
  routes" claim in this app's docs.
- `VLAY_INTER_AGENT_COORDINATION.md`'s "13 real agents" count (domain
  agents, excluding MIA) — already correct against the current
  `vacon/lib/agents.js` roster including Jake.
- `V4_CLAUDE.md` gap items 0, 3, 6, 7 and `QVAN_LESLIE_DESKINS_
  TECH_AVATAR.md`'s "14-agent roster" / role claims — verified
  directly, still accurate.
- `lib/store.js`'s "deliberately in-memory, not persisted" claim
  (gap 6) — confirmed, still true.
- Cross-app route claims this app's docs make about VACON
  (`GET /api/agents`, `POST /api/agents/:id/invoke`, `POST
  /api/route`, `GET /api/route/history`) — all confirmed present in
  `vacon/server.js`.
- `dev-docs/phase-1-agent-proxy/` (`plan.md`, `tasks.md`) — an
  explicitly retroactive snapshot of this app's original, much smaller
  `/api/agent`-only phase; doesn't claim anything about the app's
  current, larger scope, so it isn't stale, just narrow by design.

## Still open (not a doc-vs-code mismatch — tracked for awareness only)

- `lib/maps.js`'s real cross-app API is not yet called by any sibling
  app (see the GEO_ENGINE correction above) — an adoption gap, not a
  documentation error, so no doc claims otherwise. Left for whichever
  app (CVNVO, VOID, DREAMS, HVNTZ) next needs shared location data.
