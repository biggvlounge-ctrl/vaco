# Plan — Phase 1: start-ecosystem.sh / stop-ecosystem.sh

## Goal
Close a real, verified gap from the ecosystem status audit: no root
`package.json`, `docker-compose`, or start script existed anywhere in
this repo, meaning getting the full ecosystem live meant ~25 manual
`npm start` calls in ~25 separate terminals.

## Design
`start-ecosystem.sh`: a real, data-driven list of every app (name,
relative path, real start command, real port, real health-check path
-- all confirmed by grepping each app's own `server.js` for its actual
`PORT` default, not guessed), backgrounded via `nohup`, with a real
per-app health-check poll (up to 17s each) against `/api/health` (or
`/` for the two Vite dev servers) before reporting UP/DOWN.
`stop-ecosystem.sh` kills exactly what was started via recorded PIDs,
plus a real safety-net sweep for `node server.js`/vite child processes
an npm wrapper's PID doesn't always cover.

## Real bugs found and fixed during this build
1. Relative `../logs/...` paths broke for apps nested two directories
   deep (`cvnvo/yap`, `chopz/chopz-shop`) -- their logs/PIDs silently
   went to the wrong (nonexistent) directory. Fixed by computing a
   real `REPO_ROOT` absolute path once and using it everywhere.
2. `cd path && nohup cmd &` as one compound backgrounded command left
   `logs/pids/` empty -- `$!` wasn't reliably capturing nohup's real
   PID. Fixed by separating `cd` and the backgrounded `nohup` into two
   statements inside one subshell.

Both were caught by actually running the script and checking its own
output (`ls logs/`, `ls logs/pids/`), not by reading the code and
assuming it worked.

## Explicitly NOT in this task
`world-layer` (no HTTP layer, nothing to start) and, by default,
`venvs-mock-backend` (kept for local reference only behind
`--with-mock`, since every real app already defaults to the real
`v3`/`shield` services).

## Verification approach
Ran the real script twice (once revealing the two bugs above, once
confirmed fixed): 23 of 24 apps came up healthy; the 24th
(`v4-proxy`) correctly and honestly reported DOWN because it refuses
to start without a real `ANTHROPIC_API_KEY` -- a genuine, pre-existing
safety behavior, not a script defect, confirmed by reading its own log.
`stop-ecosystem.sh` then confirmed to actually kill every process --
`ps aux | grep "node server.js|vite"` returned nothing afterward.

## Done when
One command brings up the whole real ecosystem with an honest
UP/DOWN report, and one command tears it back down completely.
