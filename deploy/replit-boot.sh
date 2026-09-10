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
# The full stack measured **2.43 GB resident across 68 processes** on
# this machine (68 rather than 34 because `npm start` stays alive as a
# parent of each `node`). A Replit container with less RAM than that
# will OOM partway through step 2, and the symptom is undramatic: some
# apps report DOWN and the gateway 502s exactly those paths.
#
# So this script does not claim success it has not seen. It prints the
# real up/down count from start-ecosystem.sh, and if anything is down
# it says so and names the log, rather than starting the gateway and
# letting a 502 be the first anyone hears of it.
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
# `scripts/deploy-preflight.mjs` reports 29 required env vars. Replit
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
  echo "  * not enough memory -- the full stack needs ~2.5 GB. Set"
  echo "    VACO_APPS to a subset and boot fewer."
  echo
fi

# -- 3. the gateway ---------------------------------------------------
#
# `exec`, so the gateway is PID 1's direct child and a stop signal from
# the host reaches it rather than this shell. stop-ecosystem.sh is what
# takes the apps down; on a container teardown they die with it.
echo "Starting the gateway on :$GATEWAY_PORT -- everything is reachable through this one port."
exec env PORT="$GATEWAY_PORT" node gateway.js
