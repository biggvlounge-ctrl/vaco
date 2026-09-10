#!/usr/bin/env bash
# VACO -- start every real, running app in the ecosystem with one
# command. Closes a real, verified gap: no root package.json, no
# docker-compose, no start-all script existed anywhere in this repo --
# getting more than 2-3 apps live at once meant ~25 manual `npm start`
# calls in ~25 separate terminals.
#
# Real, deliberate scope: starts every app that has a real server.js
# or a real Vite dev server. Skips `world-layer` (a pure data module,
# no HTTP layer of its own -- see its own README) and, by default,
# `venvs-mock-backend` (kept for local reference only; every real app
# already defaults to the real `v3`/`shield` services instead --
# see v3/README.md's "Ecosystem cutover"). Pass --with-mock to also
# start the legacy mock alongside everything else.
#
# Logs: each app's stdout/stderr goes to logs/<app>.log (created next
# to this script, gitignored). PIDs: logs/pids/<app>.pid, so
# stop-ecosystem.sh can shut down exactly what this script started,
# not anything else already running.

set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

WITH_MOCK=0
# Anything that is not `--with-mock` used to be ignored, which meant
# `./start-ecosystem.sh --help` booted all 36 apps. Found by typing
# exactly that expecting a usage line. An unrecognised flag on a script
# whose job is to start 36 servers should never mean "start 36 servers".
case "${1:-}" in
  "") ;;
  --with-mock) WITH_MOCK=1 ;;
  -h|--help)
    echo "Usage: ./start-ecosystem.sh [--with-mock]"
    echo
    echo "  --with-mock   also start venvs-mock-backend (local reference only)"
    echo
    echo "Environment:"
    echo "  VACO_APPS     space-separated app names to start instead of all of"
    echo "                them, for hosts that cannot hold the full ~2.5 GB stack."
    echo "                An unknown name is refused rather than skipped."
    echo
    echo "Stop what this started: ./stop-ecosystem.sh"
    exit 0
    ;;
  *)
    echo "start-ecosystem.sh: unknown option '$1'" >&2
    echo "Try ./start-ecosystem.sh --help" >&2
    exit 1
    ;;
esac

mkdir -p "$REPO_ROOT/logs/pids"

# -- V3 service credentials -------------------------------------------
#
# The internal services (V3, VACA, Analytics, Notify, VACON) refuse an
# unauthenticated mutating call (`VACO_SERVICE_AUTH_MODE`
# now defaults to `enforce`). Server-to-server settlement has no
# end-user session to present, so each app authenticates as a service.
#
# For local development this generates one random token per boot and
# hands the same value to every receiving service and every caller. Per-boot rather than
# fixed, because a checked-in dev token is the kind that reaches
# production by accident.
#
# **Deployment does not use this.** docker-compose and pm2 read real
# per-service tokens from the environment — see `.env.example` and
# `dev-docs/DEPLOYMENT_INVENTORY.md`. If `VACO_SERVICE_TOKENS` is already
# set, it is respected and nothing is generated.
# **Derived, not listed.** This was a hardcoded string of 19 names
# while `scripts/generate-service-tokens.mjs` derived 27 from the same
# manifest plus each app's real `V3_API_URL` usage. A local boot
# therefore allowlisted 19 services and the other 8 -- chopz, v4-proxy,
# vaca, vaco-notify, vaco-operator, vacon, vacon-c, venvm -- got 403
# from V3 on every service call they made. Confirmed live rather than
# reasoned: V3's own `/api/health` reported `allowlistedServices` of
# exactly 19 on a boot from this script.
#
# That is the third place this list drifted. `.env.example` did it
# first (16 hand-kept against 19 derived) and was fixed by deriving;
# this is the same fix in the last place still keeping its own copy.
VACO_CALLERS="$(node "$REPO_ROOT/scripts/generate-service-tokens.mjs" --list 2>/dev/null)"
if [ -z "$VACO_CALLERS" ]; then
  echo "start-ecosystem: could not derive the V3 caller list." >&2
  echo "Falling back to a shorter hardcoded list is what caused 8 apps to 403; refusing." >&2
  exit 1
fi

if [ -z "${VACO_SERVICE_TOKENS:-}" ]; then
  DEV_TOKEN="dev-$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  TOKENS=""
  for caller in $VACO_CALLERS; do
    TOKENS="${TOKENS}${TOKENS:+,}${caller}:${DEV_TOKEN}"
  done
  export VACO_SERVICE_TOKENS="$TOKENS"
  export VACO_SERVICE_TOKEN="$DEV_TOKEN"
  echo "Generated a per-boot dev service token for $(echo "$VACO_CALLERS" | wc -w) callers."
else
  echo "Using VACO_SERVICE_TOKENS from the environment."
fi

# name:relative-path:start-command:port:health-path
APPS=(
  "vaco-shell:vaco-shell:npm start:8789:/api/health"
  "v4-proxy:v4-proxy:npm start:8787:/api/health"
  "v4-search:v4-search:npm start:8788:/api/health"
  "vacon:vacon:npm start:8805:/api/health"
  "vacon-c:vacon-c:npm start:8809:/api/health"
  "hvntz:hvntz:npm start:8792:/api/health"
  "void:void:npm start:8793:/api/health"
  "voidmagic:voidmagic:npm start:8797:/api/health"
  "voken:voken:npm start:8794:/api/health"
  "vago:vago:npm start:8795:/api/health"
  "vxllage:vxllage:npm start:8796:/api/health"
  "cvnvo:cvnvo:npm start:8798:/api/health"
  "yap:cvnvo/yap:npm start:8802:/api/health"
  "chopz:chopz:npm start:8800:/api/health"
  "chopz-shop:chopz/chopz-shop:npm start:8801:/api/health"
  "vacay:vacay:npm start:8803:/api/health"
  "vavlt-stvdios:vavlt-stvdios:npm start:8808:/api/health"
  "vsafe:vsafe:npm start:8799:/api/health"
  "vaca:vaca:npm start:8804:/api/health"
  "v3:v3:npm start:8811:/api/health"
  "shield:shield:npm start:8812:/api/health"
  "vaco-analytics:vaco-analytics:npm start:8790:/api/health"
  "vulture-music:vulture-music:npm start:8806:/api/health"
  "vulture-flix:vulture-flix:npm start:8807:/api/health"
  "vulture-pods:vulture-pods:npm start:8810:/api/health"
  "venvm:venvm:npm start:8813:/api/health"
  "dreams:dreams:npm start:8814:/api/health"
  "vulture-studios:vulture-studios:npm start:8815:/api/health"
  "vex:vex:npm start:8816:/api/health"
  "vex-trading:vex-trading:npm start:8817:/api/health"
  "vaco-notify:vaco-notify:npm start:8818:/api/health"
  "vaco-audit:vaco-audit:npm start:8819:/api/health"
  "vaco-operator:vaco-operator:npm start:8820:/api/health"
  "vaco-media:vaco-media:npm start:8821:/api/health"
  "venvs:venvs:npm run dev:5173:/"
  "vdp:vdp:npm run dev:5174:/"
)

if [ "$WITH_MOCK" = "1" ]; then
  APPS+=("venvs-mock-backend:venvs-mock-backend:npm start:8791:/api/health")
fi

# -- VACO_APPS: boot a subset -----------------------------------------
#
# The full stack measures ~2.5 GB resident across ~68 processes (68
# rather than 36 because `npm start` stays alive as a parent of each
# `node`). Plenty of hosts have less than that, and the failure mode
# there is bad: the OOM killer takes whichever apps it likes and you
# get a different half of the ecosystem on every boot.
#
# VACO_APPS is a space-separated list of app names to start instead of
# all of them. Everything downstream -- health checks, the up/down
# count, stop-ecosystem.sh's PID files -- follows from the same
# filtered array, so a subset boot is a first-class thing rather than a
# special case.
#
#   VACO_APPS="vaco-shell v3 shield void" ./start-ecosystem.sh
#
# An unknown name is a hard error. Silently starting fewer apps than
# asked for is how you spend an afternoon on a 502 from an app you
# believe is running.
if [ -n "${VACO_APPS:-}" ]; then
  SELECTED=()
  for want in $VACO_APPS; do
    found=""
    for entry in "${APPS[@]}"; do
      IFS=":" read -r name _rest <<< "$entry"
      if [ "$name" = "$want" ]; then found="$entry"; break; fi
    done
    if [ -z "$found" ]; then
      echo "VACO_APPS names '$want', which is not an app in this manifest." >&2
      echo "Known apps:" >&2
      for entry in "${APPS[@]}"; do
        IFS=":" read -r name _rest <<< "$entry"
        echo "  $name" >&2
      done
      exit 1
    fi
    SELECTED+=("$found")
  done
  # VACO_APPS=" " reaches here having named nothing. Left alone it
  # starts zero apps and reports "0 up, 0 down" -- a clean bill of
  # health for an ecosystem that is not running. Refuse instead.
  if [ "${#SELECTED[@]}" -eq 0 ]; then
    echo "VACO_APPS is set but names no apps. Unset it to start everything," >&2
    echo "or give it a space-separated list of app names." >&2
    exit 1
  fi
  APPS=("${SELECTED[@]}")
  echo "VACO_APPS is set: starting ${#APPS[@]} of the full manifest, not all of it."
fi

echo "Starting ${#APPS[@]} apps..."
for entry in "${APPS[@]}"; do
  IFS=":" read -r name path cmd port health <<< "$entry"
  (
    cd "$REPO_ROOT/$path" || exit 1
    nohup $cmd > "$REPO_ROOT/logs/${name}.log" 2>&1 &
    echo $! > "$REPO_ROOT/logs/pids/${name}.pid"
  )
done

echo "Waiting for real health checks (up to 20s each)..."
sleep 3

UP=0
DOWN=0
for entry in "${APPS[@]}"; do
  IFS=":" read -r name path cmd port health <<< "$entry"
  ok=0
  for _ in $(seq 1 17); do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${health}" 2>/dev/null | grep -qE "^(200|304)$"; then
      ok=1
      break
    fi
    sleep 1
  done
  if [ "$ok" = "1" ]; then
    printf "  UP    %-16s http://localhost:%s\n" "$name" "$port"
    UP=$((UP+1))
  else
    printf "  DOWN  %-16s http://localhost:%s  (see logs/%s.log)\n" "$name" "$port" "$name"
    DOWN=$((DOWN+1))
  fi
done

echo
echo "$UP up, $DOWN down, out of ${#APPS[@]} total."
[ "$DOWN" -gt 0 ] && echo "Check logs/<app>.log for anything marked DOWN."
echo "Shell:  http://localhost:8789"
echo "Stop everything this script started: ./stop-ecosystem.sh"
