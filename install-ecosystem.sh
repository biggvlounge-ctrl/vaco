#!/usr/bin/env bash
# VACO -- install dependencies for every app in the ecosystem.
#
# Closes a real gap found during a deployment-readiness check: the
# distributed archive (`git archive`, or a fresh `git clone`) contains
# tracked files only, so no app has `node_modules`. `start-ecosystem.sh`
# assumes dependencies are already present and fails immediately on a
# fresh unpack. The Docker path never hit this, because
# `deploy/Dockerfile.node` runs `npm install` itself -- so the gap only
# ever affected the local/pm2 path.
#
# Reads the same authoritative manifest as start-ecosystem.sh,
# deploy/generate-docker-compose.js, and deploy/generate-nginx-conf.js:
# the APPS array in start-ecosystem.sh. One source of truth for "what
# apps exist," not a second list to drift.
#
# Usage:
#   ./install-ecosystem.sh              # install everything
#   ./install-ecosystem.sh --ci         # use `npm ci` (needs a lockfile)
#
# Note: `vex-business/` is deliberately not covered. It is a Python
# monorepo with its own toolchain (uv + alembic) and its own
# docker-compose.yml -- see dev-docs/DEPLOYMENT_FILE_PLACEMENT.md.

set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

CMD="install"
if [ "${1:-}" = "--ci" ]; then CMD="ci"; fi

# Real, deliberate reuse: parse the app paths straight out of
# start-ecosystem.sh's own APPS array rather than restating them.
PATHS=$(sed -n '/^APPS=(/,/^)/p' start-ecosystem.sh \
        | grep -o '"[^"]*"' \
        | tr -d '"' \
        | cut -d: -f2 \
        | sort -u)

TOTAL=0
OK=0
FAILED=()

for p in $PATHS; do
  [ -f "$p/package.json" ] || continue
  TOTAL=$((TOTAL + 1))
  printf "  %-22s " "$p"
  if (cd "$p" && npm "$CMD" --silent >/dev/null 2>&1); then
    printf "ok\n"
    OK=$((OK + 1))
  else
    printf "FAILED\n"
    FAILED+=("$p")
  fi
done

echo
echo "$OK/$TOTAL installed."
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed: ${FAILED[*]}"
  echo "Re-run one manually to see the real error: (cd <app> && npm $CMD)"
  exit 1
fi
echo "Next: ./start-ecosystem.sh"
