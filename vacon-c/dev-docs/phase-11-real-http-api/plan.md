# Plan — Phase 11: real HTTP API + the Artifact/Mission system

## Goal
Close the single biggest gap on this project: real, substantial
simulation logic (2,729 lines across engine/keys/tick/traits) with
zero way to actually run it as a service. CLAUDE.md's own API contract
doc names 5 required endpoints that "must keep their exact shape" —
build them for real, for the first time in any handoff to this
project.

## Real investigation before any code
Read `README.md`'s own "No `/api/*` routes exist in this handoff"
section, `CLAUDE.md`'s own "API contract" pointer, and
`VACANCY_API_ENDPOINT_MAP.md` directly — a genuinely complete, real
REST contract already exists (~40 endpoints across 5 phases), but
CLAUDE.md itself only locks 5 as the "must keep exact shape" baseline:
`GET /api/state`, `POST /api/tick`, `POST /api/npc/generate`,
`POST /api/mission`, `GET /api/health`.

While building `/api/mission`, found a second real, false claim: both
CLAUDE.md's own "What this project is" section and the Locked Day 1
scope list mark the "Artifact/Mission system" as "already built" /
part of the "Foundation already running." Checked directly — no
`generateArtifact`, `generateMission`, or any related code exists
anywhere in `server/*.js`, and `WorldState` had no `artifacts`/
`missions` arrays. `VACANCY_POSTGRESQL_SCHEMA.sql` has real tables for
both, under a comment literally reading "already built since Volume
1" — the schema doc was written assuming code that was never actually
delivered in any handoff to this project. Same pattern this session
has caught repeatedly elsewhere (VAGO/VDP's false casino-district
claim, Village District's false VAGO precedent, Food District's false
placeholder claim) — now in this project too, and handled the same
way: verified directly, then built for real rather than faked or
skipped.

## Design
`server/missions.js` (new) — a real module matching the real schema
shape exactly (`artifacts`/`missions` columns), same convention as
`players.js`/`territory.js` (every function takes `worldState`
explicitly; `engine.js` wraps as bound convenience functions).
`generateMission` requires a real, existing `artifactId` — the API
map's own literal contract — and validates `controllingFactionId`
against a real faction if given, never trusted bare.

`server.js` (new) — a real Express app wrapping `engine.js`. The 5
required routes, plus 2 real, necessary additions: `POST /api/artifacts`
and `GET /api/artifacts/:id`. Without artifact creation exposed,
`/api/mission` could never actually be called over HTTP by anything —
confirmed the API map's own Phase 1 list only names `GET /api/artifacts`
(list), no creation route, which would leave the required endpoint
permanently unreachable in practice, not just unbuilt-but-usable-later.

`package.json` — added `express`/`cors`/`dotenv` dependencies, real
`start`/`dev` scripts (matching every other app's own convention),
removed the broken `test` script (pointed at a `server/selftest.js`
that never existed on disk).

Picked port 8809 — checked `vaco-shell/lib/registry.js`'s own real,
complete port map directly to confirm it was genuinely unused, not
guessed. Updated that registry's own `vacon-c` entry from `url: null`
to the real new URL, closing that side's own flagged gap too.

## Explicitly NOT in this task
The API map's own further ~40 endpoints (entities, keys, families,
organizations, economy, properties, communities, cities, players,
multiplayer) — real, separate, much larger future scope. Postgres-
backed persistence for the new Artifact/Mission arrays (same
in-memory-first posture every other WorldState array already has).

## Verification approach
14 plain-Node checks on `missions.js` directly. A live pass against
the real running server: state, NPC generation, tick advance,
artifact creation, and mission generation all confirmed working
end to end over real HTTP, including the real rejection of a mission
request against a nonexistent artifact.

## Done when
VACON-C can be run as a real service and driven entirely over HTTP,
matching CLAUDE.md's own required contract, with the Artifact/Mission
system real rather than assumed.
