#!/usr/bin/env bash
# VACO -- stop exactly what start-ecosystem.sh started, via the real
# PIDs it recorded, rather than a blanket pkill that could catch
# something else on the machine.

set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

STOPPED=0
if [ -d logs/pids ] && [ -n "$(ls -A logs/pids 2>/dev/null)" ]; then
  for pidfile in logs/pids/*.pid; do
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile" 2>/dev/null)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      printf "  stopped  %-16s (pid %s)\n" "$name" "$pid"
      STOPPED=$((STOPPED+1))
    fi
    rm -f "$pidfile"
  done
fi

# Real safety net, not just the recorded PIDs: `npm start`/`npm run
# dev` wraps a real child `node server.js`/`vite` process, and a
# SIGTERM to the npm wrapper doesn't always propagate to that child --
# the same real issue this session's own manual server shutdowns hit
# repeatedly, always solved the same way (kill the actual node/vite
# process directly, not just its npm parent).
LEFTOVER=$(pgrep -f "node server.js|node .*vite" 2>/dev/null || true)
if [ -n "$LEFTOVER" ]; then
  echo "$LEFTOVER" | xargs -r kill -9 2>/dev/null
  LEFTOVER_COUNT=$(echo "$LEFTOVER" | grep -c .)
  echo "  force-stopped $LEFTOVER_COUNT leftover node/vite process(es) npm's own PID didn't cover"
fi

echo "$STOPPED process(es) stopped via recorded PID."
