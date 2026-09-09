#!/usr/bin/env bash
# Copies the VACO design system into every app that has a frontend.
#
# **Why copy rather than link.** The obvious alternative is for each app
# to <link> straight at the shell's copy on :8789. That makes the shell a
# runtime dependency of every other app's *appearance*: if it is down, or
# reachable but slow, twenty-six apps render unstyled. It also means a
# cross-origin request on every page load for a file that changes maybe
# once a month.
#
# So the system is copied in, and this script is the mechanism that keeps
# the copies honest. `vaco-shell/public/` is the single source of truth;
# everything else is a build artifact. Run it after editing either file.
#
#   ./sync-design-system.sh          # copy into every app
#   ./sync-design-system.sh --check  # verify copies are current (CI)
#
# --check exits non-zero if any copy has drifted, which is the whole
# reason this is a script and not a note in a README.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$ROOT/vaco-shell/public"
ASSETS=(vaco-design.css vaco-ui.js)

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

# Every app that serves a frontend. vaco-shell is the source and is not
# a target; vdp and venvs are Vite apps whose assets live elsewhere and
# are handled by their own builds.
TARGETS=(
  chopz chopz/chopz-shop cvnvo dreams hvntz shield v3 vaca vacay
  vacon vacon-c vaco-analytics vago vavlt-stvdios venvm vex vex-trading vaco-notify
  void voidmagic voken vsafe vulture-flix vulture-music vulture-pods
  vulture-studios vxllage
  v4-proxy v4-search cvnvo/yap
)

drift=0
copied=0

for target in "${TARGETS[@]}"; do
  dir="$ROOT/$target"
  if [ ! -d "$dir" ]; then
    echo "  skip   $target (no such directory)"
    continue
  fi
  mkdir -p "$dir/public"
  for asset in "${ASSETS[@]}"; do
    src="$SOURCE_DIR/$asset"
    dest="$dir/public/$asset"
    if [ "$CHECK_ONLY" = "1" ]; then
      if ! cmp -s "$src" "$dest"; then
        echo "  DRIFT  $target/public/$asset"
        drift=1
      fi
    else
      if ! cmp -s "$src" "$dest" 2>/dev/null; then
        cp "$src" "$dest"
        copied=$((copied + 1))
      fi
    fi
  done
done

# The mirror of the drift check, and the direction it cannot see.
#
# Everything above asks "is the copy I placed current?" and answers it
# truthfully while an app that serves the design system without being a
# target sits entirely outside its view. That is not hypothetical for
# this script specifically: `vex-trading` shipped with the design system
# in its public/ and a hand-rolled stylesheet on the page, and nothing
# reported it.
#
# So: any app whose HTML asks for vaco-design.css must be a target.
# vaco-shell is excluded because it is the SOURCE, not a target -- and
# that exclusion is the reason this check is written against the target
# list rather than against "has the file", which would flag the source
# every time.
#
# **"Serves" means the file sits under an app's `public/`.** The scan
# used to accept any HTML anywhere, which is a different question and
# gave a wrong answer the first time one was asked: the display
# prototypes in dev-docs/ *mention* vaco-design.css in a source comment
# -- truthfully, saying where their tokens came from -- and were
# reported as apps that would never receive updates. They have no
# public/ and are not served by anything. The path filter below is the
# check knowing what it is actually looking for; do not fix a case like
# that by reworking the comment that tripped it.
untracked=0
while IFS= read -r html; do
  case "$html" in */public/*) ;; *) continue ;; esac
  app="${html#./}"; app="${app%%/public/*}"
  [ "$app" = "vaco-shell" ] && continue
  printf '%s\n' "${TARGETS[@]}" | grep -qx -- "$app" && continue
  echo "  UNTRACKED $app serves vaco-design.css but is not in TARGETS --" >&2
  echo "            it will never receive design-system updates" >&2
  untracked=1
done < <(grep -rl 'vaco-design\.css' --include='*.html' --exclude-dir=node_modules . 2>/dev/null)

if [ "$untracked" = "1" ]; then
  echo "" >&2
  echo "Add the app(s) above to TARGETS in sync-design-system.sh." >&2
  exit 1
fi

if [ "$CHECK_ONLY" = "1" ]; then
  if [ "$drift" = "1" ]; then
    echo ""
    echo "Design system copies are out of date. Run ./sync-design-system.sh"
    exit 1
  fi
  echo "Design system: all copies current, and every app that serves it is a target."
else
  echo "Design system synced to ${#TARGETS[@]} apps ($copied file(s) updated)."
fi
