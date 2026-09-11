#!/usr/bin/env bash
# VACO -- boot the ecosystem behind one port, for Replit and any other
# host that gives you a single port and one process to own it.
#
# This is the `.replit` run command. It does three things in order:
#
#   1. install dependencies if they are missing
#   2. start every app on its own local port (start-ecosystem.sh)
#   3. put gateway.js in front of them on $PORT
#
# **Only step 3 binds anything the outside world can reach.** The 34
# backends stay on 127.0.0.1; the gateway is the single public
# listener. That is the same shape as the nginx configs, which is the
# point -- one routing table, three deployments.
#
# ---------------------------------------------------------------------
# What this does NOT pretend
#
# The full stack measures **0.82–0.86 GB across 38 processes** on this
# machine -- by PSS, confirmed against the memory actually freed when
# it stops. An earlier revision of this comment said 2.43 GB; that was
# summed RSS, which double-counts the pages 36 Node processes share.
#
# So most containers will hold all of it. One that cannot will OOM
# partway through step 2, and the symptom is undramatic: some apps
# report DOWN and the gateway 502s exactly those paths.
#
# So this script does not claim success it has not seen. It prints the
# real up/down count from start-ecosystem.sh, and if anything is down
# it says so and names the log, rather than starting the gateway and
# letting a 502 be the first anyone hears of it.
#
# VACON-C and its database
#
# **29 of the 34 backends use Postgres when it is there**, as of 11 Sep
# 2026 -- this said "one app" until then. Attach Replit's built-in
# PostgreSQL and DATABASE_URL is set for you; nothing else to configure.
#
# vacon-c loads its own 63-table world schema. The other 28 keep a
# document each in a vaco.stores table, and V3's ledger goes further
# still: balances and transactions are real rows, so two V3 containers
# can both write.
#
# Without a database everything falls back to a JSON file per app and
# still boots. With one attached but unreachable, the 28 converted apps
# refuse to start and say why, while vacon-c starts an empty world and
# says so -- a simulation that can regenerate its state is a working
# demo, and a ledger reading every balance as zero is not.
#
# Set VACO_APPS to run a subset -- a space-separated list of app names.
# On a small container that is the difference between a working demo of
# five apps and an OOM of thirty-five.
#
#   VACO_APPS="vaco-shell v3 shield void"  ./deploy/replit-boot.sh
#
# ---------------------------------------------------------------------
# Secrets
#
# `scripts/deploy-preflight.mjs` reports 30 required env vars -- but 27
# are inter-service tokens this script's launcher generates per boot, so
# a demo needs none of them set by hand. Replit
# Secrets is where those go; this script does not invent defaults for
# them, because a made-up secret that lets the app boot is worse than a
# refusal that names what is missing. Apps that require one refuse on
# their own and appear as DOWN -- v4-proxy without ANTHROPIC_API_KEY is
# the worked example, and that refusal is correct behaviour.

set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# -- PORT belongs to the gateway and to nothing else --------------------
#
# **This was a real failure, found by running this script.** `PORT` is
# set for the gateway, but `start-ecosystem.sh` hands its environment to
# every app it starts, and every app reads `process.env.PORT`. So all 36
# backends tried to bind the gateway's port, all of them lost the race
# except one, and the boot reported "0 up, 5 down" for apps that start
# perfectly well on their own. The logs said EADDRINUSE on 0.0.0.0:8080.
#
# Replit always sets PORT, so this would have failed there every single
# time -- and failed looking like a memory problem rather than what it
# was.
#
# The apps get their ports from the manifest. They must be started with
# PORT removed from the environment, not merely with a different value.
GATEWAY_PORT="${PORT:-8080}"
unset PORT

echo "== VACO on a single port =="
echo

# -- 1. dependencies --------------------------------------------------
#
# Replit persists the filesystem between runs, so this is a first-boot
# cost, not a per-boot one. `vaco-shell` is the cheapest probe: it is
# the root app and always in the manifest.
if [ ! -d "$REPO_ROOT/node_modules" ] && [ ! -d "$REPO_ROOT/v3/node_modules" ]; then
  echo "First boot: installing dependencies for every app. This takes a while."
  ./install-ecosystem.sh || {
    echo "install-ecosystem.sh failed. Nothing below this point will work." >&2
    exit 1
  }
  echo
fi

# -- 2. the apps ------------------------------------------------------
#
# `tee`, not `START_OUTPUT="$(...)"`. Command substitution buffers
# every line until the script finishes, and a full boot health-checks
# 36 apps -- so the console showed the banner and then nothing at all
# for over two minutes, which on a PaaS is indistinguishable from a
# hang. Stream it and read the summary back from the file.
START_LOG="$REPO_ROOT/logs/replit-boot.log"
mkdir -p "$REPO_ROOT/logs"
./start-ecosystem.sh 2>&1 | tee "$START_LOG"
echo

# The script's own summary line, e.g. "35 up, 1 down, out of 36 total."
SUMMARY="$(grep -E '^[0-9]+ up, [0-9]+ down' "$START_LOG" || true)"
DOWN="$(echo "$SUMMARY" | sed -n 's/^[0-9]* up, \([0-9]*\) down.*/\1/p')"

if [ -z "$SUMMARY" ]; then
  echo "start-ecosystem.sh printed no summary line -- it did not get far enough" >&2
  echo "to health-check anything. See the output above." >&2
  exit 1
fi

if [ "${DOWN:-0}" -gt 0 ]; then
  echo "-- $DOWN app(s) did not come up. --"
  echo
  echo "The gateway will start anyway, because a partly-up ecosystem is"
  echo "still worth reaching, but those paths will 502 and the 502 will"
  echo "name the app. Two likely causes, in order:"
  echo
  echo "  * a missing secret -- the app refused on purpose. Check"
  echo "    logs/<app>.log; it will say which variable."
  echo "  * not enough memory -- the full stack needs 0.82–0.86 GB. Set"
  echo "    VACO_APPS to a subset and boot fewer."
  echo
fi

# -- 2b. demo content -------------------------------------------------
#
# A launcher full of apps that all open onto blank pages reads as
# broken rather than as new. `scripts/seed-demo.mjs` creates four demo
# people and gives them posts, businesses, screens, releases and
# profiles -- through the real HTTP API, as real signed-in users,
# against the same guards and validation any other caller meets.
#
# Idempotent: it registers a marker account that succeeds exactly once
# per set of stores, so a second boot adds nothing. Set VACO_NO_SEED=1
# to skip it entirely.
#
# Failure here is reported and does not stop the boot. An unseeded
# ecosystem is still a running ecosystem, and the gateway coming up
# matters more than the demo content.
if [ -z "${VACO_NO_SEED:-}" ]; then
  echo "Seeding demo content..."
  node scripts/seed-demo.mjs 2>&1 | sed 's/^/  /' || {
    echo "  Seeding did not complete. The ecosystem is still up; the apps will just be empty."
  }
  echo
fi

# -- 3. the gateway ---------------------------------------------------
#
# `exec`, so the gateway is PID 1's direct child and a stop signal from
# the host reaches it rather than this shell. stop-ecosystem.sh is what
# takes the apps down; on a container teardown they die with it.
echo "Starting the gateway on :$GATEWAY_PORT -- everything is reachable through this one port."
exec env PORT="$GATEWAY_PORT" node gateway.js
