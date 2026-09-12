#!/usr/bin/env bash
# VACO -- copy the canonical shared runtime modules into every app that
# uses them.
#
# **Why copies rather than a require.** `deploy/Dockerfile.node` builds
# with the individual app directory as its build context
# (`context: ./void`), so `COPY . .` only ever sees that one app. A
# `require('../../shared/shieldAuth')` would resolve in development and
# fail inside the container -- the worst possible split, because local
# testing would never show it. Same constraint, same answer, as
# `sync-design-system.sh`.
#
# **The lesson from the design system, applied here.** A synced file
# nobody imports is drift that `--check` cannot see -- that is exactly
# how `vex-trading` shipped with the design system in its public/ and a
# hand-rolled stylesheet on the page. So this script also verifies that
# each target app actually *requires* what was copied into it, and
# fails if a copy is sitting there unused. That check has already earned
# its keep once: it caught `vex` receiving `shieldAuth.js` without the
# matching require.
#
# **Both modules are synced as `.cjs`, deliberately.** `vaco-analytics`
# and `vaco-shell` are `"type": "module"`, so a `.js` file there is
# parsed as ESM and a CommonJS module's `require()`/`module.exports`
# throws on load. Node loads `.cjs` as CommonJS regardless of the
# package type, and both `require()` (from the CJS apps) and `import`
# (from the ESM ones) work against it. One filename that works
# everywhere beats a per-app variant.
#
# serviceAuth was `.cjs` from the start for this reason; shieldAuth was
# `.js` until `vaco-shell` became the first ESM app to need it and would
# have failed at boot. Extended rather than special-cased, so the next
# ESM app does not rediscover the same wall.
#
# **Three modules, three target lists, because they answer different
# questions.** `shieldAuth` proves a human is who they claim to be, and
# goes to apps with user-facing mutating routes. `serviceAuth` proves a
# caller is a known internal service, and goes to apps that receive
# writes from other apps with no end-user session. Several apps need
# both; plenty need only one. A single list would push an auth module
# into apps that never mount it, which is exactly the drift above.
#
# Usage:
#   ./sync-shared-runtime.sh            # copy into every app
#   ./sync-shared-runtime.sh --check    # fail if any copy has drifted

set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Apps that guard a user-facing route with Shield.
SHIELD_TARGETS=(
  chopz chopz/chopz-shop cvnvo dreams hvntz v3 v4-proxy vaca vacay vaco-audit vaco-shell vacon-c vaco-notify vago vavlt-stvdios venvm void vex voidmagic voken
  vsafe vulture-flix vulture-music vulture-pods vulture-studios vxllage vaco-media
  vaco-analytics
)

# Apps that record operator-grade decisions in vaco-audit. This is
# group 2 of dev-docs/OPERATOR_ROLES_SCOPE.md -- "decisions with a
# loser" -- and deliberately NOT every app with a service credential.
# An app that only reports telemetry has nothing to attribute.
DECISION_LOG_TARGETS=(
  vago voken hvntz void vulture-music vulture-studios vaco-shell vaco-operator vex vaca
)

# Apps with a group-2 route that demands a human operator.
#
# vaco-operator is deliberately NOT here. It guards its own grant routes
# on `operator:grant` -- the route that hands out authority is itself a
# decision with a loser -- but it does so by calling `verify()` in
# process. Giving the authority service an HTTP client pointed at itself
# would add a network hop, a timeout and a failure mode to the one
# service that must be able to answer when everything else cannot.
# Apps that open live media sessions or register recorded assets in
# vaco-media. Four live consumers (the ones that each built a session
# layer and stopped at the same wall) plus three catalogue consumers.
# -- persistence.js ----------------------------------------------------
#
# **The durability layer, and it was the one shared module nothing
# managed.** 28 byte-identical copies of a 177-line file, maintained by
# hand. `--check` reported "all 119 copies current" while these sat
# entirely outside its view — the same blind spot documented below for
# unmanaged copies, except here it covered the module that decides
# whether an acknowledged write survives a restart.
#
# Copied as `persistence.js`, not `.cjs`, unlike every module above.
# The `.cjs` convention exists so a `"type": "module"` package cannot
# misread a CommonJS file; all 28 of these apps are CommonJS packages,
# and renaming would mean rewriting the require in every one of them
# for no gain. Checked rather than assumed — the target list is derived
# from the apps whose package.json has no `"type": "module"`.
#
# **Three copies are deliberately NOT here**:
#   vaco-shell   — a `"type": "module"` package, so its copy is real
#                  ESM (`export function`) rather than a stale fork. It
#                  carries the same three exports and uses durable().
#   vdp, venvs   — Vite frontends. Their persistence is browser storage
#                  and shares only the name, the same documented split
#                  as their shieldAuth clients.
# The unmanaged check below excludes all three on module identity
# rather than filename, so none of them produces a false positive.
PERSISTENCE_TARGETS=(
  chopz chopz/chopz-shop cvnvo cvnvo/yap dreams hvntz shield v3 vaca vacay
  vaco-audit vaco-media vaco-notify vaco-operator vacon vago vavlt-stvdios
  venvm vex void voidmagic voken vsafe vulture-flix vulture-music
  vulture-pods vulture-studios vxllage
)

# -- persistencePg.js --------------------------------------------------
#
# The same store, in Postgres instead of a JSON file. **One app so far.**
#
# This list is short on purpose and is the honest record of how far the
# conversion has got: every app not named here still keeps its state in
# a file and still must not be run in more than one container. Adding a
# name here is the act of converting an app, and it is not free -- the
# Postgres backend is asynchronous, so the app's store must be awaited
# before it listens and its `durable()` must delay the response. See
# shared/persistencePg.js for what that costs.
PERSISTENCE_PG_TARGETS=(
  chopz chopz/chopz-shop cvnvo cvnvo/yap dreams hvntz shield v3 vaca
  vacay vaco-audit vaco-media vaco-notify vaco-operator vacon vago
  vavlt-stvdios venvm vex void voidmagic voken vsafe vulture-flix
  vulture-music vulture-pods vulture-studios vxllage
)

# -- storeBackend.js ---------------------------------------------------
#
# The one call an app makes to get a store, whichever backend holds it.
# Every app converted off a file-only store carries it; the apps still
# on `createPersistentStore` directly do not need it yet.
STORE_BACKEND_TARGETS=("${PERSISTENCE_PG_TARGETS[@]}")

# `shared/settleOnce.js` -- claim before you pay. Only the apps that
# actually settle money need it, which is why this is its own list
# rather than riding on the persistence one: an app that holds a store
# does not necessarily move money, and a shared module copied into an
# app that never calls it is exactly the unused copy the check at the
# bottom of this script exists to catch.
SETTLE_ONCE_TARGETS=(
  vago dreams vulture-studios voken
)

MEDIA_TARGETS=(
  vxllage cvnvo vavlt-stvdios v4-proxy vulture-flix vulture-pods chopz
)

OPERATOR_TARGETS=(
  vago voken hvntz void vulture-music vulture-studios vaco-shell vex vaca vacon-c vaco-notify
)

# **Every app that serves HTTP, with no exceptions.** Tracing is not a
# security control and carries no per-app judgement: a trace that stops
# at one service is worth nothing, because the whole value is being able
# to line up the eight log streams that describe one user action.
#
# This started as five apps and a note that the rest were mechanical.
# They were, and leaving it there would have meant a trace id that dies
# the first time a request touches VOID or V3 -- the two services most
# likely to be on the path when something goes wrong.
TRACING_TARGETS=(
  chopz chopz/chopz-shop cvnvo cvnvo/yap dreams hvntz shield v3 v4-proxy v4-search
  vaca vacay vaco-analytics vaco-audit vaco-media vaco-notify vaco-operator vaco-shell
  vacon vacon-c vago vavlt-stvdios venvm venvs-mock-backend vex vex-trading
  void voidmagic voken vsafe vulture-flix vulture-music vulture-pods vulture-studios vxllage
  vaco-mcp
)

# Apps that RECEIVE service-to-service writes. Listed rather than
# discovered, because "this app is written to by other apps" is a real
# architectural fact per app, not something to infer from a directory.
SERVICE_TARGETS=(
  v3 v4-proxy vaca vacay vacon vaco-analytics vaco-audit vaco-notify vsafe cvnvo voken vago hvntz dreams venvm void voidmagic vavlt-stvdios vulture-music vulture-flix vulture-pods vulture-studios vaco-shell vaco-operator vex vacon-c vaco-media
)

CHECK=0
if [ "${1:-}" = "--check" ]; then CHECK=1; fi

DRIFTED=0
UNUSED=0
COPIED=0

sync_one() {
  local source="$1" app="$2" basename="$3"
  local target="$app/lib/$basename"

  if [ ! -f "$source" ]; then
    echo "  MISSING  $source" >&2
    DRIFTED=$((DRIFTED + 1)); return
  fi
  if [ ! -d "$app/lib" ]; then
    echo "  MISSING  $app/lib does not exist" >&2
    DRIFTED=$((DRIFTED + 1)); return
  fi

  if [ "$CHECK" = "1" ]; then
    if ! cmp -s "$source" "$target"; then
      echo "  DRIFTED  $target" >&2
      DRIFTED=$((DRIFTED + 1))
    fi
  else
    cp "$source" "$target"
    COPIED=$((COPIED + 1))
  fi

  # The copy must actually be reached for. A file present and never
  # required is the failure mode this check exists for -- and for an
  # auth module that failure is a security hole, not a cosmetic one.
  # `*.mjs` is in the include list because `vaco-mcp` is the first app
  # written as ESM-by-extension rather than by package type. Without it
  # the check reported a synced module as UNUSED while server.mjs was
  # requiring it on the line above -- a false negative in the one tool
  # whose job is catching false negatives.
  #
  # Matches `require('./lib/x')`, `require('./lib/x.cjs')` and
  # `import ... from "./lib/x.cjs"` -- CJS apps normally drop the
  # extension, ESM cannot, and the .cjs suffix only appears on
  # serviceAuth. The extension is optional so all three resolve.
  #
  # Searched across the whole app rather than just server.js and the top
  # of lib/, because VACAY mounts its four sub-products as routers under
  # `lib/<product>/routes.js` and those are where its guards live. A
  # narrower search would have reported the copy unused and blocked the
  # sync for the app with the most money-moving routes.
  local stem="${basename%.*}"
  # The third alternative is a sibling require inside `lib/` itself --
  # `require('./persistence')` from `lib/storeBackend.js`. Without it a
  # shared module used only by another shared module reads as UNUSED,
  # which is how `persistence.js` looked the moment `storeBackend.js`
  # became the thing that requires it. A managed file whose only caller
  # is another managed file is still in use.
  if ! grep -rqE "(require\(|from ) *['\"](\.\./)*\./?lib/${stem}(\.(js|cjs))?['\"]|(require\(|from ) *['\"]\.\./${stem}(\.(js|cjs))?['\"]|(require\(|from ) *['\"]\./${stem}(\.(js|cjs))?['\"]" \
      --include='*.js' --include='*.cjs' --include='*.mjs' \
      --exclude-dir=node_modules --exclude-dir=public --exclude-dir=test \
      "$app" 2>/dev/null; then
    echo "  UNUSED   $target is present but nothing in $app requires it" >&2
    UNUSED=$((UNUSED + 1))
  fi
}

for app in "${SHIELD_TARGETS[@]}"; do sync_one "shared/shieldAuth.js" "$app" "shieldAuth.cjs"; done
for app in "${SERVICE_TARGETS[@]}"; do sync_one "shared/serviceAuth.js" "$app" "serviceAuth.cjs"; done
for app in "${DECISION_LOG_TARGETS[@]}"; do sync_one "shared/decisionLog.js" "$app" "decisionLog.cjs"; done
for app in "${OPERATOR_TARGETS[@]}"; do sync_one "shared/operatorAuth.js" "$app" "operatorAuth.cjs"; done
for app in "${MEDIA_TARGETS[@]}"; do sync_one "shared/mediaClient.js" "$app" "mediaClient.cjs"; done
for app in "${TRACING_TARGETS[@]}"; do sync_one "shared/tracing.js" "$app" "tracing.cjs"; done
for app in "${PERSISTENCE_TARGETS[@]}"; do sync_one "shared/persistence.js" "$app" "persistence.js"; done
for app in "${PERSISTENCE_PG_TARGETS[@]}"; do sync_one "shared/persistencePg.js" "$app" "persistencePg.js"; done
for app in "${STORE_BACKEND_TARGETS[@]}"; do sync_one "shared/storeBackend.js" "$app" "storeBackend.js"; done
for app in "${SETTLE_ONCE_TARGETS[@]}"; do sync_one "shared/settleOnce.js" "$app" "settleOnce.js"; done

# -- The mirror of the UNUSED check, and the more dangerous direction --
#
# Everything above only looks at apps that are already in a target list.
# It answers "is the copy I manage current and used?" -- and it answers
# it truthfully while an app holding an *unmanaged* copy sits completely
# outside its view. That is not hypothetical: `vaco-shell` shipped a
# frozen shieldAuth this way and surfaced as ERR_MODULE_NOT_FOUND at
# boot, and `vaco-audit` did the same with serviceAuth while --check
# cheerfully reported "all 53 copies current and in use."
#
# So: walk the tree for anything requiring one of these modules, and
# demand that its app is in the matching list. A frozen copy of an auth
# module is a security hole with a long fuse -- the app keeps working
# on yesterday's rules.
#
# Matched on module *identity*, not filename. The first version of this
# check matched `*/lib/<stem>.cjs` and immediately produced two false
# positives: `vdp/src/lib/shieldAuth.cjs` and the venvs equivalent are
# browser-side ESM session clients that deliberately share a name with
# the Express middleware, per the documented VENVS/VDP split. Flagging
# them would have been this same failure class pointed the other way --
# a match too loose to mean what it claims. So a file only counts if it
# is CommonJS *and* carries the canonical module's own export.
UNMANAGED=0
check_unmanaged() {
  local stem="$1"; shift
  local signature="$1"; shift
  local -n list="$1"; shift
  # The copied filename. Was hardcoded to "${stem}.cjs", which made
  # this a no-op the moment a module was synced under any other name:
  # `persistence.js` copies are `.js`, so the find matched zero files
  # and the check reported success having examined nothing.
  #
  # That is the failure SYSTEM_OF_RECORD.md §8 names in its own words —
  # "a tool that finds nothing must not report success" — committed
  # inside the tool that enforces the rest of them. Caught by planting
  # an unmanaged copy and watching --check stay green.
  local filename="${1:-${stem}.cjs}"
  local examined=0
  local app
  while IFS= read -r file; do
    examined=$((examined + 1))
    grep -q 'module\.exports' "$file" 2>/dev/null || continue
    grep -q "$signature" "$file" 2>/dev/null || continue
    # <app>/lib/<stem>.cjs -> <app>, preserving one level of nesting
    # (chopz/chopz-shop and cvnvo/yap are real apps, not directories).
    app="${file%/lib/*}"
    app="${app#./}"
    [ -z "$app" ] && continue
    for known in "${list[@]}"; do [ "$known" = "$app" ] && continue 2; done
    echo "  UNMANAGED $app/lib/${filename} exists but $app is not in ${!list} --" >&2
    echo "            it will never receive updates to shared/${stem}.js" >&2
    UNMANAGED=$((UNMANAGED + 1))
  done < <(find . -path ./node_modules -prune -o -name "${filename}" -path '*/lib/*' -print 2>/dev/null | grep -v node_modules)

  # A scan that examined fewer files than there are managed targets did
  # not look at the managed copies, let alone any unmanaged ones. It
  # cannot have checked what it claims to have checked, so it fails
  # rather than passing quietly.
  if [ "$examined" -lt "${#list[@]}" ]; then
    echo "  BROKEN   the ${stem} scan examined $examined file(s) but ${#list[@]} are managed --" >&2
    echo "           it is looking for the wrong filename and would report success regardless" >&2
    UNMANAGED=$((UNMANAGED + 1))
  fi
}
check_unmanaged shieldAuth  requireActor       SHIELD_TARGETS
check_unmanaged serviceAuth createServiceAuth  SERVICE_TARGETS
check_unmanaged decisionLog createDecisionLog  DECISION_LOG_TARGETS
check_unmanaged operatorAuth createOperatorAuth  OPERATOR_TARGETS
check_unmanaged mediaClient  createMediaClient   MEDIA_TARGETS
check_unmanaged tracing      traceMiddleware     TRACING_TARGETS
check_unmanaged persistence createPersistentStore PERSISTENCE_TARGETS persistence.js
check_unmanaged persistencePg createPersistentStorePg PERSISTENCE_PG_TARGETS persistencePg.js

# Every list, summed. Adding PERSISTENCE_TARGETS to the loops and to
# the message but not to this line made --check report "all 119 copies
# current" on the same line that itemised 147 of them — a headline
# contradicting its own breakdown, which is worse than either number
# being wrong on its own.
TOTAL=$(( ${#SHIELD_TARGETS[@]} + ${#SERVICE_TARGETS[@]} + ${#DECISION_LOG_TARGETS[@]} + ${#OPERATOR_TARGETS[@]} + ${#MEDIA_TARGETS[@]} + ${#TRACING_TARGETS[@]} + ${#PERSISTENCE_TARGETS[@]} + ${#PERSISTENCE_PG_TARGETS[@]} + ${#STORE_BACKEND_TARGETS[@]} + ${#SETTLE_ONCE_TARGETS[@]} ))

if [ "$CHECK" = "1" ]; then
  if [ "$DRIFTED" -gt 0 ] || [ "$UNUSED" -gt 0 ] || [ "$UNMANAGED" -gt 0 ]; then
    echo "Shared runtime: $DRIFTED drifted, $UNUSED unused, $UNMANAGED unmanaged. Run ./sync-shared-runtime.sh" >&2
    exit 1
  fi
  echo "Shared runtime: all $TOTAL copies current and in use (${#SHIELD_TARGETS[@]} shieldAuth, ${#SERVICE_TARGETS[@]} serviceAuth, ${#DECISION_LOG_TARGETS[@]} decisionLog, ${#OPERATOR_TARGETS[@]} operatorAuth, ${#MEDIA_TARGETS[@]} mediaClient, ${#TRACING_TARGETS[@]} tracing, ${#PERSISTENCE_TARGETS[@]} persistence, ${#PERSISTENCE_PG_TARGETS[@]} persistencePg, ${#STORE_BACKEND_TARGETS[@]} storeBackend, ${#SETTLE_ONCE_TARGETS[@]} settleOnce), and no unmanaged copies elsewhere."
else
  if [ "$UNUSED" -gt 0 ] || [ "$UNMANAGED" -gt 0 ]; then
    echo "Shared runtime: copied $COPIED file(s), but $UNUSED are not required anywhere and $UNMANAGED are outside the target lists." >&2
    exit 1
  fi
  echo "Shared runtime: copied $COPIED file(s) (${#SHIELD_TARGETS[@]} shieldAuth, ${#SERVICE_TARGETS[@]} serviceAuth, ${#DECISION_LOG_TARGETS[@]} decisionLog, ${#OPERATOR_TARGETS[@]} operatorAuth, ${#MEDIA_TARGETS[@]} mediaClient, ${#TRACING_TARGETS[@]} tracing, ${#PERSISTENCE_TARGETS[@]} persistence, ${#PERSISTENCE_PG_TARGETS[@]} persistencePg, ${#STORE_BACKEND_TARGETS[@]} storeBackend, ${#SETTLE_ONCE_TARGETS[@]} settleOnce)."
fi
